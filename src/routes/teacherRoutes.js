const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const teacherController = require("../controllers/teacherController");
const authMiddleware = require("../middlewares/authMiddleware");
const { AttendanceStatus, ScoreType } = require("../utils/enum");

/**
 * Teacher routes
 * Base path: /api/teachers
 */

// Get all teachers (accessible to admin and teachers)
router.get(
  "/",
  authMiddleware.isTeacherOrAdmin,
  teacherController.getAllTeachers
);

// Get teacher by ID
router.get(
  "/:id",
  authMiddleware.isTeacherOrAdmin,
  teacherController.getTeacherById
);

// Get teacher's schedule/timetable
router.get(
  "/:id/schedule",
  authMiddleware.isTeacherOrAdmin,
  teacherController.getTeacherSchedule
);

// Create attendance session (only for specific teacher)
router.post(
  "/:id/attendance-sessions",
  authMiddleware.isTeacher,
  [
    body("scheduleId").isUUID().withMessage("Valid schedule ID is required"),
    body("durationMinutes")
      .optional()
      .isInt({ min: 5, max: 180 })
      .withMessage("Duration must be between 5 and 180 minutes"),
    // New fields for geolocation
    body("latitude")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be a valid number between -90 and 90"),
    body("longitude")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be a valid number between -180 and 180"),
    body("radiusMeters")
      .optional()
      .isInt({ min: 1, max: 1000 }) // Maximum radius set to 1km (1000m)
      .withMessage("Radius must be a positive integer (max 1000m)"),
  ],
  teacherController.createAttendanceSession
);

// Get attendance sessions for teacher
router.get(
  "/:id/attendance-sessions",
  authMiddleware.isTeacher,
  teacherController.getAttendanceSessions
);

// Update attendance status
router.put(
  "/:id/attendance/:attendanceId",
  authMiddleware.isTeacher,
  [
    body("status")
      .isIn(Object.values(AttendanceStatus))
      .withMessage("Valid attendance status is required"),
  ],
  teacherController.manageAttendance
);

// Add manual attendance for students
router.post(
  "/:id/manual-attendance",
  authMiddleware.isTeacher,
  [
    body("sessionId").isUUID().withMessage("Valid session ID is required"),
    body("studentId").isUUID().withMessage("Valid student ID is required"),
    body("status")
      .isIn(Object.values(AttendanceStatus))
      .withMessage("Valid attendance status is required"),
  ],
  teacherController.addManualAttendance
);

// Add score for student
router.post(
  "/:id/scores",
  authMiddleware.isTeacher,
  [
    body("studentId").isUUID().withMessage("Valid student ID is required"),
    body("subjectId").isUUID().withMessage("Valid subject ID is required"),
    body("type")
      .isIn(Object.values(ScoreType))
      .withMessage("Valid score type is required"),
    body("value")
      .isFloat({ min: 0, max: 100 })
      .withMessage("Score must be between 0 and 100"),
    body("description")
      .optional()
      .isString()
      .isLength({ max: 255 })
      .withMessage("Description must be a string with maximum 255 characters"),
  ],
  teacherController.addScore
);

// Update student score
router.put(
  "/:id/scores/:scoreId",
  authMiddleware.isTeacher,
  [
    body("value")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Score must be between 0 and 100"),
    body("type")
      .optional()
      .isIn(Object.values(ScoreType))
      .withMessage("Valid score type is required"),
    body("description")
      .optional()
      .isString()
      .isLength({ max: 255 })
      .withMessage("Description must be a string with maximum 255 characters"),
  ],
  teacherController.updateScore
);

// Get students by class
router.get(
  "/:id/class-students/:classId",
  authMiddleware.isTeacher,
  teacherController.getClassStudents
);

// New routes for retrieving scores
// Get scores for a specific student
router.get(
  "/:id/student-scores/:studentId",
  authMiddleware.isTeacher,
  teacherController.getStudentScores
);

// Get scores for all students in a class
router.get(
  "/:id/class-scores/:classId",
  authMiddleware.isTeacher,
  teacherController.getClassScores
);

module.exports = router;
