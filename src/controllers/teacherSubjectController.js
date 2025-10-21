// src/controllers/teacherSubjectController.js
const prisma = require("../utils/prisma");
const { validationResult } = require("express-validator");

/**
 * Get all subjects assigned to a teacher
 * @route GET /api/teachers/:teacherId/subjects
 */
exports.getTeacherSubjects = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Get subjects assigned to this teacher
    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: {
        teacherId,
      },
      include: {
        subject: true,
      },
    });

    const subjects = teacherSubjects.map((ts) => ts.subject);

    return res.status(200).json({
      teacher: teacher.name,
      subjects,
    });
  } catch (error) {
    console.error("Get teacher subjects error:", error);
    return res.status(500).json({
      message: "Error retrieving teacher subjects",
      error: error.message,
    });
  }
};

/**
 * Assign multiple subjects to a teacher
 * @route POST /api/teachers/:teacherId/subjects
 */
exports.assignSubjectsToTeacher = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teacherId } = req.params;
    const { subjectIds } = req.body;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if all subjects exist
    const subjects = await prisma.subject.findMany({
      where: {
        id: { in: subjectIds },
      },
    });

    if (subjects.length !== subjectIds.length) {
      return res
        .status(400)
        .json({ message: "One or more subjects not found" });
    }

    // Get existing assignments to avoid duplicates
    const existingAssignments = await prisma.teacherSubject.findMany({
      where: {
        teacherId,
        subjectId: { in: subjectIds },
      },
    });

    const existingSubjectIds = existingAssignments.map((a) => a.subjectId);
    const newSubjectIds = subjectIds.filter(
      (id) => !existingSubjectIds.includes(id)
    );

    // Create new assignments
    const assignments = await Promise.all(
      newSubjectIds.map((subjectId) =>
        prisma.teacherSubject.create({
          data: {
            teacherId,
            subjectId,
          },
          include: {
            subject: true,
          },
        })
      )
    );

    return res.status(201).json({
      message: `${assignments.length} subjects assigned to teacher successfully`,
      assignments,
      skipped: existingSubjectIds.length, // Number of already existing assignments
    });
  } catch (error) {
    console.error("Assign subjects to teacher error:", error);
    return res.status(500).json({
      message: "Error assigning subjects to teacher",
      error: error.message,
    });
  }
};

/**
 * Remove a subject assignment from a teacher
 * @route DELETE /api/teachers/:teacherId/subjects/:subjectId
 */
exports.removeSubjectFromTeacher = async (req, res) => {
  try {
    const { teacherId, subjectId } = req.params;

    // Check if assignment exists
    const assignment = await prisma.teacherSubject.findFirst({
      where: {
        teacherId,
        subjectId,
      },
      include: {
        teacher: true,
        subject: true,
      },
    });

    if (!assignment) {
      return res
        .status(404)
        .json({ message: "Subject is not assigned to this teacher" });
    }

    // Check if teacher has schedules with this subject
    const schedules = await prisma.schedule.findMany({
      where: {
        teacherId,
        subjectId,
      },
    });

    if (schedules.length > 0) {
      return res.status(400).json({
        message:
          "Cannot remove subject with active schedules for this teacher. Please remove schedules first.",
        scheduleCount: schedules.length,
      });
    }

    // Remove assignment
    await prisma.teacherSubject.delete({
      where: {
        id: assignment.id,
      },
    });

    return res.status(200).json({
      message: "Subject removed from teacher successfully",
      teacher: assignment.teacher.name,
      subject: assignment.subject.name,
    });
  } catch (error) {
    console.error("Remove subject from teacher error:", error);
    return res.status(500).json({
      message: "Error removing subject from teacher",
      error: error.message,
    });
  }
};

/**
 * Replace all subject assignments for a teacher
 * @route PUT /api/teachers/:teacherId/subjects
 */
exports.updateTeacherSubjects = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teacherId } = req.params;
    const { subjectIds } = req.body;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if all subjects exist
    const subjects = await prisma.subject.findMany({
      where: {
        id: { in: subjectIds },
      },
    });

    if (subjects.length !== subjectIds.length) {
      return res
        .status(400)
        .json({ message: "One or more subjects not found" });
    }

    // Get existing assignments
    const existingAssignments = await prisma.teacherSubject.findMany({
      where: {
        teacherId,
      },
    });

    // Check if teacher has schedules with subjects that will be removed
    const existingSubjectIds = existingAssignments.map((a) => a.subjectId);
    const subjectsToRemove = existingSubjectIds.filter(
      (id) => !subjectIds.includes(id)
    );

    if (subjectsToRemove.length > 0) {
      const schedulesWithSubjects = await prisma.schedule.findMany({
        where: {
          teacherId,
          subjectId: { in: subjectsToRemove },
        },
      });

      if (schedulesWithSubjects.length > 0) {
        return res.status(400).json({
          message:
            "Cannot remove subjects with active schedules. Please remove schedules first.",
          schedulesCount: schedulesWithSubjects.length,
        });
      }
    }

    // Transaction to update all assignments
    const result = await prisma.$transaction(async (prisma) => {
      // Delete existing assignments
      await prisma.teacherSubject.deleteMany({
        where: {
          teacherId,
        },
      });

      // Create new assignments
      const newAssignments = await Promise.all(
        subjectIds.map((subjectId) =>
          prisma.teacherSubject.create({
            data: {
              teacherId,
              subjectId,
            },
            include: {
              subject: true,
            },
          })
        )
      );

      return newAssignments;
    });

    return res.status(200).json({
      message: "Teacher subject assignments updated successfully",
      assignments: result,
    });
  } catch (error) {
    console.error("Update teacher subjects error:", error);
    return res.status(500).json({
      message: "Error updating teacher subjects",
      error: error.message,
    });
  }
};
