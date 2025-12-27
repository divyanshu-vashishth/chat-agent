import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { getHistory, handleUserMessage } from "./services/chat";

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "*";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: WEB_ORIGIN,
    credentials: false,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

const ChatMessageSchema = z.object({
  message: z.string(),
  sessionId: z.uuid().optional(),
});

app.post("/chat/message", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: "Invalid JSON body. Expected { message, sessionId? }" },
      400,
    );
  }

  const parsed = ChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload.", details: parsed.error.flatten() }, 400);
  }

  const MAX_LEN = 2000;
  const msg = parsed.data.message.trim();
  if (!msg) {
    return c.json({ error: "Message cannot be empty." }, 400);
  }

  const safeMsg = msg.length > MAX_LEN ? msg.slice(0, MAX_LEN) : msg;

  const out = await handleUserMessage({
    message: safeMsg,
    sessionId: parsed.data.sessionId,
  });

  return c.json(out);
});

app.get("/chat/history", async (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: "sessionId is required" }, 400);
  }

  const parsed = z.uuid().safeParse(sessionId);
  if (!parsed.success) {
    return c.json({ error: "sessionId must be a UUID" }, 400);
  }

  const rows = await getHistory(sessionId);
  return c.json({ sessionId, messages: rows });
});

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`API running on http://localhost:${PORT}`);