import { api } from './api';

export type ChatRoom = {
  id: string;
  kind: string;
  title: string;
  alias: string;
  teamId?: string | null;
  missionId?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  body: string;
  photoUrl?: string | null;
  createdAt: string;
  senderId: string | null;
  senderName: string;
  source?: string;
  mine: boolean;
};

export async function listChatRooms() {
  return api.get<ChatRoom[]>('/chat/rooms');
}

export async function listChatMessages(roomId: string) {
  return api.get<ChatMessage[]>(`/chat/rooms/${roomId}/messages`);
}

export async function postChatMessage(roomId: string, body: string, photoUrl?: string) {
  return api.post<ChatMessage>(`/chat/rooms/${roomId}/messages`, { body, photoUrl });
}

export async function chatRoomForMission(missionId: string, opts?: { missionRoom?: boolean }) {
  const q = opts?.missionRoom ? '?missionRoom=1' : '';
  return api.get<{ roomId: string; title: string; kind: string }>(
    `/chat/rooms/for-mission/${missionId}${q}`,
  );
}
