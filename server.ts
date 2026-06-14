import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client with correct custom header for telemetry
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } else {
    // Check if .env has it or fallback gracefully
    console.warn("GEMINI_API_KEY is not defined in the environment variables!");
  }
} catch (error) {
  console.error("Failed to initialize Google Gen AI SDK:", error);
}

// Full-stack API Route for AI Meeting Assistant
app.post("/api/ai/chat", async (req, res) => {
  const { prompt, chatHistory } = req.body;

  if (!ai) {
    return res.status(500).json({
      error: "لم يتم تكوين مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) بشكل صحيح على خوادم البرنامج.",
    });
  }

  try {
    const formattedHistory = (chatHistory || []).map((msg: any) => ({
      role: msg.senderId === "ai" ? "model" as const : "user" as const,
      parts: [{ text: msg.text }],
    }));

    // Add current prompt
    formattedHistory.push({
      role: "user" as const,
      parts: [{ text: prompt }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedHistory,
      config: {
        systemInstruction: `أنت مساعد ذكي وميسر للاجتماعات عبر الفيديو ومحادثات الغرف في تطبيق يسمى "محادثات فيديو ومشاركة ملفات".
اجعل إجاباتك ودية، مختصرة، مفيدة، وباللغة العربية بشكل طبيعي وسهل ومحفز.
يمكنك مساعدة المستخدمين على:
1. تلخيص النقاط الأساسية المطروحة في المحادثة.
2. اقتراح أسئلة ترحيبية أو مواضيع للنقاش لتسهيل التواصل المرئي.
3. ترجمة النصوص بين العربية والإنجليزية أو لغات أخرى.
4. الإجابة عن أي أسئلة عامة يطرحونها.
لا تستخدم أي كلام تقني معقد، وركز تماماً على تلبية رغبات الحاضرين في اللقاء.`,
      },
    });

    return res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error?.message || "حدث خطأ أثناء التواصل مع المساعد الذكي.",
    });
  }
});

import agoraPkg from "agora-token";
const { RtcTokenBuilder, RtcRole } = agoraPkg;

// Dynamic Agora Token Generation Route
app.post("/api/agora/token", (req, res) => {
  const { channelName, userId } = req.body;

  if (!channelName) {
    return res.status(400).json({ error: "اسم القناة (channelName) مطلوب." });
  }

  const appId = process.env.VITE_AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    return res.status(500).json({
      error: "لم يتم تكوين مفتاح أو شهادة Agora بالشكل الصحيح على السيرفر (VITE_AGORA_APP_ID / AGORA_APP_CERTIFICATE).",
    });
  }

  try {
    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600 * 2; // صلاحية ساعتين
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Generate token with string userAccount
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      userId || "",
      role,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    return res.json({ token });
  } catch (error: any) {
    console.error("Agora Token Generation Error:", error);
    return res.status(500).json({ error: "فشل إنشاء رمز الاتصال الخاص بـ Agora." });
  }
});

// Configure Vite or Static Assets serving based on the environment

async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VividCall Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
