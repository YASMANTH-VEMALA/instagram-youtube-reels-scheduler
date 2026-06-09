import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type VideoAutomation = {
  id: string;
  videoId: string;
  accountId: string;
  accountUsername: string;
  caption: string;
  trigger: string;
  reply: string;
  target: string;
  deliveryTitle: string;
  deliveryUrl: string;
  deliveryMessage: string;
  followersOnly: boolean;
  nonFollowerMessage: string;
  visitProfileLabel: string;
  confirmFollowLabel: string;
  status: "active" | "paused";
  createdAt: string;
  thumbnailUrl?: string;
  permalink?: string;
};

export type WebhookEventLog = {
  id: string;
  receivedAt: string;
  eventType: string;
  accountId?: string;
  senderId?: string;
  text?: string;
  matchedAutomationId?: string;
  action?: string;
  error?: string;
  payload: unknown;
};

const storeDir = path.join(process.cwd(), ".data");
const automationsPath = path.join(storeDir, "instagram-automations.json");
const eventsPath = path.join(storeDir, "instagram-webhook-events.json");

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

export async function listAutomations(): Promise<VideoAutomation[]> {
  return readJsonFile<VideoAutomation[]>(automationsPath, []);
}

export async function upsertAutomation(automation: VideoAutomation) {
  const automations = await listAutomations();
  const nextAutomations = [
    automation,
    ...automations.filter((item) => item.id !== automation.id),
  ];

  await writeJsonFile(automationsPath, nextAutomations);
}

export async function listWebhookEvents(): Promise<WebhookEventLog[]> {
  return readJsonFile<WebhookEventLog[]>(eventsPath, []);
}

export async function addWebhookEvent(event: WebhookEventLog) {
  const events = await listWebhookEvents();
  await writeJsonFile(eventsPath, [event, ...events].slice(0, 200));
}

export function matchesAutomationTrigger(automation: VideoAutomation, text = "") {
  const lowerText = text.toLowerCase();
  return automation.trigger
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean)
    .some((keyword) => lowerText.includes(keyword));
}
