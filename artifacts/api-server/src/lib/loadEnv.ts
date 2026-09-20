import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import path from "node:path";

export function loadProjectEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(import.meta.dirname, "../../.env"),
  ];
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (envPath) loadEnvFile(envPath);
}