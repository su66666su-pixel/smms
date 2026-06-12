import React, { useState, useEffect, useRef } from "react";
import { 
  Send, UploadCloud, FileText, Image as ImageIcon, Download, 
  Trash2, X, Lock, MessageSquare, Users, ChevronLeft, Search, Check, AlertCircle, Clock
} from "lucide-react";
import { collection, addDoc, query, where, onSnapshot, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { processFileForUpload, downloadBase64File } from "../utils/compressor";
import { syncMessageToSupabase } from "../supabase";

interface DMsPanelProps {
  currentUsername: string; // nickname
  lang: string;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

export function DMsPanel({ currentUsername, lang, t }: DMsPanelProps) {
  const isRtl = lang === "ar" || lang === "ur";

  // List of all messages involving current user
  const [allDmMessages, setAllDmMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  
  // Active selected person for private chat
  const [activePartner, setActivePartner] = useState<string | null>(null);
  
  // Available partners (friends/followed users)
  const [availablePartners, setAvailablePartners] = useState<any[]>([]);
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Shake tracking hooks
  const prevMessagesLengthRef = useRef<number>(0);
  const [shouldShake, setShouldShake] = useState(false);
  const [shakingMessageId, setShakingMessageId] = useState<string | null>(null);
  const [shakingPartner, setShakingPartner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Listen to all direct messages involving current user
  useEffect(() => {
    if (!currentUsername) return;

    const q = query(
      collection(db, "direct_messages"),
      where("participants", "array-contains", currentUsername)
    );

     const unsub = onSnapshot(q, (snapshot) => {
       const list: any[] = [];
       snapshot.forEach((docSnap) => {
         list.push({ id: docSnap.id, ...docSnap.data() });
       });
 
       // Sort by creation time locally (prevents composite index requirements)
       list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

       // Detect new incoming message from someone else to trigger shake
       if (list.length > 0 && prevMessagesLengthRef.current > 0 && list.length > prevMessagesLengthRef.current) {
         const newest = list[list.length - 1];
         if (newest && newest.sender !== currentUsername) {
           setShakingMessageId(newest.id || null);
           setShakingPartner(newest.sender || null);
           setShouldShake(true);

           // Play standard browser chime or notification if available
           try {
             const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
             const osc = audioContext.createOscillator();
             const gain = audioContext.createGain();
             osc.type = "sine";
             osc.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5 note
             osc.frequency.setValueAtTime(880, audioContext.currentTime + 0.12); // A5 note
             gain.gain.setValueAtTime(0.08, audioContext.currentTime);
             gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
             osc.connect(gain);
             gain.connect(audioContext.destination);
             osc.start();
             osc.stop(audioContext.currentTime + 0.4);
           } catch (ae) {}

           setTimeout(() => {
             setShouldShake(false);
             setShakingMessageId(null);
             setShakingPartner(null);
           }, 850);
         }
       }

       prevMessagesLengthRef.current = list.length;
       setAllDmMessages(list);
     }, (error) => {
       console.error("Error loading direct messages: ", error);
       handleFirestoreError(error, OperationType.LIST, "direct_messages");
     });

    return () => unsub();
  }, [currentUsername]);

  // 2. Load contacts (people whom the user follows or who follow the user) to initiate chat
  useEffect(() => {
    async function loadContacts() {
      if (!currentUsername) return;
      setIsLoadingPartners(true);
      try {
        const followsCollection = collection(db, "follows");
        const qSent = query(followsCollection, where("sender", "==", currentUsername), where("status", "==", "approved"));
        const qRecv = query(followsCollection, where("recipient", "==", currentUsername), where("status", "==", "approved"));

        const [sentSnap, recvSnap] = await Promise.all([getDocs(qSent), getDocs(qRecv)]);
        
        const friendsSet = new Set<string>();
        sentSnap.forEach(d => friendsSet.add(d.data().recipient));
        recvSnap.forEach(d => friendsSet.add(d.data().sender));

        const friendsArray = Array.from(friendsSet);
        const fetchedFriends: any[] = [];

        // Fetch their avatar details
        for (const fName of friendsArray) {
          const userDoc = await getDoc(doc(db, "users", fName));
          if (userDoc.exists()) {
            fetchedFriends.push({
              nickname: fName,
              avatarColor: userDoc.data().avatarColor || "bg-blue-600",
              email: userDoc.data().email || ""
            });
          } else {
            fetchedFriends.push({
              nickname: fName,
              avatarColor: "bg-blue-500",
              email: ""
            });
          }
        }
        setAvailablePartners(fetchedFriends);
      } catch (err) {
        console.error("Error loading contacts for DMs:", err);
      } finally {
        setIsLoadingPartners(false);
      }
    }

    loadContacts();
  }, [currentUsername]);

  // 3. Auto-scroll to the bottom when active messages stream changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allDmMessages, activePartner]);

  // Build conversations history from allDmMessages
  const getConversations = () => {
    const groups: Record<string, { lastMessage: any; partner: string }> = {};

    allDmMessages.forEach((msg) => {
      const partner = msg.sender === currentUsername ? msg.recipient : msg.sender;
      if (!partner) return;

      const existing = groups[partner];
      if (!existing || new Date(msg.createdAt).getTime() > new Date(existing.lastMessage.createdAt).getTime()) {
        groups[partner] = {
          lastMessage: msg,
          partner
        };
      }
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  };

  const conversations = getConversations();

  // Filter messages for currently active chat session
  const activeConversationId = activePartner 
    ? [currentUsername, activePartner].sort().join("_")
    : "";

  const activeMessages = allDmMessages.filter(
    (msg) => msg.conversationId === activeConversationId
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartner || (!inputText.trim() && !selectedFile)) return;

    try {
      const payload = {
        sender: currentUsername,
        recipient: activePartner,
        text: inputText.trim(),
        createdAt: new Date().toISOString(),
        conversationId: activeConversationId,
        participants: [currentUsername, activePartner],
        file: selectedFile || null
      };

      setInputText("");
      setSelectedFile(null);

      const docRef = await addDoc(collection(db, "direct_messages"), payload);

      // Symmetrically push to Supabase as well
      try {
        await syncMessageToSupabase(docRef.id, `dm_${activeConversationId}`, {
          senderId: currentUsername,
          senderName: currentUsername,
          senderAvatar: "bg-indigo-600",
          text: payload.text,
          createdAt: payload.createdAt,
          isPrivate: true,
          recipientId: activePartner,
          recipientName: activePartner,
          file: payload.file || undefined
        });
      } catch (sbErr) {
        console.warn("Supabase integration secondary push skipped:", sbErr);
      }

    } catch (err) {
      console.error("Failed to send direct message: ", err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm(t("confirmDeletePrivateMsg"))) {
      return;
    }
    try {
      const docRef = doc(db, "direct_messages", msgId);
      await updateDoc(docRef, {
        isDeleted: true,
        text: t("msgDeleted"),
        file: null
      });

      try {
        await syncMessageToSupabase(msgId, `dm_${activeConversationId}`, {
          text: t("msgDeleted"),
          file: null
        });
      } catch (sbErr) {
        console.warn("Supabase delete sync skipped:", sbErr);
      }
    } catch (err) {
      console.error("Failed to delete direct message: ", err);
      alert(t("failedDeletePrivateMsg"));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await processFileForUpload(file);
      setSelectedFile(result);
    } catch (err) {
      console.error("Direct message file processing failed:", err);
      alert(t("failedPrepareDirectFile"));
    } finally {
      setIsUploading(false);
    }
  };

  // Filter contacts by keyword
  const filteredContacts = availablePartners.filter(contact => 
    contact.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-[#151f32] border rounded-3xl overflow-hidden relative shadow-sm transition-all duration-300 ${isRtl ? "text-right" : "text-left"} ${shouldShake ? "animate-subtle-shake border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900/40" : "border-slate-200 dark:border-slate-800"}`}>
      
      {/* 1. CHAT THREAD VIEW SCREEN */}
      {activePartner ? (
        <div className="flex flex-col h-full min-h-0">
          {/* Active DM Header */}
          <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
            <button 
              onClick={() => setActivePartner(null)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
              <span className="text-2xs font-extrabold">{t("btnBack")}</span>
            </button>

            <div className={`flex items-center gap-2.5 flex-1 justify-end ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-normal">{activePartner}</h4>
                <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  {t("secureDirectChat")}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0 border border-slate-200 dark:border-slate-800">
                {activePartner.substring(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          {/* DM Message stream */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 scrollbar-thin bg-slate-50/50">
            {activeMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-70">
                <Lock className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-xs text-slate-600 font-black">{t("startSecureConversationTitle")}</p>
                <p className="text-[10px] text-slate-450 mt-1 max-w-[240px] leading-relaxed">
                  {t("startSecureConversationDesc")}
                </p>
              </div>
            ) : (
              activeMessages.map((msg) => {
                const isMe = msg.sender === currentUsername;
                const formattedTime = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
                const isDeleted = msg.isDeleted === true;
                const messageText = isDeleted
                  ? t("msgDeleted")
                  : msg.text;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 max-w-[85%] group relative items-center ${isMe ? "self-end flex-row-reverse text-right" : "self-start flex-row text-left"} ${msg.id === shakingMessageId ? "animate-subtle-shake" : ""}`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      {/* Dialogue Bubble */}
                      <div
                        className={`rounded-2xl p-3 text-xs leading-relaxed shadow-sm relative border ${
                          isDeleted
                            ? "bg-slate-100 dark:bg-slate-805 text-slate-450 dark:text-slate-500 border-slate-200 dark:border-slate-700 italic"
                            : isMe
                              ? "bg-indigo-600 text-white border-indigo-700/50 rounded-tr-none"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none"
                        } ${msg.id === shakingMessageId ? "border-indigo-400 bg-indigo-50/10 shadow-md" : ""}`}
                      >
                        {/* Message body */}
                        {(messageText || isDeleted) && (
                          <div className={`flex items-center gap-1.5 ${isDeleted ? "text-slate-450" : ""}`}>
                            {isDeleted && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <p className="whitespace-pre-wrap font-sans break-words">{messageText}</p>
                          </div>
                        )}

                        {/* Message file attachment support */}
                        {msg.file && !isDeleted && (
                          <div className="mt-2 text-slate-900">
                            {msg.file.type.startsWith("image/") ? (
                              <div className="rounded-lg overflow-hidden border border-slate-200 shrink-0 max-w-[190px]">
                                <img
                                  src={msg.file.dataUrl}
                                  alt={msg.file.name}
                                  className="w-full h-auto cursor-pointer max-h-48 object-cover"
                                  onClick={() => downloadBase64File(msg.file!.dataUrl, msg.file!.name)}
                                  referrerPolicy="no-referrer"
                                />
                                <div className="bg-slate-50 border-t border-slate-100 p-1.5 px-2 flex justify-between items-center text-[9px] text-slate-650 font-semibold">
                                  <span className="truncate max-w-[120px]">{msg.file.name}</span>
                                  <button
                                    onClick={() => downloadBase64File(msg.file!.dataUrl, msg.file!.name)}
                                    className="text-blue-600 hover:text-blue-700 pointer-events-auto"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center gap-2.5 text-slate-800">
                                <div className="w-7 h-7 rounded-lg bg-indigo-55 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className={`flex-1 min-w-0 text-left`}>
                                  <p className="text-[10px] font-bold text-slate-850 truncate max-w-[90px]">{msg.file.name}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => downloadBase64File(msg.file!.dataUrl, msg.file!.name)}
                                  className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-850 pointer-events-auto cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Time stamp inside */}
                        <div className={`text-[8.5px] mt-1.5 flex items-center gap-1 justify-end opacity-80 ${isMe && !isDeleted ? "text-indigo-200" : "text-slate-400 font-mono"}`}>
                          <span>{formattedTime}</span>
                          {isMe && !isDeleted && <Check className="w-3 h-3 text-indigo-100 shrink-0" />}
                        </div>
                      </div>
                    </div>

                    {/* Delete button option for the owner of active messages */}
                    {isMe && !isDeleted && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 px-1.5 bg-slate-50 hover:bg-slate-200 text-slate-450 hover:text-rose-600 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer text-xxs flex items-center justify-center shrink-0 border border-slate-200"
                        title={t("deleteMsgForEveryone")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* DM text and document attachments inputs */}
          <form onSubmit={handleSendMessage} className="bg-slate-50 border-t border-slate-200 p-3.5 flex flex-col gap-2">
            
            {/* File attachment preview */}
            {selectedFile && (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs">
                <div className="flex items-center gap-2 text-indigo-805">
                  <span className="text-xs">📁</span>
                  <p className="font-extrabold max-w-[170px] truncate leading-none">{selectedFile.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-indigo-500 hover:text-rose-600 rounded-lg hover:bg-indigo-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-10 h-10 shrink-0 rounded-xl border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-550 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer relative"
                title={t("attachMediaFile")}
              >
                <UploadCloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t("typeDirectMsgPlaceholder")}
                className={`flex-1 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-705 focus:border-indigo-650 dark:focus:border-indigo-500 outline-none rounded-xl px-3 text-xs leading-none transition-all font-sans py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
              />

              <button
                type="submit"
                disabled={!inputText.trim() && !selectedFile}
                className="w-10 h-10 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
              </button>
            </div>
          </form>
        </div>
      ) : (
        
        /* 2. CHAT ROSTER / LIST VIEW SCREEN */
        <div className="flex flex-col h-full min-h-0">
          
          {/* Header of Sidebar */}
          <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block animate-pulse shrink-0" />
              {t("privateDmsTitle")}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
              {t("privateDmsDesc")}
            </p>
          </div>

          {/* Quick Search For Contact */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#151f32]">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchContactDmPlaceholder")}
                className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none rounded-xl py-2 px-3.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${isRtl ? "text-right" : "text-left"}`}
              />
              <Search className={`absolute w-3.5 h-3.5 text-slate-400 top-2.5 ${isRtl ? "left-3" : "right-3"}`} />
            </div>
          </div>

          {/* DM list stream splits: Recent Conversations vs Connections */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
            
            {/* If there is active searchQuery, show filtered contacts results */}
            {searchQuery ? (
              <div className="space-y-2">
                <p className="text-[10px] font-extrabold text-slate-405 uppercase tracking-wider">{t("contactsSearchResultTitle")}</p>
                {filteredContacts.length === 0 ? (
                  <p className="text-3xs text-slate-400 py-2.5 italic">{t("noMatchingFollowedFriends")}</p>
                ) : (
                  filteredContacts.map(contact => (
                    <button
                      key={contact.nickname}
                      onClick={() => {
                        setActivePartner(contact.nickname);
                        setSearchQuery("");
                      }}
                      className="w-full flex items-center justify-between p-2.5 bg-indigo-50/40 border border-indigo-100/50 hover:bg-indigo-50 rounded-2xl transition-all cursor-pointer text-xs font-sans"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shrink-0 ${contact.avatarColor}`}>
                          {contact.nickname.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-800">{contact.nickname}</p>
                          <p className="text-3xs text-slate-400 font-mono truncate max-w-[120px]">{contact.email}</p>
                        </div>
                      </div>
                      <MessageSquare className="w-4 h-4 text-indigo-500" />
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                {/* 1. Conversations list history */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-extrabold text-slate-404 text-slate-400 uppercase tracking-wider mb-2">{t("recentConversationsTitle")}</p>
                  
                  {conversations.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400">
                      <MessageSquare className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                      <p className="text-3xs font-extrabold text-slate-500">{t("noActiveChatsYet")}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        {t("noActiveChatsYetDesc")}
                      </p>
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const displayTime = conv.lastMessage.createdAt 
                        ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : "";
                      const isSenderMe = conv.lastMessage.sender === currentUsername;

                      return (
                        <button
                          key={conv.partner}
                          onClick={() => setActivePartner(conv.partner)}
                          className={`w-full flex items-center justify-between p-3 border rounded-2xl transition-all cursor-pointer text-xs font-sans text-left ${
                            conv.partner === shakingPartner
                              ? "animate-subtle-shake border-indigo-400 dark:border-indigo-500 bg-indigo-50/35 dark:bg-indigo-950/20 ring-2 ring-indigo-200 dark:ring-indigo-900/30"
                              : "border-slate-100 dark:border-slate-805 hover:border-indigo-100 dark:hover:border-indigo-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-100 to-indigo-500 text-indigo-950 dark:text-slate-100 flex items-center justify-center font-black text-xs shrink-0 self-center">
                              {conv.partner.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-extrabold text-slate-805 dark:text-slate-100 truncate text-left">{conv.partner}</p>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-mono shrink-0 ml-1.5">{displayTime}</span>
                              </div>
                              <p className="text-xxs text-slate-450 dark:text-slate-400 truncate mt-0.5">
                                {isSenderMe ? t("dmYouPrefix") : ""}
                                {conv.lastMessage.file ? t("dmAttachedDocument") : conv.lastMessage.text}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* 2. Direct Contacts Connection list (Approved Follows) */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">{t("startChatWithFriends")}</p>
                  
                  {isLoadingPartners ? (
                    <div className="flex items-center justify-center py-4 text-slate-400 text-3xs">
                      <Clock className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>{t("discoveringVerifiedConnections")}</span>
                    </div>
                  ) : availablePartners.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-center text-slate-400">
                      <Users className="w-4 h-4 text-slate-350 mx-auto mb-1.5" />
                      <p className="text-[10px] text-slate-400 leading-normal">
                        {t("noVerifiedDirectFriends")}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {availablePartners.map(contact => (
                        <button
                          key={contact.nickname}
                          onClick={() => setActivePartner(contact.nickname)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-xs font-sans text-left ${
                            contact.nickname === shakingPartner
                              ? "animate-subtle-shake bg-indigo-50/40 ring-2 ring-indigo-300"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shrink-0 ${contact.avatarColor}`}>
                              {contact.nickname.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-800 truncate">{contact.nickname}</p>
                              {contact.email && <p className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{contact.email}</p>}
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-750 font-black whitespace-nowrap">
                            {t("btnChat")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
