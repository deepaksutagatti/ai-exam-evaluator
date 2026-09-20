import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm to install this workspace: https://pnpm.io/installation");
  process.exit(1);
}

// Keep the workspace deterministic without relying on Unix-only `rm` or `sh`.
for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const file = resolve(process.cwd(), lockfile);
  if (existsSync(file)) unlinkSync(file);
}