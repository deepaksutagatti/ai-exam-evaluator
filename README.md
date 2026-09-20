# AI Examiner: Evidence-Based Academic Assessment

🔗 **[View Live Application Here](https://ai-exam-evaluator-nine.vercel.app)** 

A full-stack grading platform that uses multi-modal LLMs to evaluate handwritten student answer sheets against teacher-defined rubrics, while keeping human-approved assessment records in one secure cloud workspace.


## Overview


https://github.com/user-attachments/assets/873b0941-5f50-4684-b7c7-d5e7f4472159


### The Problem
Grading subjective, handwritten exams is one of the most time-consuming bottlenecks in academia. While evaluating long-form answers requires context and rubric alignment, manual grading is slow and prone to subjective fatigue.

### The Solution
AI Examiner acts as a highly capable assistant for educators using a "Human-in-the-Loop" architecture. The system processes scanned PDFs, grades the handwritten responses based on an uploaded answer key, and generates a structured feedback report. Teachers retain final approval over all AI-generated scores and can record a final manual score before releasing it to students.

## Technical Highlights
* **Stateless Cloud Architecture:** Fully migrated away from local file storage to a serverless infrastructure. Uploaded exam PDFs are stored securely in **Supabase Storage** buckets. The backend API authorizes and signs every upload/download request, ensuring that confidential student data remains durable, private, and horizontally scalable.
* **Defensive AI Pipeline:** To prevent LLM data hallucinations from corrupting the database, the backend implements a strict validation layer using **Zod**. Every JSON response from the Gemini API is parsed, sanitized, and type-checked before interacting with PostgreSQL.
* **Binary PDF Manipulation:** Programmatically manipulates the binary data of the student's original PDF, drawing the final scorecard and feedback directly onto the document before saving it to the cloud.

## User Roles (RBAC)
Clerk handles authentication, isolating workspaces across four specific roles:
* **Admins:** Manage subjects, student accounts, rosters, and HOD accounts.
* **HODs (Head of Department):** Oversee students assigned to their specific branch.
* **Teachers:** Register for subjects, upload marking schemes, review AI-assisted answer sheets, and finalize evaluations.
* **Students:** Securely view their released evaluation results and graded PDFs.

## Tech Stack & Architecture
* **Frontend (Hosted on Vercel):** React, Vite, Wouter (SPA routing)
* **Backend (Hosted on Render):** Node.js 24, Express 5, esbuild (CJS bundle)
* **Database & Storage (Supabase):** PostgreSQL, Drizzle ORM, Supabase Storage
* **Validation & Codegen:** Zod (zod/v4), drizzle-zod, Orval (generates API hooks/schemas from OpenAPI spec)
* **Auth:** `pnpm` workspaces, Clerk 

## Project Structure
* `artifacts/ai-examiner` — React/Vite web application
* `artifacts/api-server` — Express API, Clerk authentication, evaluation routes, and Supabase integration
* `lib/db` — Drizzle schema and PostgreSQL client
* `lib/api-zod` — Shared request and response validation
* `render.yaml` — Render backend service configuration
* `vercel.json` — Vercel frontend build and SPA routing configuration

## Run & Operate (Local Setup)

**Required Backend Environment Variables (`.env`):**
Because the app relies on cloud storage, you must provide Supabase credentials even for local development.
* `DATABASE_URL` — Supabase Postgres connection string
* `SUPABASE_URL` — Supabase project URL
* `SUPABASE_SERVICE_ROLE_KEY` — Secret key for backend bypass
* `SUPABASE_STORAGE_BUCKET` — (e.g., `exam-files`)
* `GEMINI_API_KEY` — Google Gemini API key
* `CLERK_SECRET_KEY` & `CLERK_PUBLISHABLE_KEY` 

**Commands:**
```bash
# Run the API server on port 5000
pnpm --filter @workspace/api-server run dev 

# Run the Vite frontend
pnpm --filter @workspace/ai-examiner run dev 

# Regenerate API hooks and Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen 

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push 

# Full typecheck across all packages
pnpm run typecheck 

# Typecheck + build all packages
pnpm run build
