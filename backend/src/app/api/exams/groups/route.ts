import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const searchParams = req.nextUrl.searchParams;
    const gradeLevelId = searchParams.get("gradeLevelId") || undefined;
    const academicYear = searchParams.get("academicYear") || undefined;
    const semester = (searchParams.get("semester") as "ganjil" | "genap") || undefined;
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search")?.trim() || undefined;

    const where: Prisma.ExamWhereInput = {
      ...(academicYear ? { academicYear } : {}),
      ...(semester ? { semester } : {}),
      ...(status ? { status: status as any } : {}),
      ...(category ? { category } : {}),
      ...(gradeLevelId ? {
        OR: [
          { classroom: { gradeLevelId } },
          { subjectFolder: { gradeLevelId } },
        ],
      } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { subjectName: { contains: search, mode: "insensitive" } },
          { className: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };

    const exams = await prisma.exam.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        accessCode: true,
        durationMinutes: true,
        classroomId: true,
        className: true,
        subjectId: true,
        subjectName: true,
        academicYear: true,
        semester: true,
        category: true,
        categoryNumber: true,
        scheduledStartAt: true,
        passingScore: true,
        revision: true,
        createdAt: true,
        classroom: {
          select: {
            id: true,
            name: true,
            gradeLevelId: true,
            gradeLevel: { select: { id: true, name: true } },
          },
        },
        subjectFolder: {
          select: {
            id: true,
            name: true,
            gradeLevelId: true,
            gradeLevel: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { questions: true, students: true },
        },
      },
    });

    // Grouping structure: Classroom -> Subjects -> Exams
    type SubjectGroup = {
      subjectId: string | null;
      subjectName: string;
      gradeLevelName: string | null;
      totalExams: number;
      activeExams: number;
      exams: typeof exams;
    };

    type ClassroomGroup = {
      classroomId: string | null;
      className: string;
      gradeLevelId: string | null;
      gradeLevelName: string | null;
      totalExams: number;
      activeExams: number;
      subjects: SubjectGroup[];
    };

    const classroomMap = new Map<string, ClassroomGroup>();
    const unmappedClassroomKey = "__unmapped__";

    for (const exam of exams) {
      const cId = exam.classroomId || unmappedClassroomKey;
      let cGroup = classroomMap.get(cId);
      if (!cGroup) {
        cGroup = {
          classroomId: exam.classroomId,
          className: exam.classroom?.name || exam.className || "Perlu Dipetakan",
          gradeLevelId: exam.classroom?.gradeLevelId || null,
          gradeLevelName: exam.classroom?.gradeLevel?.name || null,
          totalExams: 0,
          activeExams: 0,
          subjects: [],
        };
        classroomMap.set(cId, cGroup);
      }

      cGroup.totalExams++;
      if (exam.status === "active") cGroup.activeExams++;

      const sId = exam.subjectId || "__unmapped_subject__";
      let sGroup = cGroup.subjects.find((s) => s.subjectId === (exam.subjectId || null));
      if (!sGroup) {
        sGroup = {
          subjectId: exam.subjectId,
          subjectName: exam.subjectFolder?.name || exam.subjectName || "Perlu Dipetakan",
          gradeLevelName: exam.subjectFolder?.gradeLevel?.name || exam.classroom?.gradeLevel?.name || null,
          totalExams: 0,
          activeExams: 0,
          exams: [],
        };
        cGroup.subjects.push(sGroup);
      }

      sGroup.totalExams++;
      if (exam.status === "active") sGroup.activeExams++;
      sGroup.exams.push(exam);
    }

    const groups = Array.from(classroomMap.values());

    return successResponse({
      totalExams: exams.length,
      groups,
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil kelompok ujian"), 500);
  }
}

