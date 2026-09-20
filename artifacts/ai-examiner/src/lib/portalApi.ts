export type Role = "admin" | "teacher" | "student" | "hod";
export type Branch = "Computer Science" | "AIML" | "Electronics" | "Mechanical" | "Civil";
export const branches: Branch[] = ["Computer Science", "AIML", "Electronics", "Mechanical", "Civil"];
export const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

export interface Profile {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  role: Role | null;
  branch: Branch | null;
}

export interface MeResponse {
  clerkUserId: string;
  profile: Profile | null;
  canClaimAdmin: boolean;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
}

export interface Student {
  id: number;
  fullName: string;
  admissionNumber: string;
  email: string | null;
  clerkUserId: string | null;
  semester: number | null;
  branch: Branch | null;
  active: boolean;
}

export interface Registration {
  id: number;
  status: "pending" | "approved" | "rejected";
  subject: Pick<Subject, "id" | "name" | "code">;
}

export interface DocumentRecord {
  id: number;
  kind: "model_answer" | "student_answer" | "evaluated_pdf" | "markcard";
  fileName: string;
  contentType: string;
  objectPath: string;
  subjectId: number | null;
  studentId: number | null;
  createdAt: string;
}

export interface StudentEvaluation {
  id: number;
  result: {
    examTitle?: string;
    overallScore?: number;
    percentage?: number;
    grade?: string;
    summary?: string;
  };
  finalScore: number | null;
  maxScore: number;
  status: "ai_draft" | "final";
  createdAt: string;
  subject: Pick<Subject, "id" | "name" | "code">;
}

export interface StudentImportResult {
  imported: Array<{
    rowNumber: number;
    fullName: string;
    admissionNumber: string;
    email: string;
    semester: number;
    branch: Branch;
    clerkUserId: string;
  }>;
  errors: Array<{
    rowNumber: number;
    email: string;
    admissionNumber: string;
    error: string;
  }>;
  credentialRows: Array<{
    "Full name": string;
    USN: string;
    Email: string;
    Semester: number;
    Branch: Branch;
    Password: string;
  }>;
  downloads: {
    excel: { fileName: string; contentType: string; base64: string };
    pdf: { fileName: string; contentType: string; base64: string };
  };
}

export interface ManualStudentResult {
  student: Student;
  credential: {
    "Full name": string;
    USN: string;
    Email: string;
    Semester: number;
    Branch: Branch;
    Password: string;
  };
}

export interface HodCredentialResult {
  profile: Profile;
  credential: {
    fullName: string;
    email: string;
    branch: Branch;
    password: string;
  };
}

export interface SaveDocumentInput {
  kind: "model_answer" | "student_answer";
  fileName: string;
  contentType: string;
  objectPath: string;
  subjectId?: number;
  studentId?: number;
}

type AuthTokenGetter = () => Promise<string | null> | string | null;
const apiOrigin = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
export const apiBaseUrl = apiOrigin ? `${apiOrigin}/api` : "/api";
let authTokenGetter: AuthTokenGetter | null = null;

export function setPortalAuthTokenGetter(getter: AuthTokenGetter | null) {
  authTokenGetter = getter;
}

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authTokenGetter ? await authTokenGetter() : null;
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const portalApi = {
  me: () => request<MeResponse>("/me"),
  setRole: (role: Role, identity?: { displayName?: string; email?: string }) =>
    request<Profile>("/me/role", {
      method: "POST",
      body: JSON.stringify({ role, ...identity }),
    }),
  subjects: () => request<Subject[]>("/subjects"),
  adminSubjects: () => request<Subject[]>("/admin/subjects"),
  addSubject: (body: { name: string; code: string; description?: string }) =>
    request<Subject>("/admin/subjects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminStudents: () => request<Student[]>("/admin/students"),
  addStudent: (body: { fullName: string; admissionNumber: string; email: string; semester: number; branch: Branch }) =>
    request<ManualStudentResult>("/admin/students", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addHod: (body: { fullName: string; email: string; branch: Branch }) =>
    request<HodCredentialResult>("/admin/hods", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  importStudents: (body: { fileName: string; fileBase64: string }) =>
    request<StudentImportResult>("/admin/students/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  teacherRegistrations: () => request<Registration[]>("/teacher/registrations"),
  registerTeacher: (subjectId: number) =>
    request<Registration>("/teacher/registrations", {
      method: "POST",
      body: JSON.stringify({ subjectId }),
    }),
  teacherStudents: () => request<Student[]>("/teacher/students"),
  teacherDocuments: () => request<DocumentRecord[]>("/teacher/documents"),
  teacherStudentSheets: () =>
    request<
      Array<{
        id: number;
        fileName: string;
        objectPath: string;
        createdAt: string;
        subject: Pick<Subject, "id" | "name" | "code">;
        student: Pick<Student, "id" | "fullName" | "admissionNumber">;
      }>
    >("/teacher/student-sheets"),
  teacherEvaluations: () =>
    request<
      Array<{
        id: number;
        result: { examTitle?: string; summary?: string };
        aiScore: number;
        maxScore: number;
        finalScore: number | null;
        status: "ai_draft" | "final";
        createdAt: string;
        evaluatedPdfDocumentId: number | null;
        subject: Pick<Subject, "id" | "name" | "code">;
        student: Pick<Student, "id" | "fullName" | "admissionNumber">;
      }>
    >("/teacher/evaluations"),
  adminRegistrations: () =>
    request<
      Array<{
        id: number;
        teacherClerkUserId: string;
        status: Registration["status"];
        subject: Pick<Subject, "id" | "name" | "code">;
      }>
    >("/admin/teacher-registrations"),
  reviewRegistration: (id: number, status: "approved" | "rejected") =>
    request<Registration>(`/admin/teacher-registrations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  saveDocument: (body: SaveDocumentInput) =>
    request<DocumentRecord>("/documents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  studentEvaluations: () => request<StudentEvaluation[]>("/student/evaluations"),
  hodStudents: () => request<{ branch: Branch; students: Student[] }>("/hod/students"),
  finalizeEvaluation: (id: number, finalScore: number) =>
    request<{ id: number; finalScore: number; status: "final" }>(`/teacher/evaluations/${id}/finalize`, {
      method: "PATCH",
      body: JSON.stringify({ finalScore }),
    }),
  createManualEvaluation: (body: {
    subjectId: number;
    studentId: number;
    answerSheetDocumentId: number;
    modelAnswerDocumentId?: number;
    examTitle: string;
    maxScore: number;
    finalScore: number;
    summary: string;
  }) =>
    request<{ id: number; finalScore: number; status: "final" }>("/teacher/evaluations/manual", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadDocument: async (file: File, metadata: Omit<SaveDocumentInput, "fileName" | "contentType" | "objectPath">) => {
    const upload = await request<{ uploadURL: string; objectPath: string }>("/storage/uploads/request-url", {
      method: "POST",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    const put = await fetch(apiOrigin ? `${apiOrigin}${upload.uploadURL}` : upload.uploadURL, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": file.type,
        ...(authTokenGetter && (await authTokenGetter()) ? { Authorization: `Bearer ${await authTokenGetter()}` } : {}),
      },
      body: file,
    });
    if (!put.ok) throw new Error("The document could not be uploaded to storage.");
    return portalApi.saveDocument({
      ...metadata,
      fileName: file.name,
      contentType: file.type,
      objectPath: upload.objectPath,
    });
  },
};