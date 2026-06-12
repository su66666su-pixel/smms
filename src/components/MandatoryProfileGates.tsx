import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { syncUserToSupabase } from "../supabase";
import { ShieldAlert, Loader2, Check, Lock, Globe, User, Phone } from "lucide-react";
import { motion } from "motion/react";

interface MandatoryProfileGatesProps {
  username: string;
  lang: string;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

export function MandatoryProfileGates({
  username,
  lang,
  t,
}: MandatoryProfileGatesProps) {
  const isRtl = lang === "ar" || lang === "ur";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("private"); // PRIVATE BY DEFAULT !!! Special request
  const [saving, setSaving] = useState(false);

  // Auto pre-load existing email/name if they exist
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const uSnap = await getDoc(doc(db, "users", username));
        if (uSnap.exists()) {
          const val = uSnap.data();
          setDisplayName(val.displayName || val.nickname || "");
          setEmail(val.email || "");
          setPhone(val.phone || "");
          if (val.accountType || val.privacy) {
            setPrivacy(val.accountType || val.privacy);
          }
        }
      } catch (e) {}
    };
    fetchExisting();
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      alert("الطلب إلزامي: يرجى إدخال الاسم المعروض.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      alert("الطلب إلزامي: يرجى إدخال بريد إلكتروني صالح.");
      return;
    }
    if (!phone.trim()) {
      alert("الطلب إلزامي: يرجى إدخال رقم الهاتف الثابت أو الجوال.");
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", username);
      const updateData = {
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        privacy: privacy,
        accountType: privacy, // private by default (خاص افتراضياً)
        lastActive: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);

      // Sync user doc to supabase
      const fullSnap = await getDoc(userRef);
      if (fullSnap.exists()) {
        await syncUserToSupabase(username, fullSnap.data());
      }
    } catch (err: any) {
      console.error("Failed to complete mandatory profile registration:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${username}`);
      alert("حدث خطأ أثناء حفظ السجلات، تيقن من جودة شبكة الاتصال.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      {/* Decorative stars / glows */}
      <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative backdrop-blur-md"
      >
        <div className="text-xl font-extrabold tracking-tight bg-gradient-to-l from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-6 text-center">
          SNNS.PRO
        </div>

        <div className="flex flex-col items-center gap-4 mb-6 text-center animate-pulse">
          <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
            <ShieldAlert className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">
              {t("profileCompletionTitle") || "إكمال الملف الشخصي إجباري"}
            </h2>
            <p className="text-2xs text-slate-400 mt-2.5 leading-relaxed max-w-sm">
              {t("profileCompletionDesc") || "لطفاً أكمل بيانات حسابك للمتابعة. البريد ورقم الهاتف هامان لاستعادة الحساب وضمان أمانك."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-2xs font-extrabold text-slate-350">{t("displayNameLabel")}</label>
            <div className="relative">
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("displayNamePlaceholder")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-3 text-xs text-slate-205 outline-none focus:border-indigo-500 transition-colors"
              />
              <User className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-2xs font-extrabold text-slate-350">{t("emailLabel")}</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-3 text-xs text-slate-205 outline-none focus:border-indigo-500 transition-colors"
              />
              <span className="absolute right-3 top-3.5 flex items-center justify-center font-bold text-slate-500 text-xs">@</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-2xs font-extrabold text-slate-355">{t("phoneLabel")}</label>
            <div className="relative">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-3 text-xs text-slate-205 outline-none focus:border-indigo-500 transition-colors"
                dir="ltr"
              />
              <Phone className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Privacy Level - Hidden Default (خاص افتراضياً) */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl mt-1.5 flex flex-col gap-2">
            <span className="text-2xs font-extrabold text-slate-400">حالة الخصوصية الافتراضية للجهاز:</span>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="privacy"
                  checked={privacy === "private"}
                  onChange={() => setPrivacy("private")}
                  className="text-indigo-500"
                />
                <Lock className="w-3.5 h-3.5 inline text-slate-500" />
                <span>{t("privacyPrivate") || "خاص (مخفي لحمايتك)"}</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="privacy"
                  checked={privacy === "public"}
                  onChange={() => setPrivacy("public")}
                  className="text-indigo-500"
                />
                <Globe className="w-3.5 h-3.5 inline text-indigo-400" />
                <span>{t("privacyPublic") || "عام (قابل للبحث)"}</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:scale-100 flex items-center justify-center gap-1.5 mt-3 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("submittingLoader") || "جاري تحديث السجل..."}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{t("saveBtn") || "تأكيد الدخول الآمن"}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
