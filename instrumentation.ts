export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { cleanupDisk } = await import("./lib/cleanup");
  const { resetStuckRenders, purgeOldEdits } = await import("./lib/video-edit");
  resetStuckRenders();
  const tick = () => {
    try {
      purgeOldEdits();
    } catch {}
    cleanupDisk();
  };
  setTimeout(tick, 8000);
  setInterval(tick, 6 * 60 * 60 * 1000);
}
