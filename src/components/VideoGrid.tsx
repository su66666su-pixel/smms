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
                    <span>{t("startWebRtcCallBtn")}
                    </span>
                  </button>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Call Floating Action Overlays Controls / Dashboard (HUD) - Floating over the Video */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 md:gap-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-2xl p-2.5 px-4 rounded-2xl w-[94%] sm:w-auto max-w-[96%] transition-all duration-300">
          
          {/* 1. 📞 Audio Call (اتصال صوتي) */}
          <button
            type="button"
            onClick={callState !== "idle" ? onToggleMute : onStartCall}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer text-xs font-bold ${
              isMuted && callState !== "idle"
                ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                : "bg-emerald-600/20 text-emerald-400 border border-emerald-550/30 hover:bg-emerald-600/30"
            }`}
            title={audioCallLabel}
          >
            <span className="text-sm">📞</span>
            <span>{audioCallLabel}</span>
          </button>

          {/* 2. 🎥 Video Call (اتصال مرئي) */}
          <button
            type="button"
            onClick={callState !== "idle" ? onToggleVideo : onStartCall}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer text-xs font-bold ${
              isVideoOff && callState !== "idle"
                ? "bg-red-500/30 text-red-400 border border-red-505/40 hover:bg-red-500/45"
                : "bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30"
            }`}
            title={videoCallLabel}
          >
            <span className="text-sm">🎥</span>
            <span>{videoCallLabel}</span>
          </button>

          {/* 3. ➕ Add Participant (إضافة مشارك) */}
          <button
            type="button"
            onClick={copyRoomLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-805 text-slate-200 hover:bg-slate-850 transition-all cursor-pointer text-xs font-bold active:scale-95"
            title={addParticipantLabel}
          >
            <span className="text-xs">➕</span>
            <span>{copied ? (isArabic ? "تم النسخ!" : "Link Copied!") : addParticipantLabel}</span>
          </button>

          {/* 4. 🛡️ Block (حظر) */}
          <button
            type="button"
            onClick={() => setIsBlocked(!isBlocked)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer text-xs font-bold ${
              isBlocked
                ? "bg-rose-650 text-white border border-rose-600 hover:bg-rose-700 animate-pulse"
                : "bg-amber-600/20 text-amber-500 border border-amber-555/30 hover:bg-amber-655/35"
            }`}
            title={blockLabel}
          >
            <span className="text-sm">🛡️</span>
            <span>{blockLabel}</span>
          </button>

          {/* 5. ⋮ More (المزيد) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl border transition-all cursor-pointer text-xs font-bold ${
                showMoreMenu
                  ? "bg-indigo-650 border-indigo-505 text-white"
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
              title={moreLabel}
            >
              <span className="text-sm font-bold">⋮</span>
              <span>{moreLabel}</span>
            </button>
            
            {showMoreMenu && (
              <div className={`absolute bottom-11 ${isRtl ? "right-0" : "left-0"} bg-slate-950 border border-slate-800 rounded-xl p-2 w-48 shadow-2xl z-40 flex flex-col gap-1 text-[11px]`}>
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
                  <span>🖥️</span>
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
                  <span>📋</span>
                  <span>{isArabic ? "نسخ رابط الغرفة" : "Copy Room Link"}</span>
                </button>
                <div className="border-t border-slate-900 my-1" />
                <div className="px-3 py-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider text-left">
                  {isArabic ? "المعلومات التقنية" : "Technical info"}
                </div>
                <div className="px-3 py-1.5 text-slate-450 font-mono text-[9px] flex flex-col gap-0.5 text-left">
                  <div>Room: {roomTitle}</div>
                  <div>Status: {internalStatus}</div>
                  <div>RTC: HD Quality</div>
                </div>
              </div>
            )}
          </div>

          {/* 6. End Broadcast (انهاء البث) */}
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
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all font-bold text-xs cursor-pointer ${
              isScreenSharing || !isVideoOff
                ? "bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/35"
                : "opacity-40 cursor-not-allowed bg-slate-900 border border-slate-800 text-slate-500"
            }`}
            title={endBroadcastLabel}
          >
            <span className="text-sm">📡</span>
            <span>{endBroadcastLabel}</span>
          </button>

          {/* 7. End Call (انهاء المكالمة) */}
          {callState !== "idle" ? (
            <button
              type="button"
              onClick={onEndCall}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-650 border border-red-600 hover:bg-red-700 hover:scale-102 text-white transition-all cursor-pointer text-xs font-bold"
              title={endCallLabel}
            >
              <span className="text-sm">❌</span>
              <span>{endCallLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 opacity-40 cursor-not-allowed text-xs font-bold"
              title={endCallLabel}
            >
              <span className="text-sm">❌</span>
              <span>{endCallLabel}</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
