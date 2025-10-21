// src/controllers/teacherController.js
const prisma = require("../utils/prisma");
const { validationResult } = require("express-validator");

/**
 * Get all teachers with pagination and filtering
 * @route GET /api/teachers
 */
exports.getAllTeachers = async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { name, gender } = req.query;

    // Build where clause for filtering
    const where = {};
    if (name) where.name = { contains: name, mode: "insensitive" };
    if (gender) where.gender = gender;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get teachers with pagination
    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              createdAt: true,
            },
          },
          subjects: {
            include: {
              subject: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          name: "asc",
        },
      }),
      prisma.teacher.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      teachers,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get all teachers error:", error);
    return res.status(500).json({
      message: "Error retrieving teachers",
      error: error.message,
    });
  }
};

/**
 * Get teacher by ID
 * @route GET /api/teachers/:id
 */
exports.getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get teacher
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
        subjects: {
          include: {
            subject: true,
          },
        },
        schedules: {
          include: {
            subject: true,
            class: true,
          },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        },
      },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    return res.status(200).json({ teacher });
  } catch (error) {
    console.error("Get teacher by ID error:", error);
    return res.status(500).json({
      message: "Error retrieving teacher",
      error: error.message,
    });
  }
};

/**
 * Get teacher's schedule/timetable
 * @route GET /api/teachers/:id/schedule
 */
exports.getTeacherSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { day, classId } = req.query;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Build where clause
    const where = { teacherId: id };

    // Add day filter if provided
    if (day) {
      where.day = day;
    }

    // Add class filter if provided
    if (classId) {
      where.classId = classId;
    }

    // Get schedule
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        subject: true,
        class: true,
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
        teacherName: teacher.name,
        schedule: scheduleByDay,
      });
    }

    return res.status(200).json({
      teacherName: teacher.name,
      schedule: schedules,
    });
  } catch (error) {
    console.error("Get teacher schedule error:", error);
    return res.status(500).json({
      message: "Error retrieving teacher schedule",
      error: error.message,
    });
  }
};

/**
 * Create attendance session
 * @route POST /api/teachers/:id/attendance-sessions
 */
exports.createAttendanceSession = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { scheduleId, durationMinutes = 30 } = req.body;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if schedule exists and belongs to the teacher
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        teacherId: id,
      },
      include: {
        subject: true,
        class: true,
      },
    });

    if (!schedule) {
      return res.status(404).json({
        message: "Schedule not found or not assigned to this teacher",
      });
    }

    // Generate random token (6 characters)
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Set expiry time based on duration minutes
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000);

    // Create attendance session
    const session = await prisma.attendanceSession.create({
      data: {
        scheduleId,
        date: now,
        token,
        expiresAt,
      },
      include: {
        schedule: {
          include: {
            subject: true,
            class: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Attendance session created successfully",
      session,
    });
  } catch (error) {
    console.error("Create attendance session error:", error);
    return res.status(500).json({
      message: "Error creating attendance session",
      error: error.message,
    });
  }
};

/**
 * Get attendance sessions created by teacher
 * @route GET /api/teachers/:id/attendance-sessions
 */
exports.getAttendanceSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduleId, active, date } = req.query;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Build where clause for sessions
    let whereSchedule = { teacherId: id };
    if (scheduleId) {
      whereSchedule.id = scheduleId;
    }

    let whereSession = {};
    // Filter for active sessions only
    if (active === "true") {
      whereSession.expiresAt = { gt: new Date() };
    }

    // Filter by date
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      whereSession.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get sessions with pagination
    const [sessions, total] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: {
          ...whereSession,
          schedule: whereSchedule,
        },
        include: {
          schedule: {
            include: {
              subject: true,
              class: true,
            },
          },
          attendances: {
            select: {
              id: true,
              status: true,
              student: {
                select: {
                  id: true,
                  name: true,
                  nis: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          date: "desc",
        },
      }),
      prisma.attendanceSession.count({
        where: {
          ...whereSession,
          schedule: whereSchedule,
        },
      }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      sessions,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get attendance sessions error:", error);
    return res.status(500).json({
      message: "Error retrieving attendance sessions",
      error: error.message,
    });
  }
};

/**
 * Manage attendance records (add/update)
 * @route PUT /api/teachers/:id/attendance/:attendanceId
 */
exports.manageAttendance = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id, attendanceId } = req.params;
    const { status } = req.body;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if attendance exists and schedule belongs to teacher
    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        schedule: {
          teacherId: id,
        },
      },
      include: {
        schedule: true,
        student: true,
      },
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ message: "Attendance record not found or unauthorized" });
    }

    // Update attendance status
    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { status },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
          },
        },
        schedule: {
          include: {
            subject: true,
            class: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Attendance status updated successfully",
      attendance: updatedAttendance,
    });
  } catch (error) {
    console.error("Manage attendance error:", error);
    return res.status(500).json({
      message: "Error updating attendance status",
      error: error.message,
    });
  }
};

/**
 * Add attendance record manually (for absent students)
 * @route POST /api/teachers/:id/manual-attendance
 */
exports.addManualAttendance = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { sessionId, studentId, status } = req.body;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if session exists and belongs to teacher's schedule
    const session = await prisma.attendanceSession.findFirst({
      where: {
        id: sessionId,
        schedule: {
          teacherId: id,
        },
      },
      include: {
        schedule: true,
      },
    });

    if (!session) {
      return res
        .status(404)
        .json({ message: "Session not found or unauthorized" });
    }

    // Check if student exists and belongs to the class
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        classId: session.schedule.classId,
      },
    });

    if (!student) {
      return res
        .status(404)
        .json({ message: "Student not found or not in this class" });
    }

    // Check if student already has attendance for this session
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        sessionId,
        studentId,
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: "Student already has attendance for this session",
        existingAttendance,
      });
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        studentId,
        sessionId,
        scheduleId: session.scheduleId,
        status,
        date: new Date(),
        // No scannedAt since this is manual entry
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
          },
        },
        schedule: {
          include: {
            subject: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Attendance record added successfully",
      attendance,
    });
  } catch (error) {
    console.error("Add manual attendance error:", error);
    return res.status(500).json({
      message: "Error adding attendance record",
      error: error.message,
    });
  }
};

/**
 * Add score for student
 * @route POST /api/teachers/:id/scores
 */
exports.addScore = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { studentId, subjectId, type, value, description } = req.body;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if subject exists and is taught by this teacher
    const teacherSubject = await prisma.teacherSubject.findFirst({
      where: {
        teacherId: id,
        subjectId,
      },
    });

    if (!teacherSubject) {
      return res
        .status(403)
        .json({ message: "You are not assigned to teach this subject" });
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Create score record with optional description
    const score = await prisma.score.create({
      data: {
        studentId,
        subjectId,
        type,
        value: parseFloat(value),
        description: description || null, // Handle optional description
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
          },
        },
        subject: true,
      },
    });

    return res.status(201).json({
      message: "Score added successfully",
      score,
    });
  } catch (error) {
    console.error("Add score error:", error);
    return res.status(500).json({
      message: "Error adding score",
      error: error.message,
    });
  }
};

/**
 * Update student score
 * @route PUT /api/teachers/:id/scores/:scoreId
 */
exports.updateScore = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id, scoreId } = req.params;
    const { value, type, description } = req.body;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if score exists
    const score = await prisma.score.findUnique({
      where: { id: scoreId },
      include: {
        subject: true,
      },
    });

    if (!score) {
      return res.status(404).json({ message: "Score not found" });
    }

    // Check if teacher teaches this subject
    const teacherSubject = await prisma.teacherSubject.findFirst({
      where: {
        teacherId: id,
        subjectId: score.subjectId,
      },
    });

    if (!teacherSubject) {
      return res
        .status(403)
        .json({ message: "You are not assigned to teach this subject" });
    }

    // Update data object with all optional fields
    const data = {};
    if (value !== undefined) data.value = parseFloat(value);
    if (type !== undefined) data.type = type;
    if (description !== undefined) data.description = description || null; // Handle optional description

    // Update score
    const updatedScore = await prisma.score.update({
      where: { id: scoreId },
      data,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
          },
        },
        subject: true,
      },
    });

    return res.status(200).json({
      message: "Score updated successfully",
      score: updatedScore,
    });
  } catch (error) {
    console.error("Update score error:", error);
    return res.status(500).json({
      message: "Error updating score",
      error: error.message,
    });
  }
};

/**
 * Get students by class for a teacher
 * @route GET /api/teachers/:id/class-students/:classId
 */
exports.getClassStudents = async (req, res) => {
  try {
    const { id, classId } = req.params;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if class exists and teacher has a schedule with this class
    const hasClassSchedule = await prisma.schedule.findFirst({
      where: {
        teacherId: id,
        classId,
      },
    });

    if (!hasClassSchedule) {
      return res
        .status(403)
        .json({ message: "You don't have a schedule with this class" });
    }

    // Get students in the class
    const students = await prisma.student.findMany({
      where: {
        classId,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({ students });
  } catch (error) {
    console.error("Get class students error:", error);
    return res.status(500).json({
      message: "Error retrieving students",
      error: error.message,
    });
  }
};

/**
 * Get student scores for a specific subject
 * @route GET /api/teachers/:id/student-scores/:studentId
 */
exports.getStudentScores = async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { subjectId } = req.query;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Build where clause for scores
    const where = { studentId };

    // If subject ID is provided, filter by subject
    if (subjectId) {
      where.subjectId = subjectId;

      // Check if teacher teaches this subject
      const teacherSubject = await prisma.teacherSubject.findFirst({
        where: {
          teacherId: id,
          subjectId,
        },
      });

      if (!teacherSubject) {
        return res
          .status(403)
          .json({ message: "You are not assigned to teach this subject" });
      }
    } else {
      // If no subject ID provided, get scores for all subjects taught by this teacher
      const teacherSubjects = await prisma.teacherSubject.findMany({
        where: {
          teacherId: id,
        },
        select: {
          subjectId: true,
        },
      });

      where.subjectId = {
        in: teacherSubjects.map((ts) => ts.subjectId),
      };
    }

    // Get scores
    const scores = await prisma.score.findMany({
      where,
      include: {
        subject: true,
      },
      orderBy: [{ subjectId: "asc" }, { type: "asc" }, { createdAt: "desc" }],
    });

    return res.status(200).json({
      student: {
        id: student.id,
        name: student.name,
        nis: student.nis,
      },
      scores,
    });
  } catch (error) {
    console.error("Get student scores error:", error);
    return res.status(500).json({
      message: "Error retrieving student scores",
      error: error.message,
    });
  }
};

/**
 * Get class scores for a specific subject
 * @route GET /api/teachers/:id/class-scores/:classId
 */
exports.getClassScores = async (req, res) => {
  try {
    const { id, classId } = req.params;
    const { subjectId, type } = req.query;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Require subject ID for class scores
    if (!subjectId) {
      return res.status(400).json({ message: "Subject ID is required" });
    }

    // Check if teacher teaches this subject
    const teacherSubject = await prisma.teacherSubject.findFirst({
      where: {
        teacherId: id,
        subjectId,
      },
    });

    if (!teacherSubject) {
      return res
        .status(403)
        .json({ message: "You are not assigned to teach this subject" });
    }

    // Get all students in the class
    const students = await prisma.student.findMany({
      where: {
        classId,
      },
      select: {
        id: true,
        name: true,
        nis: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Build where clause for scores
    const where = {
      studentId: {
        in: students.map((s) => s.id),
      },
      subjectId,
    };

    // Filter by score type if provided
    if (type) {
      where.type = type;
    }

    // Get scores
    const scores = await prisma.score.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
          },
        },
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });

    // Group scores by student and type for easier consumption
    const studentScores = {};

    // Initialize with all students (even those without scores)
    students.forEach((student) => {
      studentScores[student.id] = {
        student,
        scores: {},
      };
    });

    // Add scores to the respective students
    scores.forEach((score) => {
      if (!studentScores[score.studentId].scores[score.type]) {
        studentScores[score.studentId].scores[score.type] = [];
      }

      studentScores[score.studentId].scores[score.type].push({
        id: score.id,
        value: score.value,
        description: score.description,
        createdAt: score.createdAt,
      });
    });

    return res.status(200).json({
      class: classData,
      subject: {
        id: subjectId,
      },
      studentScores: Object.values(studentScores),
    });
  } catch (error) {
    console.error("Get class scores error:", error);
    return res.status(500).json({
      message: "Error retrieving class scores",
      error: error.message,
    });
  }
};
