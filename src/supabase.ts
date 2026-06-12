import { createClient } from "@supabase/supabase-js";

// Supabase configuration parameters provided by the user
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://iuncogugnnjbeqtrkbnr.supabase.co";
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1bmNvZ3Vnbm5qYmVxdHJrYm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODEwODIsImV4cCI6MjA5NTQ1NzA4Mn0.a3VkOrf3NigKlndbEs83lXIKnD0jAN0hXdZnzPdI8NA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verification and stats storage
export interface SyncStatus {
  connected: boolean;
  lastSyncTime: string | null;
  usersSynced: number;
  roomsSynced: number;
  messagesSynced: number;
  followsSynced: number;
  participantsSynced: number;
  errors: string[];
}

export const syncStats: SyncStatus = {
  connected: true,
  lastSyncTime: null,
  usersSynced: 0,
  roomsSynced: 0,
  messagesSynced: 0,
  followsSynced: 0,
  participantsSynced: 0,
  errors: [],
};

// ==========================================
// Safe Synchronization Helper Functions
// ==========================================

export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("users").select("count").limit(1);
    if (error) {
      // The table might not exist yet, which is expected before schema execution
      if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
        console.log("Supabase connected but tables are not created yet.");
        return true; 
      }
      console.warn("Supabase handshake error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase offline or unreachable:", err);
    return false;
  }
}

/**
 * Synchronize User profile
 */
export async function syncUserToSupabase(nickname: string, userPayload: any) {
  if (!nickname) return;
  try {
    const cleanPayload = {
      nickname: nickname,
      uid: userPayload.uid || null,
      password: userPayload.password || "",
      role: userPayload.role || "user",
      status: userPayload.status || "approved",
      email: userPayload.email || null,
      avatarColor: userPayload.avatarColor || null,
      accountType: userPayload.accountType || "public",
      createdAt: userPayload.createdAt || new Date().toISOString()
    };

    const { error } = await supabase
      .from("users")
      .upsert(cleanPayload, { onConflict: "nickname" });

    if (error) {
      throw error;
    }
    syncStats.usersSynced++;
    syncStats.lastSyncTime = new Date().toISOString();
  } catch (err: any) {
    const errMsg = `User sync error [${nickname}]: ${err.message || err}`;
    console.warn(errMsg);
    if (!syncStats.errors.includes(errMsg)) {
      syncStats.errors.push(errMsg);
    }
    if (syncStats.errors.length > 50) syncStats.errors.shift();
  }
}

/**
 * Synchronize Room information
 */
export async function syncRoomToSupabase(roomId: string, roomPayload: any) {
  if (!roomId) return;
  try {
    const cleanPayload = {
      id: roomId,
      title: roomPayload.title || "Room",
      hostId: roomPayload.hostId || null,
      createdAt: roomPayload.createdAt || new Date().toISOString()
    };

    const { error } = await supabase
      .from("rooms")
      .upsert(cleanPayload, { onConflict: "id" });

    if (error) throw error;
    syncStats.roomsSynced++;
    syncStats.lastSyncTime = new Date().toISOString();
  } catch (err: any) {
    const errMsg = `Room sync error [${roomId}]: ${err.message || err}`;
    console.warn(errMsg);
    if (!syncStats.errors.includes(errMsg)) {
      syncStats.errors.push(errMsg);
    }
  }
}

/**
 * Synchronize Chat Message
 */
export async function syncMessageToSupabase(messageId: string, roomId: string, msgPayload: any) {
  if (!messageId || !roomId) return;
  try {
    const fileData = msgPayload.file || null;
    const cleanPayload = {
      id: messageId,
      roomId: roomId,
      senderId: msgPayload.senderId || "",
      senderName: msgPayload.senderName || "Unknown",
      senderAvatar: msgPayload.senderAvatar || "",
      text: msgPayload.text || null,
      file_name: fileData?.name || null,
      file_type: fileData?.type || null,
      file_size: fileData?.size || null,
      file_dataUrl: fileData?.dataUrl || null,
      isPrivate: !!msgPayload.isPrivate,
      recipientId: msgPayload.recipientId || null,
      recipientName: msgPayload.recipientName || null,
      createdAt: msgPayload.createdAt || new Date().toISOString()
    };

    const { error } = await supabase
      .from("messages")
      .upsert(cleanPayload, { onConflict: "id" });

    if (error) throw error;
    syncStats.messagesSynced++;
    syncStats.lastSyncTime = new Date().toISOString();
  } catch (err: any) {
    const errMsg = `Message sync error [${messageId}]: ${err.message || err}`;
    console.warn(errMsg);
    if (!syncStats.errors.includes(errMsg)) {
      syncStats.errors.push(errMsg);
    }
  }
}

/**
 * Synchronize Follow requests & network status
 */
export async function syncFollowToSupabase(followId: string, followPayload: any) {
  if (!followId) return;
  try {
    const cleanPayload = {
      id: followId,
      sender: followPayload.sender || "",
      recipient: followPayload.recipient || "",
      status: followPayload.status || "pending",
      createdAt: followPayload.createdAt || new Date().toISOString(),
      updatedAt: followPayload.updatedAt || new Date().toISOString()
    };

    const { error } = await supabase
      .from("follows")
      .upsert(cleanPayload, { onConflict: "id" });

    if (error) throw error;
    syncStats.followsSynced++;
    syncStats.lastSyncTime = new Date().toISOString();
  } catch (err: any) {
    const errMsg = `Follow sync error [${followId}]: ${err.message || err}`;
    console.warn(errMsg);
    if (!syncStats.errors.includes(errMsg)) {
      syncStats.errors.push(errMsg);
    }
  }
}

/**
 * Remove follow request when deleted/rejected
 */
export async function deleteFollowFromSupabase(followId: string) {
  if (!followId) return;
  try {
    await supabase.from("follows").delete().eq("id", followId);
  } catch (err) {
    console.warn("Follow deletion mirror failed:", err);
  }
}

/**
 * Synchronize active participant representation in room
 */
export async function syncParticipantToSupabase(roomId: string, uid: string, partPayload: any) {
  const compositeId = `${roomId}_${uid}`;
  try {
    const cleanPayload = {
      id: compositeId,
      roomId: roomId,
      uid: uid,
      name: partPayload.name || "Anonymous",
      avatar: partPayload.avatar || "",
      isActive: partPayload.isActive !== false,
      joinedAt: partPayload.joinedAt || new Date().toISOString()
    };

    const { error } = await supabase
      .from("participants")
      .upsert(cleanPayload, { onConflict: "id" });

    if (error) throw error;
    syncStats.participantsSynced++;
    syncStats.lastSyncTime = new Date().toISOString();
  } catch (err: any) {
    const errMsg = `Participant sync error [${compositeId}]: ${err.message || err}`;
    console.warn(errMsg);
    if (!syncStats.errors.includes(errMsg)) {
      syncStats.errors.push(errMsg);
    }
  }
}

/**
 * Remove participant when leaving room
 */
export async function deleteParticipantFromSupabase(roomId: string, uid: string) {
  const compositeId = `${roomId}_${uid}`;
  try {
    await supabase.from("participants").delete().eq("id", compositeId);
  } catch (err) {
    console.warn("Participant delete mirror failed:", err);
  }
}
