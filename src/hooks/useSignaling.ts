import { useState, useEffect, useRef } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { CallSession } from "../types";
import AgoraRTC, { IAgoraRTCClient, ILocalTrack } from "agora-rtc-sdk-ng";

// جلب مفتاح Agora من متغيرات البيئة في السيرفر
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;

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

  const localStreamRef = useRef<MediaStream | null>(null);
  const currentInviteIdRef = useRef<string | null>(null);
  const callStateRef = useRef(callState);

  // مراجع Agora
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracksRef = useRef<ILocalTrack[]>([]);

  const unsubscribeCallRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // دالة تنظيف وإغلاق الاتصال
  const cleanupConnection = async () => {
    try {
      if (unsubscribeCallRef.current) {
        unsubscribeCallRef.current();
        unsubscribeCallRef.current = null;
      }

      // إغلاق مسارات Agora
      if (localTracksRef.current.length > 0) {
        localTracksRef.current.forEach((track) => {
          track.stop();
          track.close();
        });
        localTracksRef.current = [];
      }

      // الخروج من غرفة Agora
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave();
        agoraClientRef.current = null;
      }

      setRemoteStream(null);
      setCallState("idle");
      setActiveCall(null);
      currentInviteIdRef.current = null;
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  };

  // دالة الانضمام لخوادم Agora وبث الفيديو
  const initAgoraAndJoin = async (channelName: string) => {
    if (!AGORA_APP_ID) {
      setError("مفتاح Agora غير متاح في السيرفر.");
      return;
    }

    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      agoraClientRef.current = client;

      const rStream = new MediaStream();
      setRemoteStream(rStream);

      // استقبال فيديو وصوت الطرف الآخر
      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === "video" && user.videoTrack) {
          rStream.addTrack(user.videoTrack.getMediaStreamTrack());
        }
        if (mediaType === "audio" && user.audioTrack) {
          rStream.addTrack(user.audioTrack.getMediaStreamTrack());
        }
        
        // تحديث الواجهة بمجرد وصول الفيديو
        setRemoteStream(new MediaStream(rStream.getTracks()));
        setCallState("connected");
      });

      // الانضمام للغرفة برقم المستخدم
      await client.join(AGORA_APP_ID, channelName, null, userId);

      // تحويل فيديو الكاميرا الحالي إلى مسارات Agora وبثها
      if (localStreamRef.current) {
        const tracks: ILocalTrack[] = [];
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        const videoTrack = localStreamRef.current.getVideoTracks()[0];

        if (audioTrack) {
          const customAudio = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioTrack });
          tracks.push(customAudio);
          localTracksRef.current.push(customAudio);
        }
        if (videoTrack) {
          const customVideo = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoTrack });
          tracks.push(customVideo);
          localTracksRef.current.push(customVideo);
        }

        if (tracks.length > 0) {
          await client.publish(tracks);
        }
      }
    } catch (err) {
      console.error("Agora Error:", err);
      setError("فشل الاتصال بخوادم البث المباشر.");
    }
  };

  // 1. الاستماع للدعوات الواردة (الرنين) عبر Firebase
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
          createdAt: data.createdAt,
        });
        setCallState("ringing-in");
      }
    });

    return () => unsubIncoming();
  }, [roomId, userId]);

  // 2. مراقبة حالة المكالمة النشطة (القبول أو الرفض)
  useEffect(() => {
    if (!activeCall?.id) return;

    const callDocRef = doc(db, "call_invites", activeCall.id);
    const unsub = onSnapshot(callDocRef, async (snapshot) => {
      if (!snapshot.exists() || snapshot.data().status === "ended" || snapshot.data().status === "rejected") {
        cleanupConnection();
        return;
      }

      const data = snapshot.data();

      // إذا قام الطرف الآخر بالقبول، يتم التأكد من تحديث الحالة لمتصل
      if (data.status === "accepted" && data.fromUserId === userId && callStateRef.current === "ringing-out") {
        setCallState("connected");
      }
    });

    unsubscribeCallRef.current = unsub;
    return () => unsub();
  }, [activeCall?.id, userId]);

  // بدء مكالمة (المتصل) - تدعم الاتصال المباشر من الواجهة
  const startCall = async (targetUserId?: string) => {
    if (!localStream) {
      setError("الرجاء تشغيل الكاميرا والصوت أولاً.");
      return;
    }
    setError(null);
    setCallState("ringing-out");

    try {
      let targetPeerId = targetUserId || "";
      let targetPeerName = "مشارك";

      // البحث عن أول شخص متاح إذا لم يتم التحديد
      if (!targetPeerId) {
        const presenceSnapshot = await getDocs(
          query(collection(db, "room_presence"), where("roomId", "==", roomId))
        );
        const otherPeers = presenceSnapshot.docs.map((d) => d.data()).filter((p) => p.userId !== userId);
        
        if (otherPeers.length > 0) {
          targetPeerId = otherPeers[0].userId;
          targetPeerName = otherPeers[0].displayName || "Participant";
        }
      }

      if (!targetPeerId) {
        setError("الطرف الآخر غير متصل");
        setCallState("idle");
        return;
      }

      const inviteId = `${roomId}_${userId}_${targetPeerId}_${Date.now()}`;
      currentInviteIdRef.current = inviteId;

      // الدخول لغرفة Agora فوراً لتقليل التأخير
      await initAgoraAndJoin(inviteId);

      const invitePayload = {
        roomId,
        fromUserId: userId,
        fromUserName: userName,
        toUserId: targetPeerId,
        status: "ringing",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "call_invites", inviteId), invitePayload);

      setActiveCall({
        id: inviteId,
        callerId: userId,
        callerName: userName,
        status: "ringing",
        createdAt: invitePayload.createdAt,
      });

    } catch (e: any) {
      setError("حدث خطأ أثناء الاتفاق.");
      setCallState("idle");
    }
  };

  // قبول المكالمة (المُستقبِل)
  const acceptCall = async () => {
    const inviteId = currentInviteIdRef.current;
    if (!inviteId) {
      setError("لا توجد تفاصيل عرض صالحة للمكالمة.");
      return;
    }
    setError(null);

    try {
      // الدخول لغرفة Agora
      await initAgoraAndJoin(inviteId);

      // إشعار الطرف الآخر بالقبول
      await updateDoc(doc(db, "call_invites", inviteId), {
        status: "accepted",
      });

      setCallState("connected");
    } catch (e: any) {
      setError("حدث خطأ أثناء قبول الاتصال المرئي.");
      setCallState("idle");
    }
  };

  // إنهاء أو رفض المكالمة
  const endCall = async () => {
    const inviteId = currentInviteIdRef.current || activeCall?.id;
    try {
      if (inviteId) {
        await updateDoc(doc(db, "call_invites", inviteId), { status: "ended" });
      }
    } catch (e) {}
    
    await cleanupConnection();
  };

  return { activeCall, remoteStream, callState, error, startCall, acceptCall, endCall };
}