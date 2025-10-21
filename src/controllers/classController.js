// src/controllers/classController.js
const prisma = require("../utils/prisma");
const { validationResult } = require("express-validator");

/**
 * Get all classes with pagination and filtering
 * @route GET /api/classes
 */
exports.getAllClasses = async (req, res) => {
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

    // Get classes with pagination
    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          _count: {
            select: {
              students: true,
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
      prisma.class.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      classes,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get all classes error:", error);
    return res.status(500).json({
      message: "Error retrieving classes",
      error: error.message,
    });
  }
};

/**
 * Get class by ID
 * @route GET /api/classes/:id
 */
exports.getClassById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get class
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          orderBy: {
            name: "asc",
          },
        },
        schedules: {
          include: {
            subject: true,
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

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    return res.status(200).json({ class: classData });
  } catch (error) {
    console.error("Get class by ID error:", error);
    return res.status(500).json({
      message: "Error retrieving class",
      error: error.message,
    });
  }
};

/**
 * Get schedule for a specific class
 * @route GET /api/classes/:id/schedule
 */
exports.getClassSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { day } = req.query;

    // Check if class exists
    const classData = await prisma.class.findUnique({
      where: { id },
    });

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Build where clause
    const where = { classId: id };

    // Add day filter if provided
    if (day) {
      where.day = day;
    }

    // Get schedule
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });

    // Group schedules by day if no specific day was requested
    if (!day) {
      const scheduleByDay = {};

      for (const schedule of schedules) {
        if (!scheduleByDay[schedule.day]) {
          scheduleByDay[schedule.day] = [];
        }
        scheduleByDay[schedule.day].push(schedule);
      }

      return res.status(200).json({
        className: classData.name,
        schedule: scheduleByDay,
      });
    }

    return res.status(200).json({
      className: classData.name,
      schedule: schedules,
    });
  } catch (error) {
    console.error("Get class schedule error:", error);
    return res.status(500).json({
      message: "Error retrieving class schedule",
      error: error.message,
    });
  }
};

/**
 * Get students in a class
 * @route GET /api/classes/:id/students
 */
exports.getClassStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nis, gender } = req.query;

    // Check if class exists
    const classData = await prisma.class.findUnique({
      where: { id },
    });

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Build where clause
    const where = { classId: id };

    // Add filters if provided
    if (name) where.name = { contains: name, mode: "insensitive" };
    if (nis) where.nis = { contains: nis };
    if (gender) where.gender = gender;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get students
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          name: "asc",
        },
      }),
      prisma.student.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      className: classData.name,
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get class students error:", error);
    return res.status(500).json({
      message: "Error retrieving class students",
      error: error.message,
    });
  }
};

/**
 * Create a new class
 * @route POST /api/classes
 */
exports.createClass = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;

    // Check for duplicate class name
    const existingClass = await prisma.class.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existingClass) {
      return res
        .status(400)
        .json({ message: "Class with this name already exists" });
    }

    // Create class
    const newClass = await prisma.class.create({
      data: {
        name,
      },
    });

    return res.status(201).json({
      message: "Class created successfully",
      class: newClass,
    });
  } catch (error) {
    console.error("Create class error:", error);
    return res.status(500).json({
      message: "Error creating class",
      error: error.message,
    });
  }
};

/**
 * Update a class
 * @route PUT /api/classes/:id
 */
exports.updateClass = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name } = req.body;

    // Check if class exists
    const classData = await prisma.class.findUnique({
      where: { id },
    });

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Check for duplicate class name
    if (name) {
      const existingClass = await prisma.class.findFirst({
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

      if (existingClass) {
        return res
          .status(400)
          .json({ message: "Class with this name already exists" });
      }
    }

    // Update class
    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
        name,
      },
    });

    return res.status(200).json({
      message: "Class updated successfully",
      class: updatedClass,
    });
  } catch (error) {
    console.error("Update class error:", error);
    return res.status(500).json({
      message: "Error updating class",
      error: error.message,
    });
  }
};

/**
 * Delete a class
 * @route DELETE /api/classes/:id
 */
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            schedules: true,
          },
        },
      },
    });

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Check if class has students or schedules
    if (classData._count.students > 0) {
      return res.status(400).json({
        message:
          "Cannot delete class with students. Please transfer or remove students first.",
        studentCount: classData._count.students,
      });
    }

    if (classData._count.schedules > 0) {
      return res.status(400).json({
        message:
          "Cannot delete class with schedules. Please remove schedules first.",
        scheduleCount: classData._count.schedules,
      });
    }

    // Delete class
    await prisma.class.delete({
      where: { id },
    });

    return res.status(200).json({
      message: "Class deleted successfully",
    });
  } catch (error) {
    console.error("Delete class error:", error);
    return res.status(500).json({
      message: "Error deleting class",
      error: error.message,
    });
  }
};
