import { NextRequest, NextResponse } from "next/server";
import {
  listInstagramAccounts,
  removeInstagramAccount,
} from "@/lib/instagram-store";

export const runtime = "nodejs";

export async function GET() {
  const accounts = await listInstagramAccounts();
  return NextResponse.json({ accounts });
}

export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await removeInstagramAccount(userId);
  return NextResponse.json({ ok: true });
}
