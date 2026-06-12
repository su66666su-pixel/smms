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
  const unsubscribeCallRef = useRef<(() => void) | null>(null);
  const unsubscribeCallerCandidatesRef = useRef<(() => void) | null>(null);
  const unsubscribeCalleeCandidatesRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Listen for call state updates in the room
  useEffect(() => {
    if (!roomId || roomId === "default" || !userId || userId === "guest") {
      cleanupConnection();
      return;
    }

    const callDocRef = doc(db, "rooms", roomId, "calls", "active_call");

    const unsub = onSnapshot(callDocRef, async (snapshot) => {
      if (!snapshot.exists()) {
        // Call ended or not available
        if (callState !== "idle") {
          cleanupConnection();
        }
        return;
      }

      const data = snapshot.data() as CallSession;
      setActiveCall({ ...data, id: snapshot.id });

      if (data.status === "ended") {
        cleanupConnection();
        return;
      }

      // Handle callee receiving a ringing call
      if (data.status === "ringing" && data.callerId !== userId && callState === "idle") {
        setCallState("ringing-in");
      }

      // Handle caller receiving an answer from callee
      if (data.status === "active" && data.callerId === userId && callState === "ringing-out" && data.answer) {
        try {
          if (pcRef.current && pcRef.current.signalingState !== "stable") {
            const remoteDesc = new RTCSessionDescription(data.answer as RTCSessionDescriptionInit);
            await pcRef.current.setRemoteDescription(remoteDesc);
            setCallState("connected");
          }
        } catch (e: any) {
          console.error("Error setting remote description on caller:", e);
          setError("فشل الاتصال اللقائي مع المشارك الآخر.");
        }
      }
    }, (err) => {
      console.error("Signaling read error:", err);
    });

    unsubscribeCallRef.current = unsub;
    return () => {
      unsub();
      cleanupConnection();
    };
  }, [roomId, userId, callState]);

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

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      setRemoteStream(null);
      setCallState("idle");
      setActiveCall(null);
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    // Track remote stream insertion
    const rStream = new MediaStream();
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
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

  // Start a new Call as Caller
  const startCall = async () => {
    if (!localStream) {
      setError("الرجاء تشغيل الكاميرا والصوت أولاً للاتصال.");
      return;
    }
    setError(null);
    setCallState("ringing-out");

    try {
      const pc = createPeerConnection();
      const callDocRef = doc(db, "rooms", roomId, "calls", "active_call");
      const callerCandidatesCollection = collection(callDocRef, "callerCandidates");

      // Handle standard ICE candidate generation from local peer
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await addDoc(callerCandidatesCollection, event.candidate.toJSON());
        }
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const callPayload = {
        callerId: userId,
        callerName: userName,
        status: "ringing",
        offer: {
          type: offerDescription.type,
          sdp: offerDescription.sdp,
        },
        createdAt: new Date().toISOString(),
      };

      await setDoc(callDocRef, callPayload);

      // Listen for remote callee ICE candidates inside active call
      const calleeCandidatesCollection = collection(callDocRef, "calleeCandidates");
      unsubscribeCalleeCandidatesRef.current = onSnapshot(calleeCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            try {
              if (pcRef.current) {
                await pcRef.current.addIceCandidate(candidate);
              }
            } catch (e) {
              console.warn("Failed to add ICE candidate:", e);
            }
          }
        });
      });
    } catch (e: any) {
      console.error("Error creating video call:", e);
      setError("خطأ أثناء إعداد مكالمة الفيديو.");
      setCallState("idle");
    }
  };

  // Answer Incoming Call as Callee
  const acceptCall = async () => {
    if (!activeCall || !activeCall.offer) {
      setError("لا توجد تفاصيل عرض صالحة للمكالمة.");
      return;
    }
    setError(null);

    try {
      const pc = createPeerConnection();
      const callDocRef = doc(db, "rooms", roomId, "calls", "active_call");
      const calleeCandidatesCollection = collection(callDocRef, "calleeCandidates");

      // Write ICE candidates generated locally
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await addDoc(calleeCandidatesCollection, event.candidate.toJSON());
        }
      };

      // Set offer description
      const offerDesc = new RTCSessionDescription(activeCall.offer as RTCSessionDescriptionInit);
      await pc.setRemoteDescription(offerDesc);

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      // Update call node so caller knows we accepted
      await updateDoc(callDocRef, {
        answer: {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        },
        status: "active",
      });

      // Listen for caller candidates
      const callerCandidatesCollection = collection(callDocRef, "callerCandidates");
      unsubscribeCallerCandidatesRef.current = onSnapshot(callerCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            try {
              if (pcRef.current) {
                await pcRef.current.addIceCandidate(candidate);
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
    try {
      const callDocRef = doc(db, "rooms", roomId, "calls", "active_call");
      // Mark as ended or delete
      await deleteDoc(callDocRef);
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
