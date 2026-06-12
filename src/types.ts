export interface Room {
  id: string;
  title: string;
  hostId: string;
  createdAt: any;
}

export interface Participant {
  uid: string;
  name: string;
  joinedAt: any;
  isActive: boolean;
  avatar: string;
}

export interface FileAttachment {
  name: string;
  type: string;
  size?: number;
  dataUrl: string; // Base64 representation of the file
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text?: string;
  createdAt: any;
  file?: FileAttachment;
}

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  status: "ringing" | "active" | "ended";
  offer?: {
    type: string;
    sdp: string;
  };
  answer?: {
    type: string;
    sdp: string;
  };
  createdAt: any;
  endedAt?: any;
}

export interface IceCandidateData {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}
