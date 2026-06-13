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
  ShieldAlert,
  MoreVertical,
  Plus,
  Unlock,
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
  isLocalMock: boolean;
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
  isLocalMock,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  const [internalStatus, setInternalStatus] = React.useState<"idle" | "connecting" | "ringing" | "connected" | "rejected" | "ended">("idle");
  const [prevCallState, setPrevCallState] = React.useState<typeof callState>("idle");
  const [lastRemoteName, setLastRemoteName] = React.useState<string>("");
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  const isRtl = lang === "ar" || lang === "ur";
  const isArabic = lang === "ar" || lang === "ur";
  const audioCallLabel = isArabic ? "اتصال صوتي" : "Audio Call";
  const videoCallLabel = isArabic ? "اتصال مرئي" : "Video Call";
  const addParticipantLabel = isArabic ? "إضافة مشارك" : "Add Participant";
  const blockLabel = isBlocked 
    ? (isArabic ? "إلغاء الحظر" : "Unblock")
    : (isArabic ? "حظر" : "Block/Ban");
  const moreLabel = isArabic ? "المزيد" : "More";
  const endBroadcastLabel = isArabic ? "انهاء البث" : "End Broadcast";
  const endCallLabel = isArabic ? "انهاء المكالمة" : "End Call";

  const tTooltipAudio = (() => {
    if (callState === "idle") {
      return isArabic ? "بدء اتصال صوتي آمن مع الطرف الآخر" : "Start secure audio call with other participant";
    }
    return isMuted 
      ? (isArabic ? "تشغيل الميكروفون (إلغاء الكتم)" : "Unmute microphone")
      : (isArabic ? "كتم الصوت مؤقتاً" : "Mute microphone");
  })();

  const tTooltipVideo = (() => {
    if (callState === "idle") {
      return isArabic ? "بدء اتصال مرئي HD مع الطرف الآخر" : "Start HD video call with other participant";
    }
    return isVideoOff
      ? (isArabic ? "تشغيل كاميرا البث" : "Start camera stream")
      : (isArabic ? "إيقاف كاميرا البث" : "Stop camera stream");
  })();

  const tTooltipAdd = copied
    ? (isArabic ? "تم نسخ الرابط الحصري للغرفة!" : "Exclusive room link copied!")
    : (isArabic ? "نسخ رابط دعوة الغرفة السريع وإرساله للأصدقاء" : "Copy quick room invitation link & send to friends");

  const tTooltipBlock = isBlocked
    ? (isArabic ? "إلغاء حظر رؤية وصوت هذا المستخدم" : "Unblock user media & vision")
    : (isArabic ? "حظر رؤية وصوت هذا المستخدم مؤقتاً" : "Block user media & vision temporarily");

  const tTooltipMore = isArabic ? "خيارات إضافية ومشاركة الشاشة ومعلومات الرابط" : "Extra options, screen share & connection info";

  const tTooltipBroadcast = isArabic ? "إنهاء البث وإيقاف الكاميرا أو مشاركة الشاشة" : "End broadcast & stop camera or screen share";

  const tTooltipEndCall = isArabic ? "إنهاء المكالمة بالكامل مع الطرف الآخر" : "End entire call session with other participant";

  // تحويل ألوان الصور الرمزية لتناسب الهوية الذهبية
  function getAvatarColorAndInitials(name: string) {
    if (!name) return { initials: "👤", bgClass: "bg-gradient-to-tr from-[#D4AF37] to-[#8B6508] shadow-[0_0_15px_rgba(212,175,55,0.4)]" };
    const cleanName = name.replace(/[#\.\/\[\]\$]/g, "").trim();
    if (!cleanName) return { initials: "👤", bgClass: "bg-gradient-to-tr from-[#D4AF37] to-[#8B6508]" };
    const initials = cleanName.substring(0, 2).toUpperCase();
    const bgClass = "bg-gradient-to-tr from-[#D4AF37] to-[#996515] shadow-[0_0_15px_rgba(212,175,55,0.3)]";
    return { initials, bgClass };
  }

  useEffect(() => {
    if (activeCall) {
      const remoteName = activeCall.callerId === (localStream?.id || "local")
        ? t("remoteParticipantLabel")
        : activeCall.callerName;
      if (remoteName && remoteName !== t("remoteParticipantLabel")) {
        setLastRemoteName(remoteName);
      }
    }
  }, [activeCall, localStream, t]);

  useEffect(() => {
    if (callState === "ringing-out") {
      setInternalStatus("connecting");
      const ringTimer = setTimeout(() => {
        setInternalStatus("ringing");
      }, 2500);
      return () => clearTimeout(ringTimer);
    } else if (callState === "ringing-in") {
      setInternalStatus("ringing");
    } else if (callState === "connected") {
      setInternalStatus("connected");
    } else if (callState === "idle") {
      if (prevCallState === "ringing-out" || prevCallState === "ringing-in") {
        setInternalStatus("rejected");
        const clearTimer = setTimeout(() => {
          setInternalStatus("idle");
        }, 6000);
        return () => clearTimeout(clearTimer);
      } else if (prevCallState === "connected") {
        setInternalStatus("ended");
        const clearTimer = setTimeout(() => {
          setInternalStatus("idle");
        }, 6000);
        return () => clearTimeout(clearTimer);
      } else {
        setInternalStatus("idle");
      }
    }
    setPrevCallState(callState);
  }, [callState, prevCallState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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
      {/* Top Bar Detail Card - Royal Gold & Black */}
      <div className={`bg-[#050505]/80 backdrop-blur-md border border-[#D4AF37]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_15px_rgba(212,175,55,0.05)] ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse shadow-[0_0_8px_#D4AF37]" />
          <div>
            <h4 className="text-sm font-bold text-[#D4AF37]">{roomTitle}</h4>
            <p className="text-xxs text-[#D4AF37]/60 font-mono mt-0.5">{t("roomSubheadingOpen")}</p>
          </div>
        </div>
        
        {/* Copy share link button - Gold Accent */}
        <button
          onClick={copyRoomLink}
          className="flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] text-xs px-4 py-2 rounded-xl hover:bg-[#D4AF37]/20 transition-all font-semibold active:scale-95 shadow-[0_0_10px_rgba(212,175,55,0.1)] cursor-pointer"
          title={t("copyShareableLink")}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-[#D4AF37] font-bold" />
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

      {isLocalMock && (
        <div className={`bg-[#1a1500] border border-[#D4AF37]/40 p-4 rounded-2xl flex items-start gap-3 shadow-md text-xs text-[#D4AF37] leading-relaxed ${isRtl ? "flex-row-reverse text-right" : "flex-row text-left"}`}>
          <span className="text-xl shrink-0 mt-0.5">💡</span>
          <div className="flex-1">
            <p className="font-black text-[#D4AF37] text-sm">
              {t("usingSimulatedCamera")}
            </p>
            <p className="mt-1 text-[#D4AF37]/70 text-xs font-semibold leading-relaxed">
              {t("simulatorCameraDisclaimer")}
            </p>
          </div>
        </div>
      )}

      {/* Main Video Camera Workspace */}
      <div className="flex-1 min-h-[350px] relative grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Stream Window */}
        <div className="bg-[#030303] border border-[#D4AF37]/20 rounded-2xl overflow-hidden relative group shadow-[0_0_20px_rgba(212,175,55,0.05)] flex items-center justify-center">
          {isVideoOff ? (
            <div className="text-center p-4 flex flex-col items-center gap-3 font-sans">
              <div className="w-16 h-16 rounded-full bg-red-950/45 border border-red-500/30 flex items-center justify-center text-red-400">
                <VideoOff className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#D4AF37]">{t("camDisabledTitle")}</p>
                <p className="text-2xs text-[#D4AF37]/50 mt-1">{t("camDisabledDesc")}</p>
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
              <div className="absolute top-3 left-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2.5 py-1 rounded-full text-xxs font-mono text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                IP-RTC
              </div>
            </>
          )}

          {/* Floating User Info overlay */}
          <div className="absolute bottom-4 right-4 left-4 bg-black/80 backdrop-blur-md border border-[#D4AF37]/20 rounded-xl p-2.5 px-3.5 flex items-center justify-between z-10 shadow-lg" dir={isRtl ? "rtl" : "ltr"}>
            <span className="text-xs font-bold text-[#D4AF37] shrink-0">{nickname} ({t("badgeYou")})</span>
            <div className="flex gap-1.5">
              {isMuted && (
                <span className="p-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30">
                  <MicOff className="w-3 h-3" />
                </span>
              )}
              {isScreenSharing && (
                <span className="p-1 rounded-md bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                  <Tv className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Remote Stream Window */}
        <div className="bg-[#030303] border border-[#D4AF37]/20 rounded-2xl overflow-hidden relative group shadow-[0_0_20px_rgba(212,175,55,0.05)] flex items-center justify-center">
          {isBlocked ? (
            <div className="text-center p-6 flex flex-col items-center gap-3 font-sans z-25 relative">
              <div className="w-16 h-16 rounded-full bg-red-950/45 border border-red-500/30 flex items-center justify-center text-red-500">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-rose-500">{isRtl ? "🛡️ تم حظر المستخدم" : "🛡️ User Blocked"}</p>
                <p className="text-2xs text-[#D4AF37]/60 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  {isRtl ? "تم حجب بث الصوت والفيديو مؤقتاً لهذا المشارك." : "Video and audio streams are temporarily blocked."}
                </p>
                <button
                  type="button"
                  onClick={() => setIsBlocked(false)}
                  className="mt-3 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xxs rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
                >
                  <Unlock className="w-3 h-3" />
                  <span>{isRtl ? "إلغاء الحظر" : "Unblock"}</span>
                </button>
              </div>
            </div>
          ) : callState === "connected" && remoteStream ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-[#D4AF37]/20 border border-[#D4AF37]/40 px-2.5 py-1 rounded-full text-xxs font-mono text-[#D4AF37] animate-pulse flex items-center gap-1 shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                <span className="w-1.5 h-1.5 bg-[#F4C430] rounded-full animate-ping" />
                <span>LIVE HD • {t("statusConnectedNow")}</span>
              </div>
              <div className="absolute bottom-4 right-4 left-4 bg-black/80 backdrop-blur-md border border-[#D4AF37]/20 rounded-xl p-2.5 px-3.5 flex items-center justify-between z-10 shadow-lg">
                <span className="text-xs font-bold text-[#D4AF37]">
                  {activeCall ? (activeCall.callerId === localStream?.id ? lastRemoteName || t("remoteParticipantLabel") : activeCall.callerName) : lastRemoteName || t("remoteParticipantLabel")}
                </span>
                <span className="text-xxs px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] rounded-full font-bold">
                  {t("statusConnectedNow")}
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-full relative bg-gradient-to-b from-black via-[#0a0804] to-black flex flex-col items-center justify-center p-6 text-center font-sans">
              
              {/* Royal Gold Floating Background Bubbles Effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)] pointer-events-none" />
              
              {/* Avatar Frame with Dynamic Glowing Rings */}
              <div className="relative mb-5 flex items-center justify-center">
                {(internalStatus === "connecting" || internalStatus === "ringing") && (
                  <>
                    <div className="absolute w-36 h-36 rounded-full border border-[#D4AF37]/30 animate-ping opacity-60" />
                    <div className="absolute w-44 h-44 rounded-full border border-[#D4AF37]/10 animate-pulse scale-105" />
                  </>
                )}
                {internalStatus === "rejected" && (
                  <div className="absolute w-32 h-32 rounded-full bg-red-500/10 border border-red-500/20 animate-pulse" />
                )}
                
                {/* Dynamic Initialized Avatar Badge */}
                {(() => {
                  const resolvedRemoteName = activeCall
                    ? (activeCall.callerId === localStream?.id
                        ? (lastRemoteName || t("remoteParticipantLabel"))
                        : activeCall.callerName)
                    : (lastRemoteName || t("remoteParticipantLabel"));
                  const avatar = getAvatarColorAndInitials(resolvedRemoteName);
                  return (
                    <div className={`w-24 h-24 rounded-full ${avatar.bgClass} flex items-center justify-center text-black text-3xl font-black relative shadow-xl border-2 border-[#D4AF37] transition-all duration-300 z-10`}>
                      {avatar.initials}
                    </div>
                  );
                })()}
              </div>

              {/* User Name Tag */}
              <h5 className="text-base md:text-lg font-black text-[#D4AF37] px-4 tracking-wide shadow-xs truncate max-w-[280px]">
                {activeCall
                  ? (activeCall.callerId === localStream?.id
                      ? (lastRemoteName || t("remoteParticipantLabel"))
                      : activeCall.callerName)
                  : (lastRemoteName || t("remoteParticipantLabel"))}
              </h5>

              {/* Status Message */}
              <div className="mt-2 text-xxs md:text-xs font-bold flex items-center gap-2 px-3 py-1 bg-[#111]/80 border border-[#D4AF37]/30 rounded-full text-[#D4AF37]/80 shadow-[0_0_10px_rgba(212,175,55,0.1)]">
                {internalStatus === "connecting" && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-ping" />
                    <span className="text-[#D4AF37]">{t("statusConnecting")}</span>
                  </>
                )}
                {internalStatus === "ringing" && (
                  <>
                    <Phone className="w-3.5 h-3.5 text-[#D4AF37] animate-bounce" />
                    <span className="text-[#D4AF37] font-extrabold">{t("statusRinging")}</span>
                  </>
                )}
                {internalStatus === "rejected" && (
                  <>
                    <PhoneOff className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-400 font-extrabold">{t("statusCallRejected")}</span>
                  </>
                )}
                {internalStatus === "ended" && (
                  <>
                    <PhoneOff className="w-3.5 h-3.5 text-[#D4AF37]/50" />
                    <span className="text-[#D4AF37]/50">{t("statusCallEnded")}</span>
                  </>
                )}
                {internalStatus === "idle" && (
                  <>
                    <PhoneOff className="w-3.5 h-3.5 text-[#D4AF37]/40" />
                    <span className="text-[#D4AF37]/50">{t("statusOffline")}</span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 z-10">
                {callState === "ringing-out" ? (
                  <button
                    onClick={onEndCall}
                    className="bg-red-950 hover:bg-red-900 hover:scale-105 active:scale-95 text-red-400 text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] flex items-center gap-2 cursor-pointer border border-red-500/40"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>{t("cancelCallBtn")}</span>
                  </button>
                ) : callState === "ringing-in" ? (
                  <div className="flex gap-4">
                    <button
                      onClick={onAcceptCall}
                      className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:from-[#F4C430] hover:to-[#D4AF37] hover:scale-105 active:scale-95 text-black font-extrabold text-xs px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2 cursor-pointer border border-[#D4AF37]/30"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{t("acceptCallBtn")}</span>
                    </button>
                    <button
                      onClick={onEndCall}
                      className="bg-red-950 hover:bg-red-900 hover:scale-105 active:scale-95 text-red-400 font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer border border-red-500/30"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>{t("rejectBtn")}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onStartCall}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:from-[#F4C430] hover:to-[#D4AF37] hover:scale-105 active:scale-95 text-black text-xs font-bold px-7 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2 cursor-pointer border border-[#F4C430]/50"
                  >
                    <Phone className="w-4 h-4 animate-pulse" />
                    <span>{t("startWebRtcCallBtn")}</span>
                  </button>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Floating Action Overlays Controls - Royal Theme */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-nowrap items-center justify-center gap-3 bg-[#050505]/95 backdrop-blur-2xl border border-[#D4AF37]/30 shadow-[0_10px_40px_rgba(212,175,55,0.15)] p-2.5 px-4 rounded-full w-max max-w-[96%] transition-all duration-300">
          
          {/* 1. 📞 Audio Call (اتصال صوتي) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={callState !== "idle" ? onToggleMute : onStartCall}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                callState === "idle"
                  ? "bg-black border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
                  : isMuted
                    ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                    : "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50 hover:bg-[#D4AF37]/30 shadow-[0_0_10px_rgba(212,175,55,0.2)]"
              }`}
            >
              {callState !== "idle" && isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-black border border-[#D4AF37]/30 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <span className="text-[#D4AF37] font-extrabold text-[9px] uppercase tracking-wider">{audioCallLabel}</span>
                <span className="text-[10.5px] font-medium text-[#D4AF37]/80">{tTooltipAudio}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-black border-r border-b border-[#D4AF37]/30 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 2. 🎥 Video Call (اتصال مرئي) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={callState !== "idle" ? onToggleVideo : onStartCall}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                callState === "idle"
                  ? "bg-black border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
                  : isVideoOff
                    ? "bg-red-500/20 text-red-500 border-red-505/40 hover:bg-red-500/30"
                    : "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50 hover:bg-[#D4AF37]/30 shadow-[0_0_10px_rgba(212,175,55,0.2)]"
              }`}
            >
              {callState !== "idle" && isVideoOff ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-black border border-[#D4AF37]/30 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <span className="text-[#D4AF37] font-extrabold text-[9px] uppercase tracking-wider">{videoCallLabel}</span>
                <span className="text-[10.5px] font-medium text-[#D4AF37]/80">{tTooltipVideo}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-black border-r border-b border-[#D4AF37]/30 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 3. ➕ Add Participant (إضافة مشارك) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={copyRoomLink}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                copied
                  ? "bg-[#D4AF37]/30 border-[#D4AF37] text-[#F4C430]"
                  : "bg-black border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
              }`}
            >
              {copied ? (
                <Check className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-black border border-[#D4AF37]/30 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <span className="text-[#D4AF37] font-extrabold text-[9px] uppercase tracking-wider">{addParticipantLabel}</span>
                <span className="text-[10.5px] font-medium text-[#D4AF37]/80">{tTooltipAdd}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-black border-r border-b border-[#D4AF37]/30 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 4. 🛡️ Block (حظر) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsBlocked(!isBlocked)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                isBlocked
                  ? "bg-rose-600/20 text-rose-400 border-rose-500/40 animate-pulse"
                  : "bg-[#8B6508]/20 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#8B6508]/40"
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-black border border-[#D4AF37]/30 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <span className="text-[#D4AF37] font-extrabold text-[9px] uppercase tracking-wider">{blockLabel}</span>
                <span className="text-[10.5px] font-medium text-[#D4AF37]/80">{tTooltipBlock}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-black border-r border-b border-[#D4AF37]/30 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 5. ⋮ More (المزيد) */}
          <div className="relative">
            <div className="relative group flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                  showMoreMenu
                    ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#F4C430]"
                    : "bg-black border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
                }`}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Tooltip */}
              <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
                <div className="bg-black border border-[#D4AF37]/30 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                  <span className="text-[#D4AF37] font-extrabold text-[9px] uppercase tracking-wider">{moreLabel}</span>
                  <span className="text-[10.5px] font-medium text-[#D4AF37]/80">{tTooltipMore}</span>
                </div>
                <div className="w-2.5 h-2.5 bg-black border-r border-b border-[#D4AF37]/30 rotate-45 -mt-1.5 shadow-sm" />
              </div>
            </div>
            
            {showMoreMenu && (
              <div className={`absolute bottom-13 ${isRtl ? "right-0" : "left-0"} bg-black border border-[#D4AF37]/40 rounded-xl p-2 w-48 shadow-[0_15px_30px_rgba(212,175,55,0.1)] z-40 flex flex-col gap-1 text-[11px] backdrop-blur-xl`}>
                <button
                  type="button"
                  onClick={() => {
                    onToggleScreenShare();
                    setShowMoreMenu(false);
                  }}
                  className={`w-full text-right px-3 py-2 rounded-lg hover:bg-[#D4AF37]/10 flex items-center gap-2 cursor-pointer transition-colors ${
                    isScreenSharing ? "text-[#F4C430] font-bold" : "text-[#D4AF37]"
                  }`}
                >
                  <Tv className="w-4 h-4 text-[#D4AF37]" />
                  <span>{isArabic ? "مشاركة الشاشة" : "Share Screen"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyRoomLink();
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-right px-3 py-2 text-[#D4AF37] rounded-lg hover:bg-[#D4AF37]/10 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Copy className="w-4 h-4 text-[#D4AF37]/80" />
                  <span>{isArabic ? "نسخ رابط الغرفة" : "Copy Room Link"}</span>
                </button>
                <div className="border-t border-[#D4AF37]/20 my-1" />
                <div className="px-3 py-1 text-[9px] text-[#D4AF37]/60 font-bold uppercase tracking-wider text-left">
                  {isArabic ? "المعلومات التقنية" : "Technical info"}
                </div>
                <div className="px-3 py-1.5 text-[#D4AF37]/50 font-mono text-[9px] flex flex-col gap-0.5 text-left">
                  <div>Room: {roomTitle}</div>
                  <div>Status: {internalStatus}</div>
                  <div>RTC: VIP HD Quality</div>
                </div>
              </div>
            )}
          </div>

          {/* 6. End Broadcast (انهاء البث) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (isScreenSharing) {
                  onToggleScreenShare();
                } else if (!isVideoOff) {
                  onToggleVideo();
                }
              }}
              disabled={!isScreenSharing && isVideoOff}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                isScreenSharing || !isVideoOff
                  ? "bg-orange-950 text-orange-400 border-orange-500/40 hover:bg-orange-900"
                  : "opacity-30 cursor-not-allowed bg-black border-black text-[#D4AF37]/30"
              }`}
            >
              <Tv className="w-5 h-5" />
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-black border border-[#D4AF37]/30 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <span className="text-[#D4AF37] font-extrabold text-[9px] uppercase tracking-wider">{endBroadcastLabel}</span>
                <span className="text-[10.5px] font-medium text-[#D4AF37]/80">{tTooltipBroadcast}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-black border-r border-b border-[#D4AF37]/30 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 7. End Call (انهاء المكالمة) */}
          <div className="relative group flex items-center justify-center">
            {callState !== "idle" ? (
              <button
                type="button"
                onClick={onEndCall}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-red-800 hover:bg-red-700 text-white border border-red-500/50 transition-all cursor-pointer active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-11 h-11 rounded-full flex items-center justify-center bg-black border border-black text-[#D4AF37]/30 opacity-30 cursor-not-allowed"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-black border border-[#D4AF37]/30 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <span className="text-[#D4AF37] font-extrabold text-[9px] uppercase tracking-wider">{endCallLabel}</span>
                <span className="text-[10.5px] font-medium text-[#D4AF37]/80">{tTooltipEndCall}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-black border-r border-b border-[#D4AF37]/30 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}