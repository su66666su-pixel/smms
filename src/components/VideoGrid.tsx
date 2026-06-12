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
  t: (key: string, replacements?: Record<string, string | number>) => string;
  lang: string;
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
  t,
  lang,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  const isRtl = lang === "ar" || lang === "ur";

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
    <div className={`flex flex-col gap-4 h-full ${isRtl ? "text-right" : "text-left"}`}>
      {/* Top Bar Detail Card */}
      <div className={`bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h4 className="text-sm font-bold text-slate-800">{roomTitle}</h4>
            <p className="text-xxs text-slate-400 font-mono mt-0.5">{t("roomSubheadingOpen")}</p>
          </div>
        </div>
        
        {/* Copy share link button */}
        <button
          onClick={copyRoomLink}
          className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-xs px-4 py-2 rounded-xl hover:bg-blue-105 transition-all font-semibold active:scale-95 shadow-sm cursor-pointer"
          title={lang === "ar" ? "افتح مشاركة الرابط" : "Copy shareable meeting link"}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-600 font-bold" />
              {t("linkCopiedGrid")}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              {t("copyInviteGridBtn")}
            </>
          )}
        </button>
      </div>

      {/* Main Video Camera Workspace */}
      <div className="flex-1 min-h-[350px] relative grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Stream Window */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative group shadow-md flex items-center justify-center">
          {isVideoOff ? (
            <div className="text-center p-4 flex flex-col items-center gap-3 font-sans">
              <div className="w-16 h-16 rounded-full bg-red-950/45 border border-red-500/30 flex items-center justify-center text-red-400">
                <VideoOff className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-205 text-white">{t("camDisabledTitle")}</p>
                <p className="text-2xs text-slate-400 mt-1">{t("camDisabledDesc")}</p>
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
          <div className="absolute bottom-4 right-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-850 rounded-xl p-2.5 px-3.5 flex items-center justify-between z-10 shadow-lg" dir={isRtl ? "rtl" : "ltr"}>
            <span className="text-xs font-bold text-white shrink-0">{nickname} ({t("badgeYou")})</span>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative group shadow-md flex items-center justify-center">
          {callState === "connected" && remoteStream ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-1 rounded-full text-xxs font-mono text-emerald-300 animate-pulse">
                LIVE HD
              </div>
              <div className="absolute bottom-4 right-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-850 rounded-xl p-2.5 px-3.5 flex items-center justify-between z-10 shadow-lg">
                <span className="text-xs font-bold text-white">
                  {activeCall ? (activeCall.callerId === localStream?.id ? t("remoteParticipantLabel") : activeCall.callerName) : t("remoteParticipantLabel")}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center p-6 flex flex-col items-center gap-4 font-sans max-w-sm">
              {callState === "ringing-out" ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
                    <Phone className="w-8 h-8 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-400 animate-pulse">{t("ringingCallTitle")}</p>
                    <p className="text-2xs text-slate-400 mt-1">{t("ringingCallDesc")}</p>
                  </div>
                  <button
                    onClick={onEndCall}
                    className="mt-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-xs px-4 py-2 rounded-xl transition-all font-semibold cursor-pointer"
                  >
                    {t("cancelCallBtn")}
                  </button>
                </>
              ) : callState === "ringing-in" ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-ping">
                    <Phone className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-450 text-emerald-500">{t("incomingCallFrom", { caller: activeCall?.callerName || "" })}</p>
                    <p className="text-2xs text-slate-400 mt-1">{t("incomingCallDesc")}</p>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={onAcceptCall}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      {t("acceptCallBtn")}
                    </button>
                    <button
                      onClick={onEndCall}
                      className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      {t("rejectBtn")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-650">
                    <PhoneOff className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-300">{t("noActiveCallTitle")}</p>
                    <p className="text-2xs text-slate-400 mt-1">{t("noActiveCallDesc")}</p>
                  </div>
                  <button
                    onClick={onStartCall}
                    className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors shadow-md cursor-pointer"
                  >
                    {t("startWebRtcCallBtn")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Call Floating Action Overlays Controls / Dashboard */}
      <div className="bg-[#172033] border border-slate-700 rounded-2xl p-4 flex justify-center items-center gap-4 shadow-lg shrink-0">
        {/* Toggle Muted state */}
        <button
          onClick={onToggleMute}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            isMuted
              ? "bg-red-600/30 border-red-500/40 text-red-400"
              : "bg-[#0b0f19] border-slate-700 text-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
          title={isMuted ? (lang === "ar" ? "إلغاء كتم الصوت" : "Unmute Microphone") : (lang === "ar" ? "كتم المايكرفون" : "Mute Microphone")}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video state */}
        <button
          onClick={onToggleVideo}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            isVideoOff
              ? "bg-red-600/30 border-red-500/40 text-red-400"
              : "bg-[#0b0f19] border-slate-700 text-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
          title={isVideoOff ? (lang === "ar" ? "تشغيل الكاميرا" : "Turn Video On") : (lang === "ar" ? "إيقاف الكاميرا" : "Turn Video Off")}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen sharing button */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            isScreenSharing
              ? "bg-indigo-600/40 border-indigo-500/45 text-indigo-300"
              : "bg-[#0b0f19] border-slate-700 text-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
          title={isScreenSharing ? (lang === "ar" ? "المشاركة الحالية نشطة" : "Sharing active") : (lang === "ar" ? "مشاركة الشاشة بالكامل" : "Share screen")}
        >
          <Tv className="w-5 h-5" />
        </button>

        {/* Separation vertical line */}
        <div className="w-[1px] h-8 bg-slate-700" />

        {/* Red emergency drop call button */}
        {callState !== "idle" && (
          <button
            onClick={onEndCall}
            className="p-3.5 rounded-xl bg-red-650 hover:bg-red-700 text-white font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-sans"
            title={lang === "ar" ? "إنهاء وإغلاق مكالمة الفيديو" : "End call"}
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline text-xs mt-0.5">{t("endCallBtn")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
