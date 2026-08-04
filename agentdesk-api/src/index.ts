import app, { ensureInit } from "./app.js";
import { config } from "./config.js";
import { LOGO_WORDMARK } from "./brand.js";
import { dbMode } from "./db.js";

async function start() {
  await ensureInit();

  app.listen(config.port, () => {
    console.log(`${LOGO_WORDMARK} API running on http://localhost:${config.port}`);
    console.log(`Database mode: ${dbMode}`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
