export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type GenerateJsonArgs = {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function openRouterModelName(): string {
  return process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_MODEL;
}

export async function generateOpenRouterJson({
  prompt,
  system,
  model = openRouterModelName(),
  temperature = 0.1,
}: GenerateJsonArgs): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. OpenRouter calls must run server-side with this env var set.");
  }

  const messages: OpenRouterMessage[] = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user", content: prompt },
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME || "Reunify",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as OpenRouterChatResponse;
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty response from OpenRouter");

  return text;
}
