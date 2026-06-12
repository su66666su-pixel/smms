import React, { useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  Tv,
  Share2,
  Copy,
  Check,
  Award,
} from "lucide-react";
import { motion } from "motion/react";
import { CallSession } from "../types";

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  // Signaling props
  activeCall: CallSession | null;
  callState: "idle" | "ringing-out" | "ringing-in" | "connected";
  onStartCall: () => void;
  onAcceptCall: () => void;
  onEndCall: () => void;
  nickname: string;
  roomTitle: string;
}

export function VideoGrid({
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  activeCall,
  callState,
  onStartCall,
  onAcceptCall,
  onEndCall,
  nickname,
  roomTitle,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Bind local stream object to HTMLVideoElement
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream object to HTMLVideoElement
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const copyRoomLink = () => {
    const link = `${window.location.origin}${window.location.pathname}#room-${encodeURIComponent(roomTitle)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top Bar Detail Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-right">
            <h4 className="text-sm font-bold text-slate-855 text-slate-800">{roomTitle}</h4>
            <p className="text-xxs text-slate-400 font-mono mt-0.5">معرف الغرفة المفتوع للجميع</p>
          </div>
        </div>
        
        {/* Copy share link button */}
        <button
          onClick={copyRoomLink}
          className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-xs px-4 py-2 rounded-xl hover:bg-blue-100/60 transition-all font-semibold active:scale-95 shadow-sm"
          title="افتح مشاركة الرابط"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              تم نسخ الرابط!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              انسخ بريد/رابط الدعوة اللحظي
            </>
          )}
        </button>
      </div>

      {/* Main Video Camera Workspace */}
      <div className="flex-1 min-h-[350px] relative grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Stream Window */}
        <div className="bg-slate-900 border border-slate-800/40 rounded-2xl overflow-hidden relative group shadow-md flex items-center justify-center">
          {isVideoOff ? (
            <div className="text-center p-4 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400">
                <VideoOff className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">كاميراتك مغلقة الآن</p>
                <p className="text-2xs text-slate-400 mt-1">انقر على زر الكاميرا بالأسفل لاستئناف العرض</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-3 left-3 bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1 rounded-full text-xxs font-mono text-indigo-300">
                IP-RTC
              </div>
            </>
          )}

          {/* Floating User Info overlay */}
          <div className="absolute bottom-4 right-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800/50 rounded-xl p-2.5 px-3.5 flex items-center justify-between z-10 shadow-lg">
            <span className="text-xs font-bold text-white shrink-0">{nickname} (أنت)</span>
            <div className="flex gap-1.5">
              {isMuted && (
                <span className="p-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30">
                  <MicOff className="w-3 h-3" />
                </span>
              )}
              {isScreenSharing && (
                <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Tv className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Remote Stream Window */}
        <div className="bg-slate-900 border border-slate-800/40 rounded-2xl overflow-hidden relative group shadow-md flex items-center justify-center">
          {callState === "connected" && remoteStream ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full text-xxs font-mono text-emerald-300 animate-pulse">
                LIVE HD
              </div>
              <div className="absolute bottom-4 right-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800/50 rounded-xl p-2.5 px-3.5 flex items-center justify-between z-10 shadow-lg">
                <span className="text-xs font-bold text-white">
                  {activeCall ? (activeCall.callerId === localStream?.id ? "الطرف الآخر" : activeCall.callerName) : "الطرف الآخر"}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center p-6 flex flex-col items-center gap-4">
              {callState === "ringing-out" ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
                    <Phone className="w-8 h-8 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-450 text-blue-400 animate-pulse">جاري الرنين والاتصال حالياً...</p>
                    <p className="text-2xs text-slate-400 mt-1">بانتظار قبول الطرف الآخر للدخول المباشر</p>
                  </div>
                  <button
                    onClick={onEndCall}
                    className="mt-2 bg-red-650/15 hover:bg-red-650/20 border border-red-500/30 text-red-350 text-red-400 text-xs px-4 py-2 rounded-xl transition-all font-semibold"
                  >
                    إلغاء الاتصال
                  </button>
                </>
              ) : callState === "ringing-in" ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-550/15 border border-emerald-500/30 flex items-center justify-center text-emerald-405 text-emerald-400 animate-ping">
                    <Phone className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-400">مكالمة واردة من: {activeCall?.callerName}</p>
                    <p className="text-2xs text-slate-400 mt-1">يريد الطرف الآخر القيام باتصال مرئي معكم الآن</p>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={onAcceptCall}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md"
                    >
                      قبول والرد
                    </button>
                    <button
                      onClick={onEndCall}
                      className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-semibold text-xs px-5 py-2.5 rounded-xl transition-all"
                    >
                      رفض
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
                    <PhoneOff className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-350 text-slate-400">لا يوجد اتصال مرئي نشط الآن</p>
                    <p className="text-2xs text-slate-500 mt-1">ابدأ اتصالاً مرئياً مباشراً في الغرفة لدعوة الآخرين</p>
                  </div>
                  <button
                    onClick={onStartCall}
                    className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors shadow-md"
                  >
                    بدء بث واتصال مرئي بقوة WebRTC
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Call Floating Action Overlays Controls / Dashboard */}
      <div className="bg-[#172033] border border-slate-700 rounded-2xl p-4 flex justify-center items-center gap-4 shadow-lg">
        {/* Toggle Muted state */}
        <button
          onClick={onToggleMute}
          className={`p-3.5 rounded-xl border transition-all ${
            isMuted
              ? "bg-red-600/30 border-red-500/40 text-red-400"
              : "bg-[#0b0f19] border-slate-700 text-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
          title={isMuted ? "إلغاء كتم الصوت" : "كتم المايكرفون"}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video state */}
        <button
          onClick={onToggleVideo}
          className={`p-3.5 rounded-xl border transition-all ${
            isVideoOff
              ? "bg-red-600/30 border-red-500/40 text-red-400"
              : "bg-[#0b0f19] border-slate-700 text-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
          title={isVideoOff ? "تشغيل الكاميرا" : "إيقاف الكاميرا"}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen sharing button */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3.5 rounded-xl border transition-all ${
            isScreenSharing
              ? "bg-indigo-650/40 border-indigo-500/40 text-indigo-300"
              : "bg-[#0b0f19] border-slate-700 text-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
          title={isScreenSharing ? "المشاركة الحالية نشطة" : "مشاركة الشاشة بالكامل"}
        >
          <Tv className="w-5 h-5" />
        </button>

        {/* Separation vertical line */}
        <div className="w-[1px] h-8 bg-slate-700" />

        {/* Red emergency drop call button */}
        {callState !== "idle" && (
          <button
            onClick={onEndCall}
            className="p-3.5 rounded-xl bg-red-650 hover:bg-red-700 text-white font-bold transition-all shadow-md flex items-center justify-center gap-2"
            title="إنهاء وإغلاق مكالمة الفيديو"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline text-xs mt-0.5">إنهاء الاتصال</span>
          </button>
        )}
      </div>
    </div>
  );
}
