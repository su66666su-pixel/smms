import { useState, useEffect, useRef } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { CallSession } from "../types";

const configuration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
    {
      urls: "turn:YOUR_DOMAIN:3478",
      username: "user",
      credential: "password"
    }
  ],
};

interface UseSignalingProps {
  roomId: string;
  userId: string;
  userName: string;
  localStream: MediaStream | null;
}

export function useSignaling({ roomId, userId, userName, localStream }: UseSignalingProps) {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<"idle" | "ringing-out" | "ringing-in" | "connected">("idle");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentInviteIdRef = useRef<string | null>(null);
  const callStateRef = useRef(callState);

  const unsubscribeCallRef = useRef<(() => void) | null>(null);
  const unsubscribeCallerCandidatesRef = useRef<(() => void) | null>(null);
  const unsubscribeCalleeCandidatesRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Clean up WebRTC resources and active channels
  const cleanupConnection = () => {
    try {
      if (unsubscribeCallerCandidatesRef.current) {
        unsubscribeCallerCandidatesRef.current();
        unsubscribeCallerCandidatesRef.current = null;
      }
      if (unsubscribeCalleeCandidatesRef.current) {
        unsubscribeCalleeCandidatesRef.current();
        unsubscribeCalleeCandidatesRef.current = null;
      }
      if (unsubscribeCallRef.current) {
        unsubscribeCallRef.current();
        unsubscribeCallRef.current = null;
      }

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      setRemoteStream(null);
      setCallState("idle");
      setActiveCall(null);
      currentInviteIdRef.current = null;
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  };

  // Helper: Create peer connection and bind standard event listeners
  const createPeerConnection = (inviteId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    // Monitor WebRTC connection states
    pc.onconnectionstatechange = () => {
      console.log("WebRTC Connection State:", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("peer connected");
        setCallState("connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setError("فشل WebRTC ICE / يحتاج TURN server");
        console.error("WebRTC Connection Failed");
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("WebRTC ICE Connection State:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        console.log("peer connected");
        setCallState("connected");
      } else if (pc.iceConnectionState === "failed") {
        setError("فشل WebRTC ICE");
        console.error("WebRTC ICE Connection Failed");
      }
    };

    // Track remote stream insertions
    const rStream = new MediaStream();
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
      console.log("WebRTC: Remote track received");
      event.streams[0].getTracks().forEach((track) => {
        rStream.addTrack(track);
      });
    };

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  };

  // 1. Listen for call invites directed to current user
  useEffect(() => {
    if (!roomId || roomId === "default" || !userId || userId === "guest") {
      cleanupConnection();
      return;
    }

    // Realtime queries for ringing call invites addressed to current user
    const q = query(
      collection(db, "call_invites"),
      where("roomId", "==", roomId),
      where("toUserId", "==", userId),
      where("status", "==", "ringing")
    );

    const unsubIncoming = onSnapshot(q, (snapshot) => {
      if (callStateRef.current !== "idle") return; // active call takes preference

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        console.log("call invite received"); // Log as requested in step 9

        currentInviteIdRef.current = docSnap.id;
        setActiveCall({
          id: docSnap.id,
          callerId: data.fromUserId,
          callerName: data.fromUserName,
          status: "ringing",
          offer: data.offer,
          createdAt: data.createdAt,
        });
        setCallState("ringing-in");
      }
    });

    return () => {
      unsubIncoming();
    };
  }, [roomId, userId]);

  // 2. Realtime updates listener for the active call invitation document
  useEffect(() => {
    if (!activeCall?.id) return;

    const callDocRef = doc(db, "call_invites", activeCall.id);
    const unsub = onSnapshot(callDocRef, async (snapshot) => {
      if (!snapshot.exists()) {
        if (callStateRef.current !== "idle") {
          console.log("Call invitation doc deleted, cleaning up...");
          cleanupConnection();
        }
        return;
      }

      const data = snapshot.data();

      if (data.status === "ended") {
        console.log("Call ended by peer, cleaning up...");
        cleanupConnection();
        return;
      }

      // If caller is in ringing-out and receives Callee's accepted response with answer
      if (data.status === "accepted" && data.fromUserId === userId && callStateRef.current === "ringing-out" && data.answer) {
        console.log("answer received"); // Log as requested in step 9
        try {
          if (pcRef.current) {
            const remoteDesc = new RTCSessionDescription(data.answer);
            await pcRef.current.setRemoteDescription(remoteDesc);
            setCallState("connected");
          }
        } catch (e: any) {
          console.error("Error setting remote description on caller:", e);
          setError("فشل WebRTC ICE");
        }
      }
    }, (err) => {
      console.error("Error watching invitation state:", err);
    });

    unsubscribeCallRef.current = unsub;
    return () => {
      unsub();
    };
  }, [activeCall?.id, userId]);

  // Start a new Call as Caller and direct it to the target user
  const startCall = async () => {
    if (!localStream) {
      setError("الرجاء تشغيل الكاميرا والصوت أولاً للاتصال.");
      return;
    }
    setError(null);
    setCallState("ringing-out");

    try {
      // Find the recipient from room_presence
      const presenceSnapshot = await getDocs(
        query(
          collection(db, "room_presence"),
          where("roomId", "==", roomId),
          where("isOnline", "==", true)
        )
      );

      const otherPeers = presenceSnapshot.docs
        .map((d) => d.data())
        .filter((p) => p.userId !== userId);

      let targetPeerId = "";
      let targetPeerName = "";

      if (otherPeers.length > 0) {
        targetPeerId = otherPeers[0].userId;
        targetPeerName = otherPeers[0].displayName || otherPeers[0].name || "Participant";
      } else {
        // Robust fallback to participants subcollection
        const participantsSnapshot = await getDocs(collection(db, "rooms", roomId, "participants"));
        const otherParticipants = participantsSnapshot.docs
          .map((d) => d.data())
          .filter((p) => p.uid !== userId);

        if (otherParticipants.length > 0) {
          targetPeerId = otherParticipants[0].uid;
          targetPeerName = otherParticipants[0].name || "Participant";
        }
      }

      // If no other participant is found, set error as requested in step 10
      if (!targetPeerId) {
        setError("الطرف الآخر غير متصل");
        setCallState("idle");
        return;
      }

      // Create random ID for invitation doc
      const inviteId = `${roomId}_${userId}_${targetPeerId}_${Date.now()}`;
      currentInviteIdRef.current = inviteId;

      const pc = createPeerConnection(inviteId);

      // Handle sending local ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await addDoc(
              collection(db, "call_invites", inviteId, "callerCandidates"),
              event.candidate.toJSON()
            );
            console.log("ice candidate sent"); // Log as requested in step 9
          } catch (e) {
            console.error("Failed to upload caller candidate:", e);
          }
        }
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const invitePayload = {
        roomId,
        fromUserId: userId,
        fromUserName: userName,
        toUserId: targetPeerId,
        status: "ringing",
        offer: {
          type: offerDescription.type,
          sdp: offerDescription.sdp,
        },
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "call_invites", inviteId), invitePayload);
      console.log("call invite sent"); // Log as requested in step 9
      console.log("offer sent"); // Log as requested in step 9

      setActiveCall({
        id: inviteId,
        callerId: userId,
        callerName: userName,
        status: "ringing",
        offer: invitePayload.offer,
        createdAt: invitePayload.createdAt,
      });

      // Listen for remote callee ICE candidates
      const calleeCandidatesCollection = collection(db, "call_invites", inviteId, "calleeCandidates");
      unsubscribeCalleeCandidatesRef.current = onSnapshot(calleeCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            try {
              if (pcRef.current) {
                await pcRef.current.addIceCandidate(candidate);
                console.log("ice candidate received"); // Log as requested in step 9
              }
            } catch (e) {
              console.warn("Failed to add ICE candidate:", e);
            }
          }
        });
      });

    } catch (e: any) {
      console.error("Error creating video call:", e);
      setError("حدث خطأ أثناء الاتفاق.");
      setCallState("idle");
    }
  };

  // Answer Incoming Call as Callee
  const acceptCall = async () => {
    const inviteId = currentInviteIdRef.current;
    if (!activeCall || !activeCall.offer || !inviteId) {
      setError("لا توجد تفاصيل عرض صالحة للمكالمة.");
      return;
    }
    setError(null);

    try {
      const pc = createPeerConnection(inviteId);

      // Handle sending local ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await addDoc(
              collection(db, "call_invites", inviteId, "calleeCandidates"),
              event.candidate.toJSON()
            );
            console.log("ice candidate sent"); // Log as requested in step 9
          } catch (e) {
            console.error("Failed to upload callee candidate:", e);
          }
        }
      };

      // Set offer description (remote) and create answer (local)
      const offerDesc = new RTCSessionDescription(activeCall.offer as RTCSessionDescriptionInit);
      await pc.setRemoteDescription(offerDesc);

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      // Update the invite document so caller knows we accepted
      await updateDoc(doc(db, "call_invites", inviteId), {
        status: "accepted",
        answer: {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        },
      });

      // Listen for caller's ICE candidates
      const callerCandidatesCollection = collection(db, "call_invites", inviteId, "callerCandidates");
      unsubscribeCallerCandidatesRef.current = onSnapshot(callerCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            try {
              if (pcRef.current) {
                await pcRef.current.addIceCandidate(candidate);
                console.log("ice candidate received"); // Log as requested in step 9
              }
            } catch (e) {
              console.warn("Failed to add ICE candidate:", e);
            }
          }
        });
      });

      setCallState("connected");
    } catch (e: any) {
      console.error("Error accepting call:", e);
      setError("حدث خطأ أثناء قبول الاتصال المرئي.");
      setCallState("idle");
    }
  };

  // Decline/End Call for both caller and callee
  const endCall = async () => {
    const inviteId = currentInviteIdRef.current || activeCall?.id;
    try {
      if (inviteId) {
        const callDocRef = doc(db, "call_invites", inviteId);
        await updateDoc(callDocRef, { status: "ended" });
        // Optionally clean up the doc completely
        await deleteDoc(callDocRef);
      }
    } catch (e) {
      console.error("Error ending signaling session:", e);
    }
    cleanupConnection();
  };

  return {
    activeCall,
    remoteStream,
    callState,
    error,
    startCall,
    acceptCall,
    endCall,
  };
}
