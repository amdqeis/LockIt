import assert from "node:assert/strict";
import test from "node:test";
import { POST as loginHandler } from "./route";
import { POST as refreshHandler } from "../refresh/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateRefreshTokenString, hashRefreshToken } from "@/lib/auth";

test("POST /api/auth/login with rememberMe: true sets 30-day persistent cookies", async () => {
  const email = `guru-remember-${Date.now()}@test.eduquas.local`;
  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  const teacher = await prisma.teacher.create({
    data: {
      email,
      fullName: "Guru Ingat Saya",
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  try {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe: true }),
    });

    const res = await loginHandler(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.teacher.email, email);

    const refreshCookie = res.cookies.get("refreshToken");
    assert.ok(refreshCookie);
    assert.ok(refreshCookie.expires, "refreshToken cookie should have expires when rememberMe is true");

    const sessionCookie = res.cookies.get("hasTeacherSession");
    assert.ok(sessionCookie);
    assert.equal(sessionCookie.value, "1");
    assert.ok(sessionCookie.expires, "hasTeacherSession cookie should have expires when rememberMe is true");

    // Expiry should be roughly 30 days ahead (+- 5 minutes tolerance)
    const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const cookieTime = new Date(sessionCookie.expires!).getTime();
    assert.ok(Math.abs(cookieTime - expectedExpiry) < 5 * 60 * 1000);
  } finally {
    await prisma.teacher.delete({ where: { id: teacher.id } }).catch(() => {});
  }
});

test("POST /api/auth/login with rememberMe: false sets session cookies without expires", async () => {
  const email = `guru-session-${Date.now()}@test.eduquas.local`;
  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  const teacher = await prisma.teacher.create({
    data: {
      email,
      fullName: "Guru Sesi Biasa",
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  try {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe: false }),
    });

    const res = await loginHandler(req);
    assert.equal(res.status, 200);

    const refreshCookie = res.cookies.get("refreshToken");
    assert.ok(refreshCookie);
    assert.equal(refreshCookie.expires, undefined, "refreshToken should be a session cookie without expires when rememberMe is false");

    const sessionCookie = res.cookies.get("hasTeacherSession");
    assert.ok(sessionCookie);
    assert.equal(sessionCookie.value, "1");
    assert.equal(sessionCookie.expires, undefined, "hasTeacherSession should be a session cookie without expires when rememberMe is false");
  } finally {
    await prisma.teacher.delete({ where: { id: teacher.id } }).catch(() => {});
  }
});

test("POST /api/auth/refresh preserves rememberMe lifetime on token rotation", async () => {
  const email = `guru-refresh-${Date.now()}@test.eduquas.local`;
  const password = "Password123!";
  const passwordHash = await hashPassword(password);

  const teacher = await prisma.teacher.create({
    data: {
      email,
      fullName: "Guru Refresh",
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  try {
    // 1. Long-lived token (rememberMe)
    const longTokenString = generateRefreshTokenString();
    const longTokenHash = hashRefreshToken(longTokenString);
    await prisma.refreshToken.create({
      data: {
        teacherId: teacher.id,
        tokenHash: longTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const longReq = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: `refreshToken=${longTokenString}`,
      },
    });

    const longRes = await refreshHandler(longReq);
    assert.equal(longRes.status, 200);
    const longRefreshCookie = longRes.cookies.get("refreshToken");
    assert.ok(longRefreshCookie?.expires, "Rotated long-lived token should maintain persistent cookie expires");

    // 2. Short-lived token (session)
    const shortTokenString = generateRefreshTokenString();
    const shortTokenHash = hashRefreshToken(shortTokenString);
    await prisma.refreshToken.create({
      data: {
        teacherId: teacher.id,
        tokenHash: shortTokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const shortReq = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: `refreshToken=${shortTokenString}`,
      },
    });

    const shortRes = await refreshHandler(shortReq);
    assert.equal(shortRes.status, 200);
    const shortRefreshCookie = shortRes.cookies.get("refreshToken");
    assert.equal(shortRefreshCookie?.expires, undefined, "Rotated session token should remain session cookie without expires");
  } finally {
    await prisma.teacher.delete({ where: { id: teacher.id } }).catch(() => {});
  }
});

test.after(async () => {
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 100).unref();
});
