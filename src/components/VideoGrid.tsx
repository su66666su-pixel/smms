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

  // WhatsApp-style calling states & details
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

  function getAvatarColorAndInitials(name: string) {
    if (!name) return { initials: "👤", bgClass: "bg-gradient-to-tr from-indigo-700 to-purple-600 shadow-indigo-505/30" };
    const cleanName = name.replace(/[#\.\/\[\]\$]/g, "").trim();
    if (!cleanName) return { initials: "👤", bgClass: "bg-gradient-to-tr from-indigo-700 to-purple-600 shadow-indigo-505/30" };
    const initials = cleanName.substring(0, 2).toUpperCase();
    const colors = [
      "bg-gradient-to-tr from-indigo-600 to-indigo-800 shadow-indigo-505/35",
      "bg-gradient-to-tr from-purple-600 to-violet-850 shadow-purple-505/35",
      "bg-gradient-to-tr from-rose-600 to-pink-800 shadow-rose-505/35",
      "bg-gradient-to-tr from-emerald-600 to-teal-800 shadow-emerald-505/35",
      "bg-gradient-to-tr from-amber-600 to-orange-800 shadow-amber-505/35",
      "bg-gradient-to-tr from-cyan-600 to-sky-800 shadow-cyan-505/35"
    ];
    let sum = 0;
    for (let i = 0; i < cleanName.length; i++) {
      sum += cleanName.charCodeAt(i);
    }
    const bgClass = colors[sum % colors.length];
    return { initials, bgClass };
  }

  // Monitor call status transitions with pristine state accuracy
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
      // Advance to "ringing" simulating real WhatsApp double tick transition
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
          title={t("copyShareableLink")}
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

      {isLocalMock && (
        <div className={`bg-amber-50 border border-amber-200/80 p-4 rounded-2xl flex items-start gap-3 shadow-xs text-xs text-amber-900 leading-relaxed ${isRtl ? "flex-row-reverse text-right" : "flex-row text-left"}`}>
          <span className="text-xl shrink-0 mt-0.5">💡</span>
          <div className="flex-1">
            <p className="font-black text-amber-950 text-sm">
              {t("usingSimulatedCamera")}
            </p>
            <p className="mt-1 text-amber-800 text-xs font-semibold leading-relaxed">
              {t("simulatorCameraDisclaimer")}
            </p>
          </div>
        </div>
      )}

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
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden relative group shadow-md flex items-center justify-center">
          {isBlocked ? (
            <div className="text-center p-6 flex flex-col items-center gap-3 font-sans z-25 relative">
              <div className="w-16 h-16 rounded-full bg-red-950/45 border border-red-500/30 flex items-center justify-center text-red-500">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-rose-500">{isRtl ? "🛡️ تم حظر المستخدم" : "🛡️ User Blocked"}</p>
                <p className="text-2xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
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
              <div className="absolute top-3 left-3 bg-emerald-500/20 border border-emerald-505/35 px-2.5 py-1 rounded-full text-xxs font-mono text-emerald-300 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-450 rounded-full animate-ping" />
                <span>LIVE HD • {t("statusConnectedNow")}</span>
              </div>
              <div className="absolute bottom-4 right-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-850 rounded-xl p-2.5 px-3.5 flex items-center justify-between z-10 shadow-lg">
                <span className="text-xs font-bold text-white">
                  {activeCall ? (activeCall.callerId === localStream?.id ? lastRemoteName || t("remoteParticipantLabel") : activeCall.callerName) : lastRemoteName || t("remoteParticipantLabel")}
                </span>
                <span className="text-xxs px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-350 rounded-full font-bold">
                  {t("statusConnectedNow")}
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-full relative bg-gradient-to-b from-[#0e1626] via-[#151f38] to-[#0a0f1d] flex flex-col items-center justify-center p-6 text-center font-sans">
              
              {/* WhatsApp Floating Background Bubbles Effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />
              
              {/* Avatar Frame with Dynamic Glowing Rings (WhatsApp Style) */}
              <div className="relative mb-5 flex items-center justify-center">
                {(internalStatus === "connecting" || internalStatus === "ringing") && (
                  <>
                    <div className="absolute w-36 h-36 rounded-full border border-indigo-500/20 animate-ping opacity-60" />
                    <div className="absolute w-44 h-44 rounded-full border border-indigo-400/10 animate-pulse scale-105" />
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
                    <div className={`w-24 h-24 rounded-full ${avatar.bgClass} flex items-center justify-center text-white text-3xl font-black relative shadow-xl border-3 border-[#1c2742]/50 transition-all duration-300 z-10`}>
                      {avatar.initials}
                    </div>
                  );
                })()}
              </div>

              {/* User Name Tag */}
              <h5 className="text-base md:text-lg font-black text-white px-4 tracking-wide shadow-xs truncate max-w-[280px]">
                {activeCall
                  ? (activeCall.callerId === localStream?.id
                      ? (lastRemoteName || t("remoteParticipantLabel"))
                      : activeCall.callerName)
                  : (lastRemoteName || t("remoteParticipantLabel"))}
              </h5>

              {/* Status Message (Like WhatsApp Subtitle Indicator) */}
              <div className="mt-2 text-xxs md:text-xs font-bold flex items-center gap-2 px-3 py-1 bg-[#1a2540]/65 border border-[#2b3b61]/40 rounded-full text-slate-300 shadow-sm">
                {internalStatus === "connecting" && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                    <span className="text-blue-400">{t("statusConnecting")}</span>
                  </>
                )}
                {internalStatus === "ringing" && (
                  <>
                    <Phone className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                    <span className="text-emerald-400 font-extrabold">{t("statusRinging")}</span>
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
                    <PhoneOff className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">{t("statusCallEnded")}</span>
                  </>
                )}
                {internalStatus === "idle" && (
                  <>
                    <PhoneOff className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-400">{t("statusOffline")}</span>
                  </>
                )}
              </div>

              {/* Action Buttons Integrated Into Calling Panels */}
              <div className="mt-6 z-10">
                {callState === "ringing-out" ? (
                  <button
                    onClick={onEndCall}
                    className="bg-red-650 hover:bg-red-700 hover:scale-105 active:scale-95 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer border border-red-500/40"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>{t("cancelCallBtn")}</span>
                  </button>
                ) : callState === "ringing-in" ? (
                  <div className="flex gap-4">
                    <button
                      onClick={onAcceptCall}
                      className="bg-emerald-600 hover:bg-emerald-700 hover:scale-105 active:scale-95 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer border border-emerald-500/30"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{t("acceptCallBtn")}</span>
                    </button>
                    <button
                      onClick={onEndCall}
                      className="bg-[#ad202c] hover:bg-[#c22836] hover:scale-105 active:scale-95 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer border border-red-500/30"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>{t("rejectBtn")}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onStartCall}
                    className="bg-gradient-to-r from-blue-650 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 hover:scale-105 active:scale-95 text-white text-xs font-bold px-7 py-3 rounded-xl transition-all shadow-xl flex items-center gap-2 cursor-pointer border border-blue-500/25"
                  >
                    <Phone className="w-4 h-4 animate-pulse" />
                    <span>{t("startWebRtcCallBtn")}</span>
                  </button>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Call Floating Action Overlays Controls / Dashboard (HUD) - Floating over the Video */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-nowrap items-center justify-center gap-3 bg-[#070b15]/90 backdrop-blur-2xl border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2.5 px-4 rounded-full w-max max-w-[96%] transition-all duration-300">
          
          {/* 1. 📞 Audio Call (اتصال صوتي) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={callState !== "idle" ? onToggleMute : onStartCall}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                callState === "idle"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700"
                  : isMuted
                    ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                    : "bg-emerald-600/20 text-emerald-450 border-emerald-550/40 hover:bg-emerald-600/30"
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
              <div className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-2xl">
                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider">{audioCallLabel}</span>
                <span className="text-[10.5px] font-medium text-slate-200">{tTooltipAudio}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 2. 🎥 Video Call (اتصال مرئي) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={callState !== "idle" ? onToggleVideo : onStartCall}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                callState === "idle"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700"
                  : isVideoOff
                    ? "bg-red-500/20 text-red-500 border-red-505/40 hover:bg-red-500/30"
                    : "bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30"
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
              <div className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-2xl">
                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider">{videoCallLabel}</span>
                <span className="text-[10.5px] font-medium text-slate-200">{tTooltipVideo}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 3. ➕ Add Participant (إضافة مشارك) */}
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={copyRoomLink}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                copied
                  ? "bg-teal-600/20 border-teal-500/40 text-teal-400"
                  : "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700"
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
              <div className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-2xl">
                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider">{addParticipantLabel}</span>
                <span className="text-[10.5px] font-medium text-slate-200">{tTooltipAdd}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45 -mt-1.5 shadow-sm" />
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
                  : "bg-amber-600/10 border-amber-555/30 text-amber-500 hover:bg-amber-600/20"
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-2xl">
                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider">{blockLabel}</span>
                <span className="text-[10.5px] font-medium text-slate-200">{tTooltipBlock}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45 -mt-1.5 shadow-sm" />
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
                    ? "bg-indigo-600 border-indigo-505 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                }`}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Tooltip */}
              <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
                <div className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-2xl">
                  <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider">{moreLabel}</span>
                  <span className="text-[10.5px] font-medium text-slate-200">{tTooltipMore}</span>
                </div>
                <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45 -mt-1.5 shadow-sm" />
              </div>
            </div>
            
            {showMoreMenu && (
              <div className={`absolute bottom-13 ${isRtl ? "right-0" : "left-0"} bg-slate-950 border border-slate-800 rounded-xl p-2 w-48 shadow-[0_15px_30px_rgba(0,0,0,0.6)] z-40 flex flex-col gap-1 text-[11px] backdrop-blur-xl`}>
                <button
                  type="button"
                  onClick={() => {
                    onToggleScreenShare();
                    setShowMoreMenu(false);
                  }}
                  className={`w-full text-right px-3 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2 cursor-pointer transition-colors ${
                    isScreenSharing ? "text-indigo-400 font-bold" : "text-slate-300"
                  }`}
                >
                  <Tv className="w-4 h-4 text-indigo-400" />
                  <span>{isArabic ? "مشاركة الشاشة" : "Share Screen"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyRoomLink();
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-right px-3 py-2 text-slate-300 rounded-lg hover:bg-slate-900 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>{isArabic ? "نسخ رابط الغرفة" : "Copy Room Link"}</span>
                </button>
                <div className="border-t border-slate-900 my-1" />
                <div className="px-3 py-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider text-left">
                  {isArabic ? "المعلومات التقنية" : "Technical info"}
                </div>
                <div className="px-3 py-1.5 text-slate-400 font-mono text-[9px] flex flex-col gap-0.5 text-left">
                  <div>Room: {roomTitle}</div>
                  <div>Status: {internalStatus}</div>
                  <div>RTC: HD Quality</div>
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
                  ? "bg-orange-600/20 text-orange-400 border-orange-500/40 hover:bg-orange-600/35"
                  : "opacity-30 cursor-not-allowed bg-slate-950 border-slate-900 text-slate-650"
              }`}
            >
              <Tv className="w-5 h-5" />
            </button>

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-2xl">
                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider">{endBroadcastLabel}</span>
                <span className="text-[10.5px] font-medium text-slate-200">{tTooltipBroadcast}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

          {/* 7. End Call (انهاء المكالمة) */}
          <div className="relative group flex items-center justify-center">
            {callState !== "idle" ? (
              <button
                type="button"
                onClick={onEndCall}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white border border-red-500/30 transition-all cursor-pointer active:scale-95 shadow-[0_4px_15px_rgba(239,68,68,0.4)]"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-950 border border-slate-900 text-slate-650 opacity-30 cursor-not-allowed"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full mb-3.5 invisible opacity-0 scale-95 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-250 pointer-events-none z-50 flex flex-col items-center select-none shadow-2xl">
              <div className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl whitespace-nowrap text-right flex flex-col items-center gap-0.5 shadow-2xl">
                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider">{endCallLabel}</span>
                <span className="text-[10.5px] font-medium text-slate-200">{tTooltipEndCall}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45 -mt-1.5 shadow-sm" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
