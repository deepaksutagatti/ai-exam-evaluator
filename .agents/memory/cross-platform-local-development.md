---
name: Cross-platform local development
description: Local commands must work outside Replit's injected workflow environment and on non-Linux developer machines.
---

The workspace should not depend on Replit-only PORT, BASE_PATH, or platform-pruning overrides for ordinary local installation and development.

**Why:** The application is also run from Windows/PowerShell laptops, where missing workflow variables and excluded native packages turn otherwise valid code into sequential startup and install failures.

**How to apply:** Keep laptop-safe defaults in the frontend and API entrypoints, retain a root command that starts both services, and let pnpm resolve native optional dependencies for the host platform.