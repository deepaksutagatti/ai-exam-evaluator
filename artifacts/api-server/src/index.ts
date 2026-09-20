import { loadProjectEnv } from "./lib/loadEnv";
import { logger } from "./lib/logger";

loadProjectEnv();

const { default: app } = await import("./app");

// PORT is supplied by the managed workflow. Keep a predictable default so
// `pnpm ... start` also works when the server is launched directly locally.
const rawPort = process.env["PORT"] || process.env["API_PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
