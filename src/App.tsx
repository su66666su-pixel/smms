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
import { DMsPanel } from "./components/DMsPanel";
import { useSignaling } from "./hooks/useSignaling";
import { getMediaStream } from "./utils/webrtc";
import { Message, Participant } from "./types";
import { LogOut, Users, Video, Wifi, WifiOff, Clock, XCircle, MessageSquare, Lock } from "lucide-react";
import { AdminDashboard } from "./components/AdminDashboard";
import { translations, LANGUAGES, LanguageCode } from "./utils/translations";
import { LanguageSelector } from "./components/LanguageSelector";
import { playMessageChime, playJoinChime } from "./utils/audio";
import { 
  syncUserToSupabase, 
  syncRoomToSupabase, 
  syncParticipantToSupabase, 
  deleteParticipantFromSupabase, 
  syncMessageToSupabase 
} from "./supabase";

export default function App() {
  const [lang, setLang] = useState<LanguageCode>(() => {
    return (localStorage.getItem("snns_lang") as LanguageCode) || "ar";
  });

  const t = (key: string, replacements?: Record<string, string | number>) => {
    let str = translations[lang]?.[key] || translations["ar"]?.[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  useEffect(() => {
    const langInfo = LANGUAGES.find((l) => l.code === lang);
    const direction = langInfo?.dir || "ltr";
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", lang);
    localStorage.setItem("snns_lang", lang);
  }, [lang]);

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
  const [rightPanelTab, setRightPanelTab] = useState<"chat" | "contacts" | "dms">("chat");

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

  const prevMessagesLengthRef = useRef<number>(0);
  const prevParticipantsRef = useRef<string[]>([]);

  const playNotificationSound = (type: "message" | "join") => {
    if (type === "message") {
      playMessageChime();
    } else if (type === "join") {
      playJoinChime();
    }
  };

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
    const seedSuperAdmin = async () => {
      try {
        const superAdminRef = doc(db, "users", "1007363904");
        const snap = await getDoc(superAdminRef);
        if (!snap.exists()) {
          console.log("Seeding super admin account 1007363904 into database...");
          await setDoc(superAdminRef, {
            nickname: "1007363904",
            password: "139213",
            role: "admin",
            status: "approved",
            email: "su66666su@gmail.com",
            createdAt: new Date().toISOString(),
            avatarColor: "bg-rose-600 font-extrabold text-white text-base",
            accountType: "public"
          });
        } else {
          const currentData = snap.data();
          if (currentData.password !== "139213" || currentData.role !== "admin" || currentData.status !== "approved") {
            await setDoc(superAdminRef, {
              ...currentData,
              password: "139213",
              role: "admin",
              status: "approved"
            }, { merge: true });
          }
        }
      } catch (err) {
        console.warn("Failed to check/seed super admin in firestore:", err);
      }
    };

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
      } else {
        // Safe seeding after login
        seedSuperAdmin();
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
      try {
        const uSnap = await getDoc(userDocRef);
        if (uSnap.exists()) {
          await syncUserToSupabase(name, uSnap.data());
        }
      } catch (err) {}

      // Create Room node if it doesn't exist
      const roomDocRef = doc(db, "rooms", safeRoomId);
      const roomPayload = {
        title: title,
        hostId: uid,
        createdAt: new Date().toISOString(),
      };
      await setDoc(roomDocRef, roomPayload, { merge: true });
      await syncRoomToSupabase(safeRoomId, roomPayload);

      // Grab local camera or emulator media stream
      const media = await getMediaStream(name, { video: true, audio: true });
      setLocalStream(media.stream);
      setIsLocalMock(media.isMock);

      // Set participant as active presence in room
      const participantDocRef = doc(db, "rooms", safeRoomId, "participants", uid);
      const participantPayload = {
        uid,
        name,
        avatar: colorClass,
        isActive: true,
        joinedAt: new Date().toISOString(),
      };
      await setDoc(participantDocRef, participantPayload);
      await syncParticipantToSupabase(safeRoomId, uid, participantPayload);

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
        const pendingUserPayload = {
          nickname: cleanName,
          status: "pending",
          uid: "",
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, pendingUserPayload);
        await syncUserToSupabase(cleanName, pendingUserPayload);
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

    // Restore cached message backup from local storage first to guarantee instant loader responsiveness
    const cached = localStorage.getItem(`chat_history_${roomId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setMessages(parsed);
        prevMessagesLengthRef.current = parsed.length;
      } catch (err) {
        console.error("Local storage sync error:", err);
      }
    } else {
      setMessages([]);
      prevMessagesLengthRef.current = 0;
    }

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
          isPrivate: d.isPrivate,
          recipientId: d.recipientId,
          recipientName: d.recipientName,
        });
      });

      // LocalStorage temporary safe caching for quick recovery
      try {
        localStorage.setItem(`chat_history_${roomId}`, JSON.stringify(msgs));
      } catch (e) {
        console.warn("Saving chat history to localStorage failed:", e);
      }

      // Play notification chime for new messages received (if the sender is not current user)
      if (msgs.length > prevMessagesLengthRef.current) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.senderId !== currentUser?.uid && prevMessagesLengthRef.current > 0) {
          playNotificationSound("message");
        }
      }
      prevMessagesLengthRef.current = msgs.length;

      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/messages`);
    });

    // participants subcollection query
    const participantsCollectionRef = collection(db, "rooms", roomId, "participants");
    const unsubParticipants = onSnapshot(participantsCollectionRef, (snapshot) => {
      const parts: Participant[] = [];
      const currentUids: string[] = [];
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
          currentUids.push(d.uid);
        }
      });

      // Play notification chime for newly entered participants
      if (prevParticipantsRef.current.length > 0) {
        const newlyJoined = currentUids.filter(uid => !prevParticipantsRef.current.includes(uid));
        if (newlyJoined.length > 0 && !newlyJoined.includes(currentUser?.uid || "")) {
          playNotificationSound("join");
        }
      }
      prevParticipantsRef.current = currentUids;

      setParticipants(parts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/participants`);
    });

    return () => {
      unsubMessages();
      unsubParticipants();
    };
  }, [roomId, currentUser]);

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
  const handleSendMessage = async (
    text: string, 
    filePayload?: { name: string; type: string; size?: number; dataUrl: string },
    isPrivate?: boolean,
    recipientId?: string,
    recipientName?: string
  ) => {
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
      if (isPrivate) {
        payload.isPrivate = true;
        payload.recipientId = recipientId;
        payload.recipientName = recipientName;
      }

      const docRef = await addDoc(messagesCollectionRef, payload);
      await syncMessageToSupabase(docRef.id, roomId, payload);
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
          await deleteParticipantFromSupabase(rId, uId);
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
      const isRtl = lang === "ar" || lang === "ur";
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
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
                <h2 className="text-lg font-bold text-white">{t("pendingApprovalTitle")}</h2>
                <div className="text-xs text-amber-400 font-medium mt-1.5 flex items-center gap-1.5 justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-550 animate-ping" />
                  {t("pendingApprovalSub", { nickname: pendingUser.nickname })}
                </div>
              </div>
            </div>

            <div className={`p-4 bg-slate-950/60 border border-slate-800 rounded-xl mb-6 text-xs text-slate-300 leading-relaxed flex flex-col gap-2 ${isRtl ? "text-right" : "text-left"}`}>
              <div className="font-bold text-slate-200 mb-1">💡 {t("pendingInfoTitle")}</div>
              <div>• {t("pendingInfoLine1")}</div>
              <div>• {t("pendingInfoLine2")}</div>
              <div>• {t("pendingInfoLine3")}</div>
            </div>

            <button
              onClick={() => {
                setApprovalStatus("none");
                setPendingUser(null);
              }}
              className="w-full bg-slate-800 hover:bg-slate-705 text-slate-300 text-xs py-3.5 rounded-xl transition-all font-semibold cursor-pointer"
            >
              {t("pendingCancel")}
            </button>
          </div>
        </div>
      );
    }

    if (approvalStatus === "rejected" && pendingUser) {
      const isRtl = lang === "ar" || lang === "ur";
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
          <div className="w-full max-w-md bg-slate-900 border border-red-950/30 rounded-3xl p-6 md:p-8 shadow-2xl relative text-center">
            <div className="text-xl font-extrabold tracking-tight text-red-500 mb-6">
              SNNS.PRO
            </div>

            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <XCircle className="w-8 h-8 text-rose-450" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{t("rejectedTitle")}</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {t("rejectedDesc", { nickname: pendingUser.nickname })}
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
              {t("rejectedBack")}
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
        lang={lang}
        onLanguageChange={setLang}
        t={t}
      />
    );
  }

  const isRtl = lang === "ar" || lang === "ur";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-300 relative overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      {/* Decorative starry backdrop */}
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-blue-100/20 to-transparent pointer-events-none" />

      {/* Main App Bar */}
      <header className="bg-white border-b border-slate-200/80 p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-105">
              <Video className="w-5 h-5 text-blue-600" />
            </div>
            <div className={isRtl ? "text-right" : "text-left"}>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {roomTitle}
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-650 rounded-md font-mono shrink-0">
                  {t("connectedParticipantsCount", { count: participants.length })}
                </span>
              </h2>
              <p className="text-2xs text-slate-400 mt-0.5 font-mono">ROOM_ID: {roomId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Multi-language Selector in workspace header */}
            <LanguageSelector currentLanguage={lang} onLanguageChange={setLang} dark={false} />

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
                  {t("networkConnected")}
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  {t("networkDisconnected")}
                </>
              )}
            </div>

            {/* Leave room / Log out action button */}
            <button
              id="leave_room_btn"
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 bg-red-650 hover:bg-red-700 text-white text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
              title={t("leaveRoomTooltip")}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t("leaveRoomBtn")}</span>
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
            <div className={`bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 ${isRtl ? "text-right" : "text-left"}`}>
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
              t={t}
              lang={lang}
            />
          </div>

          {/* Active Participants bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-700">{t("activeParticipantsLabel")}</span>
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
                      <span className="text-3xs text-slate-450 font-mono shrink-0">({t("badgeYou")})</span>
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
          <div className="bg-white border border-slate-200/80 p-1 rounded-2xl flex gap-1 shadow-sm shrink-0" dir={isRtl ? "rtl" : "ltr"}>
            <button
              onClick={() => setRightPanelTab("chat")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                rightPanelTab === "chat"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="truncate">{t("tabChat")}</span>
            </button>
            <button
              onClick={() => setRightPanelTab("dms")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                rightPanelTab === "dms"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="truncate">{lang === "ar" ? "الرسائل الخاصة" : "Private DMs"}</span>
            </button>
            <button
              onClick={() => setRightPanelTab("contacts")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                rightPanelTab === "contacts"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="truncate">{t("tabContacts")}</span>
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {rightPanelTab === "chat" ? (
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                userId={currentUser.uid}
                roomId={roomId}
                participants={participants}
                t={t}
                lang={lang}
              />
            ) : rightPanelTab === "contacts" ? (
              <ContactsPanel
                currentUsername={currentUser.name}
                currentRoomTitle={roomTitle}
                participants={participants}
                recentSenders={recentSenders}
                currentUserId={currentUser.uid}
                t={t}
                lang={lang}
              />
            ) : (
              <DMsPanel
                currentUsername={currentUser.name}
                lang={lang}
                t={t}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
