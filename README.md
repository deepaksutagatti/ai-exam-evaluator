# AI Examiner

AI Examiner helps educators review exam answer sheets, compare them with marking schemes, and keep human-approved assessment records in one workspace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server on port 5000
- `pnpm --filter @workspace/ai-examiner run dev` — run the Vite frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- External deployment env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optional `SUPABASE_STORAGE_BUCKET` (`exam-files` by default) provide private durable PDF storage.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from the OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ai-examiner` — React/Vite web application
- `artifacts/api-server` — Express API, Clerk authentication, evaluation routes, and file access
- `lib/db` — Drizzle schema and PostgreSQL client
- `lib/api-zod` — shared request and response validation
- `render.yaml` — Render backend service configuration
- `vercel.json` — Vercel frontend build and SPA routing configuration

## Architecture decisions

- Clerk handles authentication while PostgreSQL stores application profiles, rosters, documents, and evaluations.
- Uploaded PDFs are kept in a private Supabase Storage bucket; the API authorizes every upload and download.
- Teachers retain final approval over AI-generated scores and can record a final manual score.
- The frontend and API can run on separate origins for Vercel and Render deployments.

## Product

- Admins manage subjects, student accounts, rosters, and HOD accounts.
- HODs see students assigned to their branch.
- Teachers register for subjects, upload marking schemes, review answer sheets, and finalize evaluations.
- Students can view their released evaluation results.

## Deployment notes

Set `DATABASE_URL` to the Supabase Session Pooler connection string. The API also needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET=exam-files`.

For a split deployment, set `VITE_API_URL` on Vercel to the Render API origin and set `CORS_ORIGINS` on Render to the Vercel origin. Keep service-role, Clerk secret, Gemini, and database credentials on the API server only.