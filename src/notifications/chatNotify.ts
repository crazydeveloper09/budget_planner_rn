import { api } from "../api/client";

export async function notifyChatMessage(input: {
  topicId: string;
  topicTitle: string;
  authorName: string;
  kind?: "message" | "plan";
}) {
  await api.post("/households/chat-notify", input);
}
