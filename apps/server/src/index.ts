import path from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/database.js";
import { loadEnvFile } from "./loadEnv.js";
import { logger } from "./logger.js";

loadEnvFile();
const config = loadConfig();
const dbPath = path.isAbsolute(config.dbPath)
  ? config.dbPath
  : path.resolve(process.cwd(), config.dbPath);

const db = openDatabase(dbPath);
const app = createApp(config, db);

app.listen(config.port, config.host, () => {
  logger.info("Everworld AI server listening", {
    host: config.host,
    port: config.port,
    provider: config.modelProvider,
    dbPath,
  });
});
