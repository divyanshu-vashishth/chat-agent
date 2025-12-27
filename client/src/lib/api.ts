import { PUBLIC_API_URL } from "$env/static/public";

export type ChatSender = "user" | "ai";

export type ChatMessage = {
  id?: string;
  sender: ChatSender;
  text: string;
  createdAt?: string;
};

export async function fetchHistory(sessionId: string) {
  const res = await fetch(`${PUBLIC_API_URL}/chat/history?sessionId=${sessionId}`);
  if (!res.ok) throw new Error("Failed to load history");
  return (await res.json()) as { sessionId: string; messages: ChatMessage[] };
}

export async function sendMessage(args: {
  sessionId?: string;
  message: string;
}) {
  const res = await fetch(`${PUBLIC_API_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && typeof data.error === "string" && data.error) ||
      "Request failed";
    throw new Error(msg);
  }

  return data as { reply: string; sessionId: string };
}