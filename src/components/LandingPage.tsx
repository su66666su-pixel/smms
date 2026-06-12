import React, { useState, useEffect } from "react";
import { 
  Video, Sparkles, LogIn, ArrowLeftRight, Users, MessageSquare, 
  ShieldAlert, UserPlus, Mail, Lock, LogOut, CheckCircle2, AlertCircle, ArrowRightCircle
} from "lucide-react";
import { motion } from "motion/react";
import { doc, getDoc, setDoc, updateDoc, collection, query, onSnapshot, limit, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { syncUserToSupabase } from "../supabase";
import { LanguageSelector } from "./LanguageSelector";
import { LanguageCode } from "../utils/translations";

interface LandingPageProps {
  onJoinRoom: (roomTitle: string, nickname: string, avatarColor: string) => void;
  isLoading: boolean;
  onOpenAdmin: () => void;
  lang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const AVATAR_COLORS = [
  { nameKey: "avatarBlue", class: "bg-blue-600 shadow-blue-500/50", arabicFallback: "أزرق فضاء" },
  { nameKey: "avatarPurple", class: "bg-indigo-600 shadow-indigo-500/50", arabicFallback: "بنفسجي عميق" },
  { nameKey: "avatarEmerald", class: "bg-emerald-600 shadow-emerald-500/50", arabicFallback: "أخضر زمردي" },
  { nameKey: "avatarPink", class: "bg-pink-600 shadow-pink-500/50", arabicFallback: "وردي نيون" },
  { nameKey: "avatarOrange", class: "bg-amber-600 shadow-amber-500/50", arabicFallback: "برتقالي ناري" },
];

export function LandingPage({ 
  onJoinRoom, 
  isLoading, 
  onOpenAdmin, 
  lang, 
  onLanguageChange, 
  t 
}: LandingPageProps) {
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
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "recovery">("login");
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

  // Recovery States
  const [recoveryNickname, setRecoveryNickname] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");

  // Room Title for joined flows
  const [roomTitle, setRoomTitle] = useState(() => t("roomPlaceholder").replace("مثال: ", ""));

  // List of all active/public rooms
  const [allRooms, setAllRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionUser) return;
    const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllRooms(list);
    }, (error) => {
      console.error("Error fetching rooms: ", error);
    });
    return () => unsub();
  }, [sessionUser]);

  // Check URL Hash for invitation links (e.g. #room-1234)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#room-")) {
      const decodedRoomName = decodeURIComponent(hash.substring(6));
      setRoomTitle(decodedRoomName);
    }
  }, []);

  // Sync default room title if it's currently the default one and language changes
  useEffect(() => {
    const isDefault = roomTitle === "لقاء الويب العام" || roomTitle === "Public Web Meeting" || roomTitle === t("roomPlaceholder").replace("مثال: ", "");
    if (isDefault) {
      setRoomTitle(t("roomPlaceholder").replace("مثال: ", "").replace("Example: ", ""));
    }
  }, [lang]);

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
      setSuccessMessage(lang === "ar" ? "تم التحقق بنجاح! جاري توجيهك إلى لوحة الإدارة السرية فوراً..." : "Verified successfully! Redirecting you to secret admin panel instantly...");
      const timer = setTimeout(() => {
        onOpenAdmin();
        setLoginNickname("");
        setLoginPassword("");
        setAuthLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loginNickname, loginPassword, onOpenAdmin, lang]);

  // Handle Login Action
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = loginNickname.trim();
    const password = loginPassword.trim();

    if (!cleanName || !password) {
      setErrorMessage(t("errFillAll"));
      return;
    }

    if (cleanName === "1007363904" && password === "139213") {
      setAuthLoading(true);
      sessionStorage.setItem("snns_admin_logged", "true");
      setSuccessMessage(lang === "ar" ? "تم التحقق بنجاح! جاري توجيهك إلى لوحة الإدارة السرية..." : "Verified successfully! Directing you to admin console...");
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
        setErrorMessage(lang === "ar" 
          ? "عذراً، هذا الاسم المستعار غير مسجل لدينا. يرجى التوجه لعلامة تبويب 'تسجيل جديد'." 
          : "Sorry, this nickname is not registered. Please go to 'Register' tab.");
        setAuthLoading(false);
        return;
      }

      const userData = snap.data();
      const savedPassword = userData.password;

      // Verify Password
      if (savedPassword && savedPassword !== password) {
        setErrorMessage(t("errIncorrectPass"));
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
      setSuccessMessage(t("successLogin"));
      
      // Auto-populate active signup avatar details
      setSelectedColor(loggedUser.avatarColor);

      // Instant redirect to the room
      setTimeout(() => {
        onJoinRoom(roomTitle.trim(), loggedUser.nickname, loggedUser.avatarColor);
      }, 500);

    } catch (err) {
      console.error("Login Error:", err);
      setErrorMessage(lang === "ar" ? "حدث خطأ أثناء محاولة تسجيل الدخول. يرجى إعادة المحاولة." : "An error occurred during login. Please retry.");
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
      setErrorMessage(lang === "ar" ? "الرجاء إدخال الاسم الكريم والبريد وكلمة المرور." : "Please fill in nickname, email, and password.");
      return;
    }

    if (/[#./[\]$]/.test(cleanName)) {
      setErrorMessage(t("errSpecialChars"));
      return;
    }

    setAuthLoading(true);
    setErrorMessage(null);

    try {
      const userDocRef = doc(db, "users", cleanName);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        setErrorMessage(t("errNicknameReserved"));
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

      // Mirror sync profile instantly to Supabase
      await syncUserToSupabase(cleanName, newUserPayload);

      // Save to active session
      localStorage.setItem("snns_session", JSON.stringify(newUserPayload));
      setSessionUser(newUserPayload);
      setSuccessMessage(t("successSignup"));

      // Instant redirect to the room
      setTimeout(() => {
        onJoinRoom(roomTitle.trim(), newUserPayload.nickname, selectedColor);
      }, 500);

    } catch (err) {
      console.error("Signup Error:", err);
      setErrorMessage(t("errSignupError"));
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Account Password Password Recovery
  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = recoveryNickname.trim();
    const email = recoveryEmail.trim().toLowerCase();
    const newPass = recoveryNewPassword.trim();

    if (!cleanName || !email || !newPass) {
      setErrorMessage(t("errRecoveryEmpty"));
      return;
    }

    setAuthLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const userDocRef = doc(db, "users", cleanName);
      const snap = await getDoc(userDocRef);

      if (!snap.exists()) {
        setErrorMessage(t("errRecoveryNotFound"));
        setAuthLoading(false);
        return;
      }

      const userData = snap.data();
      const savedEmail = (userData.email || "").trim().toLowerCase();

      if (!savedEmail) {
        setErrorMessage(t("errRecoveryNoEmail"));
        setAuthLoading(false);
        return;
      }

      if (savedEmail !== email) {
        setErrorMessage(t("errRecoveryNoMatch"));
        setAuthLoading(false);
        return;
      }

      // Update password in Firestore
      await updateDoc(userDocRef, {
        password: newPass
      });

      // Mirror password reset instantly to Supabase
      await syncUserToSupabase(cleanName, { ...userData, password: newPass });

      setSuccessMessage(t("successRecovery"));
      
      // Auto fill login fields for convenience
      setLoginNickname(cleanName);
      setLoginPassword(newPass);
      
      // Reset recovery form
      setRecoveryNickname("");
      setRecoveryEmail("");
      setRecoveryNewPassword("");
      
      setTimeout(() => {
        setActiveTab("login");
      }, 2000);

    } catch (err) {
      console.error("Password recovery error:", err);
      setErrorMessage(lang === "ar" ? "حدث خطأ أثناء محاولة استعادة الحساب. يرجى مراجعة الاتصال." : "An error occurred during password recovery. Check network.");
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
    setSuccessMessage(t("successLogout"));
  };

  // Handle entering/broadcasting inside room
  const handleJoinOrCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) {
      setErrorMessage(t("errRoomEmpty"));
      return;
    }

    onJoinRoom(roomTitle.trim(), sessionUser.nickname, sessionUser.avatarColor);
  };

  const isRtl = lang === "ar" || lang === "ur";

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 md:p-8 font-sans transition-colors duration-300 relative`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Decorative ambient blobs */}
      <div className={`absolute top-10 ${isRtl ? "right-10" : "left-10"} w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none`} />
      <div className={`absolute bottom-10 ${isRtl ? "left-10" : "right-10"} w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none`} />

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-4 z-30">
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onDoubleClick={onOpenAdmin}
          title={lang === "ar" ? "انقر مرتين سريعتين كإجراء سري" : "Double click as a secret action"}
        >
          <div className="p-2.5 bg-blue-50 border border-blue-105 rounded-xl">
            <Video className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-l from-blue-700 to-indigo-600 bg-clip-text text-transparent">
              {t("platformName")}
            </h1>
            <p className="text-xs text-slate-500 font-mono font-bold tracking-wide">SNNS.PRO WEB SERVICES</p>
          </div>
        </div>

        {/* Multi-Language Selector Dropdown Integration */}
        <div className="flex items-center gap-3">
          <LanguageSelector currentLanguage={lang} onLanguageChange={onLanguageChange} dark={false} />
          
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 border border-slate-200 rounded-full px-3 py-1.5 bg-white shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t("secureServers")}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center my-auto py-8 z-10">
        {/* Modern Promotional / Info Panel */}
        <div className={`md:col-span-5 flex flex-col gap-6 text-start ${isRtl ? "md:text-right" : "md:text-left"}`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-1 px-3 w-fit rounded-full bg-blue-50 border border-blue-105 text-blue-700 text-xs font-semibold flex items-center gap-1.5 ${isRtl ? "mr-0" : "ml-0"}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("subTitle")}
          </motion.div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-snug">
            {t("heroTitle")}
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">
            {t("heroDesc")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-550/30 transition-all flex items-start gap-3 shadow-sm">
              <Users className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">{t("feature1Title")}</h4>
                <p className="text-2xs text-slate-500 mt-1">{t("feature1Desc")}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-550/30 transition-all flex items-start gap-3 shadow-sm">
              <MessageSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">{t("feature2Title")}</h4>
                <p className="text-2xs text-slate-500 mt-1">{t("feature2Desc")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive dynamic forms & Account controllers */}
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
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "login"
                      ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50" 
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  {t("loginTab")}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("signup"); setErrorMessage(null); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "signup"
                      ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50" 
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  {t("signupTab")}
                </button>
              </div>

              {/* Login Frame */}
              {activeTab === "login" ? (
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className={`${isRtl ? "text-right" : "text-left"}`}>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{t("loginDetailsTitle")}</h3>
                    <p className="text-2xs text-slate-400 mb-4">{t("loginDetailsSub")}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("nicknameLabel")}</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={loginNickname}
                        onChange={(e) => setLoginNickname(e.target.value)}
                        placeholder={t("nicknamePlaceholder")}
                        className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-808 placeholder-slate-400/80 transition-all ${isRtl ? "text-right" : "text-left"}`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>{t("passwordLabel")}</span>
                      <button
                        type="button"
                        onClick={() => { setActiveTab("recovery"); setErrorMessage(null); }}
                        className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline cursor-pointer font-bold"
                      >
                        {t("forgotPass")}
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-808 placeholder-slate-400/80 transition-all font-mono ${isRtl ? "text-right" : "text-left"}`}
                      />
                    </div>
                  </div>

                  {/* Integrated Room Name Field */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("roomLabel")}</label>
                    <input
                      type="text"
                      required
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder={t("roomPlaceholder")}
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-805 font-semibold transition-all ${isRtl ? "text-right" : "text-left"}`}
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
                        {t("submitLoginLoading")}
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        {t("submitLogin")}
                      </>
                    )}
                  </button>
                </form>
              ) : activeTab === "signup" ? (
                /* Registration Frame */
                <form onSubmit={handleSignup} className="flex flex-col gap-3">
                  <div className={`${isRtl ? "text-right" : "text-left"}`}>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{t("signupDetailsTitle")}</h3>
                    <p className="text-2xs text-slate-400 mb-3">{t("signupDetailsSub")}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("nicknameLabel")}</label>
                    <input
                      type="text"
                      required
                      value={signupNickname}
                      onChange={(e) => setSignupNickname(e.target.value)}
                      placeholder={t("nicknamePlaceholder")}
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-450 transition-all ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("emailLabel")}</label>
                    <input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-3 py-3 text-xs text-slate-800 placeholder-slate-450 transition-all font-mono ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("passwordLabel")}</label>
                    <input
                      type="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-450 transition-all font-mono ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* Integrated Room Name Field */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("roomLabel")}</label>
                    <input
                      type="text"
                      required
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder={t("roomPlaceholder")}
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-505 outline-none rounded-xl px-4 py-3 text-xs text-slate-805 font-semibold transition-all ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* Account Privacy Choice */}
                  <div className={`flex flex-col gap-1.5 mt-1 ${isRtl ? "text-right" : "text-left"}`}>
                    <label className="text-xs font-bold text-slate-700">{t("privacyLabel")}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountType("public")}
                        className={`py-2.5 px-3 rounded-xl border text-2xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          accountType === "public"
                            ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${accountType === "public" ? "bg-indigo-600 animate-pulse" : "bg-slate-400"}`} />
                        {t("privacyPublic")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType("private")}
                        className={`py-2.5 px-3 rounded-xl border text-2xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          accountType === "private"
                            ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${accountType === "private" ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
                        {t("privacyPrivate")}
                      </button>
                    </div>
                    <p className="text-3xs text-slate-450 leading-relaxed">
                      {t("privacyNote")}
                    </p>
                  </div>

                  {/* Color choices */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <label className="text-xs font-bold text-slate-700">{t("avatarLabel")}</label>
                    <div className="flex items-center gap-3 py-1">
                      {AVATAR_COLORS.map((avatar, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedColor(avatar.class)}
                          className={`w-8 h-8 rounded-lg relative transition-all ${avatar.class} flex items-center justify-center border-2 ${
                            selectedColor === avatar.class ? "border-slate-805 scale-110 shadow-sm" : "border-transparent opacity-80 hover:opacity-100"
                          }`}
                          title={lang === "ar" ? avatar.arabicFallback : avatar.nameKey}
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
                        {t("submitSignupLoading")}
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        {t("submitSignup")}
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Password Recovery Frame */
                <form onSubmit={handleRecovery} className="flex flex-col gap-4 animate-fadeIn">
                  <div className={`${isRtl ? "text-right" : "text-left"}`}>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{t("recoveryTitle")}</h3>
                    <p className="text-2xs text-slate-400 mb-4">{t("recoverySub")}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("recoveryNickname")}</label>
                    <input
                      type="text"
                      required
                      value={recoveryNickname}
                      onChange={(e) => setRecoveryNickname(e.target.value)}
                      placeholder={t("nicknamePlaceholder")}
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400/80 transition-all ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("recoveryEmail")}</label>
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-808 placeholder-slate-400/80 transition-all font-mono ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">{t("recoveryNewPass")}</label>
                    <input
                      type="password"
                      required
                      value={recoveryNewPassword}
                      onChange={(e) => setRecoveryNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm text-slate-820 placeholder-slate-400/80 transition-all font-mono ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  <div className="flex gap-2 mt-3 text-xs">
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="flex-1 bg-gradient-to-l from-indigo-650 via-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {authLoading ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          {t("submitRecoveryLoading")}
                        </>
                      ) : (
                        <>
                          <span>{t("submitRecovery")}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("login"); setErrorMessage(null); }}
                      className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-all border border-slate-200 cursor-pointer"
                    >
                      {t("backToLogin")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* ACTIVE SUCCESSFUL SESSION DISPLAY */
            <div className="flex flex-col justify-between h-full gap-6">
              {/* Profile Card Header */}
              <div className={`p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 ${isRtl ? "text-right" : "text-left"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl text-white flex items-center justify-center ${sessionUser.avatarColor} font-bold text-lg shadow-sm border border-black/10`}>
                    {sessionUser.nickname.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      {sessionUser.nickname}
                      <span className="text-3xs px-1.5 py-0.5 bg-emerald-100 border border-emerald-250 text-emerald-800 rounded font-semibold whitespace-nowrap">
                        {lang === "ar" ? "عضو موثق" : "Verified Member"}
                      </span>
                    </h4>
                    <span className="text-3xs text-slate-450 font-mono">{sessionUser.email || (lang === "ar" ? "بدون بريد" : "No email")}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogoutSession}
                  className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-xl transition-all border border-transparent hover:border-red-100 flex items-center gap-1 text-2xs font-extrabold cursor-pointer whitespace-nowrap"
                  title={lang === "ar" ? "تسجيل الخروج من الحساب" : "Log out"}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {lang === "ar" ? "خروج" : "Logout"}
                </button>
              </div>

              {/* Room Chooser Frame */}
              <form onSubmit={handleJoinOrCreate} className="flex flex-col gap-4">
                <div className={`${isRtl ? "text-right" : "text-left"}`}>
                  <h3 className="text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Video className="w-4 h-4 text-blue-500" />
                    {t("roomLabel")}
                  </h3>
                  <input
                    type="text"
                    required
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    placeholder={t("roomPlaceholder")}
                    className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none rounded-xl px-4 py-3.5 text-sm text-slate-805 font-semibold transition-all ${isRtl ? "text-right" : "text-left"}`}
                  />
                  
                  {/* Active Rooms list directory */}
                  <div className="mt-4 border-t border-slate-100 pt-3 flex flex-col gap-2.5">
                    <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                      <span className="text-3xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        {lang === "ar" ? "الغرف المتاحة حالياً" : "Active Public Rooms"} ({allRooms.length})
                      </span>
                      <span className="text-[9.5px] text-blue-650 font-bold">
                        {lang === "ar" ? "اختر للدخول السريع" : "Click to select"}
                      </span>
                    </div>

                    {allRooms.length === 0 ? (
                      <div className="p-3.5 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-[10px] text-slate-400 italic">
                          {lang === "ar" ? "لا توجد غرف عامة نشطة حالياً. اكتب اسماً للأعلى وأنشئ غرفتك الخاصة!" : "No active public rooms discovered. Type above to create yours!"}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-[130px] overflow-y-auto scrollbar-thin pr-0.5">
                        {allRooms.map((room) => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => {
                              setRoomTitle(room.title);
                            }}
                            className={`flex flex-col items-start gap-0.5 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all text-left w-full cursor-pointer group`}
                          >
                            <span className="text-xs font-bold text-slate-800 truncate w-full">
                              🚪 {room.title}
                            </span>
                            <span className="text-[9px] text-slate-450 font-mono">
                              ID: {room.id.substring(0, 10)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-3xs text-slate-450 leading-relaxed mt-2.5 text-justify">
                    * {lang === "ar" ? "ملاحظة: للدخول مع زملائك، يرجى كتابة اسم الغرفة بدقة كاملة. سيتم توجيهك تلقائياً وبأمان." : "Note: To enter with your team, please write the room title accurately. You will be directed securely."}
                  </p>
                </div>

                <button
                  id="join_room_btn"
                  type="submit"
                  disabled={isLoading || !roomTitle.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {lang === "ar" ? "جاري الاتصال والتحويل لغرفة البث..." : "Connecting and opening live room..."}
                    </>
                  ) : (
                    <>
                      <ArrowRightCircle className="w-4 h-4" />
                      {lang === "ar" ? `الاتصال ودخول الغرفة المرئية ("${roomTitle}")` : `Connect & Enter Video Room ("${roomTitle}")`}
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
        title={lang === "ar" ? "انقر هنا مرتين للدخول السري" : "Double-click here for secret entrance"}
      >
        {lang === "ar" ? (
          <>تطوير وتشغيل SNNS.PRO • جميع الحقوق محفوظة لغرف ومكالمات البث المباشر ومشاركة الملفات الآمنة 100%. <span onClick={(e) => { e.stopPropagation(); onOpenAdmin(); }} className="opacity-0 cursor-pointer text-slate-100">.</span></>
        ) : (
          <>Powered by SNNS.PRO • All rights reserved for secure video rooms & protected live file transfers 100%. <span onClick={(e) => { e.stopPropagation(); onOpenAdmin(); }} className="opacity-0 cursor-pointer text-slate-100">.</span></>
        )}
      </footer>
    </div>
  );
}
