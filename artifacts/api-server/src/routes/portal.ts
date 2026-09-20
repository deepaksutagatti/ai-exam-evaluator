import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createClerkClient } from "@clerk/backend";
import { randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import {
  db,
  branchEnum,
  documentsTable,
  evaluationsTable,
  profilesTable,
  studentsTable,
  subjectsTable,
  teacherRegistrationsTable,
} from "@workspace/db";
import {
  AuthenticatedRequest,
  getProfile,
  hasApprovedSubject,
  requireAuth,
  requireRole,
} from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);
type BranchName = (typeof branchEnum.enumValues)[number];

const RoleBody = z.object({
  role: z.enum(["admin", "teacher", "student"]),
  displayName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional(),
});
const SubjectBody = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/),
  description: z.string().trim().max(500).optional(),
});
const StudentBody = z.object({
  fullName: z.string().trim().min(2),
  admissionNumber: z.string().trim().min(1).max(11).regex(/^[A-Za-z0-9]+$/),
  email: z.string().trim().email(),
  semester: z.coerce.number().int().min(1).max(8),
  branch: z.enum(branchEnum.enumValues),
});
const HodBody = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  branch: z.enum(branchEnum.enumValues),
});
const StudentImportBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileBase64: z.string().min(1),
});
const RegistrationBody = z.object({ subjectId: z.coerce.number().int().positive() });
const ReviewBody = z.object({ status: z.enum(["approved", "rejected"]) });
const DocumentBody = z.object({
  kind: z.enum(["model_answer", "student_answer"]),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  objectPath: z.string().startsWith("/objects/"),
  subjectId: z.coerce.number().int().positive().optional(),
  studentId: z.coerce.number().int().positive().optional(),
});
const ManualEvaluationBody = z.object({
  subjectId: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive(),
  answerSheetDocumentId: z.coerce.number().int().positive(),
  modelAnswerDocumentId: z.coerce.number().int().positive().optional(),
  examTitle: z.string().trim().min(1).max(200),
  maxScore: z.coerce.number().int().positive(),
  finalScore: z.coerce.number().int().min(0),
  summary: z.string().trim().min(1).max(2000),
});

function userId(req: Request): string {
  return (req as AuthenticatedRequest).clerkUserId;
}

function publicProfile(profile: Awaited<ReturnType<typeof getProfile>>) {
  if (!profile) return null;
  return {
    clerkUserId: profile.clerkUserId,
    displayName: profile.displayName,
    email: profile.email,
    role: profile.role,
    branch: profile.branch,
  };
}

type ImportedStudent = {
  rowNumber: number;
  fullName: string;
  admissionNumber: string;
  email: string;
  semester: number;
  branch: BranchName;
};

type StudentCredential = ImportedStudent & {
  password: string;
  clerkUserId: string;
};

function getClerkAdminClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Clerk is not configured for administrator account creation.");
  }
  return createClerkClient({ secretKey });
}

function normalizedCell(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return names.includes(normalizedKey);
  });
  return typeof match?.[1] === "string" ? match[1].trim() : String(match?.[1] ?? "").trim();
}

function normalizeBranch(value: string) {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, BranchName> = {
    computerscience: "Computer Science",
    cse: "Computer Science",
    cs: "Computer Science",
    aiml: "AIML",
    artificialintelligenceandmachinelearning: "AIML",
    electronics: "Electronics",
    ece: "Electronics",
    electronicsandcommunication: "Electronics",
    mechanical: "Mechanical",
    mech: "Mechanical",
    civil: "Civil",
  };
  return aliases[key];
}

function parseStudentRoster(fileBase64: string): ImportedStudent[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(Buffer.from(fileBase64, "base64"), { type: "buffer" });
  } catch {
    throw new Error("The roster file could not be read. Upload a valid Excel or CSV file.");
  }
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] || ""];
  if (!firstSheet) throw new Error("The roster file does not contain a worksheet.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
    raw: false,
  });
  if (!rows.length) throw new Error("The roster file is empty.");
  if (rows.length > 500) throw new Error("Import up to 500 students at a time.");

  const parsed: ImportedStudent[] = [];
  const seenAdmissionNumbers = new Set<string>();
  const seenEmails = new Set<string>();
  rows.forEach((row, index) => {
    const fullName = normalizedCell(row, ["fullname", "name", "studentname"]);
    const admissionNumber = normalizedCell(row, [
      "usn",
      "admissionnumber",
      "admissionno",
      "rollnumber",
      "rollno",
    ]).replace(/\s+/g, "").toUpperCase();
    const email = normalizedCell(row, ["email", "emailid", "emailaddress"]).toLowerCase();
    const branch = normalizeBranch(normalizedCell(row, ["branch", "department", "stream"]));
    const semesterValue = normalizedCell(row, ["semester", "sem"]);
    if (!fullName && !admissionNumber && !email) return;
    if (fullName.length < 2) throw new Error(`Row ${index + 2}: enter the student's full name.`);
    if (!/^[A-Z0-9]+$/.test(admissionNumber)) {
      throw new Error(`Row ${index + 2}: USN/admission number may contain only letters and numbers.`);
    }
    if (admissionNumber.length > 11) {
      throw new Error(`Row ${index + 2}: USN/admission number must be 11 characters or fewer to fit the 15-character password.`);
    }
    if (!email || !z.string().email().safeParse(email).success) {
      throw new Error(`Row ${index + 2}: enter a valid email address.`);
    }
    const semester = Number(semesterValue);
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      throw new Error(`Row ${index + 2}: semester must be a whole number from 1 to 8.`);
    }
    if (!branch) {
      throw new Error(`Row ${index + 2}: enter one of Computer Science, AIML, Electronics, Mechanical, or Civil.`);
    }
    if (seenAdmissionNumbers.has(admissionNumber)) {
      throw new Error(`Row ${index + 2}: the USN/admission number appears more than once.`);
    }
    if (seenEmails.has(email)) {
      throw new Error(`Row ${index + 2}: the email address appears more than once.`);
    }
    seenAdmissionNumbers.add(admissionNumber);
    seenEmails.add(email);
    parsed.push({ rowNumber: index + 2, fullName, admissionNumber, email, semester, branch });
  });
  if (!parsed.length) throw new Error("No student rows were found. Use columns for Name, USN, and Email.");
  return parsed;
}

function generateStudentPassword(admissionNumber: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const fixed = `${admissionNumber}#aQ`;
  const remaining = 15 - fixed.length;
  const randomBytesValue = randomBytes(Math.max(0, remaining));
  const random = Array.from(randomBytesValue, (value) => alphabet[value % alphabet.length]).join("");
  return `${fixed}${random}`;
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || fullName, lastName: parts.slice(1).join(" ") || undefined };
}

async function createStudentAccount(
  student: ImportedStudent,
  clerk: ReturnType<typeof getClerkAdminClient>,
) {
  const password = generateStudentPassword(student.admissionNumber);
  const names = splitName(student.fullName);
  let clerkUserId: string | undefined;
  try {
    const clerkUser = await clerk.users.createUser({
      emailAddress: [student.email],
      emailAddressIdentificationStatus: ["verified"],
      password,
      firstName: names.firstName,
      lastName: names.lastName,
      skipPasswordChecks: true,
    });
    clerkUserId = clerkUser.id;
    await db.transaction(async (tx) => {
      await tx.insert(studentsTable).values({
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        email: student.email,
        clerkUserId: clerkUser.id,
        semester: student.semester,
        branch: student.branch,
      });
      await tx.insert(profilesTable).values({
        clerkUserId: clerkUser.id,
        displayName: student.fullName,
        email: student.email,
        role: "student",
        branch: student.branch,
      });
    });
    return { ...student, password, clerkUserId: clerkUser.id };
  } catch (error) {
    if (clerkUserId) {
      try {
        await clerk.users.deleteUser(clerkUserId);
      } catch (cleanupError) {
        logger.error({ err: cleanupError, clerkUserId }, "Failed to clean up partially created student account");
      }
    }
    throw error;
  }
}

function credentialRows(credentials: StudentCredential[]) {
  return credentials.map(({ fullName, admissionNumber, email, password, semester, branch }) => ({
    "Full name": fullName,
    USN: admissionNumber,
    Email: email,
    Semester: semester,
    Branch: branch,
    Password: password,
  }));
}

function buildCredentialsExcel(credentials: StudentCredential[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(credentialRows(credentials));
  worksheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 34 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Student credentials");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

async function buildCredentialsPdf(credentials: StudentCredential[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  const drawPage = (currentPage: typeof page) => {
    currentPage.drawText("AI Examiner · Student login credentials", {
      x: 42,
      y: 748,
      size: 16,
      font: bold,
      color: rgb(0.06, 0.15, 0.25),
    });
    currentPage.drawText("Keep this file private. Passwords are shown only for this import.", {
      x: 42,
      y: 728,
      size: 9,
      font: regular,
      color: rgb(0.35, 0.4, 0.42),
    });
    currentPage.drawText("Student", { x: 42, y: 700, size: 9, font: bold });
    currentPage.drawText("USN", { x: 290, y: 700, size: 9, font: bold });
    currentPage.drawText("Email", { x: 370, y: 700, size: 9, font: bold });
    currentPage.drawText("Password", { x: 42, y: 682, size: 9, font: bold });
  };
  drawPage(page);
  let y = 662;
  for (const credential of credentials) {
    if (y < 54) {
      page = pdf.addPage([612, 792]);
      drawPage(page);
      y = 662;
    }
    page.drawText(credential.fullName.slice(0, 34), { x: 42, y, size: 8, font: regular });
    page.drawText(credential.admissionNumber, { x: 290, y, size: 8, font: regular });
    page.drawText(credential.email.slice(0, 30), { x: 370, y, size: 8, font: regular });
    page.drawText(credential.password, { x: 42, y: y - 14, size: 8, font: regular });
    page.drawLine({ start: { x: 42, y: y - 21 }, end: { x: 570, y: y - 21 }, thickness: 0.5, color: rgb(0.85, 0.86, 0.84) });
    y -= 42;
  }
  return Buffer.from(await pdf.save());
}

router.get("/me", async (req, res): Promise<void> => {
  const profile = await getProfile(userId(req));
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(profilesTable);
  res.json({
    clerkUserId: userId(req),
    profile: publicProfile(profile),
    canClaimAdmin: Number(count) === 0,
  });
});

router.post("/me/role", async (req, res): Promise<void> => {
  const parsed = RoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid account role." });
    return;
  }
  const existing = await getProfile(userId(req));
  if (existing?.role) {
    res.status(409).json({ error: "Your account role is already set." });
    return;
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(profilesTable);
  if (parsed.data.role === "admin" && Number(count) > 0) {
    res.status(403).json({ error: "The initial admin account has already been claimed." });
    return;
  }
  const identity = {
    displayName: parsed.data.displayName || existing?.displayName || "Clerk user",
    email: parsed.data.email || existing?.email || null,
  };
  const [profile] = existing
    ? await db
        .update(profilesTable)
        .set({ ...identity, role: parsed.data.role, updatedAt: new Date() })
        .where(eq(profilesTable.clerkUserId, userId(req)))
        .returning()
    : await db
        .insert(profilesTable)
        .values({ clerkUserId: userId(req), role: parsed.data.role, ...identity })
        .returning();
  if (parsed.data.role === "student" && identity.email) {
    await db
      .update(studentsTable)
      .set({ clerkUserId: userId(req) })
      .where(
        and(
          eq(studentsTable.email, identity.email),
          sql`${studentsTable.clerkUserId} is null`,
        ),
      );
  }
  res.status(201).json(publicProfile(profile));
});

router.get("/subjects", async (_req, res): Promise<void> => {
  const subjects = await db
    .select()
    .from(subjectsTable)
    .where(eq(subjectsTable.active, true))
    .orderBy(asc(subjectsTable.name));
  res.json(subjects);
});

router.get("/admin/subjects", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  res.json(await db.select().from(subjectsTable).orderBy(asc(subjectsTable.name)));
});

router.post("/admin/subjects", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  const parsed = SubjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a subject name and a unique code." });
    return;
  }
  try {
    const [subject] = await db.insert(subjectsTable).values(parsed.data).returning();
    res.status(201).json(subject);
  } catch {
    res.status(409).json({ error: "That subject code is already in use." });
  }
});

router.get("/admin/students", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  res.json(await db.select().from(studentsTable).orderBy(asc(studentsTable.branch), asc(studentsTable.semester), asc(studentsTable.fullName)));
});

router.post("/admin/students", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  const parsed = StudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the student's name and admission number." });
    return;
  }
  try {
    const clerk = getClerkAdminClient();
    const created = await createStudentAccount(
      { rowNumber: 0, ...parsed.data },
      clerk,
    );
    const { password, clerkUserId, rowNumber: _rowNumber, ...student } = created;
    res.status(201).json({
      student: { ...student, clerkUserId },
      credential: {
        "Full name": created.fullName,
        USN: created.admissionNumber,
        Email: created.email,
        Semester: created.semester,
        Branch: created.branch,
        Password: password,
      },
    });
  } catch (error) {
    res.status(409).json({
      error: error instanceof Error && /email|admission|already|identifier/i.test(error.message)
        ? error.message
        : "The student account could not be created. Check the email and admission number.",
    });
  }
});

router.post("/admin/students/import", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  const parsedBody = StudentImportBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Choose an Excel or CSV roster file to import." });
    return;
  }

  let roster: ImportedStudent[];
  try {
    roster = parseStudentRoster(parsedBody.data.fileBase64);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "The roster file is invalid." });
    return;
  }

  const existingStudents = await db
    .select({ admissionNumber: studentsTable.admissionNumber })
    .from(studentsTable);
  const existingAdmissionNumbers = new Set(existingStudents.map((student) => student.admissionNumber.toUpperCase()));
  const credentials: StudentCredential[] = [];
  const errors: Array<{ rowNumber: number; email: string; admissionNumber: string; error: string }> = [];
  const clerk = getClerkAdminClient();

  for (const student of roster) {
    if (existingAdmissionNumbers.has(student.admissionNumber)) {
      errors.push({
        rowNumber: student.rowNumber,
        email: student.email,
        admissionNumber: student.admissionNumber,
        error: "This USN/admission number is already registered.",
      });
      continue;
    }

    try {
        const created = await createStudentAccount(student, clerk);
      existingAdmissionNumbers.add(student.admissionNumber);
        credentials.push(created);
    } catch (error) {
      errors.push({
        rowNumber: student.rowNumber,
        email: student.email,
        admissionNumber: student.admissionNumber,
        error: error instanceof Error ? error.message : "Could not create the student account.",
      });
    }
  }

  if (!credentials.length && errors.length) {
    res.status(409).json({
      error: "No student accounts were created.",
      imported: [],
      errors,
    });
    return;
  }

  try {
    const [excel, pdf] = await Promise.all([
      Promise.resolve(buildCredentialsExcel(credentials)),
      buildCredentialsPdf(credentials),
    ]);
    res.json({
      imported: credentials.map(({ password: _password, ...student }) => student),
      errors,
      downloads: {
        excel: {
          fileName: `student-credentials-${new Date().toISOString().slice(0, 10)}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: excel.toString("base64"),
        },
        pdf: {
          fileName: `student-credentials-${new Date().toISOString().slice(0, 10)}.pdf`,
          contentType: "application/pdf",
          base64: pdf.toString("base64"),
        },
      },
      credentialRows: credentialRows(credentials),
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to build student credential files");
    res.status(500).json({ error: "Student accounts were created, but the credential files could not be prepared." });
  }
});

router.post("/admin/hods", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  const parsed = HodBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the HOD name, email, and assigned branch." });
    return;
  }
  const clerk = getClerkAdminClient();
  const password = generateStudentPassword(`HOD${randomBytes(4).toString("hex").toUpperCase()}`);
  const names = splitName(parsed.data.fullName);
  let clerkUserId: string | undefined;
  try {
    const clerkUser = await clerk.users.createUser({
      emailAddress: [parsed.data.email],
      emailAddressIdentificationStatus: ["verified"],
      password,
      firstName: names.firstName,
      lastName: names.lastName,
      skipPasswordChecks: true,
    });
    clerkUserId = clerkUser.id;
    const [profile] = await db
      .insert(profilesTable)
      .values({
        clerkUserId,
        displayName: parsed.data.fullName,
        email: parsed.data.email,
        role: "hod",
        branch: parsed.data.branch,
      })
      .returning();
    res.status(201).json({
      profile: publicProfile(profile),
      credential: {
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        branch: parsed.data.branch,
        password,
      },
    });
  } catch (error) {
    if (clerkUserId) {
      try {
        await clerk.users.deleteUser(clerkUserId);
      } catch (cleanupError) {
        req.log.error({ err: cleanupError, clerkUserId }, "Failed to clean up partially created HOD account");
      }
    }
    res.status(409).json({
      error: error instanceof Error && /email|identifier|already/i.test(error.message)
        ? error.message
        : "The HOD account could not be created. Check the email and try again.",
    });
  }
});

router.get("/hod/students", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "hod"))) return;
  const profile = await getProfile(userId(req));
  if (!profile?.branch) {
    res.status(409).json({ error: "This HOD account has no branch assigned." });
    return;
  }
  const students = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.branch, profile.branch))
    .orderBy(asc(studentsTable.semester), asc(studentsTable.fullName));
  res.json({ branch: profile.branch, students });
});

router.get("/admin/teacher-registrations", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  const registrations = await db
    .select({
      id: teacherRegistrationsTable.id,
      teacherClerkUserId: teacherRegistrationsTable.teacherClerkUserId,
      status: teacherRegistrationsTable.status,
      createdAt: teacherRegistrationsTable.createdAt,
      subject: { id: subjectsTable.id, name: subjectsTable.name, code: subjectsTable.code },
    })
    .from(teacherRegistrationsTable)
    .innerJoin(subjectsTable, eq(teacherRegistrationsTable.subjectId, subjectsTable.id))
    .orderBy(desc(teacherRegistrationsTable.createdAt));
  res.json(registrations);
});

router.patch("/admin/teacher-registrations/:id", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "admin"))) return;
  const id = Number(req.params.id);
  const parsed = ReviewBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid registration review." });
    return;
  }
  const [registration] = await db
    .update(teacherRegistrationsTable)
    .set({ status: parsed.data.status, reviewedAt: new Date() })
    .where(eq(teacherRegistrationsTable.id, id))
    .returning();
  if (!registration) {
    res.status(404).json({ error: "Registration not found." });
    return;
  }
  res.json(registration);
});

router.get("/teacher/registrations", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  res.json(
    await db
      .select({
        id: teacherRegistrationsTable.id,
        status: teacherRegistrationsTable.status,
        subject: { id: subjectsTable.id, name: subjectsTable.name, code: subjectsTable.code },
      })
      .from(teacherRegistrationsTable)
      .innerJoin(subjectsTable, eq(teacherRegistrationsTable.subjectId, subjectsTable.id))
      .where(eq(teacherRegistrationsTable.teacherClerkUserId, userId(req))),
  );
});

router.post("/teacher/registrations", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  const parsed = RegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose an available subject." });
    return;
  }
  try {
    const [registration] = await db
      .insert(teacherRegistrationsTable)
      .values({ teacherClerkUserId: userId(req), subjectId: parsed.data.subjectId })
      .returning();
    res.status(201).json(registration);
  } catch {
    res.status(409).json({ error: "You already registered for that subject." });
  }
});

router.get("/teacher/students", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  res.json(await db.select().from(studentsTable).where(eq(studentsTable.active, true)).orderBy(asc(studentsTable.fullName)));
});

router.post("/documents", async (req, res): Promise<void> => {
  const profile = await getProfile(userId(req));
  if (!profile?.role || !["admin", "teacher"].includes(profile.role)) {
    res.status(403).json({ error: "Only admins and teachers can upload documents." });
    return;
  }
  const parsed = DocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document metadata." });
    return;
  }
  if (profile.role === "admin" && parsed.data.kind !== "student_answer") {
    res.status(403).json({ error: "Admins upload student answer sheets only." });
    return;
  }
  if (profile.role === "teacher" && parsed.data.kind !== "model_answer") {
    res.status(403).json({ error: "Teachers upload model answers only." });
    return;
  }
  if (parsed.data.kind === "model_answer") {
    if (!parsed.data.subjectId || !(await hasApprovedSubject(userId(req), parsed.data.subjectId))) {
      res.status(403).json({ error: "Your subject registration must be approved before uploading a model answer." });
      return;
    }
  }
  if (parsed.data.kind === "student_answer" && !parsed.data.studentId) {
    res.status(400).json({ error: "Choose the student and subject for this answer sheet." });
    return;
  }
  const [document] = await db
    .insert(documentsTable)
    .values({ ...parsed.data, uploadedByClerkUserId: userId(req) })
    .returning();
  res.status(201).json(document);
});

router.get("/teacher/documents", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  const registrations = await db
    .select({ subjectId: teacherRegistrationsTable.subjectId })
    .from(teacherRegistrationsTable)
    .where(
      and(
        eq(teacherRegistrationsTable.teacherClerkUserId, userId(req)),
        eq(teacherRegistrationsTable.status, "approved"),
      ),
    );
  const subjectIds = registrations.map((registration) => registration.subjectId);
  const documents = subjectIds.length
    ? await db
      .select()
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.kind, "model_answer"),
          sql`${documentsTable.subjectId} in ${subjectIds}`,
        ),
      )
      .orderBy(desc(documentsTable.createdAt))
    : [];
  res.json(documents);
});

router.post("/teacher/evaluations/manual", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  const parsed = ManualEvaluationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the exam details, score, and teacher feedback." });
    return;
  }

  const input = parsed.data;
  if (input.finalScore > input.maxScore) {
    res.status(400).json({ error: "Final score cannot exceed the maximum score." });
    return;
  }
  if (!(await hasApprovedSubject(userId(req), input.subjectId))) {
    res.status(403).json({ error: "Your teacher registration for this subject is not approved." });
    return;
  }

  const [answerSheet] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.id, input.answerSheetDocumentId),
        eq(documentsTable.kind, "student_answer"),
        eq(documentsTable.subjectId, input.subjectId),
        eq(documentsTable.studentId, input.studentId),
      ),
    )
    .limit(1);
  if (!answerSheet) {
    res.status(403).json({ error: "That answer sheet is not available for this subject and student." });
    return;
  }

  if (input.modelAnswerDocumentId) {
    const [modelAnswer] = await db
      .select({ id: documentsTable.id })
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.id, input.modelAnswerDocumentId),
          eq(documentsTable.kind, "model_answer"),
          eq(documentsTable.subjectId, input.subjectId),
        ),
      )
      .limit(1);
    if (!modelAnswer) {
      res.status(400).json({ error: "The selected marking scheme is not available for this subject." });
      return;
    }
  }

  const percentage = Math.round((input.finalScore / input.maxScore) * 100);
  const grade =
    percentage >= 90 ? "A+" :
    percentage >= 80 ? "A" :
    percentage >= 70 ? "B" :
    percentage >= 60 ? "C" :
    percentage >= 50 ? "D" : "F";
  const result = {
    examTitle: input.examTitle,
    overallScore: input.finalScore,
    maxScore: input.maxScore,
    percentage,
    grade,
    confidence: 1,
    summary: input.summary,
    strengths: [],
    improvements: [],
    questions: [],
    integrityNotes: ["Manually evaluated and approved by the teacher."],
  };

  const [evaluation] = await db
    .insert(evaluationsTable)
    .values({
      studentId: input.studentId,
      subjectId: input.subjectId,
      teacherClerkUserId: userId(req),
      answerSheetDocumentId: input.answerSheetDocumentId,
      modelAnswerDocumentId: input.modelAnswerDocumentId,
      result,
      aiScore: input.finalScore,
      maxScore: input.maxScore,
      finalScore: input.finalScore,
      status: "final",
    })
    .returning();
  res.status(201).json(evaluation);
});

router.get("/teacher/student-sheets", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  res.json(
    await db
      .select({
        id: documentsTable.id,
        fileName: documentsTable.fileName,
        objectPath: documentsTable.objectPath,
        createdAt: documentsTable.createdAt,
        subject: { id: subjectsTable.id, name: subjectsTable.name, code: subjectsTable.code },
        student: {
          id: studentsTable.id,
          fullName: studentsTable.fullName,
          admissionNumber: studentsTable.admissionNumber,
        },
      })
      .from(documentsTable)
      .innerJoin(studentsTable, eq(documentsTable.studentId, studentsTable.id))
      .innerJoin(subjectsTable, eq(documentsTable.subjectId, subjectsTable.id))
      .innerJoin(
        teacherRegistrationsTable,
        and(
          eq(teacherRegistrationsTable.subjectId, documentsTable.subjectId),
          eq(teacherRegistrationsTable.teacherClerkUserId, userId(req)),
          eq(teacherRegistrationsTable.status, "approved"),
        ),
      )
      .where(eq(documentsTable.kind, "student_answer"))
      .orderBy(desc(documentsTable.createdAt)),
  );
});

router.get("/teacher/evaluations", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  res.json(
    await db
      .select({
        id: evaluationsTable.id,
        result: evaluationsTable.result,
        aiScore: evaluationsTable.aiScore,
        maxScore: evaluationsTable.maxScore,
        finalScore: evaluationsTable.finalScore,
        status: evaluationsTable.status,
        createdAt: evaluationsTable.createdAt,
        evaluatedPdfDocumentId: evaluationsTable.evaluatedPdfDocumentId,
        subject: { id: subjectsTable.id, name: subjectsTable.name, code: subjectsTable.code },
        student: { id: studentsTable.id, fullName: studentsTable.fullName, admissionNumber: studentsTable.admissionNumber },
      })
      .from(evaluationsTable)
      .innerJoin(subjectsTable, eq(evaluationsTable.subjectId, subjectsTable.id))
      .innerJoin(studentsTable, eq(evaluationsTable.studentId, studentsTable.id))
      .where(eq(evaluationsTable.teacherClerkUserId, userId(req)))
      .orderBy(desc(evaluationsTable.createdAt)),
  );
});

router.get("/student/evaluations", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "student"))) return;
  const student = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.clerkUserId, userId(req)))
    .limit(1);
  if (!student[0]) {
    res.json([]);
    return;
  }
  res.json(
    await db
      .select({
        id: evaluationsTable.id,
        result: evaluationsTable.result,
        finalScore: evaluationsTable.finalScore,
        maxScore: evaluationsTable.maxScore,
        status: evaluationsTable.status,
        createdAt: evaluationsTable.createdAt,
        subject: { id: subjectsTable.id, name: subjectsTable.name, code: subjectsTable.code },
      })
      .from(evaluationsTable)
      .innerJoin(subjectsTable, eq(evaluationsTable.subjectId, subjectsTable.id))
        .where(
          and(
            eq(evaluationsTable.studentId, student[0].id),
            eq(evaluationsTable.status, "final"),
          ),
        )
      .orderBy(desc(evaluationsTable.createdAt)),
  );
});

router.patch("/teacher/evaluations/:id/finalize", async (req, res): Promise<void> => {
  if (!(await requireRole(req, res, "teacher"))) return;
  const id = Number(req.params.id);
  const parsed = z.object({ finalScore: z.coerce.number().min(0) }).safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: "Enter a valid final score." });
    return;
  }
  const [evaluation] = await db
    .select()
    .from(evaluationsTable)
    .where(
      and(
        eq(evaluationsTable.id, id),
        eq(evaluationsTable.teacherClerkUserId, userId(req)),
      ),
    )
    .limit(1);
  if (!evaluation) {
    res.status(404).json({ error: "Evaluation not found." });
    return;
  }
  if (parsed.data.finalScore > evaluation.maxScore) {
    res.status(400).json({ error: "Final score cannot exceed the maximum score." });
    return;
  }
  const [updated] = await db
    .update(evaluationsTable)
    .set({ finalScore: parsed.data.finalScore, status: "final", updatedAt: new Date() })
    .where(eq(evaluationsTable.id, id))
    .returning();
  res.json(updated);
});

export default router;