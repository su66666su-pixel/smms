import React, { useState, useEffect } from "react";
import { 
  Video, Phone, MessageSquare, CheckCircle, AlertCircle, Heart
} from "lucide-react";
import { collection, query, where, onSnapshot, doc, addDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { syncMessageToSupabase } from "../supabase";

interface FollowingPanelProps {
  currentUsername: string; // nickname
  currentRoomId: string | null;
  currentRoomTitle: string;
  onJoinRoom: (title: string) => void;
  onSwitchTab: (tab: "chat" | "dms" | "contacts") => void; // allow quick tab switching
  t: (key: string, replacements?: Record<string, string | number>) => string;
  lang: string;
}

export function FollowingPanel({
  currentUsername,
  currentRoomId,
  currentRoomTitle,
  onJoinRoom,
  onSwitchTab,
  t,
  lang
}: FollowingPanelProps) {
  const isRtl = lang === "ar" || lang === "ur";
  const [approvedFollowing, setApprovedFollowing] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Success message states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Listen to approved sent follows from the current user
  useEffect(() => {
    if (!currentUsername) {
      setApprovedFollowing([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "follows"),
      where("sender", "==", currentUsername),
      where("status", "==", "approved")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setApprovedFollowing(list);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching approved follows inside FollowingPanel:", error);
      handleFirestoreError(error, OperationType.LIST, "follows");
      setIsLoading(false);
    });

    return () => unsub();
  }, [currentUsername]);

  const showSuccess = (text: string) => {
    setSuccessMsg(text);
    setTimeout(() => setSuccessMsg(null), 4050);
  };

  const showError = (text: string) => {
    setErrorMsg(text);
    setTimeout(() => setErrorMsg(null), 4050);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 font-sans">
      <div className={`flex items-center justify-between border-b border-slate-100 pb-2.5 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
        <div className="flex items-center gap-2">
          <div className="p-1 px-1.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-lg">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
          </div>
          <span className="text-xs font-black text-slate-800">
            {t("networkFollowingTitle")} 
            <span className="bg-slate-100/80 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px] ml-1.5 font-bold font-mono">
              {approvedFollowing.length}
            </span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          {t("quickDialNode")}
        </span>
      </div>

      {/* Notifications overlay block */}
      {successMsg && (
        <div className={`bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl flex items-center gap-2 shadow-xs text-3xs font-semibold text-emerald-800 animate-fadeIn ${isRtl ? "flex-row-reverse text-right" : "flex-row text-left"}`}>
          <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span className="flex-1 leading-normal">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className={`bg-rose-50 border border-rose-150 p-2.5 rounded-xl flex items-center gap-2 shadow-xs text-3xs font-semibold text-rose-800 animate-fadeIn ${isRtl ? "flex-row-reverse text-right" : "flex-row text-left"}`}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
          <span className="flex-1 leading-normal">{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
          <span className="text-[10px] text-slate-400 font-bold">{t("synchronizingNetworkList")}</span>
        </div>
      ) : approvedFollowing.length === 0 ? (
        <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col gap-1.5 items-center">
          <p className="text-[11px] font-semibold text-slate-450 leading-relaxed max-w-[200px]">
            {t("noUsersFollowedYet")}
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab("contacts")}
            className="text-[10px] text-indigo-650 hover:text-indigo-800 font-black cursor-pointer flex items-center gap-1 mt-1 transition-all bg-indigo-50 border border-indigo-100 hover:border-indigo-150 px-2.5 py-1.5 rounded-lg shadow-2xs"
          >
            <span>✨ {t("findFollowPeopleNow")}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-0.5">
          {approvedFollowing.map((fol) => (
            <FollowedUserRow
              key={fol.id}
              currentUsername={currentUsername}
              targetUsername={fol.recipient}
              currentRoomId={currentRoomId}
              currentRoomTitle={currentRoomTitle}
              onJoinRoom={onJoinRoom}
              onSwitchTab={onSwitchTab}
              showSuccess={showSuccess}
              showError={showError}
              lang={lang}
              isRtl={isRtl}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
interface FollowedUserRowProps {
  currentUsername: string;
  targetUsername: string;
  currentRoomId: string | null;
  currentRoomTitle: string;
  onJoinRoom: (title: string) => void;
  onSwitchTab: (tab: "chat" | "dms" | "contacts") => void;
  showSuccess: (text: string) => void;
  showError: (text: string) => void;
  lang: string;
  isRtl: boolean;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const FollowedUserRow: React.FC<FollowedUserRowProps> = ({
  currentUsername,
  targetUsername,
  currentRoomId,
  currentRoomTitle,
  onJoinRoom,
  onSwitchTab,
  showSuccess,
  showError,
  lang,
  isRtl,
  t
}) => {
  const [targetUser, setTargetUser] = useState<any>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  // 2. Real-time document listener on the target user record to check currentRoom status
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", targetUsername), (snap) => {
      if (snap.exists()) {
        setTargetUser(snap.data());
      }
    }, (error) => {
      console.warn(`Silently failed following user sub ${targetUsername}:`, error);
    });
    return () => unsub();
  }, [targetUsername]);

  const activeRoomId = targetUser?.currentRoomId || null;
  const activeRoomTitle = targetUser?.currentRoomTitle || null;
  const avatarColor = targetUser?.avatarColor || targetUser?.avatar || "bg-indigo-650";

  // Build symmetrical conversation identifier for DMs
  const dmConversationId = [currentUsername, targetUsername].sort().join("_");

  // Call invitation handler
  const handleSendCallInvite = async () => {
    if (!currentRoomTitle || !currentRoomId) {
      showError(t("pleaseEnterVideoRoomFirst"));
      return;
    }
    
    setSendingInvite(true);
    try {
      const inviteMsg = t("callInviteText", { roomTitle: currentRoomTitle });

      const payload = {
        sender: currentUsername,
        recipient: targetUsername,
        text: inviteMsg,
        createdAt: new Date().toISOString(),
        conversationId: dmConversationId,
        participants: [currentUsername, targetUsername],
        file: null
      };

      const docRef = await addDoc(collection(db, "direct_messages"), payload);

      // Symmetrically push to Supabase as well
      try {
        await syncMessageToSupabase(docRef.id, `dm_${dmConversationId}`, {
          senderId: currentUsername,
          senderName: currentUsername,
          senderAvatar: "bg-indigo-600",
          text: payload.text,
          createdAt: payload.createdAt,
          isPrivate: true,
          recipientId: targetUsername,
          recipientName: targetUsername
        });
      } catch (err) {}

      showSuccess(t("callInviteSuccess", { targetUsername }));
    } catch (e) {
      console.error("Error sending call invite:", e);
      showError(t("callInviteFailed"));
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <div className={`p-2.5 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl flex items-center justify-between gap-3 transition-all ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
      {/* Circle details & text states */}
      <div className={`flex items-center gap-2 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
        <div className="relative">
          <div className={`w-8 h-8 rounded-lg ${avatarColor} text-white font-extrabold text-xs flex items-center justify-center border border-white shadow-xs shrink-0`}>
            {targetUsername.substring(0, 2).toUpperCase()}
          </div>
          {/* Online green indicator if active in any room */}
          {activeRoomId ? (
            <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
            </span>
          ) : (
            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-slate-350 border border-white rounded-full bg-slate-400"></span>
          )}
        </div>

        <div className={isRtl ? "text-right" : "text-left"}>
          <div className="text-[11px] font-black text-slate-800 flex items-center gap-1">
            <span>{targetUsername}</span>
          </div>
          {activeRoomId ? (
            <p className="text-[9.5px] text-emerald-600 font-bold leading-normal truncate max-w-[120px] flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {t("busyInRoom")} 
              <span className="underline decoration-emerald-200">{activeRoomTitle}</span>
            </p>
          ) : (
            <p className="text-[9px] text-slate-400 leading-normal font-semibold">
              {t("offlineNotInRoom")}
            </p>
          )}
        </div>
      </div>

      {/* Connection calling and private tools */}
      <div className="flex gap-1 shrink-0">
        {/* Quick dial button */}
        {activeRoomId ? (
          <button
            onClick={() => {
              if (activeRoomId === currentRoomId) {
                showSuccess(t("alreadyConnectedInRoom"));
              } else {
                onJoinRoom(activeRoomTitle || activeRoomId);
                showSuccess(t("connectingAndMorphing", { activeRoomTitle: activeRoomTitle || activeRoomId }));
              }
            }}
            className="p-2 bg-emerald-50 border border-emerald-150 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-emerald-700 rounded-lg transition-all cursor-pointer shadow-2xs"
            title={t("joinCallAndStream")}
          >
            <Video className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSendCallInvite}
            disabled={sendingInvite}
            className="p-2 bg-slate-100 border border-slate-200 hover:bg-slate-250 text-slate-600 hover:text-slate-800 hover:border-slate-300 rounded-lg transition-all cursor-pointer disabled:opacity-40 shadow-2xs"
            title={t("sendCallInvite")}
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Quick DM button */}
        <button
          onClick={() => {
            onSwitchTab("dms");
            // Highlight of friend will happen natively or they can start writing
          }}
          className="p-2 bg-blue-50 border border-blue-150 hover:bg-blue-600 hover:text-white hover:border-blue-605 text-blue-700 rounded-lg transition-all cursor-pointer shadow-2xs"
          title={t("directPrivateMessage")}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
