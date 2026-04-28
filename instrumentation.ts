/**
 * Next.js instrumentation module.
 *
 * This runs once when the Next.js server starts. We use it to register
 * a graceful shutdown handler that closes the SQLite connection on SIGTERM.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { closeDb } = await import("@/lib/db");

    const shutdown = () => {
      console.log("Graceful shutdown: closing database connection...");
      closeDb();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}
