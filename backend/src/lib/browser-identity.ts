import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const BROWSER_IDENTITY_COOKIE = "studentBrowser";
export const BROWSER_IDENTITY_TTL_SECONDS = 60 * 60 * 24 * 180;

function hashBrowserToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function findBrowserIdentity(req: NextRequest) {
  const token = req.cookies.get(BROWSER_IDENTITY_COOKIE)?.value;
  if (!token) return null;

  const identity = await prisma.browserIdentity.findUnique({
    where: { tokenHash: hashBrowserToken(token) },
    select: { id: true, expiresAt: true },
  });

  if (!identity || identity.expiresAt.getTime() <= Date.now()) return null;
  return identity;
}

export async function associateStudentWithBrowser(
  req: NextRequest,
  studentId: string,
  response: NextResponse
): Promise<void> {
  const existingIdentity = await findBrowserIdentity(req);
  if (existingIdentity) {
    await prisma.browserStudent.upsert({
      where: { browserId_studentId: { browserId: existingIdentity.id, studentId } },
      create: { browserId: existingIdentity.id, studentId },
      update: {},
    });
    return;
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + BROWSER_IDENTITY_TTL_SECONDS * 1000);
  await prisma.$transaction(async (tx) => {
    const identity = await tx.browserIdentity.create({
      data: { tokenHash: hashBrowserToken(token), expiresAt },
    });
    await tx.browserStudent.create({
      data: { browserId: identity.id, studentId },
    });
  });

  response.cookies.set(BROWSER_IDENTITY_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: BROWSER_IDENTITY_TTL_SECONDS,
  });
}
