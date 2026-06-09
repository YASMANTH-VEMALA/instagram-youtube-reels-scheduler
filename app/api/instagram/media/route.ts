import { NextRequest, NextResponse } from "next/server";
import { getInstagramAccountsWithTokens } from "@/lib/instagram-store";

export const runtime = "nodejs";

type InstagramMediaResponse = {
  data?: {
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    permalink?: string;
    thumbnail_url?: string;
    timestamp?: string;
    username?: string;
  }[];
  error?: {
    message?: string;
  };
};

async function fetchAccountMedia(account: Awaited<ReturnType<typeof getInstagramAccountsWithTokens>>[number]) {
  const url = new URL(`https://graph.instagram.com/v21.0/${account.userId}/media`);
  url.searchParams.set(
    "fields",
    "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username",
  );
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", account.accessToken);

  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as InstagramMediaResponse;

  if (!response.ok) {
    return {
      accountId: account.userId,
      username: account.username,
      media: [],
      error: data.error?.message || "Could not load Instagram media",
    };
  }

  return {
    accountId: account.userId,
    username: account.username,
    media: (data.data || [])
      .filter((item) => item.media_type === "VIDEO")
      .map((item) => ({
        id: item.id,
        accountId: account.userId,
        username: account.username,
        caption: item.caption || "Untitled video",
        mediaType: item.media_type || "VIDEO",
        mediaUrl: item.media_url,
        thumbnailUrl: item.thumbnail_url || item.media_url,
        permalink: item.permalink,
        timestamp: item.timestamp,
      })),
  };
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") || "all";
  const accounts = await getInstagramAccountsWithTokens(userId);

  if (!accounts.length) {
    return NextResponse.json({ media: [], errors: [] });
  }

  const results = await Promise.all(accounts.map(fetchAccountMedia));

  return NextResponse.json({
    media: results.flatMap((result) => result.media),
    errors: results
      .filter((result) => result.error)
      .map((result) => ({
        accountId: result.accountId,
        username: result.username,
        message: result.error,
      })),
  });
}
