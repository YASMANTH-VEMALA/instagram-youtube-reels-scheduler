import { NextRequest, NextResponse } from "next/server";
import {
  addWebhookEvent,
  listAutomations,
  matchesAutomationTrigger,
  type VideoAutomation,
} from "@/lib/automation-store";
import { getInstagramAccountsWithTokens } from "@/lib/instagram-store";

export const runtime = "nodejs";

type InstagramWebhookPayload = {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        id?: string;
        media_id?: string;
        text?: string;
        from?: { id?: string; username?: string };
      };
    }[];
    messaging?: {
      sender?: { id?: string };
      recipient?: { id?: string };
      message?: {
        text?: string;
        quick_reply?: { payload?: string };
      };
      postback?: { payload?: string; title?: string };
    }[];
  }[];
};

type InstagramProfileResponse = {
  is_user_follow_business?: boolean;
  error?: { message?: string };
};

function verifyToken() {
  return process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "instagram-local-webhook";
}

function profileUrl(accountUsername: string) {
  return `https://www.instagram.com/${accountUsername.replace(/^@/, "")}/`;
}

function buildContentMessage(automation: VideoAutomation) {
  return [
    automation.deliveryMessage,
    automation.deliveryUrl ? automation.deliveryUrl : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function sendInstagramMessage(
  accountId: string,
  accessToken: string,
  recipientId: string,
  message: Record<string, unknown>,
) {
  const response = await fetch(
    `https://graph.instagram.com/v21.0/${accountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message,
      }),
    },
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Instagram message send failed");
  }

  return data;
}

async function sendPrivateReply(
  commentId: string,
  accessToken: string,
  text: string,
) {
  const response = await fetch(
    `https://graph.instagram.com/v21.0/${commentId}/private_replies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message: text }),
    },
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Instagram private reply failed");
  }

  return data;
}

async function userFollowsBusiness(
  userId: string,
  accessToken: string,
): Promise<boolean | null> {
  const url = new URL(`https://graph.instagram.com/v21.0/${userId}`);
  url.searchParams.set(
    "fields",
    "is_user_follow_business,is_business_follow_user",
  );
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as InstagramProfileResponse;

  if (!response.ok) {
    return null;
  }

  return Boolean(data.is_user_follow_business);
}

async function handleMessageEvent(params: {
  accountId: string;
  senderId: string;
  text: string;
  payload?: string;
  raw: unknown;
}) {
  const [account] = await getInstagramAccountsWithTokens(params.accountId);
  const automations = (await listAutomations()).filter(
    (automation) =>
      automation.accountId === params.accountId && automation.status === "active",
  );
  const matched =
    automations.find((automation) =>
      params.payload?.startsWith(`FOLLOW_CONFIRM:${automation.id}`),
    ) ||
    automations.find((automation) =>
      matchesAutomationTrigger(automation, params.text),
    );

  if (!account || !matched) {
    await addWebhookEvent({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      eventType: "message",
      accountId: params.accountId,
      senderId: params.senderId,
      text: params.text,
      action: account ? "no_matching_automation" : "account_not_found",
      payload: params.raw,
    });
    return;
  }

  const follows = matched.followersOnly
    ? await userFollowsBusiness(params.senderId, account.accessToken)
    : true;

  if (matched.followersOnly && follows !== true) {
    await sendInstagramMessage(account.userId, account.accessToken, params.senderId, {
      text: matched.nonFollowerMessage,
      quick_replies: [
        {
          content_type: "text",
          title: matched.visitProfileLabel.slice(0, 20),
          payload: `VISIT_PROFILE:${matched.id}`,
        },
        {
          content_type: "text",
          title: matched.confirmFollowLabel.slice(0, 20),
          payload: `FOLLOW_CONFIRM:${matched.id}`,
        },
      ],
    });
    await sendInstagramMessage(account.userId, account.accessToken, params.senderId, {
      text: profileUrl(account.username),
    });

    await addWebhookEvent({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      eventType: "message",
      accountId: params.accountId,
      senderId: params.senderId,
      text: params.text,
      matchedAutomationId: matched.id,
      action: "sent_follow_gate",
      payload: params.raw,
    });
    return;
  }

  await sendInstagramMessage(account.userId, account.accessToken, params.senderId, {
    text: buildContentMessage(matched),
  });

  await addWebhookEvent({
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    eventType: "message",
    accountId: params.accountId,
    senderId: params.senderId,
    text: params.text,
    matchedAutomationId: matched.id,
    action: "sent_content_dm",
    payload: params.raw,
  });
}

async function handleCommentEvent(params: {
  accountId: string;
  commentId: string;
  mediaId?: string;
  text: string;
  raw: unknown;
}) {
  const [account] = await getInstagramAccountsWithTokens(params.accountId);
  const automations = (await listAutomations()).filter(
    (automation) =>
      automation.accountId === params.accountId &&
      automation.status === "active" &&
      (!params.mediaId || automation.videoId === params.mediaId),
  );
  const matched = automations.find((automation) =>
    matchesAutomationTrigger(automation, params.text),
  );

  if (!account || !matched) {
    await addWebhookEvent({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      eventType: "comment",
      accountId: params.accountId,
      text: params.text,
      action: account ? "no_matching_automation" : "account_not_found",
      payload: params.raw,
    });
    return;
  }

  const reply = matched.followersOnly
    ? `${matched.nonFollowerMessage}\n\n${profileUrl(account.username)}`
    : buildContentMessage(matched);

  await sendPrivateReply(params.commentId, account.accessToken, reply);
  await addWebhookEvent({
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    eventType: "comment",
    accountId: params.accountId,
    text: params.text,
    matchedAutomationId: matched.id,
    action: matched.followersOnly
      ? "sent_private_follow_gate"
      : "sent_private_content_reply",
    payload: params.raw,
  });
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken() && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid webhook verification" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as InstagramWebhookPayload;

  try {
    for (const entry of payload.entry || []) {
      for (const messageEvent of entry.messaging || []) {
        const senderId = messageEvent.sender?.id;
        const accountId = messageEvent.recipient?.id || entry.id;
        const text = messageEvent.message?.text || messageEvent.postback?.title || "";
        const quickReplyPayload =
          messageEvent.message?.quick_reply?.payload ||
          messageEvent.postback?.payload;

        if (accountId && senderId && (text || quickReplyPayload)) {
          await handleMessageEvent({
            accountId,
            senderId,
            text,
            payload: quickReplyPayload,
            raw: messageEvent,
          });
        }
      }

      for (const change of entry.changes || []) {
        const value = change.value;
        const accountId = entry.id;
        const commentId = value?.id;
        const text = value?.text || "";

        if (change.field === "comments" && accountId && commentId && text) {
          await handleCommentEvent({
            accountId,
            commentId,
            mediaId: value?.media_id,
            text,
            raw: change,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    await addWebhookEvent({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      eventType: "error",
      action: "webhook_failed",
      error: error instanceof Error ? error.message : "Webhook failed",
      payload,
    });

    return NextResponse.json({ ok: true });
  }
}
