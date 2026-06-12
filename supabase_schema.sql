-- =========================================================
-- SNNS.PRO Broadcasts & Rooms - Supabase Database Schema
-- Execute these SQL queries in your Supabase SQL Editor
-- to instantly set up the tables required for synchronization.
-- =========================================================

-- 1. Create USERS Table
-- Stores user profiles, authentication, status, and permissions
CREATE TABLE IF NOT EXISTS public.users (
    nickname TEXT PRIMARY KEY,              -- Unique registered user nickname
    uid TEXT,                               -- Firebase/Auth unique identifier
    password TEXT NOT NULL,                 -- Account sign-in password key
    role TEXT DEFAULT 'user',               -- Account privileges: 'admin' | 'moderator' | 'user'
    status TEXT DEFAULT 'approved',         -- Validation: 'approved' | 'pending' | 'rejected'
    email TEXT,                             -- User register/lookup email
    "avatarColor" TEXT,                     -- UI avatar background colors styling
    "accountType" TEXT DEFAULT 'public',    -- Account visible states: 'public' | 'private'
    "createdAt" TEXT                        -- ISO String timestamp
);

-- Enable Row Level Security (optional, defaults to public anon access here)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow all public writes users" ON public.users FOR ALL USING (true);

-- 2. Create ROOMS Table
-- Stores room identity and host records
CREATE TABLE IF NOT EXISTS public.rooms (
    id TEXT PRIMARY KEY,                    -- Room unique ID (slug representation)
    title TEXT NOT NULL,                    -- Human room readable heading
    "hostId" TEXT,                          -- Device owner ID of the room
    "createdAt" TEXT                        -- Host generation date
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Allow all public writes rooms" ON public.rooms FOR ALL USING (true);

-- 3. Create MESSAGES Table
-- Stores permanent real-time chat messages, including attachment links and whispered notes
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,                    -- Auto-generated UUID or custom Firestore message ID
    "roomId" TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
    "senderId" TEXT,                        -- Sending party unique user ID
    "senderName" TEXT,                      -- Nickname displayed
    "senderAvatar" TEXT,                    -- Styling color of the bubble
    text TEXT,                              -- Chat message content
    "file_name" TEXT,                       -- Encoded file name
    "file_type" TEXT,                       -- MIME category
    "file_size" INTEGER,                    -- Byte dimension
    "file_dataUrl" TEXT,                    -- Base64 or CDN URL reference
    "isPrivate" BOOLEAN DEFAULT false,      -- Private direct whispers toggle
    "recipientId" TEXT,                     -- Whispered peer target ID
    "recipientName" TEXT,                   -- Target nickname display
    "createdAt" TEXT                        -- Precision transmission instant hook
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow all public writes messages" ON public.messages FOR ALL USING (true);

-- 4. Create FOLLOWS Table
-- Stores peer social connections and approval systems
CREATE TABLE IF NOT EXISTS public.follows (
    id TEXT PRIMARY KEY,                    -- sender_recipient composite ID
    sender TEXT REFERENCES public.users(nickname) ON DELETE CASCADE,
    recipient TEXT REFERENCES public.users(nickname) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',          -- 'pending' | 'approved' | 'rejected'
    "createdAt" TEXT,
    "updatedAt" TEXT
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Allow all public writes follows" ON public.follows FOR ALL USING (true);

-- 5. Create PARTICIPANTS Table
-- Tracks live socket connects and active presence elements within active rooms
CREATE TABLE IF NOT EXISTS public.participants (
    id TEXT PRIMARY KEY,                    -- room_uid composite identifier
    "roomId" TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
    uid TEXT,
    name TEXT,
    avatar TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "joinedAt" TEXT
);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Allow all public writes participants" ON public.participants FOR ALL USING (true);
