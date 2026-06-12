import React, { useState, useEffect } from "react";
import { 
  Video, Sparkles, LogIn, ArrowLeftRight, Users, MessageSquare, 
  ShieldAlert, UserPlus, Mail, Lock, LogOut, CheckCircle2, AlertCircle, ArrowRightCircle
} from "lucide-react";
import { motion } from "motion/react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface LandingPageProps {
  onJoinRoom: (roomTitle: string, nickname: string, avatarColor: string) => void;
  isLoading: boolean;
  onOpenAdmin: () => void;
}

const AVATAR_COLORS = [
  { name: "أزرق فضاء", class: "bg-blue-600 shadow-blue-500/50" },
  { name: "بنفسجي عميق", class: "bg-indigo-600 shadow-indigo-500/50" },
  { name: "أخضر زمردي", class: "bg-emerald-600 shadow-emerald-500/50" },
  { name: "وردي نيون", class: "bg-pink-600 shadow-pink-500/50" },
  { name: "برتقالي ناري", class: "bg-amber-600 shadow-amber-500/50" },
];

export function LandingPage({ onJoinRoom, isLoading, onOpenAdmin }: LandingPageProps) {
  // Session State
  const [sessionUser, setSessionUser] = useState<{
    nickname: string;
    email: string;
    avatarColor: string;
    status: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("snns_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // UI state
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Form states
  const [loginNickname, setLoginNickname] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupNickname, setSignupNickname] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].class);
  const [accountType, setAccountType] = useState<"public" | "private">("public");

  // Room Title for joined flows
  const [roomTitle, setRoomTitle] = useState("لقاء الويب العام");

  // Check URL Hash for invitation links (e.g. #room-1234)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#room-")) {
      const decodedRoomName = decodeURIComponent(hash.substring(6));
      setRoomTitle(decodedRoomName);
    }
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  // Instant admin entry on matching credentials typed
  useEffect(() => {
    const cleanName = loginNickname.trim();
    const cleanPass = loginPassword.trim();
    if (cleanName === "1007363904" && cleanPass === "139213") {
      setAuthLoading(true);
      sessionStorage.setItem("snns_admin_logged", "true");
      setSuccessMessage("تم التحقق بنجاح! جاري توجيهك إلى لوحة الإدارة السرية فوراً...");
      const timer = setTimeout(() => {
        onOpenAdmin();
        setLoginNickname("");
        setLoginPassword("");
        setAuthLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loginNickname, loginPassword, onOpenAdmin]);

  // Handle Login Action
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = loginNickname.trim();
    const password = loginPassword.trim();

    if (!cleanName || !password) {
      setErrorMessage("الرجاء تعبئة كافة حقول تسجيل الدخول.");
      return;
    }

    if (cleanName === "1007363904" && password === "139213") {
      setAuthLoading(true);
      sessionStorage.setItem("snns_admin_logged", "true");
      setSuccessMessage("تم التحقق بنجاح! جاري توجيهك إلى لوحة الإدارة السرية...");
      setTimeout(() => {
        onOpenAdmin();
        setLoginNickname("");
        setLoginPassword("");
        setAuthLoading(false);
      }, 600);
      return;
    }

    setAuthLoading(true);
    setErrorMessage(null);

    try {
      const userDocRef = doc(db, "users", cleanName);
      const snap = await getDoc(userDocRef);

      if (!snap.exists()) {
        setErrorMessage("عذراً، هذا الاسم المستعار غير مسجل لدينا. يرجى التوجه لعلامة تبويب 'تسجيل جديد'.");
        setAuthLoading(false);
        return;
      }

      const userData = snap.data();
      const savedPassword = userData.password;

      // Verify Password (Fallback support if some old accounts don't have password field yet)
      if (savedPassword && savedPassword !== password) {
        setErrorMessage("كلمة المرور التي أدخلتها غير صحيحة. يرجى التأكد والمحاولة مجدداً.");
        setAuthLoading(false);
        return;
      }

      // Successful login
      const loggedUser = {
        nickname: userData.nickname || cleanName,
        email: userData.email || "",
        avatarColor: userData.avatarColor || userData.avatar || AVATAR_COLORS[0].class,
        status: userData.status || "approved"
      };

      localStorage.setItem("snns_session", JSON.stringify(loggedUser));
      setSessionUser(loggedUser);
      setSuccessMessage("تم تسجيل الدخول بنجاح! جاري تحويلك إلى الغرفة فوراً...");
      
      // Auto-populate active signup avatar details
      setSelectedColor(loggedUser.avatarColor);

      // Instant redirect to the room
      setTimeout(() => {
        onJoinRoom(roomTitle.trim(), loggedUser.nickname, loggedUser.avatarColor);
      }, 500);

    } catch (err) {
      console.error("Login Error:", err);
      setErrorMessage("حدث خطأ أثناء محاولة تسجيل الدخول. يرجى إعادة المحاولة.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Signup / Registration Action
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = signupNickname.trim();
    const email = signupEmail.trim();
    const password = signupPassword.trim();

    if (!cleanName || !email || !password) {
      setErrorMessage("الرجاء إدخال الاسم الكريم والبريد وكلمة المرور.");
      return;
    }

    if (/[#./[\]$]/.test(cleanName)) {
      setErrorMessage("يجب ألا يحتوي الاسم المستعار على رموز مثل (# . / [ ] $)");
      return;
    }

    setAuthLoading(true);
    setErrorMessage(null);

    try {
      const userDocRef = doc(db, "users", cleanName);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        setErrorMessage("عذراً، الاسم المستعار محجوز بالفعل لمشترك آخر. اختر اسماً مغايراً.");
        setAuthLoading(false);
        return;
      }

      // Create new user credentials
      const newUserPayload = {
        nickname: cleanName,
        email,
        password,
        avatarColor: selectedColor,
        status: "approved", // Fast approval for registered community members
        uid: "",
        createdAt: new Date().toISOString(),
        accountType: accountType // "public" or "private"
      };

      await setDoc(userDocRef, newUserPayload);

      // Save to active session
      localStorage.setItem("snns_session", JSON.stringify(newUserPayload));
      setSessionUser(newUserPayload);
      setSuccessMessage("تهانينا! تم إنشاء حسابك بنجاح. جاري تحويلك إلى الغرفة فوراً...");

      // Instant redirect to the room
      setTimeout(() => {
        onJoinRoom(roomTitle.trim(), newUserPayload.nickname, selectedColor);
      }, 500);

    } catch (err) {
      console.error("Signup Error:", err);
      setErrorMessage("حدث خطأ أثناء إنشاء حسابك. تفقد اتصالك بالشبكة.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Log Out completely from current account session
  const handleLogoutSession = () => {
    localStorage.removeItem("snns_session");
    setSessionUser(null);
    setLoginNickname("");
    setLoginPassword("");
    setSignupNickname("");
    setSignupEmail("");
    setSignupPassword("");
    setSuccessMessage("تم تسجيل خروجك بأمان.");
  };

  // Handle entering/broadcasting inside room
  const handleJoinOrCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) {
      setErrorMessage("الرجاء تسجيل الدخول أولاً قبل اختيار الغرفة.");
      return;
    }

    onJoinRoom(roomTitle.trim(), sessionUser.nickname, sessionUser.avatarColor);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 md:p-8 font-sans transition-colors duration-300 relative" dir="rtl">
      {/* Decorative ambient blobs */}
      <div className="absolute top-10 right-10 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-4 z-10">
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onDoubleClick={onOpenAdmin}
          title="انقر مرتين سريعتين كإجراء سري"
        >
          <div className="p-2.5 bg-blue-50 border border-blue-105 rounded-xl">
            <Video className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-l from-blue-700 to-indigo-600 bg-clip-text text-transparent">
              بث وغرف SNNS.PRO
            </h1>
            <p className="text-xs text-slate-500 font-mono font-bold tracking-wide">SNNS.PRO WEB SERVICES</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 border border-slate-200 rounded-full px-3 py-1.5 bg-white shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            خوادم الدخول والتحقق آمنة
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center my-auto py-8 z-10">
        {/* Left Side: Modern Promotional / Info Panel */}
        <div className="md:col-span-5 flex flex-col gap-6 text-right md:order-last">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-1 px-3 w-fit rounded-full bg-blue-50 border border-blue-105 text-blue-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            منصة بث ومكالمات مؤمنة بالكامل
          </motion.div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-snug">
            بث فائق الدقة، <br />
            تواصل مستقر ومشاركة ملفات <span className="bg-gradient-to-l from-blue-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">بلحظات معدودة!</span>
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">
            استمتع بتجربة بث وغرف فيديو متكاملة مع ميزات التسجيل، تسجيل الدخول الآمن لحماية أسماء المستخدمين، ومشاركات الحالات المرئية المباشرة بلا قيود.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-550/30 transition-all flex items-start gap-3 shadow-sm">
              <Users className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">حماية العضويات</h4>
                <p className="text-2xs text-slate-500 mt-1">حماية اسمك المستعار بكلمة مرور لضمان هويتك بالكامل.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-550/30 transition-all flex items-start gap-3 shadow-sm">
              <MessageSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">مشاركة لحظية</h4>
                <p className="text-2xs text-slate-500 mt-1">تبادل فوري للوسائط والصور بين مشتركي القنوات.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive beautiful dynamic forms & Account controllers */}
        <div className="md:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-md relative overflow-hidden min-h-[460px] flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-indigo-500" />
          
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 mb-4 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl flex items-center gap-2 mb-4 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* CHECK SESSIONS */}
          {!sessionUser ? (
            <div>
              {/* Login or Register Tabs */}
              <div className="flex border-b border-slate-100 pb-4 mb-6 gap-4">
                <button
                  type="button"
                  onClick={() => { setActiveTab("login"); setErrorMessage(null); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab === "login"
                      ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50" 
                      : "text-slate-550 hover:bg-slate-50"
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  تسجيل الدخول (للمشتركين)
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("signup"); setErrorMessage(null); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab === "signup"
                      ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50" 
                      : "text-slate-550 hover:bg-slate-50"
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  تسجيل جديد (إنشاء عضوية)
                </button>
              </div>

              {/* Login Frame */}
              {activeTab === "login" ? (
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="text-right">
                    <h3 className="text-sm font-bold text-slate-800 mb-1">تسجيل الدخول والدخول الفوري</h3>
                    <p className="text-2xs text-slate-400 mb-4">أدخل الاسم، كلمة المرور، واسم الغرفة للدخول مباشرة</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">الاسم المستعار *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={loginNickname}
                        onChange={(e) => setLoginNickname(e.target.value)}
                        placeholder="مثال: يوسف_الغامدي"
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400/80 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>كلمة المرور السريّة *</span>
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الخاصة بحسابك..."
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400/80 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Integrated Room Name Field */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">اسم الغرفة المراد دخولها *</label>
                    <input
                      type="text"
                      required
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="مثال: لقاء الويب العام"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-805 font-semibold transition-all"
                    />
                  </div>

                  <button
                    id="submit_login_btn"
                    type="submit"
                    disabled={authLoading}
                    className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        يرجى الانتظار جاري التحقق والاتصال...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        التحقق ودخول الغرفة فوراً
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Registration Frame */
                <form onSubmit={handleSignup} className="flex flex-col gap-3">
                  <div className="text-right">
                    <h3 className="text-sm font-bold text-slate-800 mb-1">فتح حساب جديد والانضمام المباشر</h3>
                    <p className="text-2xs text-slate-400 mb-3">احجز اسمك المستعار الآن وتوجه لغرف البث فوراً</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">الاسم المستعار المرغوب *</label>
                    <input
                      type="text"
                      required
                      value={signupNickname}
                      onChange={(e) => setSignupNickname(e.target.value)}
                      placeholder="أدخل الاسم (مثال: أحمد_علي)"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-450 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="EX: email@example.com"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-450 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">كلمة مرور قوية لحماية الحساب *</label>
                    <input
                      type="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور المرغوبة..."
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-450 transition-all font-mono"
                    />
                  </div>

                  {/* Integrated Room Name Field */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">اسم الغرفة المراد دخولها *</label>
                    <input
                      type="text"
                      required
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="مثال: لقاء الويب العام"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-4 py-3 text-xs text-slate-805 font-semibold transition-all"
                    />
                  </div>

                  {/* Account Privacy Choice */}
                  <div className="flex flex-col gap-1.5 mt-1 text-right" dir="rtl">
                    <label className="text-xs font-bold text-slate-700">خصوصية الحساب (البحث والوصول):</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountType("public")}
                        className={`py-2 px-3 rounded-xl border text-2xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          accountType === "public"
                            ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${accountType === "public" ? "bg-indigo-600 animate-pulse" : "bg-slate-400"}`} />
                        عام (قابل للبحث)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType("private")}
                        className={`py-2 px-3 rounded-xl border text-2xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          accountType === "private"
                            ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${accountType === "private" ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
                        خاص (مخفي للخصوصية)
                      </button>
                    </div>
                    <p className="text-3xs text-slate-450 leading-relaxed">
                      * الحساب العام يسمح للمشتركين والمنسقين الآخرين بالبحث عنك وسحب معلومات الاتصال عبر بريدك الإلكتروني.
                    </p>
                  </div>

                  {/* Color choices */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <label className="text-xs font-bold text-slate-700">اللون الرمزي للشخصية (أفاتار):</label>
                    <div className="flex items-center gap-3 py-1">
                      {AVATAR_COLORS.map((avatar, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedColor(avatar.class)}
                          className={`w-8 h-8 rounded-lg relative transition-all ${avatar.class} flex items-center justify-center border-2 ${
                            selectedColor === avatar.class ? "border-slate-805 scale-110 shadow-sm" : "border-transparent opacity-80 hover:opacity-100"
                          }`}
                          title={avatar.name}
                        >
                          {selectedColor === avatar.class && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    id="submit_signup_btn"
                    type="submit"
                    disabled={authLoading}
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        جاري حجز الاسم والتحويل للغرفة...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        حفظ العضوية ودخول الغرفة فوراً
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ACTIVE SUCCESSFUL SESSION DISPLAY */
            <div className="flex flex-col justify-between h-full gap-6">
              {/* Profile Card Header */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-right">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl text-white flex items-center justify-center ${sessionUser.avatarColor} font-bold text-lg shadow-sm border border-black/10`}>
                    {sessionUser.nickname.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      {sessionUser.nickname}
                      <span className="text-3xs px-1.5 py-0.5 bg-emerald-100 border border-emerald-250 text-emerald-800 rounded font-semibold">
                        عضو موثق
                      </span>
                    </h4>
                    <span className="text-3xs text-slate-450 font-mono">{sessionUser.email || "بدون بريد"}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogoutSession}
                  className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-xl transition-all border border-transparent hover:border-red-100 flex items-center gap-1 text-2xs font-extrabold cursor-pointer"
                  title="تسجيل الخروج من الحساب"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  خروج
                </button>
              </div>

              {/* Room Chooser Frame */}
              <form onSubmit={handleJoinOrCreate} className="flex flex-col gap-4">
                <div className="text-right">
                  <h3 className="text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Video className="w-4 h-4 text-blue-500" />
                    عنوان الغرفة المراد الدخول إليها:
                  </h3>
                  <input
                    type="text"
                    required
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    placeholder="قم بكتابة عنوان اللقاء هنا..."
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3.5 text-sm text-slate-805 font-semibold transition-all"
                  />
                  <p className="text-3xs text-slate-450 leading-relaxed mt-2">
                    * ملاحظة: للدخول مع زملائك، يرجى كتابة اسم الغرفة بدقة كاملة. سيتم توجيهك تلقائياً وبأمان.
                  </p>
                </div>

                <button
                  id="join_room_btn"
                  type="submit"
                  disabled={isLoading || !roomTitle.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs"
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      جاري التحويل لغرفة البث...
                    </>
                  ) : (
                    <>
                      <ArrowRightCircle className="w-4 h-4" />
                      الاتصال ودخول الغرفة المرئية ({roomTitle})
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer 
        onDoubleClick={onOpenAdmin}
        className="max-w-7xl mx-auto w-full text-center py-4 border-t border-slate-200 text-2xs text-slate-500 cursor-pointer select-none"
        title="انقر هنا مرتين للدخول السري"
      >
        تطوير وتشغيل SNNS.PRO • جميع الحقوق محفوظة لغرف ومكالمات البث المباشر ومشاركة الملفات الآمنة 100%. <span onClick={(e) => { e.stopPropagation(); onOpenAdmin(); }} className="opacity-40 hover:opacity-150 cursor-pointer select-none">.</span>
      </footer>
    </div>
  );
}
