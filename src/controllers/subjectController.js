// src/controllers/subjectController.js
const prisma = require("../utils/prisma");
const { validationResult } = require("express-validator");

/**
 * Get all subjects with pagination and filtering
 * @route GET /api/subjects
 */
exports.getAllSubjects = async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { name } = req.query;

    // Build where clause for filtering
    const where = {};
    if (name) where.name = { contains: name, mode: "insensitive" };

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get subjects with pagination
    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        include: {
          _count: {
            select: {
              teachers: true,
              schedules: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          name: "asc",
        },
      }),
      prisma.subject.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      subjects,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get all subjects error:", error);
    return res.status(500).json({
      message: "Error retrieving subjects",
      error: error.message,
    });
  }
};

/**
 * Get subject by ID
 * @route GET /api/subjects/:id
 */
exports.getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get subject
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        teachers: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        schedules: {
          include: {
            class: true,
            teacher: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        },
      },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    return res.status(200).json({ subject });
  } catch (error) {
    console.error("Get subject by ID error:", error);
    return res.status(500).json({
      message: "Error retrieving subject",
      error: error.message,
    });
  }
};

/**
 * Get teachers assigned to a subject
 * @route GET /api/subjects/:id/teachers
 */
exports.getSubjectTeachers = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    // Get teachers assigned to this subject
    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: {
        subjectId: id,
      },
      include: {
        teacher: true,
      },
    });

    const teachers = teacherSubjects.map((ts) => ts.teacher);

    return res.status(200).json({
      subject: subject.name,
      teachers,
    });
  } catch (error) {
    console.error("Get subject teachers error:", error);
    return res.status(500).json({
      message: "Error retrieving subject teachers",
      error: error.message,
    });
  }
};

/**
 * Create a new subject
 * @route POST /api/subjects
 */
exports.createSubject = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;

    // Check for duplicate subject name
    const existingSubject = await prisma.subject.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existingSubject) {
      return res
        .status(400)
        .json({ message: "Subject with this name already exists" });
    }

    // Create subject
    const newSubject = await prisma.subject.create({
      data: {
        name,
      },
    });

    return res.status(201).json({
      message: "Subject created successfully",
      subject: newSubject,
    });
  } catch (error) {
    console.error("Create subject error:", error);
    return res.status(500).json({
      message: "Error creating subject",
      error: error.message,
    });
  }
};

/**
 * Update a subject
 * @route PUT /api/subjects/:id
 */
exports.updateSubject = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name } = req.body;

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    // Check for duplicate subject name
    if (name) {
      const existingSubject = await prisma.subject.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive",
          },
          id: {
            not: id,
          },
        },
      });

      if (existingSubject) {
        return res
          .status(400)
          .json({ message: "Subject with this name already exists" });
      }
    }

    // Update subject
    const updatedSubject = await prisma.subject.update({
      where: { id },
      data: {
        name,
      },
    });

    return res.status(200).json({
      message: "Subject updated successfully",
      subject: updatedSubject,
    });
  } catch (error) {
    console.error("Update subject error:", error);
    return res.status(500).json({
      message: "Error updating subject",
      error: error.message,
    });
  }
};

/**
 * Delete a subject
 * @route DELETE /api/subjects/:id
 */
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            teachers: true,
            schedules: true,
            scores: true,
          },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    // Check if subject has related records
    if (subject._count.teachers > 0) {
      return res.status(400).json({
        message:
          "Cannot delete subject with assigned teachers. Please remove teacher assignments first.",
        teacherCount: subject._count.teachers,
      });
    }

    if (subject._count.schedules > 0) {
      return res.status(400).json({
        message:
          "Cannot delete subject with schedules. Please remove schedules first.",
        scheduleCount: subject._count.schedules,
      });
    }

    if (subject._count.scores > 0) {
      return res.status(400).json({
        message:
          "Cannot delete subject with scores. Please remove scores first.",
        scoreCount: subject._count.scores,
      });
    }

    // Delete subject
    await prisma.subject.delete({
      where: { id },
    });

    return res.status(200).json({
      message: "Subject deleted successfully",
    });
  } catch (error) {
    console.error("Delete subject error:", error);
    return res.status(500).json({
      message: "Error deleting subject",
      error: error.message,
    });
  }
};

/**
 * Assign teacher to subject
 * @route POST /api/subjects/:id/assign-teacher
 */
exports.assignTeacher = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { teacherId } = req.body;

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.teacherSubject.findFirst({
      where: {
        teacherId,
        subjectId: id,
      },
    });

    if (existingAssignment) {
      return res
        .status(400)
        .json({ message: "Teacher is already assigned to this subject" });
    }

    // Create assignment
    const assignment = await prisma.teacherSubject.create({
      data: {
        teacherId,
        subjectId: id,
      },
      include: {
        teacher: true,
        subject: true,
      },
    });

    return res.status(201).json({
      message: "Teacher assigned to subject successfully",
      assignment,
    });
  } catch (error) {
    console.error("Assign teacher error:", error);
    return res.status(500).json({
      message: "Error assigning teacher to subject",
      error: error.message,
    });
  }
};

/**
 * Remove teacher from subject
 * @route DELETE /api/subjects/:id/remove-teacher/:teacherId
 */
exports.removeTeacher = async (req, res) => {
  try {
    const { id, teacherId } = req.params;

    // Check if assignment exists
    const assignment = await prisma.teacherSubject.findFirst({
      where: {
        teacherId,
        subjectId: id,
      },
      include: {
        teacher: true,
        subject: true,
      },
    });

    if (!assignment) {
      return res
        .status(404)
        .json({ message: "Teacher is not assigned to this subject" });
    }

    // Check if teacher has schedules with this subject
    const schedules = await prisma.schedule.findMany({
      where: {
        teacherId,
        subjectId: id,
      },
    });

    if (schedules.length > 0) {
      return res.status(400).json({
        message:
          "Cannot remove teacher with active schedules for this subject. Please remove schedules first.",
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
      message: "Teacher removed from subject successfully",
      teacher: assignment.teacher.name,
      subject: assignment.subject.name,
    });
  } catch (error) {
    console.error("Remove teacher error:", error);
    return res.status(500).json({
      message: "Error removing teacher from subject",
      error: error.message,
    });
  }
};
