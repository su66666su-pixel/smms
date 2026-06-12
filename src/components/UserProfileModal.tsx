import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { syncUserToSupabase, syncFollowToSupabase, deleteFollowFromSupabase } from "../supabase";
import { X, Camera, Check, Loader2, Users, Lock, Mail, Phone, ShieldCheck, User as UserIcon, Globe, Unlock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface UserProfileModalProps {
  username: string;
  currentUsername: string;
  onClose: () => void;
  lang: string;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const PRESET_AVATARS = [
  "bg-rose-600 font-extrabold text-white text-base",
  "bg-blue-600 font-extrabold text-white text-base",
  "bg-emerald-600 font-extrabold text-white text-base",
  "bg-purple-600 font-extrabold text-white text-base",
  "bg-amber-600 font-extrabold text-white text-base",
  "bg-slate-700 font-extrabold text-white text-base",
];

export function UserProfileModal({
  username,
  currentUsername,
  onClose,
  lang,
  t,
}: UserProfileModalProps) {
  const isMe = username === currentUsername;
  const isRtl = lang === "ar" || lang === "ur";

  // Data states
  const [profileData, setProfileData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPrivacy, setEditPrivacy] = useState<"public" | "private">("private");
  const [editAvatar, setEditAvatar] = useState(""); // base64
  const [editAvatarColor, setEditAvatarColor] = useState("");

  // Social states
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "approved">("none");
  const [incomingFollowId, setIncomingFollowId] = useState<string | null>(null);

  // Image Upload handler with Canvas local Compression
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image using HTML5 Canvas to keep document size light
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
          setEditAvatar(compressedBase64);
          setEditAvatarColor(""); // clear preset color when custom image uploaded
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  // Load profile data
  useEffect(() => {
    let unsubUser = () => {};
    setLoading(true);

    const userDocRef = doc(db, "users", username);
    unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileData(data);
        setEditDisplayName(data.displayName || data.nickname || "");
        setEditEmail(data.email || "");
        setEditPhone(data.phone || "");
        setEditPrivacy(data.accountType || data.privacy || "private");
        setEditAvatar(data.avatar || "");
        setEditAvatarColor(data.avatarColor || PRESET_AVATARS[0]);
      } else {
        setProfileData(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${username}`);
      setLoading(false);
    });

    return () => unsubUser();
  }, [username]);

  // Load followers & following in real-time
  useEffect(() => {
    const followsCol = collection(db, "follows");

    // Query 1: Followers of this user
    const qFollowers = query(followsCol, where("recipient", "==", username), where("status", "==", "approved"));
    const unsubFollowers = onSnapshot(qFollowers, (snap) => {
      setFollowersCount(snap.size);
    });

    // Query 2: People this user follows
    const qFollowing = query(followsCol, where("sender", "==", username), where("status", "==", "approved"));
    const unsubFollowing = onSnapshot(qFollowing, (snap) => {
      setFollowingCount(snap.size);
    });

    // Query 3: My relationship with this user (if not me)
    let unsubRel = () => {};
    if (!isMe) {
      const relationshipDocId = `${currentUsername}_${username}`;
      const relDocRef = doc(db, "follows", relationshipDocId);
      unsubRel = onSnapshot(relDocRef, (snap) => {
        if (snap.exists()) {
          const val = snap.data();
          setFollowStatus(val.status as any);
        } else {
          setFollowStatus("none");
        }
      });
    }

    return () => {
      unsubFollowers();
      unsubFollowing();
      unsubRel();
    };
  }, [username, currentUsername, isMe]);

  // Save changes
  const handleSaveProfile = async () => {
    if (!editDisplayName.trim()) {
      alert("الرجاء إدخال الاسم المعروض.");
      return;
    }
    if (!editEmail.trim()) {
      alert("البريد الإلكتروني إلزامي.");
      return;
    }
    if (!editPhone.trim()) {
      alert("رقم الهاتف إلزامي.");
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", username);
      const updatedPayload = {
        displayName: editDisplayName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        privacy: editPrivacy,
        accountType: editPrivacy, // Write to both for compatibility!
        avatar: editAvatar,
        avatarColor: editAvatarColor,
        lastActive: new Date().toISOString()
      };

      await updateDoc(userRef, updatedPayload);
      
      // Sync to Supabase in background
      const fullSnap = await getDoc(userRef);
      if (fullSnap.exists()) {
        await syncUserToSupabase(username, fullSnap.data());
      }

      setIsEditing(false);
      alert(t("profileUpdated") || "تم حفظ تفاصيل ملفك الشخصي الفاخر بنجاح!");
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ التحديثات.");
    } finally {
      setSaving(false);
    }
  };

  // Follow / Unfollow actions
  const handleFollowClick = async () => {
    const followId = `${currentUsername}_${username}`;
    try {
      const followPayload = {
        sender: currentUsername,
        recipient: username,
        status: "approved", // Fast premium direct following to enjoy instant community updates
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "follows", followId), followPayload);
      await syncFollowToSupabase(followId, followPayload);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnfollowClick = async () => {
    const followId = `${currentUsername}_${username}`;
    try {
      await deleteDoc(doc(db, "follows", followId));
      await deleteFollowFromSupabase(followId);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={isRtl ? "rtl" : "ltr"}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="w-full max-w-md bg-white dark:bg-[#131b2e] border border-slate-250 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {isMe ? t("myProfileBtn") : t("viewProfileBtn") || "الملف الشخصي"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 md:p-6 overflow-y-auto max-h-[75vh] flex-1 flex flex-col items-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400 font-medium">جاري جلب الملف الآمن...</span>
              </div>
            ) : !profileData ? (
              <div className="text-center py-10">
                <span className="text-xs text-rose-500 font-bold">عذراً، هذا الحساب غير موجود أو تم إزالته.</span>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                {/* Profile Photo Display / Picker */}
                <div className="relative group mb-4">
                  {editAvatar ? (
                    <img
                      src={editAvatar}
                      alt={editDisplayName}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg"
                    />
                  ) : (
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 border-white dark:border-slate-800 ${editAvatarColor}`}>
                      {editDisplayName ? editDisplayName.charAt(0).toUpperCase() : username.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {isMe && isEditing && (
                    <label className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-md">
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                    </label>
                  )}
                </div>

                {isEditing ? (
                  /* Edit View */
                  <div className="w-full flex flex-col gap-4">
                    {/* Prest colors list if editing */}
                    {isMe && isEditing && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-2xs text-slate-400 font-bold">تخصيص لون الخلفية (إذا لم ترفع صورة):</span>
                        <div className="flex items-center gap-1.5 justify-center py-1">
                          {PRESET_AVATARS.map((col) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => {
                                setEditAvatarColor(col);
                                setEditAvatar(""); // clear picture
                              }}
                              className={`w-6 h-6 rounded-full border transition-all ${col} ${editAvatarColor === col ? "ring-2 ring-indigo-505 border-transparent scale-110" : "border-slate-300"}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="text-2xs font-extrabold text-slate-500 dark:text-slate-400">{t("displayNameLabel")}</label>
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder={t("displayNamePlaceholder")}
                        className="w-full bg-slate-50 border border-slate-205 dark:bg-slate-900/50 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-2xs font-extrabold text-slate-500 dark:text-slate-400">اسم المستخدم (المستعار)</label>
                      <input
                        type="text"
                        value={username}
                        disabled
                        className="w-full bg-slate-100/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-400 cursor-not-allowed outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-2xs font-extrabold text-slate-500 dark:text-slate-400">{t("emailLabel")}</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder={t("emailPlaceholder")}
                        className="w-full bg-slate-50 border border-slate-205 dark:bg-slate-900/50 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-2xs font-extrabold text-slate-500 dark:text-slate-400">{t("phoneLabel")}</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder={t("phonePlaceholder")}
                        className="w-full bg-slate-50 border border-slate-205 dark:bg-slate-900/50 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Account Privacy Toggle */}
                    <div className="flex flex-col gap-1.5 p-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl mt-1">
                      <span className="text-2xs font-extrabold text-slate-500 dark:text-slate-400">خصوصية الحساب:</span>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                          <input
                            type="radio"
                            name="privacy"
                            checked={editPrivacy === "public"}
                            onChange={() => setEditPrivacy("public")}
                            className="text-indigo-650"
                          />
                          <span>{t("privacyPublic")}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                          <input
                            type="radio"
                            name="privacy"
                            checked={editPrivacy === "private"}
                            onChange={() => setEditPrivacy("private")}
                            className="text-indigo-655"
                          />
                          <span>{t("privacyPrivate")}</span>
                        </label>
                      </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex gap-2.5 mt-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:scale-100 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t("submittingLoader") || "جاري التحديث..."}</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>{t("saveBtn")}</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        disabled={saving}
                        className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs py-3 rounded-xl font-semibold transition-all cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Profile View */
                  <div className="w-full flex flex-col items-center">
                    {/* Display Name */}
                    <h2 className="text-base font-bold text-slate-800 dark:text-white text-center flex items-center gap-1.5">
                      {profileData.displayName || profileData.nickname}
                      {profileData.role === "admin" && (
                        <span className="text-[10px] bg-red-100 dark:bg-red-950/20 text-red-600 px-1.5 py-0.5 rounded-md font-bold">👑 منسق</span>
                      )}
                    </h2>
                    <h3 className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">@{username}</h3>

                    {/* Privacy badge */}
                    <div className="mt-2.5">
                      {profileData.accountType === "public" || profileData.privacy === "public" ? (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-full text-2xs font-bold leading-none">
                          <Globe className="w-3 h-3" />
                          <span>{t("publicProfileBadge") || "حساب عام 🌐"}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-850 rounded-full text-2xs font-bold leading-none">
                          <Lock className="w-3 h-3" />
                          <span>{t("privateProfileBadge") || "حساب خاص 🔒"}</span>
                        </div>
                      )}
                    </div>

                    {/* Followers & Following box */}
                    <div className="w-full grid grid-cols-2 gap-4 my-5 py-3.5 border-y border-slate-100 dark:border-slate-800 text-center">
                      <div className="flex flex-col">
                        <span className="text-xl font-extrabold text-slate-800 dark:text-white">{followersCount}</span>
                        <span className="text-2xs text-slate-400 font-bold">{t("followersCountLabel")}</span>
                      </div>
                      <div className="flex flex-col border-s border-slate-100 dark:border-slate-800">
                        <span className="text-xl font-extrabold text-slate-800 dark:text-white">{followingCount}</span>
                        <span className="text-2xs text-slate-400 font-bold">{t("followingCountLabel")}</span>
                      </div>
                    </div>

                    {/* Private boundaries warning / Contact Details if Me or Coordinator */}
                    {(isMe || currentUsername === "1007363904") ? (
                      <div className="w-full bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/60 dark:border-indigo-900/30 rounded-2xl p-4 flex flex-col gap-2.5 mb-5 align-start text-start">
                        <div className="text-2xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>{t("onlyVisibleToYou")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{profileData.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{profileData.phone}</span>
                        </div>
                      </div>
                    ) : (
                      /* Display no details if normal viewer */
                      <div className="w-full bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850 rounded-2xl p-3 text-2xs text-slate-400 dark:text-slate-500 font-medium text-center mb-5">
                        <span>🔒 معلومات الاتصال (البريد ورقم الهاتف) محمية ومخفية بالكامل.</span>
                      </div>
                    )}

                    {/* Social button Actions */}
                    <div className="w-full flex gap-2">
                      {isMe ? (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="w-full bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-105 hover:bg-slate-800 dark:hover:bg-slate-750 text-xs py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          تعديل الملف الشخصي 👤
                        </button>
                      ) : (
                        <>
                          {followStatus === "approved" ? (
                            <button
                              onClick={handleUnfollowClick}
                              className="flex-1 bg-rose-50 border border-rose-100 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 text-rose-600 dark:text-rose-450 text-xs py-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer"
                            >
                              {t("unfollowUserBtn") || "إلغاء المتابعة"}
                            </button>
                          ) : (
                            <button
                              onClick={handleFollowClick}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>{t("followUserBtn") || "متابعة"}</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
