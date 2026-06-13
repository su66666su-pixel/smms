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
    }
    // ملاحظة: تم تعطيل خادم TURN الوهمي مؤقتاً لتجنب فشل الاتصال التلقائي
    // سيتم إضافته لاحقاً عند تجهيز خادم TURN حقيقي لضمان عمل التطبيق على شبكات 5G
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

  const createPeerConnection = (inviteId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      console.log("WebRTC Connection State:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setError("تحتاج إلى خادم TURN لتجاوز جدار الحماية للشبكة الحالية");
      }
    };

    const rStream = new MediaStream();
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
      console.log("WebRTC: Remote track received successfully");
      event.streams[0].getTracks().forEach((track) => {
        rStream.addTrack(track);
      });
      // تحديث الحالة لضمان إعادة تصيير الواجهة عند استلام الفيديو
      setRemoteStream(new MediaStream(rStream.getTracks()));
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  };

  // 1. الاستماع للدعوات الواردة
  useEffect(() => {
    if (!roomId || roomId === "default" || !userId || userId === "guest") {
      cleanupConnection();
      return;
    }

    const q = query(
      collection(db, "call_invites"),
      where("roomId", "==", roomId),
      where("toUserId", "==", userId),
      where("status", "==", "ringing")
    );

    const unsubIncoming = onSnapshot(q, (snapshot) => {
      if (callStateRef.current !== "idle") return;

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

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

    return () => unsubIncoming();
  }, [roomId, userId]);

  // 2. مراقبة حالة المكالمة النشطة (تم إصلاح الفخ البرمجي هنا)
  useEffect(() => {
    if (!activeCall?.id) return;

    const callDocRef = doc(db, "call_invites", activeCall.id);
    const unsub = onSnapshot(callDocRef, async (snapshot) => {
      if (!snapshot.exists() || snapshot.data().status === "ended") {
        cleanupConnection();
        return;
      }

      const data = snapshot.data();

      // عندما يستلم المتصل الإجابة (Answer)
      if (data.status === "accepted" && data.fromUserId === userId && callStateRef.current === "ringing-out" && data.answer) {
        try {
          if (pcRef.current) {
            const remoteDesc = new RTCSessionDescription(data.answer);
            await pcRef.current.setRemoteDescription(remoteDesc);
            setCallState("connected");

            // الإصلاح: نبدأ الاستماع لـ ICE Candidates للطرف الآخر *فقط* بعد تركيب الـ Answer
            const calleeCandidatesCollection = collection(db, "call_invites", activeCall.id, "calleeCandidates");
            unsubscribeCalleeCandidatesRef.current = onSnapshot(calleeCandidatesCollection, (snap) => {
              snap.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                  const candidateData = change.doc.data();
                  try {
                    await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidateData));
                  } catch (e) {
                    console.warn("Failed to add ICE candidate:", e);
                  }
                }
              });
            });
          }
        } catch (e: any) {
          setError("فشل في مزامنة بيانات الاتصال.");
        }
      }
    });

    unsubscribeCallRef.current = unsub;
    return () => unsub();
  }, [activeCall?.id, userId]);

  // بدء مكالمة (المتصل)
  const startCall = async () => {
    if (!localStream) {
      setError("الرجاء تشغيل الكاميرا والصوت أولاً.");
      return;
    }
    setError(null);
    setCallState("ringing-out");

    try {
      const presenceSnapshot = await getDocs(
        query(collection(db, "room_presence"), where("roomId", "==", roomId), where("isOnline", "==", true))
      );

      const otherPeers = presenceSnapshot.docs.map((d) => d.data()).filter((p) => p.userId !== userId);

      let targetPeerId = "";
      let targetPeerName = "";

      if (otherPeers.length > 0) {
        targetPeerId = otherPeers[0].userId;
        targetPeerName = otherPeers[0].displayName || otherPeers[0].name || "Participant";
      } else {
        const participantsSnapshot = await getDocs(collection(db, "rooms", roomId, "participants"));
        const otherParticipants = participantsSnapshot.docs.map((d) => d.data()).filter((p) => p.uid !== userId);

        if (otherParticipants.length > 0) {
          targetPeerId = otherParticipants[0].uid;
          targetPeerName = otherParticipants[0].name || "Participant";
        }
      }

      if (!targetPeerId) {
        setError("الطرف الآخر غير متصل");
        setCallState("idle");
        return;
      }

      const inviteId = `${roomId}_${userId}_${targetPeerId}_${Date.now()}`;
      currentInviteIdRef.current = inviteId;

      const pc = createPeerConnection(inviteId);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await addDoc(collection(db, "call_invites", inviteId, "callerCandidates"), event.candidate.toJSON());
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
        offer: { type: offerDescription.type, sdp: offerDescription.sdp },
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "call_invites", inviteId), invitePayload);

      setActiveCall({
        id: inviteId,
        callerId: userId,
        callerName: userName,
        status: "ringing",
        offer: invitePayload.offer,
        createdAt: invitePayload.createdAt,
      });

      // تم نقل الاستماع لـ Callee Candidates إلى useEffect لضمان الترتيب الصحيح

    } catch (e: any) {
      setError("حدث خطأ أثناء الاتفاق.");
      setCallState("idle");
    }
  };

  // قبول المكالمة (المُستقبِل)
  const acceptCall = async () => {
    const inviteId = currentInviteIdRef.current;
    if (!activeCall || !activeCall.offer || !inviteId) {
      setError("لا توجد تفاصيل عرض صالحة للمكالمة.");
      return;
    }
    setError(null);

    try {
      const pc = createPeerConnection(inviteId);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await addDoc(collection(db, "call_invites", inviteId, "calleeCandidates"), event.candidate.toJSON());
          } catch (e) {
            console.error("Failed to upload callee candidate:", e);
          }
        }
      };

      const offerDesc = new RTCSessionDescription(activeCall.offer as RTCSessionDescriptionInit);
      await pc.setRemoteDescription(offerDesc);

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      await updateDoc(doc(db, "call_invites", inviteId), {
        status: "accepted",
        answer: { type: answerDescription.type, sdp: answerDescription.sdp },
      });

      const callerCandidatesCollection = collection(db, "call_invites", inviteId, "callerCandidates");
      unsubscribeCallerCandidatesRef.current = onSnapshot(callerCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            try {
              await pcRef.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            } catch (e) {
              console.warn("Failed to add ICE candidate:", e);
            }
          }
        });
      });

      setCallState("connected");
    } catch (e: any) {
      setError("حدث خطأ أثناء قبول الاتصال المرئي.");
      setCallState("idle");
    }
  };

  const endCall = async () => {
    const inviteId = currentInviteIdRef.current || activeCall?.id;
    try {
      if (inviteId) {
        await updateDoc(doc(db, "call_invites", inviteId), { status: "ended" });
      }
    } catch (e) {}
    cleanupConnection();
  };

  return { activeCall, remoteStream, callState, error, startCall, acceptCall, endCall };
}