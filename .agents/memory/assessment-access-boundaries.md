---
name: Assessment access boundaries
description: Rules for keeping teacher access and student visibility scoped to approved assessment records.
---

Every student answer sheet needs a subject association, teacher evaluation needs an approved teacher registration for that subject, and student queries must filter to finalized evaluations only.

**Why:** Without the subject on the uploaded document, the server cannot safely determine which approved teacher registrations may view or evaluate it.

**How to apply:** Preserve subjectId/studentId/document ownership checks whenever adding upload, evaluation, download, or finalization endpoints.