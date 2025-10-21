// src/controllers/studentController.js
const prisma = require("../utils/prisma");
const { validationResult } = require("express-validator");

/**
 * Get all students with pagination and filtering
 * @route GET /api/students
 */
exports.getAllStudents = async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { name, nis, classId, gender } = req.query;

    // Build where clause for filtering
    const where = {};
    if (name) where.name = { contains: name, mode: "insensitive" };
    if (nis) where.nis = { contains: nis };
    if (classId) where.classId = classId;
    if (gender) where.gender = gender;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get students with pagination
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              createdAt: true,
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
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get all students error:", error);
    return res.status(500).json({
      message: "Error retrieving students",
      error: error.message,
    });
  }
};

/**
 * Get student by ID
 * @route GET /api/students/:id
 */
exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    // Get student
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({ student });
  } catch (error) {
    console.error("Get student by ID error:", error);
    return res.status(500).json({
      message: "Error retrieving student",
      error: error.message,
    });
  }
};

/**
 * Get student attendance records
 * @route GET /api/students/:id/attendance
 */
exports.getStudentAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, subjectId, status } = req.query;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Build where clause
    const where = { studentId: id };

    // Add date filters if provided
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // Add status filter if provided
    if (status) {
      where.status = status;
    }

    // Add subject filter if provided
    if (subjectId) {
      where.schedule = {
        subjectId,
      };
    }

    // Get attendance records with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          schedule: {
            include: {
              subject: true,
              teacher: {
                select: {
                  name: true,
                },
              },
              class: {
                select: {
                  name: true,
                },
              },
            },
          },
          session: {
            select: {
              date: true,
              token: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          date: "desc",
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      attendances,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    return res.status(500).json({
      message: "Error retrieving student attendance",
      error: error.message,
    });
  }
};

/**
 * Get student scores
 * @route GET /api/students/:id/scores
 */
exports.getStudentScores = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectId, type } = req.query;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Build where clause
    const where = { studentId: id };

    // Add subject filter if provided
    if (subjectId) {
      where.subjectId = subjectId;
    }

    // Add score type filter if provided
    if (type) {
      where.type = type;
    }

    // Get scores with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [scores, total] = await Promise.all([
      prisma.score.findMany({
        where,
        include: {
          subject: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.score.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      scores,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
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
 * Get student schedule/timetable
 * @route GET /api/students/:id/schedule
 */
exports.getStudentSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { day } = req.query;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Build where clause
    const where = { classId: student.classId };

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
        className: student.class.name,
        schedule: scheduleByDay,
      });
    }

    return res.status(200).json({
      className: student.class.name,
      schedule: schedules,
    });
  } catch (error) {
    console.error("Get student schedule error:", error);
    return res.status(500).json({
      message: "Error retrieving student schedule",
      error: error.message,
    });
  }
};

/**
 * Submit attendance using token
 * @route POST /api/students/:id/submit-attendance
 */
exports.submitAttendance = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { token } = req.body;
    const { user } = req;

    // Verify that the student ID matches the authenticated user
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, classId: true, userId: true, name: true },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Double-check authorization (student can only submit for themselves)
    if (student.userId !== user.id) {
      return res.status(403).json({
        message: "You can only submit attendance for yourself",
      });
    }

    // Verify token and find session
    const session = await prisma.attendanceSession.findUnique({
      where: { token },
      include: {
        schedule: {
          include: {
            subject: true,
            class: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ message: "Invalid attendance token" });
    }

    // Check if token is expired
    if (new Date() > session.expiresAt) {
      return res
        .status(400)
        .json({ message: "Attendance session has expired" });
    }

    // Check if student is in the right class
    if (session.schedule.classId !== student.classId) {
      return res
        .status(403)
        .json({ message: "This attendance session is not for your class" });
    }

    // Check if student has already submitted attendance for this session
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        studentId: id,
        sessionId: session.id,
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: "You have already submitted attendance for this session",
        existingAttendance: {
          status: existingAttendance.status,
          submittedAt: existingAttendance.scannedAt,
        },
      });
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        studentId: id,
        sessionId: session.id,
        scheduleId: session.scheduleId,
        status: "HADIR",
        date: new Date(),
        scannedAt: new Date(),
      },
      include: {
        schedule: {
          include: {
            subject: true,
          },
        },
        session: {
          select: {
            date: true,
            token: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Attendance submitted successfully",
      attendance: {
        id: attendance.id,
        status: attendance.status,
        date: attendance.date,
        scannedAt: attendance.scannedAt,
        subject: attendance.schedule.subject.name,
        sessionDate: attendance.session.date,
      },
    });
  } catch (error) {
    console.error("Submit attendance error:", error);
    return res.status(500).json({
      message: "Error submitting attendance",
      error: error.message,
    });
  }
};

/**
 * Get student dashboard summary
 * @route GET /api/students/:id/dashboard
 */
exports.getStudentDashboard = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: true,
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get current date range (this month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    // Get attendance summary for this month
    const attendanceStats = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        studentId: id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _count: {
        status: true,
      },
    });

    // Transform attendance stats to object
    const attendanceSummary = {
      HADIR: 0,
      IZIN: 0,
      SAKIT: 0,
      ALPHA: 0,
    };

    attendanceStats.forEach((stat) => {
      attendanceSummary[stat.status] = stat._count.status;
    });

    // Get total scheduled sessions this month (not just schedule count)
    const totalScheduledSessions = await prisma.attendanceSession.count({
      where: {
        schedule: {
          classId: student.classId,
        },
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Calculate attendance percentage
    const totalAttendances = Object.values(attendanceSummary).reduce(
      (sum, count) => sum + count,
      0
    );
    const attendancePercentage =
      totalAttendances > 0
        ? Math.round((attendanceSummary.HADIR / totalAttendances) * 100)
        : 0;

    // Get recent scores (last 5)
    const recentScores = await prisma.score.findMany({
      where: {
        studentId: id,
      },
      include: {
        subject: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    // Calculate average score
    const averageScore =
      recentScores.length > 0
        ? Math.round(
            recentScores.reduce((sum, score) => sum + score.value, 0) /
              recentScores.length
          )
        : 0;

    // Get today's schedule
    const today = new Date();
    const weekdays = [
      "MINGGU",
      "SENIN",
      "SELASA",
      "RABU",
      "KAMIS",
      "JUMAT",
      "SABTU",
    ];
    const currentDay = weekdays[today.getDay()];

    const todaySchedule = await prisma.schedule.findMany({
      where: {
        classId: student.classId,
        day: currentDay,
      },
      include: {
        subject: true,
        teacher: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return res.status(200).json({
      student: {
        id: student.id,
        name: student.name,
        nis: student.nis,
        class: student.class,
        email: student.user.email,
      },
      attendanceSummary,
      attendancePercentage,
      totalScheduledSessions,
      averageScore,
      recentScores,
      todaySchedule,
      currentMonth: {
        name: now.toLocaleString("id-ID", { month: "long", year: "numeric" }),
        startDate: startOfMonth,
        endDate: endOfMonth,
      },
    });
  } catch (error) {
    console.error("Get student dashboard error:", error);
    return res.status(500).json({
      message: "Error retrieving student dashboard",
      error: error.message,
    });
  }
};

/**
 * Get student attendance summary/statistics
 * @route GET /api/students/:id/attendance-summary
 */
exports.getStudentAttendanceSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Set default date range if not provided (current semester)
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), 0, 1); // Start of year
    const defaultEndDate = endDate ? new Date(endDate) : new Date();

    // Get attendance summary by status
    const attendanceByStatus = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        studentId: id,
        date: {
          gte: defaultStartDate,
          lte: defaultEndDate,
        },
      },
      _count: {
        status: true,
      },
    });

    // Get all attendance records with subject details for processing
    const subjectAttendance = await prisma.attendance.findMany({
      where: {
        studentId: id,
        date: {
          gte: defaultStartDate,
          lte: defaultEndDate,
        },
      },
      include: {
        schedule: {
          include: {
            subject: true,
          },
        },
      },
    });

    // Process subject attendance statistics manually
    const subjectStats = {};
    subjectAttendance.forEach((attendance) => {
      const subjectId = attendance.schedule.subject.id;
      const subjectName = attendance.schedule.subject.name;

      if (!subjectStats[subjectId]) {
        subjectStats[subjectId] = {
          subjectId,
          subjectName,
          HADIR: 0,
          IZIN: 0,
          SAKIT: 0,
          ALPHA: 0,
          total: 0,
        };
      }

      subjectStats[subjectId][attendance.status]++;
      subjectStats[subjectId].total++;
    });

    // Calculate attendance percentage for each subject
    Object.keys(subjectStats).forEach((subjectId) => {
      const stats = subjectStats[subjectId];
      stats.attendancePercentage =
        stats.total > 0 ? Math.round((stats.HADIR / stats.total) * 100) : 0;
    });

    // Transform status summary to object
    const statusSummary = {
      HADIR: 0,
      IZIN: 0,
      SAKIT: 0,
      ALPHA: 0,
    };

    attendanceByStatus.forEach((stat) => {
      statusSummary[stat.status] = stat._count.status;
    });

    // Calculate overall statistics
    const totalAttendances = Object.values(statusSummary).reduce(
      (sum, count) => sum + count,
      0
    );
    const overallAttendancePercentage =
      totalAttendances > 0
        ? Math.round((statusSummary.HADIR / totalAttendances) * 100)
        : 0;

    // Get attendance trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceTrend = await prisma.attendance.findMany({
      where: {
        studentId: id,
        date: {
          gte: thirtyDaysAgo,
          lte: new Date(),
        },
      },
      select: {
        date: true,
        status: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    // Group attendance trend by date for easier consumption
    const trendByDate = {};
    attendanceTrend.forEach((attendance) => {
      const dateKey = attendance.date.toISOString().split("T")[0]; // YYYY-MM-DD format
      if (!trendByDate[dateKey]) {
        trendByDate[dateKey] = {
          date: dateKey,
          HADIR: 0,
          IZIN: 0,
          SAKIT: 0,
          ALPHA: 0,
        };
      }
      trendByDate[dateKey][attendance.status]++;
    });

    return res.status(200).json({
      dateRange: {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      },
      statusSummary,
      overallAttendancePercentage,
      totalAttendances,
      subjectStats: Object.values(subjectStats),
      attendanceTrend: Object.values(trendByDate),
    });
  } catch (error) {
    console.error("Get student attendance summary error:", error);
    return res.status(500).json({
      message: "Error retrieving student attendance summary",
      error: error.message,
    });
  }
};

/**
 * Get current authenticated student's data
 * @route GET /api/students/me
 */
exports.getCurrentStudent = async (req, res) => {
  try {
    const { user } = req;

    // Get student data by user ID
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    return res.status(200).json({ student });
  } catch (error) {
    console.error("Get current student error:", error);
    return res.status(500).json({
      message: "Error retrieving student data",
      error: error.message,
    });
  }
};

/**
 * Get current authenticated student's detailed profile
 * @route GET /api/students/me/profile
 */
exports.getCurrentStudentProfile = async (req, res) => {
  try {
    const { user } = req;

    // Get detailed student profile
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    // Get additional statistics
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const [attendanceCount, totalScores, totalSchedules] = await Promise.all([
      // Count attendance this month
      prisma.attendance.count({
        where: {
          studentId: student.id,
          date: {
            gte: currentMonth,
          },
        },
      }),
      // Count total scores
      prisma.score.count({
        where: {
          studentId: student.id,
        },
      }),
      // Count total scheduled classes
      prisma.schedule.count({
        where: {
          classId: student.classId,
        },
      }),
    ]);

    const profile = {
      ...student,
      statistics: {
        attendanceThisMonth: attendanceCount,
        totalScores,
        totalScheduledClasses: totalSchedules,
      },
    };

    return res.status(200).json({ profile });
  } catch (error) {
    console.error("Get current student profile error:", error);
    return res.status(500).json({
      message: "Error retrieving student profile",
      error: error.message,
    });
  }
};

/**
 * Update current authenticated student's profile
 * @route PUT /api/students/me/profile
 */
exports.updateCurrentStudentProfile = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user } = req;
    const { name, gender } = req.body;

    // Check if student exists
    const existingStudent = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!existingStudent) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    // Prepare update data (only allow certain fields)
    const updateData = {};
    if (name) updateData.name = name;
    if (gender) updateData.gender = gender;

    // Update student profile
    const updatedStudent = await prisma.student.update({
      where: { userId: user.id },
      data: updateData,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Update current student profile error:", error);
    return res.status(500).json({
      message: "Error updating student profile",
      error: error.message,
    });
  }
};
