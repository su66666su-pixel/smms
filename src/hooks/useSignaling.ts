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

// دالة لتطهير اسم القناة ليكون متوافقاً مع شروط Agora (الأحرف المسموحة، الطول الأقصى 64 بايت، وتجنب الحروف العربية)
function sanitizeChannelName(name: string): string {
  let hash1 = 5381;
  let hash2 = 8903;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 7) + hash2) ^ char;
  }
  const part1 = Math.abs(hash1).toString(36);
  const part2 = Math.abs(hash2).toString(36);
  
  // الاحتفاظ بالأحرف اللاتينية والأرقام والشرطات فقط
  const safeLetters = name.replace(/[^a-zA-Z0-9_-]/g, "");
  const prefix = safeLetters.slice(0, 30);
  
  const combined = `${prefix}_${part1}${part2}`;
  return combined.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, "x");
}

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
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const currentInviteIdRef = useRef<string | null>(null);
  const callStateRef = useRef(callState);

  // Sync localStream prop into the ref
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // مراجع Agora
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracksRef = useRef<ILocalTrack[]>([]);

  const unsubscribeCallRef = useRef<(() => void) | null>(null);

 useEffect(() => {
  if (!roomId || !userId) return;

  // استعلام ذكي يبحث عن أي دعوة موجهة لي في هذه الغرفة
  const q = query(
    collection(db, "call_invites"),
    where("roomId", "==", roomId),
    where("toUserId", "==", userId)
  );

  const unsub = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" || change.type === "modified") {
        const data = change.doc.data();
        
        // إذا كانت حالة الدعوة "ringing" ولم نقم بالرد بعد
        if (data.status === "ringing" && callStateRef.current === "idle") {
          console.log("🔔 وصلت دعوة اتصال من:", data.fromUserName);
          currentInviteIdRef.current = change.doc.id;
          setActiveCall({
            id: change.doc.id,
            callerId: data.fromUserId,
            callerName: data.fromUserName,
            status: "ringing",
            createdAt: data.createdAt
          });
          const ringtone = new Audio("/ringtone.mp3");
          ringtone.loop = true;
          ringtone.play().catch(e => console.warn("Failed to play ringtone:", e));
          (window as any).__ringtone = ringtone;
          setCallState("ringing-in");
        }
      }
    });
  }, (error) => {
    console.warn("Error listening to call invites query:", error);
  });

  return () => unsub();
}, [roomId, userId]);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // دالة تنظيف وإغلاق الاتصال
  const cleanupConnection = async () => {
    if ((window as any).__ringtone) {
      try {
        (window as any).__ringtone.pause();
      } catch (e) {
        console.warn("Failed to pause ringtone:", e);
      }
    }
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

      remoteStreamRef.current = null;
      setRemoteStream(null);
      setCallState("idle");
      setActiveCall(null);
      currentInviteIdRef.current = null;
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  };

  // دالة الانضمام لخوادم Agora وبث الفيديو
  const initAgoraAndJoin = async (rawChannelName: string) => {
    const channelName = sanitizeChannelName(rawChannelName);

    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      agoraClientRef.current = client;

      const rStream = new MediaStream();
      remoteStreamRef.current = rStream;
      setRemoteStream(rStream);

      // استقبال فيديو وصوت الطرف الآخر
      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        // شرط صارم: لا تفتح ملفات أو مسارات الفيديو إلا من بقية المشاركين
        if (user.uid !== userId) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }

          if (mediaType === "video" && user.videoTrack) {
            // إزالة أي مسارات فيديو سابقة لمنع التكرار
            remoteStreamRef.current.getVideoTracks().forEach(t => remoteStreamRef.current?.removeTrack(t));
            remoteStreamRef.current.addTrack(user.videoTrack.getMediaStreamTrack());
            
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
            setCallState("connected");
          } else if (mediaType === "audio" && user.audioTrack) {
            user.audioTrack.play();
            // إزالة أي مسارات صوتية سابقة لمنع التكرار
            remoteStreamRef.current.getAudioTracks().forEach(t => remoteStreamRef.current?.removeTrack(t));
            remoteStreamRef.current.addTrack(user.audioTrack.getMediaStreamTrack());
            
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
            setCallState("connected");
          }
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (remoteStreamRef.current) {
          remoteStreamRef.current.getVideoTracks().forEach(t => remoteStreamRef.current?.removeTrack(t));
        }
        setRemoteStream(
          new MediaStream(
            remoteStreamRef.current?.getAudioTracks() || []
          )
        );
      });

      // جلب الرمز الديناميكي ومفتاح التطبيق من خادم snns.pro
      let token: string | null = null;
      let appIdToUse = AGORA_APP_ID;

      try {
        const response = await fetch(
          `http://snns.pro/api/agora/token?channel=${channelName}&uid=${userId}`
        );
        if (response.ok) {
          const data = await response.json();
          token = data.token;
          if (data.appId) {
            appIdToUse = data.appId;
          }
        } else {
          console.warn("Failed to fetch token from snns.pro, attempting local backend fallback...");
          const resLocal = await fetch("/api/agora/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ channelName, userId }),
          });
          if (resLocal.ok) {
            const dataLocal = await resLocal.json();
            token = dataLocal.token;
          }
        }
      } catch (err) {
        console.warn("Network error during Agora token fetch, trying local route:", err);
        try {
          const resLocal = await fetch("/api/agora/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ channelName, userId }),
          });
          if (resLocal.ok) {
            const dataLocal = await resLocal.json();
            token = dataLocal.token;
          }
        } catch (innerErr) {
          console.error("All token retrieval fallbacks failed:", innerErr);
        }
      }

      if (!appIdToUse || !token) {
        throw new Error("Agora token unavailable");
      }

      const finalAppId = appIdToUse;

      // الانضمام للغرفة برقم المستخدم والمصادقة المكتشفة ديناميكياً
      await client.join(
        finalAppId,
        channelName,
        token || null,
        String(userId)
      );

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
        const ringtone = new Audio("/ringtone.mp3");
        ringtone.loop = true;
        ringtone.play().catch(e => console.warn("Failed to play ringtone:", e));
        (window as any).__ringtone = ringtone;
        setCallState("ringing-in");
      }
    }, (error) => {
      console.warn("Error listening to incoming call invites:", error);
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
    }, (error) => {
      console.warn("Error listening to active call session status:", error);
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
    if ((window as any).__ringtone) {
      try {
        (window as any).__ringtone.pause();
      } catch (e) {
        console.warn("Failed to pause ringtone:", e);
      }
    }
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
    if ((window as any).__ringtone) {
      try {
        (window as any).__ringtone.pause();
      } catch (e) {
        console.warn("Failed to pause ringtone:", e);
      }
    }
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