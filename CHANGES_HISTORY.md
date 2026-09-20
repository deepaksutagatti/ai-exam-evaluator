# Change history

## 2026-09-05 — JCER public website redesign

- Replaced the public AI Examiner landing page with a Jain College of Engineering & Research–inspired college website.
- Added a JCER-style institutional header with accreditation/contact information, seal treatment, admissions action, and responsive navigation.
- Added a campus hero section using the supplied campus reference image, with a dark navy overlay for readable content.
- Added accreditation highlights, institution overview, academic programme cards, campus-life section, admissions call-to-action, and structured footer.
- Added responsive layouts for tablet and mobile screens, including a collapsible navigation menu.
- Added subtle hero zoom and content entrance animations.
- Added `prefers-reduced-motion` support so visitors who disable animation receive a calmer experience.
- Preserved existing Clerk authentication, sign-in/sign-up routes, portal routes, evaluator functionality, and protected application workflows.

## 2026-09-05 — AI Examiner identity refinement

- Kept the institutional engineering-website layout language while replacing all reference-specific college names, seals, contacts, accreditation claims, and admissions copy with original AI Examiner messaging.
- Replaced the reference campus image treatment with an original navy-and-cobalt abstract visual system.
- Reframed the public sections around faculty workspaces, evidence-led review, student feedback, and assessment operations.

## 2026-09-05 — Clerk browser loading fix

- Updated the Clerk provider so an empty proxy URL is not passed to Clerk.
- This prevents Clerk from constructing the invalid `https://npm/@clerk/...` browser script URL.

## Previous platform work

- Local filesystem storage is used for uploaded documents.
- Local `.env` loading supports workspace and package-directory startup.
- Windows-compatible installation and local development commands are in place.