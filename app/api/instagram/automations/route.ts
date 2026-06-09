import { NextRequest, NextResponse } from "next/server";
import {
  listAutomations,
  listWebhookEvents,
  upsertAutomation,
  type VideoAutomation,
} from "@/lib/automation-store";

export const runtime = "nodejs";

export async function GET() {
  const [automations, events] = await Promise.all([
    listAutomations(),
    listWebhookEvents(),
  ]);

  return NextResponse.json({ automations, events: events.slice(0, 50) });
}

export async function POST(request: NextRequest) {
  const automation = (await request.json()) as VideoAutomation;

  if (!automation.id || !automation.accountId || !automation.trigger) {
    return NextResponse.json(
      { error: "Automation id, account, and trigger are required" },
      { status: 400 },
    );
  }

  await upsertAutomation(automation);
  return NextResponse.json({ ok: true, automation });
}
