import { Router, type IRouter } from "express";
import {
  EvaluateAnswerSheetBody,
  EvaluateAnswerSheetResponse,
} from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import { db, documentsTable, evaluationsTable } from "@workspace/db";
import {
  AuthenticatedRequest,
  getProfile,
  hasApprovedSubject,
  requireAuth,
} from "../middlewares/auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readObject, uploadObjectBytes } from "../lib/storage";

const router: IRouter = Router();

// The current Gemini Flash preview supports multimodal PDFs and is a practical
// default for repeated classroom evaluations. The rubric and low temperature
// preserve consistency.
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_PDF_BASE64_LENGTH = 34_000_000;

const evaluationJsonSchema = {
  type: "OBJECT",
  properties: {
    examTitle: { type: "STRING" },
    overallScore: { type: "NUMBER" },
    maxScore: { type: "NUMBER" },
    percentage: { type: "NUMBER" },
    grade: { type: "STRING" },
    confidence: { type: "NUMBER" },
    summary: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    improvements: { type: "ARRAY", items: { type: "STRING" } },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          score: { type: "NUMBER" },
          maxScore: { type: "NUMBER" },
          verdict: {
            type: "STRING",
            enum: ["correct", "partial", "incorrect", "unanswered", "unclear"],
          },
          feedback: { type: "STRING" },
          expectedAnswer: { type: "STRING" },
          evidence: { type: "STRING" },
        },
        required: [
          "question",
          "score",
          "maxScore",
          "verdict",
          "feedback",
          "expectedAnswer",
          "evidence",
        ],
      },
    },
    integrityNotes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "examTitle",
    "overallScore",
    "maxScore",
    "percentage",
    "grade",
    "confidence",
    "summary",
    "strengths",
    "improvements",
    "questions",
    "integrityNotes",
  ],
} as const;

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Gemini returned an invalid JSON evaluation.");
  }
}

function buildPrompt(input: {
  examTitle: string;
  subject?: string;
  maxScore: number;
  answerKey?: string;
  rubric?: string;
}) {
  return `You are a meticulous academic examiner evaluating a student's answer sheet.

Exam title: ${input.examTitle}
Subject: ${input.subject || "Not specified"}
Maximum score: ${input.maxScore}

Marking instructions:
- Use the answer key when provided. If no answer key is provided, infer the expected answer from the questions and subject, and clearly disclose that in the result.
- Use the rubric when provided. Otherwise award partial credit for correct reasoning even when wording differs from the key.
- Inspect every page of the attached PDF, including handwritten answers and diagrams as far as legible.
- Do not award points for unsupported claims. Do not penalize harmless wording differences.
- Keep the sum of question scores equal to overallScore and never exceed question maxScore or the exam maximum.
- If an answer is unreadable, mark it "unclear" and mention that limitation rather than guessing.
- Use 0-1 for confidence, where lower means the scan or evidence is ambiguous.

Answer key:
${input.answerKey?.trim() || "No answer key supplied; infer expected answers carefully."}

Rubric:
${input.rubric?.trim() || "No separate rubric supplied; use sound subject-matter grading judgment."}

Return only a single JSON object matching the supplied response schema. Include concise evidence from the student's answer for each question, an expectedAnswer, and actionable feedback.`;
}

async function buildEvaluationPdf(evaluation: {
  examTitle: string;
  overallScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
  summary: string;
  questions: Array<{ question: string; score: number; maxScore: number; feedback: string }>;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage();
  let y = page.getHeight() - 54;
  const write = (text: string, size = 11) => {
    if (y < 54) {
      page = pdf.addPage();
      y = page.getHeight() - 54;
    }
    page.drawText(text.slice(0, 125), {
      x: 48,
      y,
      size,
      font,
      color: rgb(0.12, 0.18, 0.25),
    });
    y -= size + 9;
  };
  write("AI Examiner — Evaluated answer sheet", 16);
  write(evaluation.examTitle, 13);
  write(`Score: ${evaluation.overallScore}/${evaluation.maxScore} (${Math.round(evaluation.percentage)}%) · Grade ${evaluation.grade}`, 11);
  y -= 6;
  write("Summary", 12);
  write(evaluation.summary);
  y -= 6;
  write("Question review", 12);
  for (const question of evaluation.questions) {
    write(`${question.question} — ${question.score}/${question.maxScore}`);
    write(question.feedback);
  }
  return pdf.save();
}

router.post("/evaluate", requireAuth, async (req, res): Promise<void> => {
  const parsed = EvaluateAnswerSheetBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid evaluation request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const input = parsed.data;
  if (input.pdfBase64.length > MAX_PDF_BASE64_LENGTH) {
    res.status(400).json({
      error: "This PDF is too large to evaluate in one request. Please upload a file under 25 MB.",
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    req.log.error("GEMINI_API_KEY is not configured");
    res.status(500).json({ error: "Gemini evaluation is not configured yet." });
    return;
  }

  try {
    const profile = await getProfile((req as AuthenticatedRequest).clerkUserId);
    if (input.subjectId || input.studentId || input.answerSheetDocumentId) {
      if (!profile || profile.role !== "teacher" || !input.subjectId || !input.studentId || !input.answerSheetDocumentId) {
        res.status(403).json({ error: "A teacher must select an approved subject, student, and uploaded answer sheet." });
        return;
      }
      if (!(await hasApprovedSubject(profile.clerkUserId, input.subjectId))) {
        res.status(403).json({ error: "Your teacher registration for this subject is not approved." });
        return;
      }
    }
    let modelAnswerPdfBase64: string | undefined;
    if (input.modelAnswerDocumentId) {
      if (!profile || profile.role !== "teacher" || !input.subjectId) {
        res.status(403).json({ error: "Only a teacher evaluating an approved subject can use a marking scheme." });
        return;
      }
      const [modelAnswer] = await db
        .select({
          objectPath: documentsTable.objectPath,
          subjectId: documentsTable.subjectId,
        })
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.id, input.modelAnswerDocumentId),
            eq(documentsTable.kind, "model_answer"),
            eq(documentsTable.subjectId, input.subjectId),
          ),
        )
        .limit(1);
      if (!modelAnswer || !(await hasApprovedSubject(profile.clerkUserId, input.subjectId))) {
        res.status(403).json({ error: "The selected marking scheme is not available for this subject." });
        return;
      }
      const modelAnswerBytes = await readObject(modelAnswer.objectPath);
      modelAnswerPdfBase64 = modelAnswerBytes.toString("base64");
      if (modelAnswerPdfBase64.length > MAX_PDF_BASE64_LENGTH) {
        res.status(400).json({ error: "The selected marking scheme is too large to use in one evaluation." });
        return;
      }
    }
    const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(input) }];
    if (modelAnswerPdfBase64) {
      parts.push(
        { text: "Attached next is the teacher-uploaded model answer / marking scheme. Use it as the primary grading reference." },
        { inline_data: { mime_type: "application/pdf", data: modelAnswerPdfBase64 } },
      );
    }
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: input.pdfBase64,
      },
    });
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: evaluationJsonSchema,
        },
      }),
    });

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      req.log.error(
        { status: response.status, message: payload.error?.message },
        "Gemini evaluation request failed",
      );
      res.status(500).json({
        error: payload.error?.message || "Gemini could not evaluate this document.",
      });
      return;
    }

    const modelText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!modelText) {
      res.status(500).json({ error: "Gemini returned an empty evaluation." });
      return;
    }

    const evaluation = EvaluateAnswerSheetResponse.parse(parseModelJson(modelText));
    if (profile?.role === "teacher" && input.subjectId && input.studentId && input.answerSheetDocumentId) {
      const pdfBytes = await buildEvaluationPdf(evaluation);
      const evaluatedPdfPath = await uploadObjectBytes(pdfBytes, "application/pdf");
      const [saved] = await db
        .insert(evaluationsTable)
        .values({
          studentId: input.studentId,
          subjectId: input.subjectId,
          teacherClerkUserId: profile.clerkUserId,
          answerSheetDocumentId: input.answerSheetDocumentId,
          modelAnswerDocumentId: input.modelAnswerDocumentId,
          result: evaluation,
          aiScore: Math.round(evaluation.overallScore),
          maxScore: Math.round(evaluation.maxScore),
        })
        .returning();
      const [document] = await db
        .insert(documentsTable)
        .values({
          kind: "evaluated_pdf",
          fileName: `${input.fileName.replace(/\.pdf$/i, "")}-evaluated.pdf`,
          contentType: "application/pdf",
          objectPath: evaluatedPdfPath,
          uploadedByClerkUserId: profile.clerkUserId,
          subjectId: input.subjectId,
          studentId: input.studentId,
        })
        .returning();
      await db
        .update(evaluationsTable)
        .set({ evaluatedPdfDocumentId: document.id, updatedAt: new Date() })
        .where(eq(evaluationsTable.id, saved.id));
      res.json({ ...evaluation, evaluationId: saved.id, evaluatedPdfPath });
      return;
    }
    res.json(evaluation);
  } catch (error) {
    req.log.error({ err: error }, "Answer-sheet evaluation failed");
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "The answer sheet could not be evaluated.",
    });
  }
});

export default router;