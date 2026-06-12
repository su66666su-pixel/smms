import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
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
} from "lucide-react";

interface AdminDashboardProps {
  onClose: () => void;
}

interface WebUser {
  nickname: string;
  status: "pending" | "approved" | "rejected";
  uid?: string;
  createdAt: string;
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

  // Users & Rooms State
  const [users, setUsers] = useState<WebUser[]>([]);
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New User Form State
  const [newNickname, setNewNickname] = useState("");
  const [newStatus, setNewStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Instant auto-login as they type admin credentials
  useEffect(() => {
    const cleanUser = username.trim();
    if (cleanUser === "1007363904" && password === "139213") {
      setIsLoggedIn(true);
      sessionStorage.setItem("snns_admin_logged", "true");
      setAuthError("");
    }
  }, [username, password]);

  // Handle Login submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === "1007363904" && password === "139213") {
      setIsLoggedIn(true);
      sessionStorage.setItem("snns_admin_logged", "true");
      setAuthError("");
    } else {
      setAuthError("اسم المستخدم أو الرقم السري غير صحيح!");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem("snns_admin_logged");
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

  // Approve a user
  const handleApprove = async (nickname: string) => {
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

  // Add user manually
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const nameClean = newNickname.trim();
    if (!nameClean) {
      setFormError("الرجاء إدخال الاسم المستعار للمستخدم!");
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
      });
      setFormSuccess(`تمت إضافة المستخدم "${nameClean}" بنجاح!`);
      setNewNickname("");
    } catch (e) {
      console.error("Error creating user:", e);
      setFormError("حدث خطأ أثناء إضافة المستخدم.");
    }
  };

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.nickname.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesFilter;
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
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
              <Video className="w-4 h-4 text-indigo-400" />
              الغرف النشطة حالياً ({rooms.length})
            </h3>
            
            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
              {rooms.length === 0 ? (
                <p className="text-xxs text-slate-500 text-center py-6">
                  لا توجد غرف بث أو اجتماعات مسجلة في الوقت الراهن.
                </p>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-2.5 bg-slate-900/60 border border-slate-800/50 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200">{room.title}</div>
                      <div className="text-4xs font-mono text-slate-500 mt-1">ID: {room.id}</div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="متاحة" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Primary Users Listings & Approvals */}
        <div className="lg:col-span-8 flex flex-col bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 md:p-5 min-h-0">
          
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
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        user.status === "pending"
                          ? "bg-amber-500/10 text-amber-400"
                          : user.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
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
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 text-4xs text-slate-400 mt-1.5 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            طلب: {new Date(user.createdAt).toLocaleString("ar-SA", { hour12: true })}
                          </span>
                          {user.uid && (
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded font-bold">
                              UID: {user.uid.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center gap-2 justify-end self-end md:self-auto shrink-0">
                      {user.status !== "approved" && (
                        <button
                          onClick={() => handleApprove(user.nickname)}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.8 rounded-xl transition-all shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          موافقة وتفعيل
                        </button>
                      )}

                      {user.status !== "rejected" && (
                        <button
                          onClick={() => handleReject(user.nickname)}
                          className="flex items-center gap-1 bg-amber-600/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-[11px] font-bold px-3 py-1.8 rounded-xl transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          رفض الحساب
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(user.nickname)}
                        className="p-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
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

          <div className="text-center text-4xs text-slate-600 border-t border-slate-900 mt-4 pt-3 uppercase font-mono tracking-wider">
            SNNS.PRO • Secure ABAC Approval System Standard
          </div>
        </div>
      </main>
    </div>
  );
}
