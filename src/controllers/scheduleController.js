// src/controllers/scheduleController.js
const prisma = require("../utils/prisma");
const { Weekday } = require("../utils/enum");

const isValidTimeFormat = (timeString) => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(timeString);
};

/**
 * Helper function to compare times
 * @param {string} startTime - Start time in HH:MM
 * @param {string} endTime - End time in HH:MM
 * @returns {boolean} - Whether start time is before end time
 */
const isStartTimeBeforeEndTime = (startTime, endTime) => {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return startMinutes < endMinutes;
};

/**
 * Helper function to check time overlap
 * @param {string} start1 - Start time 1
 * @param {string} end1 - End time 1
 * @param {string} start2 - Start time 2
 * @param {string} end2 - End time 2
 * @returns {boolean} - Whether times overlap
 */
const timesOverlap = (start1, end1, start2, end2) => {
  const toMinutes = (time) => {
    const [hour, min] = time.split(":").map(Number);
    return hour * 60 + min;
  };

  const start1Min = toMinutes(start1);
  const end1Min = toMinutes(end1);
  const start2Min = toMinutes(start2);
  const end2Min = toMinutes(end2);

  return start1Min < end2Min && end1Min > start2Min;
};

/**
 * Schedule Controller
 * Handles operations for managing class schedules
 */
exports.getAllSchedules = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "day",
      sortOrder = "asc",
    } = req.query;

    // Parse and validate pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Validate sort parameters
    const validSortFields = ["day", "startTime", "endTime", "createdAt"];
    const validSortOrders = ["asc", "desc"];

    const orderBy = {};
    if (
      validSortFields.includes(sortBy) &&
      validSortOrders.includes(sortOrder)
    ) {
      orderBy[sortBy] = sortOrder;
    } else {
      // Default sorting
      orderBy.day = "asc";
    }

    // Get schedules with pagination
    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        include: {
          subject: true,
          class: true,
          teacher: {
            select: {
              id: true,
              name: true,
              gender: true,
            },
          },
        },
        orderBy: [orderBy, { startTime: "asc" }],
        skip,
        take: limitNum,
      }),
      prisma.schedule.count(),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      schedules,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return res.status(500).json({
      message: "Failed to retrieve schedules",
      error: error.message,
    });
  }
};

/**
 * Get schedules filtered by class, teacher, or subject with pagination
 */
exports.getFilteredSchedules = async (req, res) => {
  try {
    const {
      classId,
      teacherId,
      subjectId,
      day,
      page = 1,
      limit = 10,
      sortBy = "day",
      sortOrder = "asc",
    } = req.query;

    // Parse and validate pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build filter object based on provided parameters
    const where = {};

    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;
    if (subjectId) where.subjectId = subjectId;
    if (day && Object.values(Weekday).includes(day)) where.day = day;

    // Validate sort parameters
    const validSortFields = ["day", "startTime", "endTime", "createdAt"];
    const validSortOrders = ["asc", "desc"];

    const orderBy = {};
    if (
      validSortFields.includes(sortBy) &&
      validSortOrders.includes(sortOrder)
    ) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.day = "asc";
    }

    // Get filtered schedules with pagination
    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: {
          subject: true,
          class: true,
          teacher: {
            select: {
              id: true,
              name: true,
              gender: true,
            },
          },
        },
        orderBy: [orderBy, { startTime: "asc" }],
        skip,
        take: limitNum,
      }),
      prisma.schedule.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      schedules,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      filters: {
        classId: classId || null,
        teacherId: teacherId || null,
        subjectId: subjectId || null,
        day: day || null,
      },
    });
  } catch (error) {
    console.error("Error fetching filtered schedules:", error);
    return res.status(500).json({
      message: "Failed to retrieve schedules",
      error: error.message,
    });
  }
};

/**
 * Get schedule by ID
 */
exports.getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionLimit = 5, attendanceLimit = 20 } = req.query;

    // Parse limits
    const sessionLimitNum = parseInt(sessionLimit) || 5;
    const attendanceLimitNum = parseInt(attendanceLimit) || 20;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        subject: true,
        class: true,
        teacher: {
          select: {
            id: true,
            name: true,
            gender: true,
          },
        },
        sessions: {
          orderBy: { date: "desc" },
          take: sessionLimitNum,
        },
        attendances: {
          take: attendanceLimitNum,
          orderBy: { date: "desc" },
          include: {
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
    });

    if (!schedule) {
      return res.status(404).json({
        message: "Schedule not found",
      });
    }

    return res.status(200).json({
      schedule,
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return res.status(500).json({
      message: "Failed to retrieve schedule",
      error: error.message,
    });
  }
};

/**
 * Create a new schedule
 */
exports.createSchedule = async (req, res) => {
  try {
    const { subjectId, classId, teacherId, day, startTime, endTime } = req.body;

    // Validate required fields
    if (
      !subjectId ||
      !classId ||
      !teacherId ||
      !day ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        message:
          "All fields are required: subjectId, classId, teacherId, day, startTime, endTime",
      });
    }

    // Validate day enum
    if (!Object.values(Weekday).includes(day)) {
      return res.status(400).json({
        message: `Invalid day. Must be one of: ${Object.values(Weekday).join(
          ", "
        )}`,
      });
    }

    // Validate time format (HH:MM)
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      return res.status(400).json({
        message: "Time must be in HH:MM format (24-hour)",
      });
    }

    // Validate that end time is after start time
    if (!isStartTimeBeforeEndTime(startTime, endTime)) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    // Check if the teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    // Check if the class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return res.status(404).json({
        message: "Class not found",
      });
    }

    // Check if the subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    // Check if the teacher is assigned to this subject
    const teacherSubject = await prisma.teacherSubject.findUnique({
      where: {
        teacherId_subjectId: {
          teacherId,
          subjectId,
        },
      },
    });

    if (!teacherSubject) {
      return res.status(400).json({
        message: "This teacher is not assigned to teach this subject",
      });
    }

    // Check for time conflicts for the class
    const classSchedules = await prisma.schedule.findMany({
      where: {
        classId,
        day,
      },
    });

    // Check if any existing schedule overlaps with the new one
    const classConflict = classSchedules.some((schedule) =>
      timesOverlap(startTime, endTime, schedule.startTime, schedule.endTime)
    );

    if (classConflict) {
      return res.status(409).json({
        message:
          "Time conflict: This class already has a schedule during the specified time",
      });
    }

    // Check for time conflicts for the teacher
    const teacherSchedules = await prisma.schedule.findMany({
      where: {
        teacherId,
        day,
      },
    });

    // Check if any existing schedule overlaps with the new one
    const teacherConflict = teacherSchedules.some((schedule) =>
      timesOverlap(startTime, endTime, schedule.startTime, schedule.endTime)
    );

    if (teacherConflict) {
      return res.status(409).json({
        message:
          "Time conflict: This teacher already has a schedule during the specified time",
      });
    }

    // Create the schedule
    const newSchedule = await prisma.schedule.create({
      data: {
        subjectId,
        classId,
        teacherId,
        day,
        startTime,
        endTime,
      },
      include: {
        subject: true,
        class: true,
        teacher: {
          select: {
            id: true,
            name: true,
            gender: true,
          },
        },
      },
    });

    return res.status(201).json({
      schedule: newSchedule,
      message: "Schedule created successfully",
    });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return res.status(500).json({
      message: "Failed to create schedule",
      error: error.message,
    });
  }
};

/**
 * Update a schedule
 */
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectId, classId, teacherId, day, startTime, endTime } = req.body;

    // Check if schedule exists
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return res.status(404).json({
        message: "Schedule not found",
      });
    }

    // Build update data object
    const updateData = {};

    if (subjectId) updateData.subjectId = subjectId;
    if (classId) updateData.classId = classId;
    if (teacherId) updateData.teacherId = teacherId;
    if (day) {
      // Validate day enum
      if (!Object.values(Weekday).includes(day)) {
        return res.status(400).json({
          message: `Invalid day. Must be one of: ${Object.values(Weekday).join(
            ", "
          )}`,
        });
      }
      updateData.day = day;
    }

    // Validate time format if provided
    if (startTime) {
      if (!isValidTimeFormat(startTime)) {
        return res.status(400).json({
          message: "Start time must be in HH:MM format (24-hour)",
        });
      }
      updateData.startTime = startTime;
    }

    if (endTime) {
      if (!isValidTimeFormat(endTime)) {
        return res.status(400).json({
          message: "End time must be in HH:MM format (24-hour)",
        });
      }
      updateData.endTime = endTime;
    }

    // Validate that end time is after start time (if both are being updated)
    const finalStartTime = updateData.startTime || existingSchedule.startTime;
    const finalEndTime = updateData.endTime || existingSchedule.endTime;

    if (!isStartTimeBeforeEndTime(finalStartTime, finalEndTime)) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    // Check relations if updating
    if (subjectId && teacherId) {
      // Check if the teacher is assigned to this subject
      const teacherSubject = await prisma.teacherSubject.findUnique({
        where: {
          teacherId_subjectId: {
            teacherId,
            subjectId,
          },
        },
      });

      if (!teacherSubject) {
        return res.status(400).json({
          message: "This teacher is not assigned to teach this subject",
        });
      }
    }

    // Check for time conflicts if updating time-related fields
    if (day || startTime || endTime || classId || teacherId) {
      const checkDay = day || existingSchedule.day;
      const checkStartTime = startTime || existingSchedule.startTime;
      const checkEndTime = endTime || existingSchedule.endTime;
      const checkClassId = classId || existingSchedule.classId;
      const checkTeacherId = teacherId || existingSchedule.teacherId;

      // Check for time conflicts for the class
      const classSchedules = await prisma.schedule.findMany({
        where: {
          id: { not: id },
          classId: checkClassId,
          day: checkDay,
        },
      });

      const classConflict = classSchedules.some((schedule) =>
        timesOverlap(
          checkStartTime,
          checkEndTime,
          schedule.startTime,
          schedule.endTime
        )
      );

      if (classConflict) {
        return res.status(409).json({
          message:
            "Time conflict: This class already has a schedule during the specified time",
        });
      }

      // Check for time conflicts for the teacher
      const teacherSchedules = await prisma.schedule.findMany({
        where: {
          id: { not: id },
          teacherId: checkTeacherId,
          day: checkDay,
        },
      });

      const teacherConflict = teacherSchedules.some((schedule) =>
        timesOverlap(
          checkStartTime,
          checkEndTime,
          schedule.startTime,
          schedule.endTime
        )
      );

      if (teacherConflict) {
        return res.status(409).json({
          message:
            "Time conflict: This teacher already has a schedule during the specified time",
        });
      }
    }

    // Update the schedule
    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        subject: true,
        class: true,
        teacher: {
          select: {
            id: true,
            name: true,
            gender: true,
          },
        },
      },
    });

    return res.status(200).json({
      schedule: updatedSchedule,
      message: "Schedule updated successfully",
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return res.status(500).json({
      message: "Failed to update schedule",
      error: error.message,
    });
  }
};

/**
 * Delete a schedule
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if schedule exists
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return res.status(404).json({
        message: "Schedule not found",
      });
    }

    // Check if there are any related AttendanceSessions or Attendances
    const relatedSessions = await prisma.attendanceSession.count({
      where: { scheduleId: id },
    });

    const relatedAttendances = await prisma.attendance.count({
      where: { scheduleId: id },
    });

    if (relatedSessions > 0 || relatedAttendances > 0) {
      return res.status(409).json({
        message:
          "Cannot delete schedule with existing attendance sessions or records",
        relatedSessions,
        relatedAttendances,
      });
    }

    // Delete the schedule
    await prisma.schedule.delete({
      where: { id },
    });

    return res.status(200).json({
      message: "Schedule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return res.status(500).json({
      message: "Failed to delete schedule",
      error: error.message,
    });
  }
};

/**
 * Get the weekly schedule for a class
 * Returns schedule grouped by day
 */
exports.getClassWeeklySchedule = async (req, res) => {
  try {
    const { classId } = req.params;

    // Check if class exists
    const classExists = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classExists) {
      return res.status(404).json({
        message: "Class not found",
      });
    }

    // Get schedules for this class ordered by day and time
    const schedules = await prisma.schedule.findMany({
      where: { classId },
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            name: true,
            gender: true,
          },
        },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });

    // Group schedules by day
    const weekdays = Object.values(Weekday);
    const weeklySchedule = {};

    // Initialize each day with an empty array
    weekdays.forEach((day) => {
      weeklySchedule[day] = [];
    });

    // Group schedules by day
    schedules.forEach((schedule) => {
      weeklySchedule[schedule.day].push(schedule);
    });

    return res.status(200).json({
      weeklySchedule,
    });
  } catch (error) {
    console.error("Error fetching class weekly schedule:", error);
    return res.status(500).json({
      message: "Failed to retrieve class weekly schedule",
      error: error.message,
    });
  }
};

/**
 * Get the weekly schedule for a teacher
 * Returns schedule grouped by day
 */
exports.getTeacherWeeklySchedule = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Check if teacher exists
    const teacherExists = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacherExists) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    // Get schedules for this teacher ordered by day and time
    const schedules = await prisma.schedule.findMany({
      where: { teacherId },
      include: {
        subject: true,
        class: true,
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });

    // Group schedules by day
    const weekdays = Object.values(Weekday);
    const weeklySchedule = {};

    // Initialize each day with an empty array
    weekdays.forEach((day) => {
      weeklySchedule[day] = [];
    });

    // Group schedules by day
    schedules.forEach((schedule) => {
      weeklySchedule[schedule.day].push(schedule);
    });

    return res.status(200).json({
      weeklySchedule,
    });
  } catch (error) {
    console.error("Error fetching teacher weekly schedule:", error);
    return res.status(500).json({
      message: "Failed to retrieve teacher weekly schedule",
      error: error.message,
    });
  }
};

/**
 * Get today's schedule for a student
 */
exports.getStudentTodaySchedule = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    // Get day of week in Indonesian format (SENIN, SELASA, etc.)
    const daysMap = {
      0: "SENIN",
      1: "SELASA",
      2: "RABU",
      3: "KAMIS",
      4: "JUMAT",
      5: "SABTU",
      6: "MINGGU",
    };

    // Get today's day (0-6, starting from Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Convert to 0 = Monday, 6 = Sunday format
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const todayDay = daysMap[adjustedDay];

    // Create date range for today
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get schedules for student's class for today
    const todaySchedules = await prisma.schedule.findMany({
      where: {
        classId: student.classId,
        day: todayDay,
      },
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            name: true,
            gender: true,
          },
        },
        sessions: {
          where: {
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return res.status(200).json({
      today: todayDay,
      schedules: todaySchedules,
    });
  } catch (error) {
    console.error("Error fetching student today schedules:", error);
    return res.status(500).json({
      message: "Failed to retrieve student today schedules",
      error: error.message,
    });
  }
};

/**
 * Get today's schedule for a teacher
 */
exports.getTeacherTodaySchedule = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Check if teacher exists
    const teacherExists = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacherExists) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    // Get day of week in Indonesian format (SENIN, SELASA, etc.)
    const daysMap = {
      0: "SENIN",
      1: "SELASA",
      2: "RABU",
      3: "KAMIS",
      4: "JUMAT",
      5: "SABTU",
      6: "MINGGU",
    };

    // Get today's day (0-6, starting from Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Convert to 0 = Monday, 6 = Sunday format
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const todayDay = daysMap[adjustedDay];

    // Create date range for today
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get schedules for teacher for today
    const todaySchedules = await prisma.schedule.findMany({
      where: {
        teacherId,
        day: todayDay,
      },
      include: {
        subject: true,
        class: true,
        sessions: {
          where: {
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return res.status(200).json({
      today: todayDay,
      schedules: todaySchedules,
    });
  } catch (error) {
    console.error("Error fetching teacher today schedules:", error);
    return res.status(500).json({
      message: "Failed to retrieve teacher today schedules",
      error: error.message,
    });
  }
};

/**
 * Check for schedule conflicts
 */
exports.checkConflicts = async (req, res) => {
  try {
    const { subjectId, classId, teacherId, day, startTime, endTime, id } =
      req.body;

    // Validate required fields
    if (!classId || !teacherId || !day || !startTime || !endTime) {
      return res.status(400).json({
        message: "Required fields: classId, teacherId, day, startTime, endTime",
      });
    }

    // Validate day enum
    if (!Object.values(Weekday).includes(day)) {
      return res.status(400).json({
        message: `Invalid day. Must be one of: ${Object.values(Weekday).join(
          ", "
        )}`,
      });
    }

    // Validate time format (HH:MM)
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      return res.status(400).json({
        message: "Time must be in HH:MM format (24-hour)",
      });
    }

    // Validate that end time is after start time
    if (!isStartTimeBeforeEndTime(startTime, endTime)) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    const conflicts = {
      classConflicts: [],
      teacherConflicts: [],
    };

    // Build where clause to exclude current schedule if updating
    const whereExclude = id ? { id: { not: id } } : {};

    // Check for time conflicts for the class
    const classSchedules = await prisma.schedule.findMany({
      where: {
        ...whereExclude,
        classId,
        day,
      },
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Filter for overlapping schedules
    conflicts.classConflicts = classSchedules.filter((schedule) =>
      timesOverlap(startTime, endTime, schedule.startTime, schedule.endTime)
    );

    // Check for time conflicts for the teacher
    const teacherSchedules = await prisma.schedule.findMany({
      where: {
        ...whereExclude,
        teacherId,
        day,
      },
      include: {
        subject: true,
        class: true,
      },
    });

    // Filter for overlapping schedules
    conflicts.teacherConflicts = teacherSchedules.filter((schedule) =>
      timesOverlap(startTime, endTime, schedule.startTime, schedule.endTime)
    );

    // If there are conflicts, return 409 status
    if (
      conflicts.classConflicts.length > 0 ||
      conflicts.teacherConflicts.length > 0
    ) {
      return res.status(409).json({
        message: "Schedule conflicts detected",
        conflicts,
      });
    }

    // No conflicts found
    return res.status(200).json({
      message: "No conflicts detected",
      conflicts: {
        classConflicts: [],
        teacherConflicts: [],
      },
    });
  } catch (error) {
    console.error("Error checking schedule conflicts:", error);
    return res.status(500).json({
      message: "Failed to check schedule conflicts",
      error: error.message,
    });
  }
};
