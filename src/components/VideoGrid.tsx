import { useState, useEffect, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { doc, setDoc, updateDoc, onSnapshot, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { CallSession } from "../types";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

export function useSignaling({ roomId, userId, userName, localStream }: { roomId: string, userId: string, userName: string, localStream: MediaStream | null }) {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<"idle" | "ringing-out" | "ringing-in" | "connected">("idle");
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracksRef = useRef<{ videoTrack: ICameraVideoTrack | null, audioTrack: IMicrophoneAudioTrack | null }>({ videoTrack: null, audioTrack: null });

  // تنظيف الاتصال
  const cleanup = async () => {
    if (clientRef.current) {
      await clientRef.current.leave();
      clientRef.current = null;
    }
    localTracksRef.current.videoTrack?.close();
    localTracksRef.current.audioTrack?.close();
    setRemoteStream(null);
    setCallState("idle");
    setActiveCall(null);
  };

  // الانضمام لـ Agora
  const joinAgoraChannel = async (channel: string) => {
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "video" && user.videoTrack) {
        const stream = new MediaStream([user.videoTrack.getMediaStreamTrack()]);
        setRemoteStream(stream);
      }
    });

    await client.join(APP_ID, channel, null, userId);
    
    // نشر مساراتنا
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    const videoTrack = await AgoraRTC.createCameraVideoTrack();
    localTracksRef.current = { audioTrack, videoTrack };
    await client.publish([audioTrack, videoTrack]);
  };

  // استلام الدعوات (Firebase)
  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, "call_invites"), where("roomId", "==", roomId), where("toUserId", "==", userId), where("status", "==", "ringing"));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setActiveCall({ id: snap.docs[0].id, callerId: data.fromUserId, callerName: data.fromUserName, status: "ringing", createdAt: data.createdAt });
        setCallState("ringing-in");
      }
    });
    return () => unsub();
  }, [roomId, userId]);

  const startCall = async (targetId?: string) => {
    setCallState("ringing-out");
    const channelId = `call_${roomId}_${Date.now()}`;
    await joinAgoraChannel(channelId);
    
    await setDoc(doc(db, "call_invites", channelId), {
      roomId, fromUserId: userId, fromUserName: userName, toUserId: targetId, status: "ringing", createdAt: new Date().toISOString()
    });
    setActiveCall({ id: channelId, callerId: userId, callerName: userName, status: "ringing", createdAt: new Date().toISOString() });
  };

  const acceptCall = async () => {
    if (activeCall) {
      await joinAgoraChannel(activeCall.id);
      await updateDoc(doc(db, "call_invites", activeCall.id), { status: "accepted" });
      setCallState("connected");
    }
  };

  return { activeCall, remoteStream, callState, error, startCall, acceptCall, endCall: cleanup };
}