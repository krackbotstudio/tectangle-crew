import { initDatabase } from "./db.js";
import { seedAdminUser } from "./seedData.js";
import { config } from "./config.js";

async function seed() {
  await initDatabase();
  await seedAdminUser();
  console.log("Seed complete.");
  console.log("  Login: admin@agentdesk.local / admin123");
  console.log(`  API:   http://localhost:${config.port}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
