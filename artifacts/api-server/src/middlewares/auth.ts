import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, profilesTable, teacherRegistrationsTable } from "@workspace/db";

export type AuthenticatedRequest = Request & { clerkUserId: string };

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const claimedUserId = auth.sessionClaims?.userId;
  const userId =
    auth.userId ||
    (typeof claimedUserId === "string" ? claimedUserId : undefined);
  if (!userId) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }
  (req as AuthenticatedRequest).clerkUserId = userId;
  next();
}

export async function getProfile(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile ?? null;
}

export async function requireRole(
  req: Request,
  res: Response,
  role: "admin" | "teacher" | "student" | "hod",
): Promise<boolean> {
  const profile = await getProfile((req as AuthenticatedRequest).clerkUserId);
  if (!profile || profile.role !== role) {
    res.status(403).json({ error: `Only ${role}s can access this resource.` });
    return false;
  }
  return true;
}

export async function hasApprovedSubject(
  clerkUserId: string,
  subjectId: number,
): Promise<boolean> {
  const [registration] = await db
    .select({ id: teacherRegistrationsTable.id })
    .from(teacherRegistrationsTable)
    .where(
      and(
        eq(teacherRegistrationsTable.teacherClerkUserId, clerkUserId),
        eq(teacherRegistrationsTable.subjectId, subjectId),
        eq(teacherRegistrationsTable.status, "approved"),
      ),
    )
    .limit(1);
  return Boolean(registration);
}