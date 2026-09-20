import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "teacher", "student", "hod"]);
export const branchEnum = pgEnum("branch", [
  "Computer Science",
  "AIML",
  "Electronics",
  "Mechanical",
  "Civil",
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);
export const documentKindEnum = pgEnum("document_kind", [
  "model_answer",
  "student_answer",
  "evaluated_pdf",
  "markcard",
]);
export const evaluationStatusEnum = pgEnum("evaluation_status", [
  "ai_draft",
  "final",
]);

export const profilesTable = pgTable("profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  displayName: text("display_name").notNull().default("Clerk user"),
  email: text("email"),
  role: roleEnum("role"),
  branch: branchEnum("branch"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subjectsTable = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  admissionNumber: text("admission_number").notNull().unique(),
  email: text("email"),
  clerkUserId: text("clerk_user_id").unique(),
  semester: integer("semester"),
  branch: branchEnum("branch"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teacherRegistrationsTable = pgTable(
  "teacher_registrations",
  {
    id: serial("id").primaryKey(),
    teacherClerkUserId: text("teacher_clerk_user_id").notNull(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjectsTable.id, { onDelete: "cascade" }),
    status: approvalStatusEnum("status").notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("teacher_subject_unique").on(table.teacherClerkUserId, table.subjectId),
  ],
);

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  kind: documentKindEnum("kind").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  objectPath: text("object_path").notNull().unique(),
  uploadedByClerkUserId: text("uploaded_by_clerk_user_id").notNull(),
  subjectId: integer("subject_id").references(() => subjectsTable.id, {
    onDelete: "set null",
  }),
  studentId: integer("student_id").references(() => studentsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evaluationsTable = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjectsTable.id, { onDelete: "cascade" }),
  teacherClerkUserId: text("teacher_clerk_user_id").notNull(),
  answerSheetDocumentId: integer("answer_sheet_document_id")
    .notNull()
    .references(() => documentsTable.id, { onDelete: "restrict" }),
  modelAnswerDocumentId: integer("model_answer_document_id").references(
    () => documentsTable.id,
    { onDelete: "set null" },
  ),
  result: jsonb("result").notNull(),
  aiScore: integer("ai_score").notNull(),
  maxScore: integer("max_score").notNull(),
  finalScore: integer("final_score"),
  status: evaluationStatusEnum("status").notNull().default("ai_draft"),
  evaluatedPdfDocumentId: integer("evaluated_pdf_document_id").references(
    () => documentsTable.id,
    { onDelete: "set null" },
  ),
  markcardDocumentId: integer("markcard_document_id").references(
    () => documentsTable.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subjectsRelations = relations(subjectsTable, ({ many }) => ({
  registrations: many(teacherRegistrationsTable),
  documents: many(documentsTable),
  evaluations: many(evaluationsTable),
}));

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({
  id: true,
  createdAt: true,
});
export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
});
export const insertTeacherRegistrationSchema = createInsertSchema(
  teacherRegistrationsTable,
).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});
export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
});

export type Profile = typeof profilesTable.$inferSelect;
export type Subject = typeof subjectsTable.$inferSelect;
export type Student = typeof studentsTable.$inferSelect;
export type TeacherRegistration = typeof teacherRegistrationsTable.$inferSelect;
export type Document = typeof documentsTable.$inferSelect;
export type Evaluation = typeof evaluationsTable.$inferSelect;
export type Branch = "Computer Science" | "AIML" | "Electronics" | "Mechanical" | "Civil";
export type UserRole = "admin" | "teacher" | "student" | "hod";