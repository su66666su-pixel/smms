import React, { useEffect, useRef } from "react";
import { Phone, Video, Mic, MicOff, VideoOff, Monitor } from "lucide-react";

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onStartCall: (targetUid?: string) => void;
  onAcceptCall: () => void;
  onEndCall: () => void;
  callState: "idle" | "ringing-out" | "ringing-in" | "connected";
  nickname: string;
  t: (key: string) => string;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onStartCall,
  onAcceptCall,
  onEndCall,
  callState,
  nickname,
  t
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // تشغيل فيديو الطرف الآخر (Agora)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }
  }, [remoteStream]);

  // تشغيل الفيديو المحلي
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      {/* مشغل فيديو الطرف الآخر */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
        {remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold">{nickname.charAt(0)}</span>
            </div>
            <p className="text-sm">{callState === "ringing-out" ? t("callingLabel") : t("noActiveCallLabel")}</p>
            
            {callState === "ringing-in" && (
              <button onClick={onAcceptCall} className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">
                {t("acceptCallBtn")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* مشغل الفيديو المحلي */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        
        {/* شريط التحكم */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-3 bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10">
          <button onClick={onToggleMute} className="p-2 hover:bg-white/20 rounded-full">
            {isMuted ? <MicOff className="w-5 h-5 text-red-500" /> : <Mic className="w-5 h-5 text-white" />}
          </button>
          <button onClick={onToggleVideo} className="p-2 hover:bg-white/20 rounded-full">
            {isVideoOff ? <VideoOff className="w-5 h-5 text-red-500" /> : <Video className="w-5 h-5 text-white" />}
          </button>
          <button onClick={onEndCall} className="p-2 bg-red-600 hover:bg-red-500 rounded-full">
            <Phone className="w-5 h-5 text-white rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
};