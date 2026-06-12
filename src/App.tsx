import { useState, useEffect, useRef } from "react";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { LandingPage } from "./components/LandingPage";
import { VideoGrid } from "./components/VideoGrid";
import { ChatPanel } from "./components/ChatPanel";
import { ContactsPanel } from "./components/ContactsPanel";
import { useSignaling } from "./hooks/useSignaling";
import { getMediaStream } from "./utils/webrtc";
import { Message, Participant } from "./types";
import { LogOut, Users, Video, Wifi, WifiOff, Clock, XCircle, MessageSquare } from "lucide-react";
import { AdminDashboard } from "./components/AdminDashboard";

export default function App() {
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    name: string;
    avatarColor: string;
  } | null>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [recentSenders, setRecentSenders] = useState<Record<string, number>>({});
  const [rightPanelTab, setRightPanelTab] = useState<"chat" | "contacts">("chat");

  // Admin and Approval States
  const [isAdminView, setIsAdminView] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [pendingUser, setPendingUser] = useState<{
    nickname: string;
    roomTitle: string;
    avatarColor: string;
  } | null>(null);
  
  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLocalMock, setIsLocalMock] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const screenStreamRef = useRef<MediaStream | null>(null);

  // Monitor network connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Set up background silent anonymous auth to ensure all queries always run with valid permissions
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          if (err?.code === "auth/admin-restricted-operation" || err?.message?.includes("admin-restricted-operation")) {
            console.log("Anonymous auth is restricted/disabled by admin. Gracefully using direct unauthenticated mode.");
          } else {
            console.warn("Background anonymous auth failed:", err);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  // Hook up WebRTC signaling
  const {
    activeCall,
    remoteStream,
    callState,
    error: callError,
    startCall,
    acceptCall,
    endCall,
  } = useSignaling({
    roomId: roomId || "default",
    userId: currentUser?.uid || "guest",
    userName: currentUser?.name || "Anonymous",
    localStream,
  });

  // Keep local stream updated in our tracks when muted/disabled
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isAudioMuted;
      });
    }
  }, [isAudioMuted, localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        // If it's a simulated stream, we can keep the animation running instead of disabling track completely
        track.enabled = !isVideoDisabled;
      });
    }
  }, [isVideoDisabled, localStream]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      stopStreams();
    };
  }, []);

  const stopStreams = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      if ((localStream as any).stopMock) {
        (localStream as any).stopMock();
      }
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setIsAudioMuted(false);
    setIsVideoDisabled(false);
    setIsScreenSharing(false);
  };

  // Real-time snapshot listener to watch for admin approval decisions on user requests
  useEffect(() => {
    if (approvalStatus !== "pending" || !pendingUser) return;

    const userDocRef = doc(db, "users", pendingUser.nickname);
    const unsub = onSnapshot(userDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const status = data.status;
        if (status === "approved") {
          setApprovalStatus("approved");
          await executeActualJoin(pendingUser.roomTitle, pendingUser.nickname, pendingUser.avatarColor);
        } else if (status === "rejected") {
          setApprovalStatus("rejected");
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${pendingUser.nickname}`);
    });

    return () => unsub();
  }, [approvalStatus, pendingUser]);

  // Performs the actual safe login, silent authentication, stream setup, and database linking
  const executeActualJoin = async (title: string, name: string, colorClass: string) => {
    setIsLoading(true);
    try {
      // 1. Silent anonymous authentication to get a unique validated UID, with fallback if auth is disabled
      let uid;
      try {
        const credential = await signInAnonymously(auth);
        uid = credential.user.uid;
      } catch (authError) {
        console.warn("Anonymous sign-in failed, falling back to local generated UID:", authError);
        let localUid = localStorage.getItem("snns_local_uid");
        if (!localUid) {
          localUid = "usr_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          localStorage.setItem("snns_local_uid", localUid);
        }
        uid = localUid;
      }

      const preparedUser = { uid, name, avatarColor: colorClass };
      setCurrentUser(preparedUser);

      // 2. Derive path-safe Room ID from Title
      const safeRoomId = title.trim().toLowerCase().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "-");
      setRoomTitle(title);
      setRoomId(safeRoomId);

      // Update approved user with their current active UID
      const userDocRef = doc(db, "users", name);
      await setDoc(userDocRef, { uid }, { merge: true });

      // Create Room node if it doesn't exist
      const roomDocRef = doc(db, "rooms", safeRoomId);
      await setDoc(roomDocRef, {
        title: title,
        hostId: uid,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      // Grab local camera or emulator media stream
      const media = await getMediaStream(name, { video: true, audio: true });
      setLocalStream(media.stream);
      setIsLocalMock(media.isMock);

      // Set participant as active presence in room
      const participantDocRef = doc(db, "rooms", safeRoomId, "participants", uid);
      await setDoc(participantDocRef, {
        uid,
        name,
        avatar: colorClass,
        isActive: true,
        joinedAt: new Date().toISOString(),
      });

    } catch (e) {
      console.error("Room Access Error:", e);
      alert("حدث خطأ أثناء الدخول للغرفة.");
      setApprovalStatus("none");
    } finally {
      setIsLoading(false);
    }
  };

  // Screens user registration, creates pending documents if needed, or gates access
  const handleJoinOrCreateRoom = async (title: string, name: string, colorClass: string) => {
    setIsLoading(true);
    const cleanName = name.trim();
    if (!cleanName) {
      alert("الرجاء إدخال اسمك المستعار.");
      setIsLoading(false);
      return;
    }

    if (/[#./[\]$]/.test(cleanName)) {
      alert("الاسم يحتوي على رموز غير صالحة. يرجى تجنب (# . / [ ] $)");
      setIsLoading(false);
      return;
    }

    try {
      const userDocRef = doc(db, "users", cleanName);
      const snap = await getDoc(userDocRef);

      if (!snap.exists()) {
        // Create user document as pending
        await setDoc(userDocRef, {
          nickname: cleanName,
          status: "pending",
          uid: "",
          createdAt: new Date().toISOString(),
        });
        setPendingUser({ nickname: cleanName, roomTitle: title, avatarColor: colorClass });
        setApprovalStatus("pending");
      } else {
        const uData = snap.data();
        const currentStatus = uData.status || "pending";

        if (currentStatus === "approved") {
          setApprovalStatus("approved");
          await executeActualJoin(title, cleanName, colorClass);
        } else if (currentStatus === "pending") {
          setPendingUser({ nickname: cleanName, roomTitle: title, avatarColor: colorClass });
          setApprovalStatus("pending");
        } else if (currentStatus === "rejected") {
          setPendingUser({ nickname: cleanName, roomTitle: title, avatarColor: colorClass });
          setApprovalStatus("rejected");
        }
      }
    } catch (e) {
      console.error("Access screening check failed:", e);
      alert("حدث خطأ أثناء فحص تصاريح الدخول.");
    } finally {
      setIsLoading(false);
    }
  };

  // Listen to when new messages are added to trigger pulse/glow animations on active participant card
  useEffect(() => {
    if (messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    const senderId = latestMessage.senderId;
    if (senderId) {
      const now = Date.now();
      setRecentSenders((prev) => ({
        ...prev,
        [senderId]: now,
      }));

      const timer = setTimeout(() => {
        setRecentSenders((prev) => {
          if (prev[senderId] === now) {
            const next = { ...prev };
            delete next[senderId];
            return next;
          }
          return prev;
        });
      }, 5000); // Glow/Pulse active for 5 seconds

      return () => clearTimeout(timer);
    }
  }, [messages]);

  // Listen to Messages and Participants inside active room
  useEffect(() => {
    if (!roomId) return;

    // messages subcollection query
    const messagesCollectionRef = collection(db, "rooms", roomId, "messages");
    const mQuery = query(messagesCollectionRef, orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(mQuery, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data();
        msgs.push({
          id: snap.id,
          senderId: d.senderId,
          senderName: d.senderName,
          senderAvatar: d.senderAvatar,
          text: d.text,
          createdAt: d.createdAt ? new Date(d.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "",
          file: d.file,
        });
      });
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/messages`);
    });

    // participants subcollection query
    const participantsCollectionRef = collection(db, "rooms", roomId, "participants");
    const unsubParticipants = onSnapshot(participantsCollectionRef, (snapshot) => {
      const parts: Participant[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data();
        if (d.isActive) {
          parts.push({
            uid: d.uid,
            name: d.name,
            joinedAt: d.joinedAt,
            isActive: d.isActive,
            avatar: d.avatar,
          });
        }
      });
      setParticipants(parts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/participants`);
    });

    return () => {
      unsubMessages();
      unsubParticipants();
    };
  }, [roomId]);

  // Clean presence on window close/tab unload
  useEffect(() => {
    if (!roomId || !currentUser) return;
    const handleUnload = async () => {
      const docRef = doc(db, "rooms", roomId, "participants", currentUser.uid);
      await deleteDoc(docRef);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [roomId, currentUser]);

  // Handle messaging write tasks
  const handleSendMessage = async (text: string, filePayload?: { name: string; type: string; size?: number; dataUrl: string }) => {
    if (!roomId || !currentUser) return;

    try {
      const messagesCollectionRef = collection(db, "rooms", roomId, "messages");
      
      const payload: any = {
        senderId: currentUser.uid,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatarColor,
        createdAt: new Date().toISOString(),
      };

      if (text) payload.text = text;
      if (filePayload) {
        payload.file = filePayload;
      }

      await addDoc(messagesCollectionRef, payload);
    } catch (e) {
      console.error("Message write error:", e);
      alert("فشل إرسال الرسالة، يرجى التحقق من القوانين.");
    }
  };

  // Exit Room layout
  const handleLeaveRoom = async () => {
    if (window.confirm("هل أنت متأكد من رغبتك في مغادرة الغرفة وإنهاء الجلسة؟")) {
      const uId = currentUser?.uid;
      const rId = roomId;
      
      // Reset State
      setCurrentUser(null);
      setRoomId(null);
      setRoomTitle("");
      setMessages([]);
      setParticipants([]);

      // Sign signaling off
      if (callState !== "idle") {
        await endCall();
      }
      stopStreams();

      // Delete presence reference
      if (uId && rId) {
        try {
          await deleteDoc(doc(db, "rooms", rId, "participants", uId));
        } catch (e) {}
      }
    }
  };

  // Local Controls
  const toggleMute = () => {
    setIsAudioMuted(!isAudioMuted);
  };

  const toggleVideo = () => {
    setIsVideoDisabled(!isVideoDisabled);
  };

  // Full-featured Screen Sharing implementation
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop current screen share and get camera back
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      stopStreams();
      const media = await getMediaStream(currentUser?.name || "User", { video: true, audio: true });
      setLocalStream(media.stream);
      setIsLocalMock(media.isMock);
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;

        // Bind standard event when screen share is ended from default browser overlays
        stream.getVideoTracks()[0].onended = async () => {
          setIsScreenSharing(false);
          stopStreams();
          const media = await getMediaStream(currentUser?.name || "User", { video: true, audio: true });
          setLocalStream(media.stream);
          setIsLocalMock(media.isMock);
        };

        // replace video feed
        setLocalStream(stream);
        setIsScreenSharing(true);
      } catch (e) {
        console.warn("Screen share disabled or denied:", e);
      }
    }
  };

  // Admin Router
  if (isAdminView) {
    return <AdminDashboard onClose={() => setIsAdminView(false)} />;
  }

  // Simple routing: if not inside a room, show Landing Page, else show main screen dashboard
  if (!roomId || !currentUser) {
    if (approvalStatus === "pending" && pendingUser) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
          <div className="absolute top-10 right-10 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative text-center backdrop-blur-md">
            {/* Brand header */}
            <div className="text-xl font-extrabold tracking-tight bg-gradient-to-l from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-6">
              SNNS.PRO
            </div>

            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="relative flex items-center justify-center w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
                <Clock className="w-8 h-8 text-blue-400 animate-pulse" />
                <div className="absolute inset-0 rounded-2xl border border-blue-500/50 animate-ping opacity-30" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">بانتظار تفعيل دخولك لقنوات البث</h2>
                <div className="text-xs text-amber-400 font-medium mt-1.5 flex items-center gap-1.5 justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-550 animate-ping" />
                  الاسم المستعار: {pendingUser.nickname} • قيد الانتظار حالياً
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl mb-6 text-right text-xs text-slate-300 leading-relaxed flex flex-col gap-2">
              <div className="font-bold text-slate-200 mb-1">💡 معلومات سريعة:</div>
              <div>• يدعم هذا التطبيق مشاركة البث المرئي عالي الدقة دون تفريط في الخصوصية.</div>
              <div>• بمجرد قبول طلب تفعيل اسمك من لوحة الإدارة، سيتم تحويلك تلقائياً دون تحديث المتصفح.</div>
              <div>• لتسهيل تواصلك، يرجى عدم قفل هذه الشاشة للحفاظ على حجز الاتصال الفوري الخاص بك.</div>
            </div>

            <button
              onClick={() => {
                setApprovalStatus("none");
                setPendingUser(null);
              }}
              className="w-full bg-slate-800 hover:bg-slate-705 text-slate-300 text-xs py-3.5 rounded-xl transition-all font-semibold cursor-pointer"
            >
              إلغاء الطلب والعودة للرئيسية
            </button>
          </div>
        </div>
      );
    }

    if (approvalStatus === "rejected" && pendingUser) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
          <div className="w-full max-w-md bg-slate-900 border border-red-950/30 rounded-3xl p-6 md:p-8 shadow-2xl relative text-center">
            <div className="text-xl font-extrabold tracking-tight text-red-500 mb-6">
              SNNS.PRO
            </div>

            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <XCircle className="w-8 h-8 text-rose-450" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">تم عدم قبول هذا الاسم المستعار</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  نأسف، لقد فضلت إدارة SNNS.PRO عدم تفعيل دخول الاسم المستعار [ {pendingUser.nickname} ] في الوقت الراهن.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setApprovalStatus("none");
                setPendingUser(null);
              }}
              className="w-full bg-slate-800 hover:bg-slate-755 text-white text-xs py-3 rounded-xl transition-all font-semibold cursor-pointer"
            >
              العودة وتجربة اسم آخر
            </button>
          </div>
        </div>
      );
    }

    return (
      <LandingPage
        onJoinRoom={handleJoinOrCreateRoom}
        isLoading={isLoading}
        onOpenAdmin={() => setIsAdminView(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-300 relative overflow-hidden" dir="rtl">
      {/* Decorative starry backdrop */}
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-blue-100/20 to-transparent pointer-events-none" />

      {/* Main App Bar */}
      <header className="bg-white border-b border-slate-200/80 p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-105">
              <Video className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {roomTitle}
                <span className="text-xxs px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-650 rounded-md font-mono shrink-0">
                  {participants.length} متصل
                </span>
              </h2>
              <p className="text-2xs text-slate-400 mt-0.5 font-mono">ROOM_ID: {roomId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Net connection status badge */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-2xs font-semibold ${
                isOnline
                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                  : "bg-red-50 border-red-100 text-red-700"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 animate-ping" />
                  الشبكة متصلة
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  غير متصل بالشبكة
                </>
              )}
            </div>

            {/* Leave room / Log out action button */}
            <button
              id="leave_room_btn"
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 bg-red-650 hover:bg-red-700 text-white text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
              title="خروج من الغرفة"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">مغادرة اللقاء</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative min-h-0">
        
        {/* Left Column: Video Workspace & Participants */}
        <div className="lg:col-span-8 flex flex-col gap-5 min-h-0">
          
          {/* Active Call Signaling error alerts */}
          {(callError || callState === "idle" && callError) && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-right text-xs text-red-700">
              {callError}
            </div>
          )}

          {/* Video stream container */}
          <div className="flex-1 min-h-0">
            <VideoGrid
              localStream={localStream}
              remoteStream={remoteStream}
              isMuted={isAudioMuted}
              isVideoOff={isVideoDisabled}
              isScreenSharing={isScreenSharing}
              onToggleMute={toggleMute}
              onToggleVideo={toggleVideo}
              onToggleScreenShare={toggleScreenShare}
              activeCall={activeCall}
              callState={callState}
              onStartCall={startCall}
              onAcceptCall={acceptCall}
              onEndCall={endCall}
              nickname={currentUser.name}
              roomTitle={roomTitle}
            />
          </div>

          {/* Active Participants bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-right">
              <Users className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-700">المتواجدون في الغرفة حالياً:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {participants.map((part) => {
                const isRecentSender = !!recentSenders[part.uid];
                return (
                  <div
                    key={part.uid}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 relative ${
                      isRecentSender
                        ? "bg-indigo-50/90 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.55)] scale-105"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    {/* Ring animation if sending a message */}
                    <span className="relative flex h-2.5 w-2.5">
                      {isRecentSender && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${part.uid === currentUser.uid ? "bg-blue-600" : "bg-emerald-500"}`} />
                    </span>

                    <span className={`text-xs font-semibold transition-colors duration-300 ${isRecentSender ? "text-indigo-800" : "text-slate-700 font-medium"}`}>
                      {part.name}
                    </span>

                    {part.uid === currentUser.uid && (
                      <span className="text-3xs text-slate-400 font-mono shrink-0">(أنت)</span>
                    )}

                    {/* Notification badge dot for message */}
                    {isRecentSender && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Text Chat & Contacts Directory */}
        <div className="lg:col-span-4 min-h-[450px] lg:min-h-0 flex flex-col gap-4">
          {/* Tab Selection */}
          <div className="bg-white border border-slate-200/80 p-1 rounded-2xl flex gap-1 shadow-sm shrink-0" dir="rtl">
            <button
              onClick={() => setRightPanelTab("chat")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                rightPanelTab === "chat"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              المحادثة الفورية
            </button>
            <button
              onClick={() => setRightPanelTab("contacts")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                rightPanelTab === "contacts"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Users className="w-4 h-4" />
              دليل جهات الاتصال
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {rightPanelTab === "chat" ? (
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                userId={currentUser.uid}
                roomId={roomId}
              />
            ) : (
              <ContactsPanel
                currentUsername={currentUser.name}
                currentRoomTitle={roomTitle}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
