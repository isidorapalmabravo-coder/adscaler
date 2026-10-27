export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { cleanupDisk } = await import("./lib/cleanup");
  setTimeout(cleanupDisk, 8000);
}
