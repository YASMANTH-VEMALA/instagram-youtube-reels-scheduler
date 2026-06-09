# Instagram Automation

This folder is for a standalone Instagram automation product, similar in spirit
to ManyChat: connect Instagram business accounts, listen for comments/DMs, run
automation rules, and reply through approved API flows.

## Recommended Stack

- **Frontend/app:** Next.js App Router + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui or Radix primitives
- **Database:** Supabase Postgres
- **Background jobs:** Inngest, Trigger.dev, or BullMQ + Redis
- **Instagram integration:** Official Meta APIs and webhooks
- **AI replies:** OpenAI API with a strict human-review mode at first
- **Hosting:** Vercel for the Next.js app, plus a worker host if jobs become heavy

## Why Next.js + Tailwind

Next.js is a good fit because this product needs both a dashboard and API
routes/webhooks in one project. Tailwind is a good fit because the UI will be
workflow-heavy: inbox, rule builder, account settings, logs, templates, and
campaign analytics.

Keep the current Python shorts generator separate. It can remain the video
creation engine, while this folder becomes the Instagram automation app.

## Product Modules

1. **Account connection**
   - Connect Instagram professional accounts through Meta OAuth.
   - Store page/account IDs, permissions, token expiry, and webhook status.

2. **Webhook intake**
   - Receive Instagram comments, mentions, and messaging events.
   - Verify webhook signatures.
   - Save every event before running automation.

3. **Rules engine**
   - Trigger examples: keyword in comment, keyword in DM, story mention, new
     follower DM, lead magnet request.
   - Action examples: send DM, ask a question, tag contact, notify human,
     add to sequence.

4. **Inbox**
   - Unified contact timeline.
   - Human takeover.
   - AI draft replies before full auto-reply.

5. **Campaigns**
   - Comment keyword to DM flow.
   - Lead magnet delivery.
   - Follow-up sequences.

6. **Safety and limits**
   - Per-account rate limits.
   - Daily send limits.
   - Blocklist and allowlist.
   - Manual approval mode for new automations.
   - Full audit log.

## Important API Direction

For a production product, prefer the official Meta platform:

- Instagram professional accounts connected through Meta OAuth.
- Webhooks for incoming events.
- Instagram Messaging API for approved DM automation.
- Instagram Content Publishing API for Reels/posts where allowed.

Avoid building the core business on password-login automation. Libraries like
`instagrapi` are useful for experiments, but they are fragile for production and
can create account-risk issues.

Official docs to use while implementing:

- https://developers.facebook.com/docs/instagram-platform/
- https://developers.facebook.com/docs/messenger-platform/instagram/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/

## Suggested Project Shape

```text
instagram/
  README.md
  .env.example
  apps/
    web/              # Next.js dashboard and API routes
  packages/
    db/               # schema, migrations, typed queries
    instagram-api/    # Meta OAuth, webhooks, messaging, publishing clients
    automations/      # rules engine and flow execution
    ai/               # prompts, moderation, reply drafting
```

## MVP Build Order

1. Create the Next.js + Tailwind dashboard.
2. Add Supabase auth and database schema.
3. Add Meta OAuth account connection.
4. Add webhook verification and event storage.
5. Build a simple keyword rule: "comment contains X -> send DM Y".
6. Add inbox and logs.
7. Add AI draft replies with manual approval.
8. Add scheduled follow-ups and analytics.

