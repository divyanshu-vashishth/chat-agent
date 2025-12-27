import { asc, desc, eq } from "drizzle-orm";

import { conversations, messages } from "../db/schema";
import { generateReply } from "../llm/gemini";
import { db } from "../db/client";

const FAQ_CONTEXT = `
You are SpurStore Support (fictional e-commerce store).

Store facts (use these as source of truth):
- Shipping:
  - We ship across India + USA.
  - India delivery: 2–5 business days.
  - USA delivery: 7–12 business days.
  - Orders above ₹999 ship free in India. Otherwise ₹79.
- Returns & refunds:
  - 7-day return window from delivery date.
  - Items must be unused + in original packaging.
  - Refunds to original payment method in 5–7 business days after pickup/QC.
- Support hours:
  - Mon–Sat, 10:00–18:00 IST.
- Contact:
  - Email: support@spurstores.example
  - WhatsApp: +91-90000-00000

Rules:
- Answer clearly and concisely.
- If user asks something not covered, say you’re not 100% sure and offer to connect to a human.
- Don’t invent policies, prices, or promises.
`.trim();

function buildTranscript(
  history: Array<{ sender: "user" | "ai"; text: string }>,
  userMessage: string,
): string {
  const lines: string[] = [];
  lines.push("Conversation so far:");
  for (const m of history) {
    const who = m.sender === "user" ? "User" : "Agent";
    lines.push(`${who}: ${m.text}`);
  }
  lines.push(`User: ${userMessage}`);
  lines.push("Agent:");
  return lines.join("\n");
}

export async function upsertConversation(sessionId?: string) {
  if (sessionId) return sessionId;

  const convoId = crypto.randomUUID();
  await db.insert(conversations).values({ id: convoId });
  return convoId;
}

export async function getHistory(conversationId: string) {
  const rows = await db
    .select({
      id: messages.id,
      sender: messages.sender,
      text: messages.text,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  return rows;
}

export async function handleUserMessage(args: {
  message: string;
  sessionId?: string;
}) {
  const conversationId = await upsertConversation(args.sessionId);

  await db.insert(messages).values({
    conversationId,
    sender: "user",
    text: args.message,
  });

  // Fetch last N messages for context (cost control)
  const recent = await db
    .select({
      sender: messages.sender,
      text: messages.text,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(12);

  const history = recent
    .slice()
    .reverse()
    .filter((m) => m.sender === "user" || m.sender === "ai")
    .map((m) => ({ sender: m.sender, text: m.text }));

  const instructions = `${FAQ_CONTEXT}\n\n` + `You are a helpful support agent.`;
  const input = buildTranscript(history, args.message);

  let reply: string;
  try {
    reply = await generateReply({
        prompt: `${instructions}\n\n${input}`,
        maxOutputTokens: 300,
        temperature: 0.2,
        });
  } catch (err) {
    // Don’t crash; return friendly error
    reply =
      "Sorry — I’m having trouble responding right now. Please try again " +
      "in a moment, or ask for a human agent.";
  }

  await db.insert(messages).values({
    conversationId,
    sender: "ai",
    text: reply,
  });

  return { sessionId: conversationId, reply };
}