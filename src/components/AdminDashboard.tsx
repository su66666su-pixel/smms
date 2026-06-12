import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  Plus,
  Search,
  Lock,
  LogOut,
  Video,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Clock,
  RefreshCw,
  Shield,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";

interface AdminDashboardProps {
  onClose: () => void;
}

interface WebUser {
  nickname: string;
  status: "pending" | "approved" | "rejected";
  uid?: string;
  createdAt: string;
  role?: "admin" | "moderator" | "user";
  password?: string;
  email?: string;
}

interface ActiveRoom {
  id: string;
  title: string;
  hostId: string;
  createdAt: string;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  // Authentication State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem("snns_admin_logged") === "true";
  });
  const [authError, setAuthError] = useState("");
  const [loggedInRole, setLoggedInRole] = useState(() => {
    return sessionStorage.getItem("snns_admin_role") || "user";
  });

  // Users & Rooms State
  const [users, setUsers] = useState<WebUser[]>([]);
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Room Monitoring State
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomTitle, setSelectedRoomTitle] = useState<string | null>(null);
  const [monitoredParticipants, setMonitoredParticipants] = useState<any[]>([]);
  const [monitoredMessages, setMonitoredMessages] = useState<any[]>([]);
  const [isMonitoringLoading, setIsMonitoringLoading] = useState(false);

  // New User Form State
  const [newNickname, setNewNickname] = useState("");
  const [newStatus, setNewStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [newRole, setNewRole] = useState<"admin" | "moderator" | "user">("user");
  const [newPassword, setNewPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "moderator" | "user">("all");

  // Advanced inline password modifications & Broadcast system
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [editedPassword, setEditedPassword] = useState("");
  const [adminBroadcastText, setAdminBroadcastText] = useState("");
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSuccess, setBroadcastSuccess] = useState("");


  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (cleanUser === "1007363904" && cleanPass === "139213") {
      setIsLoggedIn(true);
      setLoggedInRole("admin");
      sessionStorage.setItem("snns_admin_logged", "true");
      sessionStorage.setItem("snns_admin_role", "admin");
      sessionStorage.setItem("snns_admin_user", "المدير العام");
      setAuthError("");
      return;
    }

    try {
      const userRef = doc(db, "users", cleanUser);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const u = snap.data();
        const savedPass = u.password;
        const role = u.role || "user";

        if (savedPass === cleanPass) {
          if (role === "admin" || role === "moderator") {
            setIsLoggedIn(true);
            setLoggedInRole(role);
            sessionStorage.setItem("snns_admin_logged", "true");
            sessionStorage.setItem("snns_admin_role", role);
            sessionStorage.setItem("snns_admin_user", cleanUser);
            setAuthError("");
          } else {
            setAuthError("عذراً، هذا الحساب لا يملك صلاحيات إدارية (مشرف أو مراقب).");
          }
        } else {
          setAuthError("الرقم السري غير صحيح!");
        }
      } else {
        setAuthError("اسم المستخدم غير مسجل في النظام!");
      }
    } catch (err) {
      console.error("Admin db login error:", err);
      setAuthError("حدث خطأ أثناء الاتصال بالخادم الرئيسي.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInRole("user");
    sessionStorage.removeItem("snns_admin_logged");
    sessionStorage.removeItem("snns_admin_role");
    sessionStorage.removeItem("snns_admin_user");
  };

  // Listen to Users and Rooms inside Firestore
  useEffect(() => {
    if (!isLoggedIn) return;

    setIsLoading(true);

    // 1. Real-time Users Snapshot
    const usersCollectionRef = collection(db, "users");
    const unsubUsers = onSnapshot(
      usersCollectionRef,
      (snapshot) => {
        const uList: WebUser[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          uList.push({
            nickname: snap.id, // Username/Nickname is the document ID
            status: d.status || "pending",
            uid: d.uid || "",
            createdAt: d.createdAt || new Date().toISOString(),
            role: d.role || "user",
            password: d.password || "",
            email: d.email || "",
          });
        });
        // Sort: pending first, then latest created
        uList.sort((a, b) => {
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (a.status !== "pending" && b.status === "pending") return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setUsers(uList);
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
        handleFirestoreError(error, OperationType.LIST, "users");
      }
    );

    // 2. Real-time Rooms Snapshot
    const roomsCollectionRef = collection(db, "rooms");
    const unsubRooms = onSnapshot(
      roomsCollectionRef,
      (snapshot) => {
        const rList: ActiveRoom[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          rList.push({
            id: snap.id,
            title: d.title || "",
            hostId: d.hostId || "",
            createdAt: d.createdAt || "",
          });
        });
        setRooms(rList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "rooms");
      }
    );

    return () => {
      unsubUsers();
      unsubRooms();
    };
  }, [isLoggedIn]);

  // Real-time listener for the Monitored Room (Participants & Messages)
  useEffect(() => {
    if (!selectedRoomId) {
      setMonitoredParticipants([]);
      setMonitoredMessages([]);
      return;
    }

    setIsMonitoringLoading(true);

    const partsRef = collection(db, "rooms", selectedRoomId, "participants");
    const unsubParts = onSnapshot(partsRef, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setMonitoredParticipants(list);
      setIsMonitoringLoading(false);
    }, (error) => {
      console.error("Error loading monitor participants:", error);
    });

    const msgsRef = collection(db, "rooms", selectedRoomId, "messages");
    const unsubMsgs = onSnapshot(msgsRef, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      // Sort messages chronologically
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMonitoredMessages(list);
    }, (error) => {
      console.error("Error loading monitor messages:", error);
    });

    return () => {
      unsubParts();
      unsubMsgs();
    };
  }, [selectedRoomId]);

  // Approve a user
  const handleApprove = async (nickname: string) => {
    if (loggedInRole !== "admin") {
      alert("⚠️ عذراً، لا تمتلك الصلاحية الكافية للموافقة على الأعضاء. تقتصر هذه الميزة على المشرف العام فقط.");
      return;
    }
    try {
      const userRef = doc(db, "users", nickname);
      await setDoc(userRef, { status: "approved" }, { merge: true });
    } catch (e) {
      console.error("Error approving user:", e);
      alert("فشل تحديث حالة المستخدم.");
    }
  };

  // Reject a user
  const handleReject = async (nickname: string) => {
    if (loggedInRole !== "admin") {
      alert("⚠️ عذراً، لا تمتلك الصلاحية الكافية لرفض الأعضاء. تقتصر هذه الميزة على المشرف العام فقط.");
      return;
    }
    try {
      const userRef = doc(db, "users", nickname);
      await setDoc(userRef, { status: "rejected" }, { merge: true });
    } catch (e) {
      console.error("Error rejecting user:", e);
      alert("فشل تحديث حالة المستخدم.");
    }
  };

  // Delete a user
  const handleDelete = async (nickname: string) => {
    if (loggedInRole !== "admin") {
      alert("⚠️ عذراً، حذف الأعضاء بالكامل متاح فقط للمشرف العام المشرف على كامل النظام.");
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف المستخدم "${nickname}" نهائياً من النظام؟`)) {
      try {
        const userRef = doc(db, "users", nickname);
        await deleteDoc(userRef);
      } catch (e) {
        console.error("Error deleting user:", e);
        alert("فشل حذف المستخدم.");
      }
    }
  };

  // Promote / Demote Role of a user
  const handleSetRole = async (nickname: string, role: "admin" | "moderator" | "user") => {
    if (loggedInRole !== "admin") {
      alert("⚠️ عذراً، تعديل وتغيير الصلاحيات الإدارية للأعضاء مقتصر فقط على المشرف العام.");
      return;
    }
    try {
      const userRef = doc(db, "users", nickname);
      await setDoc(userRef, { role }, { merge: true });
      alert(`تم تعديل صلاحية "${nickname}" بنجاح فورا.`);
    } catch (e) {
      console.error("Error setting user role:", e);
      alert("فشل تعديل صلاحية المستخدم.");
    }
  };

  // Kick participant from monitored room
  const handleKickParticipant = async (pId: string) => {
    if (!selectedRoomId) return;
    if (window.confirm("هل أنت متأكد من رغبتك في طرد هذا المشارك من الغرفة؟")) {
      try {
        await deleteDoc(doc(db, "rooms", selectedRoomId, "participants", pId));
        alert("تم طرد العضو من الغرفة بنجاح!");
      } catch (e) {
        console.error("Error kicking participant:", e);
        alert("فشل طرد العضو.");
      }
    }
  };

  // Delete message inside monitored room
  const handleDeleteMessage = async (msgId: string) => {
    if (!selectedRoomId) return;
    if (window.confirm("هل أنت متأكد من رغبتك في حذف هذه الرسالة من السجل؟")) {
      try {
        await deleteDoc(doc(db, "rooms", selectedRoomId, "messages", msgId));
      } catch (e) {
        console.error("Error deleting message:", e);
        alert("فشل حذف الرسالة.");
      }
    }
  };

  // Clear / Terminate full Room
  const handleCloseRoom = async (rId: string) => {
    if (window.confirm("⚠️ هل أنت متأكد من رغبتك في إغلاق هذه الغرفة بالكامل وطرد جميع الموجودين؟")) {
      try {
        await deleteDoc(doc(db, "rooms", rId));
        if (selectedRoomId === rId) {
          setSelectedRoomId(null);
          setSelectedRoomTitle(null);
        }
        alert("تم إغلاق الغرفة وطرد المشاركين بنجاح!");
      } catch (e) {
        console.error("Error closing room:", e);
        alert("فشل إغلاق الغرفة.");
      }
    }
  };

  // Update user's password directly from management list
  const handleUpdatePassword = async (nickname: string, newPass: string) => {
    const cleanPass = newPass.trim();
    if (!cleanPass) {
      alert("الطلب غير صالح. يجب تحديد كلمة مرور صالحة.");
      return;
    }
    try {
      const userRef = doc(db, "users", nickname);
      await setDoc(userRef, { password: cleanPass }, { merge: true });
      alert(`تم تحديث الرمز السري للمستشار "${nickname}" بنجاح!`);
      setEditingNickname(null);
      setEditedPassword("");
    } catch (e) {
      console.error("Error updating member password:", e);
      alert("فشل تعديل الرمز السري.");
    }
  };

  // Broadcast an urgent system message/warning inside a room chat
  const handleBroadcastMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastError("");
    setBroadcastSuccess("");

    if (!selectedRoomId) {
      setBroadcastError("الرجاء تشغيل بث واختيار غرفة صالحة أولاً.");
      return;
    }

    const textClean = adminBroadcastText.trim();
    if (!textClean) {
      setBroadcastError("الرجاء كتابة محتوى الرسالة الإدارية المراد إرسالها.");
      return;
    }

    try {
      const messagesCollectionRef = collection(db, "rooms", selectedRoomId, "messages");
      const randomDocId = "admin_alert_" + Date.now();
      const payload = {
        senderId: "admin_system",
        senderName: "🚨 تنبيه النظام الإداري",
        senderAvatar: "bg-rose-500 font-black text-rose-100",
        createdAt: new Date().toISOString(),
        text: textClean,
        isAdminStatic: true
      };
      
      await setDoc(doc(messagesCollectionRef, randomDocId), payload);
      setAdminBroadcastText("");
      setBroadcastSuccess("تم بث التنبيه الإداري عاجلاً في الغرفة بنجاح!");
      setTimeout(() => setBroadcastSuccess(""), 3500);
    } catch (err) {
      console.error("Broadcast broadcast error:", err);
      setBroadcastError("فشل بث وإلحاق التنبيه بقاعدة البيانات.");
    }
  };

  // Add user manually with role and password
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (loggedInRole !== "admin") {
      setFormError("⚠️ عذراً، ميزة إضافة أو تعديل وإدارة صلاحيات الأعضاء متاحة فقط للمشرف العام.");
      return;
    }

    const nameClean = newNickname.trim();
    const passClean = newPassword.trim();

    if (!nameClean) {
      setFormError("الرجاء إدخال الاسم المستعار للمستخدم!");
      return;
    }

    if (!passClean) {
      setFormError("الرجاء تحديد كلمة المرور / الرقم السري للمستخدم الجديد للتمكن من الدخول!");
      return;
    }

    // Path safety validation
    if (/[#./[\]$]/.test(nameClean)) {
      setFormError("الاسم المستعار غير صالح (تجنب الرموز الخاصة # . / [ ] $)");
      return;
    }

    try {
      const userRef = doc(db, "users", nameClean);
      await setDoc(userRef, {
        nickname: nameClean,
        status: newStatus,
        uid: "",
        createdAt: new Date().toISOString(),
        role: newRole,
        password: passClean,
      });
      setFormSuccess(`تمت إضافة المستخدم "${nameClean}" بنجاح بصفة: ${newRole === "admin" ? "مشرف عام" : newRole === "moderator" ? "مراقب غرف" : "عضو عادي"} وبحالة: ${newStatus === "approved" ? "نشط ومفعل" : "بانتظار الموافقة"}`);
      setNewNickname("");
      setNewPassword("");
    } catch (e) {
      console.error("Error creating user:", e);
      setFormError("حدث خطأ أثناء إضافة المستخدم.");
    }
  };

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.nickname.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === "all" || u.status === statusFilter;
    const matchesRole = roleFilter === "all" || 
      (roleFilter === "admin" && u.role === "admin") ||
      (roleFilter === "moderator" && u.role === "moderator") ||
      (roleFilter === "user" && (u.role === "user" || !u.role));
    return matchesSearch && matchesFilter && matchesRole;
  });

  const pendingCount = users.filter((u) => u.status === "pending").length;
  const approvedCount = users.filter((u) => u.status === "approved").length;

  // Render Login page if not authenticated
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
        
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3 mb-8 text-center">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
              <ShieldAlert className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-l from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                SNNS.PRO لوحة التحكم
              </h2>
              <p className="text-xs text-slate-400 mt-1.5">
                يرجى إدخال بيانات هوية المسؤول لتسجيل الدخول بأمان
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-medium">
                {authError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-350">اسم المستخدم الإداري</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 transition-all text-right"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-350">الرقم السري (PIN / Password)</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل الرقم السري الإداري..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 transition-all text-right font-mono"
                />
              </div>
            </div>

            <button
              id="admin_signin_btn"
              type="submit"
              className="w-full mt-4 bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
            >
              <Lock className="w-4 h-4" />
              تأكيد الدخول الآمن
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full border border-slate-800 hover:bg-slate-800/40 text-slate-400 text-xs py-3 rounded-xl transition-all font-semibold"
            >
              إلغاء والعودة للرئيسية
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Banner admin header */}
      <header className="bg-slate-950 border-b border-slate-800/80 p-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold bg-gradient-to-l from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  SNNS.PRO
                </span>
                <span className="text-3xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-md font-bold">
                  منصة المشرف
                </span>
              </div>
              <p className="text-xxs text-slate-400">إدارة تصاريح دخول المستخدمين للبث المباشر</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1 hover:bg-slate-800/80 border border-slate-800 px-3 py-2 rounded-xl text-xs transition-all font-semibold text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
              العودة للموقع
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-red-650/10 hover:bg-red-650/20 border border-red-500/30 text-rose-400 px-3 py-2 rounded-xl text-xs transition-all font-bold"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Top Active Session Details Span */}
        <div className="lg:col-span-12 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${loggedInRole === "admin" ? "bg-purple-900/20 text-purple-400 border border-purple-500/20" : "bg-blue-900/20 text-blue-400 border border-blue-500/20"}`}>
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">مرحباً بك مجدداً في الإدارة:</span>
                <span className="text-sm font-black text-white">{sessionStorage.getItem("snns_admin_user") || "المدير"}</span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold border ${
                  loggedInRole === "admin" 
                    ? "bg-purple-500/10 border-purple-500/25 text-purple-400" 
                    : "bg-blue-500/10 border-blue-500/25 text-blue-450"
                }`}>
                  {loggedInRole === "admin" ? "👑 مدير عام النظام" : "🛡️ مراقب غرف معتمد"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {loggedInRole === "admin" 
                  ? "✓ تمتلك الصلاحية الكاملة لتفعيل طلبات التسجيل، تعيين وإلغاء المشرفين أو المراقبين، تغيير الرموز السرية، وإدارة المحادثات والبث الحي."
                  : "🛡️ أنت مسجل كمراقب غرف. نظام التحكم النشط يتيح لك متابعة المحادثات وطرد الأجهزة الخارجة ومكافحة السبام فوراً."
                }
              </p>
            </div>
          </div>
          {loggedInRole === "moderator" && (
            <div className="bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl text-[10px] text-amber-400/90 font-medium shrink-0">
              ⚠️ صلاحية محدودة: عمليات تعديل الحسابات وتعيين الرموز حصرية للمدير العام.
            </div>
          )}
        </div>

        {/* Left Side: Stats Cards and user registration forms */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Quick Stats Grid */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              مؤشرات النظام
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800/60 p-3 rounded-xl text-center">
                <div className="text-xl font-black text-white">{users.length}</div>
                <div className="text-xxs text-slate-400 mt-1">إجمالي الأعضاء</div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl text-center">
                <div className="text-xl font-black text-amber-400">{pendingCount}</div>
                <div className="text-xxs text-slate-400 mt-1">بانتظار الموافقة</div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl text-center">
                <div className="text-xl font-black text-emerald-400">{approvedCount}</div>
                <div className="text-xxs text-slate-400 mt-1">المفعلين</div>
              </div>
            </div>
          </div>

          {/* Add User Manually Form */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
              <Plus className="w-4 h-4 text-blue-400" />
              إضافة مستخدم يدوي مفعل فورا
            </h3>

            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              {formError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xxs text-red-400 font-medium">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xxs text-emerald-400 font-medium">
                  {formSuccess}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-semibold text-slate-300">الاسم المستعار للمستخدم *</label>
                <input
                  type="text"
                  required
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="اكتب المعرف الفريد للمستخدم..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 outline-none rounded-xl px-3.5 py-2.5 text-xs text-slate-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-semibold text-slate-300">الرقم السري / كلمة المرور له *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حدد له رمز مرور للمصادقة..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 outline-none rounded-xl px-3.5 py-2.5 text-xs text-slate-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-semibold text-slate-300">مستوى الصلاحية الإدارية</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 outline-none rounded-xl px-3.5 py-2.5 text-xs text-slate-200 cursor-pointer"
                >
                  <option value="user">عضو عادي (Regular User)</option>
                  <option value="moderator">مراقب غرف فقط (Room Moderator)</option>
                  <option value="admin">مشرف عام كامل النظام (Global Admin)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-semibold text-slate-300">حالة الصلاحية الممنوحة له</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 outline-none rounded-xl px-3.5 py-2.5 text-xs text-slate-200 cursor-pointer"
                >
                  <option value="approved">مفعل ومقبول (Approved)</option>
                  <option value="pending">قيد الانتظار والمراجعة (Pending)</option>
                  <option value="rejected">مرفوض بالكامل (Rejected)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                حفظ العضو في النظام
              </button>
            </form>
          </div>

          {/* Active Rooms Monitor */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-white flex flex-col gap-1 mb-3 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-400" />
                الغرف النشطة حالياً ({rooms.length})
              </span>
              <span className="text-[10px] text-indigo-300 font-medium">*(انقر على أي غرفة لمراقبتها فوراً)*</span>
            </h3>
            
            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
              {rooms.length === 0 ? (
                <p className="text-xxs text-slate-500 text-center py-6">
                  لا توجد غرف بث أو اجتماعات مسجلة في الوقت الراهن.
                </p>
              ) : (
                rooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setSelectedRoomId(room.id);
                        setSelectedRoomTitle(room.title);
                      }}
                      className={`p-2.5 border rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-950/50 border-indigo-500"
                          : "bg-slate-900/60 border-slate-800/50 hover:bg-slate-800"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200">{room.title}</div>
                        <div className="text-4xs font-mono text-slate-500 mt-1">ID: {room.id}</div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="اضغط للمراقبة الحية" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Shared panel (General Users list or Room Monitoring details) */}
        <div className="lg:col-span-8 flex flex-col bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 md:p-5 min-h-0">
          
          {selectedRoomId ? (
            /* ACTIVE LIVE ROOM MONITORING INTERFACE */
            <div className="flex flex-col h-full animate-fade-in" id="active-live-room-monitor">
              {/* Monitoring Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-indigo-900/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-md font-bold animate-pulse">
                      بث حي ومباشر ومراقب
                    </span>
                    <h2 className="text-base font-extrabold text-white flex items-center gap-1.5 animate-pulse">
                      <Shield className="w-5 h-5 text-indigo-400" />
                      شاشة مراقبة غرفة: <span className="text-indigo-300">"{selectedRoomTitle}"</span>
                    </h2>
                  </div>
                  <p className="text-xxs text-slate-400 mt-1.5 font-medium leading-relaxed font-sans">
                    منصة التدخل المباشر لمراقبة وطرد المشاركون وحذف محتويات الرسائل فورا للبث المباشر.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto uppercase">
                  <button
                    onClick={() => {
                      setSelectedRoomId(null);
                      setSelectedRoomTitle(null);
                    }}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-slate-700 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 scale-x-[-1]" />
                    الرجوع لإدارة الأعضاء
                  </button>

                  <button
                    onClick={() => handleCloseRoom(selectedRoomId)}
                    className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    إغلاق وتفريغ الغرفة نهائياً
                  </button>
                </div>
              </div>

              {/* Sub-panels layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 min-h-[350px]">
                {/* Right Column: Participants list */}
                <div className="border border-slate-850 bg-slate-900/10 rounded-2xl p-4 flex flex-col h-full">
                  <h4 className="text-xs font-black text-indigo-300 mb-3 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    الأجهزة والمشاركون داخل الغرفة حالياً ({monitoredParticipants.length})
                  </h4>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                    {isMonitoringLoading ? (
                      <div className="flex flex-col items-center justify-center py-10">
                        <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mb-2" />
                        <span className="text-3xs text-slate-500">جاري تحميل وسحب الأجهزة...</span>
                      </div>
                    ) : monitoredParticipants.length === 0 ? (
                      <div className="text-center py-12 text-3xs text-slate-500 italic">
                        لا يوجد أي جهاز مشارك نشط حالياً في الغرفة.
                      </div>
                    ) : (
                      monitoredParticipants.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7.5 h-7.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs font-mono">
                              {p.name ? p.name.charAt(0).toUpperCase() : "?"}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-200">{p.name || p.id}</div>
                              {p.joinedAt && (
                                <div className="text-4xs text-slate-500 font-mono mt-0.5">
                                  دخل: {new Date(p.joinedAt).toLocaleTimeString("ar-SA")}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleKickParticipant(p.id)}
                            className="bg-red-500/15 hover:bg-red-650 border border-red-500/30 text-red-400 hover:text-white transition-all text-4xs font-extrabold px-2.5 py-1.5 rounded-lg shrink-0 cursor-pointer"
                          >
                            طرد وفصل فوري 🚫
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Left Column: Live chat stream message list */}
                <div className="border border-slate-850 bg-slate-900/10 rounded-2xl p-4 flex flex-col h-full justify-between">
                  <div className="flex flex-col flex-1">
                    <h4 className="text-xs font-black text-indigo-300 mb-3 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                      <MessageSquare className="w-4 h-4 text-indigo-400" />
                      البث الحي للرسائل المنشورة ({monitoredMessages.length})
                    </h4>

                    <div className="space-y-3 overflow-y-auto max-h-[300px] scrollbar-thin pr-0.5 flex-1 select-text">
                      {monitoredMessages.length === 0 ? (
                        <div className="text-center py-10 text-[10px] text-slate-500 italic">
                          لم يتم بث أي رسالة في السجل العام للغرفة بعد.
                        </div>
                      ) : (
                        monitoredMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`p-2.5 border rounded-xl flex flex-col gap-1.5 relative group transition-all text-right ${
                              m.senderId === "admin_system"
                                ? "bg-rose-500/10 border-rose-500/35"
                                : "bg-slate-950/45 border-slate-850 hover:border-indigo-900/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-900/40">
                              <span className={`text-[10px] font-black ${m.senderId === "admin_system" ? "text-rose-450 font-extrabold" : "text-indigo-300"}`}>
                                {m.senderName}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {m.createdAt && (
                                  <span className="text-[9px] text-slate-500 font-mono">{new Date(m.createdAt).toLocaleTimeString("ar-SA")}</span>
                                )}
                                <button
                                  onClick={() => handleDeleteMessage(m.id)}
                                  className="text-red-400 hover:text-red-200 transition-all hover:bg-red-500/20 p-1 rounded-md cursor-pointer"
                                  title="حذف الرسالة نهائياً"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-200 break-words leading-relaxed">
                              {m.text && <p>{m.text}</p>}
                              {m.file && (
                                <div className="mt-1 text-indigo-400 font-bold text-[10px] flex items-center gap-1">
                                  📎 ملف مشارك: <a href={m.file.url} target="_blank" rel="noreferrer" className="underline hover:text-indigo-300">{m.file.name}</a> ({(m.file.size / 1024).toFixed(1)} KB)
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Dynamic Urgent Admin Warning Broadcast */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <form onSubmit={handleBroadcastMessage} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold text-rose-400 flex items-center gap-1">
                          📢 إرسال تعميم إداري عاجل في شات الغرفة:
                        </label>
                        {broadcastSuccess && <span className="text-[9px] text-emerald-400 font-bold animate-pulse">{broadcastSuccess}</span>}
                        {broadcastError && <span className="text-[9px] text-red-500 font-bold">{broadcastError}</span>}
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={adminBroadcastText}
                          onChange={(e) => setAdminBroadcastText(e.target.value)}
                          placeholder="اكتب التوجيه أو التحذير هنا للغرفة حياً..."
                          className="flex-1 bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none rounded-xl px-3 py-2 text-[11px] text-slate-200 placeholder-slate-650 text-right"
                        />
                        <button
                          type="submit"
                          className="bg-rose-600/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-400 hover:text-white px-3 py-2 rounded-xl text-4xs font-black transition-all cursor-pointer shrink-0"
                        >
                          بث التعميم 🚀
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* GENERAL MEMBER LISTINGS AND PENDING REGISTRATION GATES */
            <>
              {/* Header Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    قائمة طلبات التسجيل والأعضاء
                  </h2>
                  <p className="text-xxs text-slate-400 mt-1">قم بتفصيل والموافقة على المستخدمين لتمكين دخولهم للقنوات المرئية</p>
                </div>

                {/* List Type filters selector */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xxs font-bold transition-all ${
                      statusFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    الكل ({users.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("pending")}
                    className={`px-3 py-1.5 rounded-lg text-xxs font-bold transition-all relative ${
                      statusFilter === "pending" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    قيد الانتظار ({pendingCount})
                    {pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setStatusFilter("approved")}
                    className={`px-3 py-1.5 rounded-lg text-xxs font-bold transition-all ${
                      statusFilter === "approved" ? "bg-emerald-500/15 text-emerald-400" : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    المقبولون ({approvedCount})
                  </button>
                </div>
              </div>

              {/* Search Input Bar */}
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث عن اسم عضو معين..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 outline-none rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 placeholder-slate-550 text-right"
                />
              </div>

              {/* Scrollable Members List */}
              <div className="flex-1 overflow-y-auto pr-1 min-h-[300px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                    <p className="text-xs text-slate-400">جاري مسامحة وسحب السجلات المرئية...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-800 rounded-2xl">
                    <Users className="w-8 h-8 text-slate-650 mb-3" />
                    <p className="text-xs text-slate-400">لا يوجد بيانات تطابق بحثك أو تصفيتك في السيرفر.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.nickname}
                        className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          user.status === "pending"
                            ? "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30"
                            : user.status === "approved"
                            ? "bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80"
                            : "bg-red-500/5 hover:bg-red-500/10 border-red-500/20"
                        }`}
                      >
                        {/* User profile identifier */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            user.status === "pending"
                              ? "bg-amber-500/10 text-amber-400"
                              : user.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="space-y-1 bg-slate-950/15 p-1 rounded-xl w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{user.nickname}</h4>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                user.status === "pending"
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-500"
                                  : user.status === "approved"
                                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/10 border border-red-500/20 text-red-500"
                              }`}>
                                {user.status === "pending" ? "بانتظار الموافقة" : user.status === "approved" ? "نشط ومفعل" : "مرفوض"}
                              </span>

                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                                user.role === "admin"
                                  ? "bg-purple-500/10 border border-purple-500/20 text-purple-400"
                                  : user.role === "moderator"
                                  ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                                  : "bg-slate-800 border border-slate-705 text-slate-400"
                              }`}>
                                {user.role === "admin" ? "مشرف عام 👑" : user.role === "moderator" ? "مراقب غرف 🛡️" : "عضو عادي"}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-4xs text-slate-400 font-mono">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                طلب: {new Date(user.createdAt).toLocaleString("ar-SA", { hour12: true })}
                              </span>
                              {user.uid && (
                                <span className="bg-slate-850 px-1.5 py-0.5 rounded text-5xs font-bold text-slate-300">
                                  UID: {user.uid.substring(0, 8)}...
                                </span>
                              )}
                              {user.password && (
                                <span className="bg-blue-950/40 border border-blue-900/30 text-blue-350 px-2 py-0.5 rounded font-black text-5xs">
                                  رمز المرور: {user.password}
                                </span>
                              )}
                            </div>

                            {/* Set role controller dropdown */}
                            <div className="pt-2 flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-bold">تعديل الصلاحية:</span>
                              <select
                                value={user.role || "user"}
                                onChange={(e) => handleSetRole(user.nickname, e.target.value as any)}
                                className="bg-slate-900 border border-slate-800 text-slate-350 text-5xs font-extrabold rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-blue-500"
                              >
                                <option value="user">عضو عادي (Regular)</option>
                                <option value="moderator">مراقب غرف (Moderator)</option>
                                <option value="admin">مشرف عام (Global Admin)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Operational controls */}
                        <div className="flex items-center gap-2 justify-end self-end md:self-auto shrink-0">
                          {user.status !== "approved" && (
                            <button
                              onClick={() => handleApprove(user.nickname)}
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.8 rounded-xl transition-all shadow-sm cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              موافقة وتفعيل
                            </button>
                          )}

                          {user.status !== "rejected" && (
                            <button
                              onClick={() => handleReject(user.nickname)}
                              className="flex items-center gap-1 bg-amber-600/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-[11px] font-bold px-3 py-1.8 rounded-xl transition-all cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              رفض الحساب
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(user.nickname)}
                            className="p-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
                            title="حذف السجل نهائيا"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="text-center text-4xs text-slate-600 border-t border-slate-900 mt-4 pt-3 uppercase font-mono tracking-wider">
            SNNS.PRO • Secure ABAC Approval System Standard
          </div>
        </div>
      </main>
    </div>
  );
}
