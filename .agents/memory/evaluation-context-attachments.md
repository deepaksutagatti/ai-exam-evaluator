---
name: Evaluation context attachments
description: How stored marking schemes participate in AI evaluation
---

The model-answer document selected for an evaluation is a real grading input. Persisting its database ID is not enough; the stored PDF must be loaded and included with the student answer sheet in the multimodal AI request.

**Why:** A previous flow saved the selected document relationship but never sent the document bytes to Gemini, so the UI appeared to offer a marking scheme while the evaluator behaved as if no scheme had been supplied.

**How to apply:** When changing evaluation inputs, keep the subject/teacher access checks and the document attachment path together. Manual evaluation may reference the scheme for auditability but does not need to send it to AI.