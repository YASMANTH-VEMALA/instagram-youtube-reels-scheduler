const appUrl = (process.env.UPLOAD_WORKER_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000").replace(/\/$/, "");
const secret = process.env.UPLOAD_WORKER_SECRET || "";
const intervalMs = Number(process.env.UPLOAD_WORKER_INTERVAL_MS || 60_000);

async function tick() {
  const stamp = new Date().toISOString();

  try {
    const response = await fetch(`${appUrl}/api/upload/worker/tick`, {
      method: "POST",
      headers: secret ? { "x-upload-worker-secret": secret } : {},
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[${stamp}] upload worker failed`, data);
      return;
    }

    if (data.processed) {
      console.log(`[${stamp}] processed scheduled upload`, data);
    } else {
      console.log(`[${stamp}] no due uploads`);
    }
  } catch (error) {
    console.error(
      `[${stamp}] upload worker could not reach app`,
      error instanceof Error ? error.message : error,
    );
  }
}

console.log(`Upload worker polling ${appUrl} every ${intervalMs}ms`);
await tick();
setInterval(() => {
  void tick();
}, intervalMs);
