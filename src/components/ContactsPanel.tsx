import React, { useState, useEffect } from "react";
import { 
  Search, Shield, ShieldAlert, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, 
  User, Copy, Check, Send, Mail, Globe, Lock, Clock, Sparkles, Radio, MessageSquare
} from "lucide-react";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

interface ContactsPanelProps {
  currentUsername: string; // The nickname of the current logged-in user
  currentRoomTitle: string;
  participants?: any[]; // Passed down list of real-time participants in current room
  recentSenders?: Record<string, number>; // State of recent senders from App.tsx
  currentUserId?: string; // UID of current user
}

export function ContactsPanel({ 
  currentUsername, 
  currentRoomTitle, 
  participants = [], 
  recentSenders = {}, 
  currentUserId 
}: ContactsPanelProps) {
  
  // Tab within the ContactsPanel: 'active' (real occupants) or 'search' (database pull)
  const [subTab, setSubTab] = useState<"active" | "search">("active");

  // Search state
  const [searchEmail, setSearchEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // My settings state (realtime cache of my account type)
  const [myAccountType, setMyAccountType] = useState<"public" | "private">("public");
  const [myEmail, setMyEmail] = useState<string>("");
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Interaction logs / Feedback
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [sentInviteTo, setSentInviteTo] = useState<string | null>(null);

  // Fetch current user settings on mount
  useEffect(() => {
    async function fetchMySettings() {
      if (!currentUsername) return;
      try {
        const userDocRef = doc(db, "users", currentUsername);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          setMyAccountType(data.accountType || "public");
          setMyEmail(data.email || "");
        }
      } catch (err) {
        console.error("Error reading personal settings:", err);
      }
    }
    fetchMySettings();
  }, [currentUsername]);

  // Toggle my account privacy type
  const handleTogglePrivacy = async () => {
    if (!currentUsername) return;
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    const nextType = myAccountType === "public" ? "private" : "public";

    try {
      const userDocRef = doc(db, "users", currentUsername);
      await updateDoc(userDocRef, {
        accountType: nextType
      });
      setMyAccountType(nextType);
      setSettingsSuccess(
        nextType === "public" 
          ? "حسابك الآن عام! يمكن للآخرين البحث عنك بالبريد الإلكتروني." 
          : "تم تحويل حسابك إلى خاص بنجاح. هويتك الآن مخفية تماماً."
      );
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err) {
      console.error("Error updating privacy:", err);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // Perform pull/search of contacts by email
  const handleSearchContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToSearch = searchEmail.trim().toLowerCase();
    
    if (!emailToSearch) {
      setSearchError("الرجاء إدخال البريد الإلكتروني للبحث.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const usersCollectionRef = collection(db, "users");
      const q = query(usersCollectionRef, where("email", "==", emailToSearch));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setSearchError("لم يتم العثور على أي حساب مسجل بهذا البريد الإلكتروني.");
      } else {
        const foundList: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          foundList.push({
            nickname: docSnap.id,
            email: data.email || "",
            avatarColor: data.avatarColor || "bg-blue-600",
            accountType: data.accountType || "public", // default to public if not set yet
            createdAt: data.createdAt || ""
          });
        });
        setSearchResult(foundList);
      }
    } catch (err) {
      console.error("Error querying contacts:", err);
      setSearchError("أخفق البحث بسبب نقص الصلاحيات أو عطل بالخادم.");
    } finally {
      setIsSearching(false);
    }
  };

  // Copy join link / Invite
  const handleCopyInvite = (nickname: string) => {
    const inviteText = `مرحباً ${nickname}! أدعوك للانضمام إلى غرفتي العامة للبث والمحادثة الآمنة. تفضل بالدخول عبر الرابط: ${window.location.origin}/#room-${encodeURIComponent(currentRoomTitle)}`;
    navigator.clipboard.writeText(inviteText);
    setCopiedName(nickname);
    setTimeout(() => setCopiedName(null), 3000);
  };

  // Trigger temporary instant invite feedback
  const handleSendInstantInvite = (nickname: string) => {
    setSentInviteTo(nickname);
    setTimeout(() => setSentInviteTo(null), 3000);
  };

  // Format relative/friendly time
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "منذ ثوانٍ";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "منذ فترة";
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-[520px] shadow-sm" dir="rtl">
      
      {/* 1. Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-55 text-indigo-600 rounded-xl bg-indigo-50">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800">حالة التواجد الفعلي والوصول</h3>
            <p className="text-3xs text-slate-400 mt-0.5">مراقبة الأجهزة النشطة والبحث عن مشتركين</p>
          </div>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>

      {/* 2. Contacts Segment Tab Switches */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-3 shrink-0">
        <button
          type="button"
          onClick={() => setSubTab("active")}
          className={`py-1.5 px-2 rounded-lg text-2xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            subTab === "active"
              ? "bg-white text-slate-800 shadow-xs"
              : "text-slate-500 hover:text-slate-750"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          المتواجدون فعلياً ({participants.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("search")}
          className={`py-1.5 px-2 rounded-lg text-2xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            subTab === "search"
              ? "bg-white text-slate-800 shadow-xs"
              : "text-slate-500 hover:text-slate-750"
          }`}
        >
          <Search className="w-3.5 h-3.5 text-slate-500" />
          البحث وسحب العضويات
        </button>
      </div>

      {/* 3. Panel Main Viewport */}
      <div className="flex-1 overflow-y-auto pr-0.5 space-y-3 min-h-0">
        
        {/* SUBTAB: ACTIVE (Actual live occupants) */}
        {subTab === "active" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">الأعضاء النشطون في الغرفة الآن</span>
              <span className="text-3xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">بث مباشر آمن</span>
            </div>

            {participants.length === 0 ? (
              <div className="h-44 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                <Radio className="w-7 h-7 text-slate-300 mb-2 animate-pulse" />
                <p className="text-2xs font-bold text-slate-500">بانتظار انضمام الأجهزة</p>
                <p className="text-3xs text-slate-400 mt-1 leading-relaxed max-w-[200px]">
                  سيظهر المشاركون والمنضمون الجدد إلى هذه الغرفة مباشرة هنا بمجرد اتصالهم.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {participants.map((part) => {
                  const isMe = part.uid === currentUserId;
                  const isRecent = !!recentSenders[part.uid];
                  
                  return (
                    <div 
                      key={part.uid} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 relative ${
                        isRecent 
                          ? "bg-indigo-50/70 border-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.25)]" 
                          : "bg-slate-50/80 border-slate-150 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs ${part.avatar || 'bg-indigo-600'}`}>
                            {part.name.substring(0, 2).toUpperCase()}
                          </div>
                          
                          {/* Pulsing online marker on avatar */}
                          <span className="absolute -bottom-0.5 -left-0.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                        </div>

                        <div className="min-w-0 text-right">
                          <div className="text-2xs font-extrabold text-slate-800 flex items-center gap-1.5">
                            <span className="truncate">{part.name}</span>
                            {isMe && (
                              <span className="text-3xs px-1 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded font-black shrink-0">أنت</span>
                            )}
                            {isRecent && (
                              <span className="text-3xs px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded font-black shrink-0 animate-bounce">يتحدث...</span>
                            )}
                          </div>
                          <p className="text-3xs text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>دخول {formatTime(part.joinedAt)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Copy Invite / Quick Action */}
                      <div className="flex items-center gap-1">
                        {!isMe && (
                          <button
                            onClick={() => handleCopyInvite(part.name)}
                            title="نسخ رابط دعوة مخصص له"
                            className="p-1 px-2 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 transition-all text-3xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedName === part.name ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 text-3xs">تم</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>دعوة</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Micro instructions */}
            <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-1.5 text-right mt-2">
              <h5 className="text-3xs font-bold text-indigo-805 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                تتبع حالة الحضور الفوري
              </h5>
              <p className="text-3xs text-slate-600 leading-relaxed">
                كافة العناوين المتصلة المذكورة أعلاه تملك اتصالاً نشطاً بقناة البث بالزمن الفعلي. عند إلقاء رسالة جديدة، سيومض الاسم فوراً للإشارة إلى المتحدث الفعلي.
              </p>
            </div>
          </div>
        )}

        {/* SUBTAB: SEARCH (Advanced scan and configuration) */}
        {subTab === "search" && (
          <div className="space-y-3">
            {/* Self privacy control card */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-right">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {myAccountType === "public" ? (
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="p-1.5 bg-amber-55 text-amber-600 border border-amber-100 rounded-lg">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div>
                    <div className="text-2xs font-bold text-slate-700">
                      حالة خصوصية حسابك:{" "}
                      <span className={myAccountType === "public" ? "text-emerald-600" : "text-amber-600"}>
                        {myAccountType === "public" ? "عام (مرئي)" : "خاص (مخفي)"}
                      </span>
                    </div>
                    <p className="text-3xs text-slate-400 mt-0.5 font-mono">
                      {myEmail || currentUsername}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTogglePrivacy}
                  disabled={isUpdatingSettings}
                  className={`flex items-center gap-1 text-2xs py-1.5 px-2.5 rounded-lg border font-extrabold transition-all cursor-pointer select-none ${
                    myAccountType === "public"
                      ? "bg-white border-slate-205 text-slate-650 hover:bg-slate-100"
                      : "bg-indigo-600 border-indigo-505 text-white hover:bg-indigo-700"
                  }`}
                >
                  {isUpdatingSettings ? (
                    <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin mr-1" />
                  ) : myAccountType === "public" ? (
                    <ToggleRight className="w-4 h-4 text-emerald-500 scale-110" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-slate-350 scale-110" />
                  )}
                  تعديل
                </button>
              </div>

              {settingsSuccess && (
                <div className="mt-2 text-3xs text-emerald-600 font-semibold bg-emerald-50/70 border border-emerald-100 p-1.5 rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>{settingsSuccess}</span>
                </div>
              )}
            </div>

            {/* Email Contact Search Input */}
            <form onSubmit={handleSearchContacts} className="mt-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="email"
                    required
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="اكتب البريد الإلكتروني للبحث الفوري..."
                    className="w-full bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 transition-all font-mono text-right"
                  />
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm text-xs cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {isSearching ? "جاري..." : "سحب"}
                </button>
              </div>
            </form>

            {/* Query Results / States inside search section */}
            <div className="space-y-3">
              {searchError && (
                <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-3 flex items-start gap-2 text-right">
                  <AlertCircle className="w-4 h-4 text-amber-650 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-2xs font-bold text-amber-800">تنبيه البحث</h4>
                    <p className="text-3xs text-slate-600 mt-1 leading-relaxed">
                      {searchError} اطلب من صديقك ضبط حسابه لعضوية عامة ليصبح قابلاً للسحب عبر البريد.
                    </p>
                  </div>
                </div>
              )}

              {searchResult && searchResult.length > 0 && (
                <div className="space-y-2">
                  <p className="text-3xs font-extrabold text-slate-400">نتائج مطابقة قاعدة البيانات:</p>
                  {searchResult.map((contact, idx) => {
                    const isPrivate = contact.accountType === "private";
                    return (
                      <div 
                        key={idx} 
                        className={`border rounded-xl p-3 transition-all text-right duration-300 relative ${
                          isPrivate 
                            ? "bg-slate-50 border-slate-200" 
                            : "bg-indigo-50/25 border-indigo-150 hover:bg-indigo-50/45"
                        }`}
                      >
                        {/* Avatar & User Info */}
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 ${contact.avatarColor || 'bg-blue-600'}`}>
                            {contact.nickname.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-2xs font-extrabold text-slate-800 flex items-center gap-1.5">
                              {isPrivate ? "مشترك مشفر" : contact.nickname}
                              {isPrivate ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-55 text-amber-700 bg-amber-50 border border-amber-100 text-3xs rounded font-bold">
                                  <Lock className="w-2.5 h-2.5" /> خاص
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-55 text-emerald-700 bg-emerald-50 border border-emerald-100 text-3xs rounded font-bold">
                                  <Globe className="w-2.5 h-2.5" /> عام
                                </span>
                              )}
                            </h4>
                            <p className="text-3xs text-slate-400 font-mono select-all">
                              {contact.email}
                            </p>
                          </div>
                        </div>

                        {/* Actions for searched */}
                        <div className="mt-2.5 flex gap-1.5">
                          {isPrivate ? (
                            <div className="w-full text-center text-3xs text-slate-400 bg-slate-105 border border-slate-200 p-2 rounded-lg flex items-center justify-center gap-1.5 leading-relaxed">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>الحساب مغفل لحماية الخصوصية.</span>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopyInvite(contact.nickname)}
                                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-3xs py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {copiedName === contact.nickname ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    <span>نسخ الدعوة</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendInstantInvite(contact.nickname)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-3xs py-1.5 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {sentInviteTo === contact.nickname ? "تم الإرسال" : "دعوة فورية"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!searchResult && !searchError && (
                <div className="h-28 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-350 p-4 text-center">
                  <Mail className="w-6 h-6 text-slate-300 mb-1" />
                  <p className="text-3xs font-semibold text-slate-500">جاهز ومستعد</p>
                  <p className="text-3xs text-slate-455 mt-0.5 leading-relaxed max-w-[180px]">
                    أدخل البريد الإلكتروني وسنقوم بسحب العضويات المسجلة والتحقق من حالة خصوصيتهم.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
