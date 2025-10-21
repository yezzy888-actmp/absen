// src/routes/studentRoutes.js
const express = require("express");
const { body, param, query } = require("express-validator");
const studentController = require("../controllers/studentController");
const {
  isAdmin,
  isTeacher,
  isStudent,
  isTeacherOrAdmin,
  isAuthenticated,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Helper middleware for student data access authorization
const authorizeStudentDataAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req;

    // Debug: Log user data to see what's in the token
    console.log("User from token:", JSON.stringify(user, null, 2));

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        message: "Authentication required - User not found in request",
      });
    }

    // Check if user.id exists
    if (!user.id) {
      return res.status(401).json({
        message: "Authentication required - User ID not found in token",
      });
    }

    // Admin dan Teacher bisa akses semua data student
    if (user.role === "ADMIN" || user.role === "TEACHER") {
      return next();
    }

    // Student hanya bisa akses data sendiri
    if (user.role === "STUDENT") {
      const prisma = require("../utils/prisma");

      // Add additional check to ensure userId is valid
      console.log("Looking for student with userId:", user.id);

      const userStudent = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      console.log("Found student:", userStudent);

      if (!userStudent) {
        return res.status(404).json({
          message: "Student profile not found for this user",
        });
      }

      if (userStudent.id !== id) {
        return res.status(403).json({
          message: "Access denied: You can only access your own data",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Authorization error:", error);
    return res.status(500).json({
      message: "Authorization process failed",
      error: error.message,
    });
  }
};

// Validation rules
const validateStudentId = [
  param("id").isUUID().withMessage("Invalid student ID format"),
];

const validateAttendanceSubmission = [
  body("token")
    .notEmpty()
    .withMessage("Token is required")
    .isLength({ min: 1 })
    .withMessage("Token cannot be empty"),
  // NEW: Validations for geolocation submission
  body("studentLatitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Student Latitude must be a valid number between -90 and 90"),
  body("studentLongitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage(
      "Student Longitude must be a valid number between -180 and 180"
    ),
];

const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

const validateDateRange = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be in valid ISO format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be in valid ISO format"),
];

const validateAttendanceFilters = [
  query("status")
    .optional()
    .isIn(["HADIR", "IZIN", "SAKIT", "ALPHA"])
    .withMessage("Status must be one of: HADIR, IZIN, SAKIT, ALPHA"),
  query("subjectId")
    .optional()
    .isUUID()
    .withMessage("Subject ID must be valid UUID"),
];

const validateScoreFilters = [
  query("type")
    .optional()
    .isIn(["UTS", "UAS", "TUGAS"])
    .withMessage("Score type must be one of: UTS, UAS, TUGAS"),
  query("subjectId")
    .optional()
    .isUUID()
    .withMessage("Subject ID must be valid UUID"),
];

const validateScheduleFilters = [
  query("day")
    .optional()
    .isIn(["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"])
    .withMessage(
      "Day must be one of: SENIN, SELASA, RABU, KAMIS, JUMAT, SABTU"
    ),
];

const validateStudentFilters = [
  query("name")
    .optional()
    .isLength({ min: 1 })
    .withMessage("Name filter cannot be empty"),
  query("nis")
    .optional()
    .isLength({ min: 1 })
    .withMessage("NIS filter cannot be empty"),
  query("classId")
    .optional()
    .isUUID()
    .withMessage("Class ID must be valid UUID"),
  query("gender")
    .optional()
    .isIn(["LAKI_LAKI", "PEREMPUAN"])
    .withMessage("Gender must be either LAKI_LAKI or PEREMPUAN"),
];

// Routes

/**
 * @route   GET /api/students/me
 * @desc    Get current student's own data (shortcut for authenticated student)
 * @access  Student only
 * NOTE: This route MUST be placed BEFORE the /:id route to avoid conflicts
 */
router.get("/me", isStudent, studentController.getCurrentStudent);

/**
 * @route   GET /api/students/me/profile
 * @desc    Get current student's profile with detailed info
 * @access  Student only
 */
router.get(
  "/me/profile",
  isStudent,
  studentController.getCurrentStudentProfile
);

/**
 * @route   PUT /api/students/me/profile
 * @desc    Update current student's profile (limited fields)
 * @access  Student only
 */
router.put(
  "/me/profile",
  isStudent,
  [
    body("name")
      .optional()
      .isLength({ min: 2 })
      .withMessage("Name must be at least 2 characters"),
    body("gender")
      .optional()
      .isIn(["LAKI_LAKI", "PEREMPUAN"])
      .withMessage("Gender must be either LAKI_LAKI or PEREMPUAN"),
  ],
  studentController.updateCurrentStudentProfile
);

/**
 * @route   GET /api/students
 * @desc    Get all students with filtering and pagination
 * @access  Teacher, Admin
 */
router.get(
  "/",
  isTeacherOrAdmin,
  [...validatePagination, ...validateStudentFilters],
  studentController.getAllStudents
);

/**
 * @route   GET /api/students/:id
 * @desc    Get student by ID
 * @access  Teacher, Admin, Student (own data only)
 */
router.get(
  "/:id",
  isAuthenticated,
  validateStudentId,
  authorizeStudentDataAccess,
  studentController.getStudentById
);

/**
 * @route   GET /api/students/:id/attendance
 * @desc    Get student attendance records
 * @access  Teacher, Admin, Student (own data only)
 */
router.get(
  "/:id/attendance",
  isAuthenticated,
  [
    ...validateStudentId,
    ...validatePagination,
    ...validateDateRange,
    ...validateAttendanceFilters,
  ],
  authorizeStudentDataAccess,
  studentController.getStudentAttendance
);

/**
 * @route   GET /api/students/:id/scores
 * @desc    Get student scores
 * @access  Teacher, Admin, Student (own data only)
 */
router.get(
  "/:id/scores",
  isAuthenticated,
  [...validateStudentId, ...validatePagination, ...validateScoreFilters],
  authorizeStudentDataAccess,
  studentController.getStudentScores
);

/**
 * @route   GET /api/students/:id/schedule
 * @desc    Get student schedule/timetable
 * @access  Teacher, Admin, Student (own data only)
 */
router.get(
  "/:id/schedule",
  isAuthenticated,
  [...validateStudentId, ...validateScheduleFilters],
  authorizeStudentDataAccess,
  studentController.getStudentSchedule
);

/**
 * @route   POST /api/students/:id/submit-attendance
 * @desc    Submit attendance using token (QR Code scan)
 * @access  Student (own data only)
 */
router.post(
  "/:id/submit-attendance",
  isAuthenticated,
  [...validateStudentId, ...validateAttendanceSubmission],
  authorizeStudentDataAccess,
  studentController.submitAttendance
);

/**
 * @route   GET /api/students/:id/dashboard
 * @desc    Get student dashboard summary
 * @access  Teacher, Admin, Student (own data only)
 */
router.get(
  "/:id/dashboard",
  isAuthenticated,
  validateStudentId,
  authorizeStudentDataAccess,
  studentController.getStudentDashboard
);

/**
 * @route   GET /api/students/:id/attendance-summary
 * @desc    Get student attendance summary/statistics
 * @access  Teacher, Admin, Student (own data only)
 */
router.get(
  "/:id/attendance-summary",
  isAuthenticated,
  [...validateStudentId, ...validateDateRange],
  authorizeStudentDataAccess,
  studentController.getStudentAttendanceSummary
);

module.exports = router;
