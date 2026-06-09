export type CaptionInput = {
  fileName: string;
  folderPath: string;
  captionTemplate: string;
  trendMode: boolean;
  trendNiche: string;
  hookStyle: string;
  hashtagPack: string;
};

function titleFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function templateCaption(input: CaptionInput) {
  const title = titleFromFileName(input.fileName);
  const caption = input.captionTemplate
    .replaceAll("{title}", title)
    .replaceAll("{folder}", input.folderPath);

  return [caption, input.hashtagPack.trim()].filter(Boolean).join("\n\n");
}

export async function generateCaption(input: CaptionInput) {
  const fallback = templateCaption(input);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey || apiKey.startsWith("your_")) return fallback;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Write concise Instagram Reel captions. Return only the caption text, no markdown.",
          },
          {
            role: "user",
            content: [
              `Filename: ${input.fileName}`,
              `Folder path: ${input.folderPath}`,
              `Niche: ${input.trendNiche}`,
              `Hook style: ${input.hookStyle}`,
              `Template: ${input.captionTemplate}`,
              `Hashtags: ${input.hashtagPack}`,
              `Trend mode: ${input.trendMode ? "on" : "off"}`,
              "Make the first line a strong hook and keep it suitable for a Reel.",
            ].join("\n"),
          },
        ],
        temperature: 0.7,
        max_tokens: 220,
      }),
    });
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    if (!response.ok) return fallback;
    return data.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}
