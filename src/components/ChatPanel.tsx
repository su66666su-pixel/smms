import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Download,
  Bot,
  BrainCircuit,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Message } from "../types";
import { processFileForUpload, downloadBase64File } from "../utils/compressor";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (text: string, filePayload?: { name: string; type: string; size?: number; dataUrl: string }) => void;
  userId: string;
  roomId: string;
}

export function ChatPanel({ messages, onSendMessage, userId, roomId }: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  } | null>(null);

  // AI Meeting summary state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto Scroll message stream on insertion
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    onSendMessage(inputText.trim(), selectedFile || undefined);
    setInputText("");
    setSelectedFile(null);
  };

  // Process selected file manually
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAndSetFile(file);
  };

  const processAndSetFile = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await processFileForUpload(file);
      setSelectedFile(result);
    } catch (err) {
      console.error("File processing failed:", err);
      alert("فشل في معالجة وتحميل هذا الملف.");
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and Drop drag over event
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Drop event
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Ask Gemini AI to Summarize meeting notes or current text chat logs
  const askAiSummary = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setAiSummary(null);

    // Extract only text logs from chat history
    const textHistory = messages
      .filter((m) => m.senderId !== "ai")
      .map((m) => ({
        senderId: m.senderId,
        senderName: m.senderName,
        text: m.text || (m.file ? `[شارك ملفاً: ${m.file.name}]` : ""),
      }));

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "يرجى تقديم ملخص منسق وشامل ومنظم عن النقاط المطروحة في هذه المحادثة حتى الآن بشكل نقاط واضحة.",
          chatHistory: textHistory,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "فشل توليد التلخيص الذكي.");
      }
      setAiSummary(data.text);
    } catch (err: any) {
      console.error("AI summarization failed:", err);
      setAiError(err?.message || "حدث خطأ أثناء الاتصال بالخادم الرئيسي للمساعد الذكي.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-3xl overflow-hidden relative shadow-sm">
      {/* Panel Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">دردشة الغرفة الفورية</h3>
        </div>

        {/* AI summary button */}
        <button
          onClick={askAiSummary}
          disabled={messages.length === 0 || isAiLoading}
          className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 disabled:opacity-40 text-indigo-700 text-xs px-3.5 py-1.5 rounded-xl transition-all font-bold disabled:cursor-not-allowed"
          title="تلخيص اللقاء ومخرجات الحديث بالذكاء الاصطناعي"
        >
          {isAiLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BrainCircuit className="w-3.5 h-3.5" />
          )}
          <span>ملخص اللقاء الذكي</span>
        </button>
      </div>

      {/* Floating AI Summary Dialog */}
      {aiSummary && (
        <div className="absolute inset-x-4 top-16 bottom-20 bg-slate-50 border border-indigo-150 rounded-2xl p-4 shadow-xl z-20 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
              <BrainCircuit className="w-4 h-4 text-indigo-655" />
              <span>ملخص وتوصيات الذكاء الاصطناعي للقاء:</span>
            </div>
            <button
              onClick={() => setAiSummary(null)}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto text-xs text-slate-700 leading-relaxed whitespace-pre-wrap text-right scrollbar-thin">
            {aiSummary}
          </div>
          <div className="border-t border-slate-200 pt-2.5 text-3xs text-slate-450 text-center">
            تضمن ذكاء خوارزمي مخصص ومأمن بالكامل - تم التحليل عبر نماذج Gemini 3.5
          </div>
        </div>
      )}

      {/* AI Error Alert popup banner */}
      {aiError && (
        <div className="absolute top-16 inset-x-4 bg-red-50 border border-red-100 p-3 rounded-xl z-20 flex justify-between items-center text-red-700 text-xs text-right">
          <span>{aiError}</span>
          <button onClick={() => setAiError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-70">
            <ImageIcon className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-xs text-slate-400">لا توجد رسائل أو ملفات مشتركة بعد</p>
            <p className="text-2xs text-slate-500 mt-1">ابدأ الحديث بالكتابة أو سحب ملفات وصور هنا</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === userId;
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[85%] ${isMe ? "self-end flex-row-reverse text-right" : "self-start flex-row text-left"}`}
              >
                {/* Avatar sphere */}
                <div
                  className={`w-8.5 h-8.5 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-bold ${
                    msg.senderAvatar || "bg-gray-750"
                  }`}
                >
                  {msg.senderName.charAt(0).toUpperCase()}
                </div>

                <div className="flex flex-col gap-1">
                  {/* Sender nickname & time */}
                  <div className="flex items-baseline gap-2 justify-start px-1">
                    <span className="text-xxs font-bold text-slate-600">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-400">{msg.createdAt}</span>
                  </div>

                  {/* Message container */}
                  <div
                    className={`rounded-2xl p-3 text-xs leading-relaxed ${
                      isMe
                        ? "bg-blue-600 text-white rounded-tr-none shadow-sm"
                        : "bg-slate-100 border border-slate-200 text-slate-850 rounded-tl-none shadow-sm"
                    }`}
                  >
                    {/* Render standard text content */}
                    {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                    {/* Render files image or attachment formats */}
                    {msg.file && (
                      <div className="mt-2.5">
                        {msg.file.type.startsWith("image/") ? (
                          <div className="rounded-lg overflow-hidden border border-slate-200 max-w-[200px]">
                            <img
                              src={msg.file.dataUrl}
                              alt={msg.file.name}
                              className="w-full h-auto cursor-pointer hover:opacity-90 max-h-48 object-cover"
                              onClick={() => downloadBase64File(msg.file!.dataUrl, msg.file!.name)}
                              referrerPolicy="no-referrer"
                            />
                            <div className="bg-slate-50 p-1.5 px-2 flex justify-between items-center text-[10px] text-slate-600">
                              <span className="truncate max-w-[120px]">{msg.file.name}</span>
                              <button
                                onClick={() => downloadBase64File(msg.file!.dataUrl, msg.file!.name)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xxs font-bold text-slate-800 truncate">{msg.file.name}</p>
                              {msg.file.size && (
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {Math.round(msg.file.size / 1024)} KB
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => downloadBase64File(msg.file!.dataUrl, msg.file!.name)}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-505 text-slate-500 hover:text-slate-800"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form area */}
      <div className="bg-slate-50 border-t border-slate-200 p-4">
        {/* Render drag drop active feedback overlay */}
        {dragActive && (
          <div
            className="absolute inset-x-4 bottom-20 top-16 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3 text-blue-700"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-12 h-12 text-blue-600 animate-bounce" />
            <p className="text-xs font-bold">أفلت المستندات أو الصور للتحميل اللحظي</p>
          </div>
        )}

        {/* Selected File thumbnail panel */}
        {selectedFile && (
          <div className="bg-blue-50 border border-blue-150 rounded-xl p-2.5 mb-3 flex items-center justify-between gap-3 animate-fade-in text-right">
            <div className="flex items-center gap-3">
              {selectedFile.type.startsWith("image/") ? (
                <img
                  src={selectedFile.dataUrl}
                  alt="thumbnail"
                  className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-650">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-855 text-slate-800 truncate max-w-[180px]">
                  {selectedFile.name}
                </p>
                <p className="text-2xs text-slate-500 font-mono mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1 rounded-lg hover:bg-slate-250 text-slate-400 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        <form
          onDragEnter={handleDrag}
          onSubmit={handleTextSubmit}
          className="flex items-center gap-3"
        >
          {/* File select button */}
          <button
            id="file_upload_btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-11 h-11 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 shadow-sm transition-colors disabled:opacity-40"
            title="تحميل صورة أو مستند"
          >
            <UploadCloud className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Text Input area */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب رسالتك العامة هنا..."
            className="flex-1 bg-white border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 transition-all text-right font-sans"
          />

          {/* Send text button */}
          <button
            id="send_message_btn"
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || isUploading}
            className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4 scale-x-[-1]" />
          </button>
        </form>
      </div>
    </div>
  );
}
