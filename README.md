# ⚡ Instagram Clipping Automation Dashboard (Instagra)

A state-of-the-art, self-hosted web application to automate video downloading (`yt-dlp`), branding watermark overlay and upscaling (`ffmpeg`), and scheduled publishing to Instagram via the official **Instagram Content Publishing Graph API**. It is built for creators, agencies, and political/marketing clipping campaigns.

---

## 🎨 Visual Showcase & User Interface

Here is a preview of the clean, premium, and functional dashboard interface:

### 1. Clip Post Composer
Create, customize, and queue your video clips. Easily paste any Instagram Reel or video URL, apply watermarks, customize captions with dynamic templates, and select one or multiple target channels.
![Clip Composer](/public/screenshots/composer.png)

### 2. Live Queue & Pipeline Monitor
Track your background video processing pipeline in real time. The queue monitors each step: downloading, upscaling, watermarking, uploading, and publishing with full visual execution logs.
![Queue Monitor](/public/screenshots/queue.png)

### 3. Channel Management
Connect and manage 2–5 Instagram Business/Creator accounts from a single interface. Set default captions, custom hashtags, and upload unique watermarks for each channel.
![Channel Management](/public/screenshots/channels.png)

### 4. MonsterLab Campaign Integration
Track views, submission statuses, and earnings for clipping campaigns automatically integrated with MonsterLab.
![MonsterLab Dashboard](/public/screenshots/monsterlab.png)

---

## 🚀 Key Features & Automation Capabilities

### 1. Multi-Account Channel Routing
* **Unified Control:** Manage multiple Instagram accounts from one center.
* **Granular Brand Templates:** Configure custom captions, hashtags, and branding watermarks per channel.
* **Parallel Distribution:** Publish one source clip to multiple target channels simultaneously with custom watermarks applied dynamically for each account.

### 2. Media Processing & 4K Upscaling Pipeline
* **High-Efficiency Downloader:** Powered by `yt-dlp` to extract media in optimal resolution.
* **Lanczos Filtering & 4K Upscale:** Video is upscaled to 4K (`2160×3840` vertical resolution) using ffmpeg for maximum platform reach.
* **Dynamic Branding Overlay:** Automatically scales and overlays channel logo watermarks at specific coordinates (e.g., bottom-right, bottom-left, top-right, center).

### 3. Smart Scheduler ("Schedule X Reels for X Days")
* **Advanced Queue Routing:** Distribute video uploads dynamically over time. Set specific dates and times for each post.
* **Multi-Day Posting Strategy:** Queue a batch of 10-20 reels and schedule them to post sequentially (e.g., 2 reels per day over 5 days) to maintain consistent page activity and algorithm ranking.
* **PostgreSQL SKIP LOCKED Queue:** Thread-safe worker architecture that claims pending jobs without double-processing.

### 4. Comment Replies & Engagement Automation (API Scopes Ready)
* **Pre-Approved Meta Scopes:** Configured with `instagram_business_manage_comments` and `instagram_business_manage_messages` permissions.
* **Webhook Engagement:** Listen for new comments on published Reels and trigger automated, context-aware comment replies or direct messages (DMs) to boost engagement metrics and drive traffic.

### 5. Fail-Safe Recovery & Retries
* **Exponential Backoff:** If Instagram's servers fail or time out, the worker retries the post (up to 3 times) with exponentially increasing delays (e.g., 2 mins, 4 mins).
* **Live Log Stream:** Detailed diagnostic logs are streamed directly to the web UI for every post.

---

## 🛠 Tech Stack

* **Framework:** Next.js (App Router, React 19, TypeScript)
* **Styling:** Tailwind CSS (v4)
* **Database & ORM:** PostgreSQL & Prisma ORM
* **Cloud Storage:** Supabase Storage (hosts processed MP4 files for Instagram's Graph API fetch)
* **Backend Engines:** `yt-dlp` (downloader) & `ffmpeg` (media processor)
* **Authentication:** Secure JWT session cookies with AES-256-GCM encryption for storing access tokens at rest.

---

## 🚀 Setup & Installation

### 1. Environment Configuration
Clone the repository and copy the example environment file:
```bash
cp .env.example .env
```
Provide the required keys in `.env`:
* `DATABASE_URL`: PostgreSQL connection string (e.g. Supabase, local, or RDS).
* `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Service role access to upload processed video assets.
* `SUPABASE_STORAGE_BUCKET`: Storage bucket name (e.g., `clips`).
* `ENCRYPTION_KEY` & `AUTH_SECRET`: Random strings used to secure stored OAuth credentials and user sessions.
* `APP_URL`: Your public web service URL (e.g., Ngrok or custom domain) required for Instagram webhook callbacks.

### 2. Database Synchronization & Seed
Initialize your database schema and create the default admin user:
```bash
# Run migrations
npx prisma migrate dev --name init

# Seed default admin user (admin@clipping.com / admin123)
npx prisma db seed
```

### 3. Launch Development Environment
```bash
# Start Next.js dashboard
npm run dev

# Start background pipeline worker (in a separate terminal)
npm run worker
```
Access the dashboard locally at `http://localhost:3000`.

---

## ☁️ Deployment Configurations

### Option A: Complete Deployment on Render (Recommended)
Use the included `render.yaml` template to deploy the entire stack:
1. **Managed PostgreSQL Database**
2. **Next.js Web Service** (Dashboard)
3. **Background Worker** (executing `npx tsx worker/index.ts`)

The project's `Dockerfile` automatically installs the necessary system dependencies (`ffmpeg` and the latest `yt-dlp` binaries) so no additional setup is required.

### Option B: Next.js on Vercel + Worker on Render
To minimize latency and take advantage of Vercel's global CDN:
1. Deploy the Next.js app to **Vercel** (handles dashboard rendering, schema operations).
2. Deploy the worker to **Render** using the `Dockerfile` with the start command:
   ```bash
   npx tsx worker/index.ts
   ```
3. Share the same `DATABASE_URL` and `SUPABASE_*` credentials between both platforms.
