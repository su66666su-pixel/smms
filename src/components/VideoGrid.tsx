import React, { useEffect, useRef, useState } from "react";
import {
  Phone,
  Video,
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  MoreVertical,
  Users,
  Settings,
  MessageSquare,
  Star,
  Sparkles,
  Clock,
  Volume2,
  Hand,
  Laptop
} from "lucide-react";

interface ParticipantInfo {
  uid: string;
  name: string;
  avatar: string;
  joinedAt?: any;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  activeCall: any;
  callState: "idle" | "ringing-out" | "ringing-in" | "connected";
  onStartCall: (targetUid?: string) => void;
  onAcceptCall: () => void;
  onEndCall: () => void;
  nickname: string;
  roomTitle: string;
  t: (key: string) => string;
  lang: string;
  isLocalMock: boolean;
  participants?: ParticipantInfo[];
}

export const VideoGrid: React.FC<VideoGridProps> = ({
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
  participants = []
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const miniLocalVideoRef = useRef<HTMLVideoElement>(null);

  const [handRaised, setHandRaised] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);

  const isRtl = lang === "ar" || lang === "ur";

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.error("WebRTC remote auto-play failed:", e));
    }
  }, [remoteStream, callState]);

  // Bind local stream to main video or miniaturized thumbnail
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
    if (miniLocalVideoRef.current && localStream) {
      miniLocalVideoRef.current.srcObject = localStream;
      miniLocalVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOff]);

  const toggleHand = () => {
    setHandRaised(!handRaised);
  };

  // Determine standard mockup participants for fallback representation to guarantee bento design fills completely (just like the image)
  const defaultFallbacks = [
    { name: "سارة خالد", role: "أخصائي تسويق", bg: "bg-emerald-600", activeSpeak: true, mic: true, cam: true },
    { name: "محمد عادل", role: "مدير تصميم المنتجات", bg: "bg-indigo-600", activeSpeak: false, mic: false, cam: false },
    { name: "ياسمين علي", role: "مبرمج واجهات أمامية", bg: "bg-[#6c47ff]", activeSpeak: false, mic: true, cam: true }
  ];

  // Merge actual participants to show real friends first, supplemented by mockup fallbacks
  const mergedParticipants = [...participants.filter((p) => p.name !== nickname)];
  const finalDisplayItems = [];

  // Always fill 3 cards at the bottom for total layout fidelity matching the image
  for (let i = 0; i < 3; i++) {
    if (mergedParticipants[i]) {
      finalDisplayItems.push({
        name: mergedParticipants[i].name,
        role: "مشارك في البث",
        bg: mergedParticipants[i].avatar || "bg-indigo-600",
        activeSpeak: i === 0,
        mic: true,
        cam: true,
        isReal: true,
        uid: mergedParticipants[i].uid
      });
    } else {
      finalDisplayItems.push({
        name: defaultFallbacks[i].name,
        role: defaultFallbacks[i].role,
        bg: defaultFallbacks[i].bg,
        activeSpeak: defaultFallbacks[i].activeSpeak,
        mic: defaultFallbacks[i].mic,
        cam: defaultFallbacks[i].cam,
        isReal: false,
        uid: "fallback-" + i
      });
    }
  }

  // Active spotlight speaker metadata
  const activeSpeakerName = callState === "connected" ? (activeCall?.userName || "الطرف الآخر") : nickname;
  const activeSpeakerTitle = callState === "connected" ? "ضيف متحدث" : "منسق الغرفة والاجتماع";

  return (
    <div className="flex flex-col h-full select-none" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* 1. Header Badges & Connection Status (Matching Design Margins) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0 font-display">
        <div className="flex items-center gap-2">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#10b981]/10 border border-[#10b981]/35 rounded-full text-[11px] text-[#10b981] font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
            </span>
            <span>{isRtl ? "جودة الاتصال ممتازة" : "Excellent connection"}</span>
          </div>

          {/* Time & Recording Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/25 rounded-full text-[11px] text-red-400 font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-550 animate-pulse" />
            <span>{isRtl ? "تسجيل" : "REC"}</span>
            <span className="opacity-80 ml-1">00:24:55</span>
          </div>
        </div>

        {/* Meeting name centered if big screen */}
        <div className="text-xs text-slate-400 font-medium bg-[#151f40]/40 border border-[#202a50]/40 px-3 py-1.5 rounded-xl flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{roomTitle}</span>
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        
        {/* UPPER ROW: Spacious Spotlight Video view */}
        <div className="flex-1 min-h-[220px] md:min-h-[350px] relative bg-[#0c0c1b] rounded-3xl overflow-hidden border border-slate-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.4)] transition-all">
          
          {/* Star decorations or grid layout inside video backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#070712] to-[#05050f] pointer-events-none" />

          {/* Video element rendering */}
          {callState === "connected" && remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          ) : localStream && !isVideoOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]"
            />
          ) : (
            // Custom avatar indicator when camera is muted/empty
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center p-6">
              <div className="w-24 h-24 bg-gradient-to-tr from-indigo-650 to-[#6c47ff] rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(108,71,255,0.45)] border-2 border-white/20 animate-pulse">
                <span className="text-3xl font-black text-white uppercase font-display">
                  {activeSpeakerName.charAt(0)}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-200">{activeSpeakerName}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">{activeSpeakerTitle} • {t("camDisabledTitle")}</p>
            </div>
          )}

          {/* Glowing Ring for Active Speeker Overlay decoration */}
          <div className="absolute inset-4 rounded-2xl border-2 border-indigo-400/20 pointer-events-none z-10" />

          {/* Active presenter namecard badge overlay (Positioned exactly as in the mock image) */}
          <div className={`absolute bottom-6 ${isRtl ? "right-6 text-right" : "left-6 text-left"} z-20 animate-fade-in`}>
            <div className="bg-[#11112b]/95 border border-white/10 backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-3 shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
              {/* Pulsing Voice volume bubble */}
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />
              </div>

              <div>
                <div className="text-xs font-black text-white flex items-center gap-1.5 font-display">
                  <span>{activeSpeakerName}</span>
                  <div className="bg-amber-500/15 border border-amber-500/30 p-0.5 px-1.5 rounded text-[8px] font-black text-amber-400 flex items-center gap-0.5">
                    <Star className="w-2 h-2 fill-amber-400" />
                    <span>{isRtl ? "منسق الجلسة" : "HOST"}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{activeSpeakerTitle}</div>
              </div>

              {/* Action options within overlay */}
              <div className="border-l border-white/10 pl-2 ml-1 flex gap-1">
                <button className="p-1 rounded-lg hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer">
                  <Star className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 rounded-lg hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Call signaling overlays for states ringing-in/out */}
          {callState === "ringing-in" && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-emerald-650 rounded-full flex items-center justify-center text-white mb-4 animate-bounce border-2 border-white/20 shadow-lg">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-base font-bold text-white">{t("incomingCallFrom", { caller: activeCall?.userName || "مشارك" })}</h2>
              <p className="text-xs text-slate-450 mt-1.5 max-w-sm leading-relaxed">يرغب الطرف الآخر في فتح بث مباشر بالصوت والصورة معك الآن بأمان.</p>
              
              <div className="flex gap-3.5 mt-6">
                <button
                  onClick={onAcceptCall}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.45)] text-white rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>{t("acceptCallBtn")}</span>
                </button>
                <button
                  onClick={onEndCall}
                  className="px-6 py-2.5 bg-red-650 hover:bg-red-600 text-white rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isRtl ? "رفض الدخول" : "Decline"}
                </button>
              </div>
            </div>
          )}

          {callState === "ringing-out" && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-indigo-650 rounded-full flex items-center justify-center text-white mb-4 animate-ping duration-1000">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">{isRtl ? "جاري الاتصال والربط الفوري بالطرف الآخر..." : "Calling remote partner..."}</h2>
              <p className="text-xs text-slate-450 font-medium">بانتظار قبول المشترك للدخول معك بالصوت والصورة بمسار مشفر.</p>
              <button
                onClick={onEndCall}
                className="mt-6 px-6 py-2.5 bg-red-650 hover:bg-red-600 text-white rounded-xl font-bold transition-[scale] cursor-pointer active:scale-95 shadow-md text-xs"
              >
                {t("cancelCallBtn")}
              </button>
            </div>
          )}

          {/* Active Screen Sharing notice panel */}
          {isScreenSharing && (
            <div className="absolute top-4 left-4 bg-indigo-600 border border-indigo-400 text-white text-[10px] p-2 rounded-xl flex items-center gap-1.5 font-bold z-20 shadow-lg animate-pulse">
              <Monitor className="w-3.5 h-3.5" />
              <span>{isRtl ? "أنت تشارك الشاشة الآن" : "Screen Sharing Active"}</span>
            </div>
          )}

          {/* Hand Raised interactive notification decoration */}
          {handRaised && (
            <div className="absolute top-4 right-4 bg-amber-500 border border-amber-350 text-white text-[10px] p-2 rounded-xl flex items-center gap-1.5 font-black z-20 shadow-lg animate-bounce">
              <Hand className="w-3.5 h-3.5 text-white animate-pulse" />
              <span>{isRtl ? "قمت برفع يدك للمشاركة" : "Your Hand is Raised"}</span>
            </div>
          )}
        </div>

        {/* PAGINATION DOTS (Centered under spotlight view) */}
        <div className="flex items-center justify-center gap-1.5 shrink-0">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              onClick={() => setActivePageIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                activePageIndex === idx ? "w-6 bg-indigo-505 bg-indigo-400" : "bg-slate-700 hover:bg-slate-500"
              }`}
              title={`صفحة ${idx + 1}`}
            />
          ))}
        </div>

        {/* LOWER ROW: Bento grid cards representing other team participants (Exactly as in Mock image) */}
        <div className="grid grid-cols-4 gap-3 md:gap-4 shrink-0 font-display">
          
          {/* Loop over 3 participant blocks */}
          {finalDisplayItems.map((item, index) => {
            return (
              <div
                key={item.uid}
                className={`relative aspect-[4/3] rounded-2xl overflow-hidden border transition-all duration-300 shadow-md ${
                  item.activeSpeak
                    ? "bg-[#111126] border-[#10b981]/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-[#10b981]/30"
                    : "bg-[#131326]/90 border-slate-800/80 hover:border-slate-700/80"
                }`}
              >
                {/* Simulated Camera stream or avatar backdrop */}
                {index === 0 && localStream && !isVideoOff && !isScreenSharing ? (
                  // If it's first block, we can render miniature camera thumbnail for ultra high fidelity interaction
                  <video
                    ref={miniLocalVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-75 z-0"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#070714] flex flex-col items-center justify-center z-0 p-3 text-center">
                    <div className={`w-11 h-11 rounded-xl ${item.bg || 'bg-indigo-600'} flex items-center justify-center text-white text-sm font-black`}>
                      {item.name.substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                )}

                {/* Star icon badge if speaking */}
                {item.activeSpeak && (
                  <div className="absolute top-2 right-2 bg-emerald-500/15 border border-emerald-500/35 p-1 rounded-lg z-10">
                    <Star className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  </div>
                )}

                {/* Meta details at bottom of participant box */}
                <div className="absolute bottom-2 inset-x-2 z-10">
                  <div className="bg-[#121226]/85 backdrop-blur-md p-1.5 px-2.5 rounded-xl border border-white/5 flex items-center justify-between gap-1.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-white truncate">{item.name}</p>
                      <p className="text-[8px] text-slate-400 truncate mt-0.5">{item.role}</p>
                    </div>

                    {/* Mic state icon tag */}
                    <div className="shrink-0 flex items-center gap-1">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${item.mic ? 'bg-indigo-500/10 text-indigo-400' : 'bg-red-500/15 text-red-400'}`}>
                        {item.mic ? <Volume2 className="w-3 h-3" /> : <MicOff className="w-3 h-3 text-red-405" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Card 4 (+ Card Representing "View More") */}
          <button
            onClick={() => {
              alert(isRtl ? "تم تفعيل شبكة الاتصال، لتوسيع العرض وإضافة مشاركين جدد استخدم لوحة المحادثات الجانبية وسحب العناوين." : "Expanded grid option activated. Use the participants tab to invite or toggle views.");
            }}
            className="aspect-[4/3] rounded-2xl bg-[#131326]/60 hover:bg-[#1c1c38]/70 border border-dashed border-slate-700/80 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer p-4 group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 group-hover:scale-110 group-hover:border-indigo-400 transition-all flex items-center justify-center mb-1.5 shadow-md">
              <span className="text-xl font-bold leading-none text-indigo-400">+</span>
            </div>
            <span className="text-[10px] font-bold">{isRtl ? "عرض المزيد" : "View More"}</span>
          </button>

        </div>

        {/* 3. FLOATING GLASS CONTROL BAR (Adopted precisely from mockup with label texts) */}
        <div className="bg-[#0b0c16]/90 border border-slate-800/80 rounded-3xl p-3 px-4.5 shadow-[0_15px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Leftmost Settings action button */}
            <div className="flex flex-col items-center group">
              <button
                onClick={() => {
                  alert(isRtl ? "الإعدادات قيد التحميل وتشفير البث المباشر مستقر." : "Advanced stream preferences & controls are optimized.");
                }}
                className="w-11 h-11 rounded-full bg-slate-800/50 hover:bg-slate-700/70 border border-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:scale-105 transition-all cursor-pointer shadow-md"
                title={isRtl ? "إعدادات البث" : "Settings"}
              >
                <Settings className="w-5 h-5 text-slate-350" />
              </button>
              <span className="text-[9px] text-slate-400 font-bold mt-1 max-w-[55px] truncate">{isRtl ? "الإعدادات" : "Settings"}</span>
            </div>

            {/* Core Middle Actions Row */}
            <div className="flex flex-wrap items-center gap-3.5 sm:gap-5 md:gap-6">
              
              {/* Mic Control */}
              <div className="flex flex-col items-center">
                <button
                  onClick={onToggleMute}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 ${
                    isMuted
                      ? "bg-red-550 border border-red-400 text-white"
                      : "bg-[#6c47ff] hover:bg-[#5b36e8] border border-[#6c47ff]/40 text-white shadow-[0_0_15px_rgba(108,71,255,0.35)]"
                  }`}
                  title={isMuted ? t("audioOff") : t("audioOn")}
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                </button>
                <span className="text-[9.5px] text-slate-300 font-bold mt-1">
                  {isRtl ? "الميكروفون" : "Microphone"}
                </span>
              </div>

              {/* Camera Control */}
              <div className="flex flex-col items-center">
                <button
                  onClick={onToggleVideo}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 ${
                    isVideoOff
                      ? "bg-red-550 border border-red-400 text-white"
                      : "bg-[#10b981] hover:bg-[#0fa471] border border-[#10b981]/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                  }`}
                  title={isVideoOff ? t("videoOff") : t("videoOn")}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
                </button>
                <span className="text-[9.5px] text-slate-300 font-bold mt-1">
                  {isRtl ? "الكاميرا" : "Camera"}
                </span>
              </div>

              {/* Screen Share Control */}
              <div className="flex flex-col items-center">
                <button
                  onClick={onToggleScreenShare}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 ${
                    isScreenSharing
                      ? "bg-amber-500 border border-amber-405 text-white"
                      : "bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 text-slate-200"
                  }`}
                  title={t("shareScreenOn")}
                >
                  <Laptop className={`w-5 h-5 ${isScreenSharing ? 'text-white' : 'text-slate-300'}`} />
                </button>
                <span className="text-[9.5px] text-slate-300 font-bold mt-1">
                  {isRtl ? "مشاركة الشاشة" : "Share screen"}
                </span>
              </div>

              {/* Raise Hand Control button */}
              <div className="flex flex-col items-center">
                <button
                  onClick={toggleHand}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 ${
                    handRaised
                      ? "bg-amber-550 border border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.35)]"
                      : "bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 text-slate-200"
                  }`}
                  title={isRtl ? "رفع اليد للمشاركة بسجل الاجتماع" : "Raise your Hand"}
                >
                  <Hand className="w-5 h-5" />
                </button>
                <span className="text-[9.5px] text-slate-300 font-bold mt-1">
                  {isRtl ? "رفع اليد" : "Raise hand"}
                </span>
              </div>

              {/* Chat focus control indicator */}
              <div className="hidden sm:flex flex-col items-center">
                <button
                  onClick={() => {
                    const chatInput = document.getElementById("file_upload_btn");
                    if (chatInput) chatInput.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-11 h-11 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 flex items-center justify-center text-slate-200 hover:scale-105 transition-all cursor-pointer shadow-md"
                  title="الدردشة"
                >
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                </button>
                <span className="text-[9.5px] text-slate-300 font-bold mt-1">
                  {isRtl ? "الدردشة" : "Chat"}
                </span>
              </div>

              {/* Participants focus control indicator */}
              <div className="hidden md:flex flex-col items-center">
                <button
                  onClick={() => {
                    const profileBtn = document.getElementById("my_profile_btn_header");
                    if (profileBtn) profileBtn.click();
                  }}
                  className="w-11 h-11 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 flex items-center justify-center text-slate-200 hover:scale-105 transition-all cursor-pointer shadow-md"
                  title="المشاركون"
                >
                  <Users className="w-5 h-5 text-indigo-400" />
                </button>
                <span className="text-[9.5px] text-slate-300 font-bold mt-1">
                  {isRtl ? "المشاركون" : "Participants"}
                </span>
              </div>

            </div>

            {/* Rightmost red End Call / Leave room trigger */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => {
                  const leaveBtn = document.getElementById("leave_room_btn");
                  if (leaveBtn) leaveBtn.click();
                }}
                className="px-5 py-3.5 rounded-2xl bg-red-650 hover:bg-red-600 border border-red-500/30 text-white font-extrabold text-xs transition-all cursor-pointer shadow-[0_5px_15px_rgba(220,38,38,0.25)] flex items-center gap-2 hover:scale-[1.03] active:scale-95"
              >
                <Phone className="w-4 h-4 rotate-[135deg]" />
                <span>{isRtl ? "إنهاء الاجتماع" : "End Meeting"}</span>
              </button>
              <span className="text-[9px] text-slate-400 font-bold mt-1 invisible h-3">إنهاء الاجتماع</span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
