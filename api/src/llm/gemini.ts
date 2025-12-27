// import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is required");
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function extractText(resp: any): string {
  const parts: any[] =
    resp?.candidates?.[0]?.content?.parts &&
    Array.isArray(resp.candidates[0].content.parts)
      ? resp.candidates[0].content.parts
      : [];

  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();

  return text;
}

export async function generateReply(args: {
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  const model = DEFAULT_MODEL;
  const maxOutputTokens = args.maxOutputTokens ?? 300;
  const temperature = args.temperature ?? 0.2;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey ?? "",
      }),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: args.prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens,
          temperature,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Gemini API error ${res.status}: ${text || res.statusText}`,
      );
    }

    const data = (await res.json()) as unknown;
    const out = extractText(data);

    return out || "Sorry — I couldn’t generate a reply right now.";
  } finally {
    clearTimeout(timeout);
  }
}