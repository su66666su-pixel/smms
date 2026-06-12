import React, { useState, useEffect } from "react";
import { 
  Search, Shield, ShieldAlert, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, 
  User, Copy, Check, Send, Mail, Globe, Lock, Clock, Sparkles
} from "lucide-react";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

interface ContactsPanelProps {
  currentUsername: string; // The nickname of the current logged-in user
  currentRoomTitle: string;
  onInviteToRoom?: (recipientName: string) => void;
}

export function ContactsPanel({ currentUsername, currentRoomTitle }: ContactsPanelProps) {
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

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-full shadow-sm" dir="rtl">
      
      {/* Tab/Section Header */}
      <div className="flex items-center justify-between border-b border-slate-150 pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Mail className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">سحب جهات الاتصال والخصوصية</h3>
            <p className="text-3xs text-slate-400 mt-0.5">البحث بالبريد ومعاينة إعدادات الوصول</p>
          </div>
        </div>
        <span className="text-3xs font-semibold px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
          نشط آمن
        </span>
      </div>

      {/* 1. Self privacy control card */}
      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 mb-4 text-right">
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
                  {myAccountType === "public" ? "عام (مرئي بالبحث)" : "خاص (مخفي وآمن)"}
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
            className={`flex items-center gap-1 text-2xs py-1.5 px-3 rounded-lg border font-bold transition-all cursor-pointer select-none ${
              myAccountType === "public"
                ? "bg-white border-slate-205 text-slate-650 hover:bg-slate-100"
                : "bg-indigo-600 border-indigo-505 text-white hover:bg-indigo-700"
            }`}
          >
            {isUpdatingSettings ? (
              <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin mr-1" />
            ) : myAccountType === "public" ? (
              <ToggleRight className="w-4 h-4 text-emerald-500 scale-125" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-slate-300 scale-125" />
            )}
            تغيير الوضع
          </button>
        </div>

        {settingsSuccess && (
          <div className="mt-2 text-3xs text-emerald-600 font-semibold bg-emerald-50/70 border border-emerald-100 p-1.5 rounded-lg flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>{settingsSuccess}</span>
          </div>
        )}
      </div>

      {/* 2. Contacts search form */}
      <form onSubmit={handleSearchContacts} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="email"
              required
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="اكتب البريد الإلكتروني للمشترك..."
              className="w-full bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 transition-all font-mono"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-sm text-xs cursor-pointer flex items-center gap-1 shrink-0"
          >
            {isSearching ? "جاري السحب..." : "سحب"}
          </button>
        </div>
      </form>

      {/* 3. Results section */}
      <div className="flex-1 overflow-y-auto max-h-[300px] pr-0.5 space-y-3">
        {searchError && (
          <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-3 flex items-start gap-2 text-right">
            <AlertCircle className="w-4 h-4 text-amber-650 shrink-0 mt-0.5" />
            <div>
              <p className="text-2xs font-bold text-amber-800">تنبيـه البحث</p>
              <p className="text-3xs text-slate-600 mt-1 leading-relaxed">
                {searchError} يمكنك دعوة أصدقائك بإنشاء حساب عام لتتمكن من العثور عليهم بالبريد فوراً.
              </p>
            </div>
          </div>
        )}

        {searchResult && searchResult.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-3xs font-bold text-slate-400 text-right">نتائج السحب والتحقق:</p>
            {searchResult.map((contact, idx) => {
              const isPrivate = contact.accountType === "private";
              return (
                <div 
                  key={idx} 
                  className={`border rounded-xl p-3.5 transition-all text-right duration-300 relative ${
                    isPrivate 
                      ? "bg-slate-50/80 border-slate-200" 
                      : "bg-indigo-50/20 border-indigo-100 hover:bg-indigo-50/40"
                  }`}
                >
                  {/* Avatar and Info Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold font-mono shadow-sm shrink-0 ${contact.avatarColor || 'bg-blue-600'}`}>
                        {contact.nickname.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-2xs font-extrabold text-slate-800 flex items-center gap-1.5">
                          {isPrivate ? "مشترك خاص" : contact.nickname}
                          {isPrivate ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-3xs rounded font-bold">
                              <Lock className="w-2.5 h-2.5" /> خاص
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-3xs rounded font-bold">
                              <Globe className="w-2.5 h-2.5" /> عام
                            </span>
                          )}
                        </h4>
                        <p className="text-3xs text-slate-400 mt-0.5 font-mono select-all">
                          {contact.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Account properties / warnings etc */}
                  <div className="p-2 rounded-lg bg-white/70 border border-slate-100 text-3xs space-y-1.5">
                    <div className="flex justify-between text-slate-500">
                      <span>تاريخ الانضمام:</span>
                      <span className="font-mono text-slate-700">
                        {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString("ar-SA") : "غير مسجل"}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>إتاحة الاتصال والتواصل:</span>
                      <span className={isPrivate ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                        {isPrivate ? "محدودة (الحساب مشفر)" : "متاحة بالكامل 🚀"}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 flex gap-2">
                    {isPrivate ? (
                      <div className="w-full text-center text-3xs text-slate-400 bg-slate-105 border border-slate-150 p-2 rounded-lg leading-relaxed flex items-center justify-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>الحساب خاص، يرجى مشاركة الرابط معه بطريق مباشر.</span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyInvite(contact.nickname)}
                          className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-3xs py-2 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {copiedName === contact.nickname ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">تم نسخ الدعوة</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ دعوة اللقاء</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendInstantInvite(contact.nickname)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-3xs py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {sentInviteTo === contact.nickname ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>تم الإرسال للغرفة</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              <span>دعوة فورية</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!searchResult && !searchError && !isSearching && (
          <div className="h-44 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <User className="w-7 h-7 text-slate-300 mb-2 animate-bounce" />
            <p className="text-2xs font-semibold">جاهز لسحب جهة الاتصال</p>
            <p className="text-3xs text-slate-400 max-w-[200px] mt-1 text-center">
              أدخل البريد الإلكتروني وسنقوم بالبحث والمقارنة في قاعدة بيانات العضويات الفورية لتحديد ما إذا كان حساباً عاماً أم خاصاً.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
