// src/routes/scheduleRoutes.js
const express = require("express");
const router = express.Router();
const scheduleController = require("../controllers/scheduleController");
const {
  isAdmin,
  isTeacher,
  isTeacherOrAdmin,
  isStudent,
  isAuthenticated,
} = require("../middlewares/authMiddleware");

/**
 * Schedule Routes
 * Handles routing for schedule management
 */

// PUBLIC ROUTES
// None

// PROTECTED ROUTES

// Get all schedules - Admin only
router.get("/all", isAdmin, scheduleController.getAllSchedules);

// Filter schedules by class, teacher, subject, day - Accessible to authenticated users
router.get("/filter", isAuthenticated, scheduleController.getFilteredSchedules);

// Get schedule by ID - Accessible to authenticated users
router.get("/:id", isAuthenticated, scheduleController.getScheduleById);

// Create new schedule - Admin only
router.post("/", isAdmin, scheduleController.createSchedule);
router.post("/check-conflicts", isAdmin, scheduleController.checkConflicts);

// Update schedule - Admin only
router.put("/:id", isAdmin, scheduleController.updateSchedule);

// Delete schedule - Admin only
router.delete("/:id", isAdmin, scheduleController.deleteSchedule);

// Get weekly schedule for a class - Teachers and Admin can access any class schedule
router.get(
  "/class/:classId/week",
  isAuthenticated,
  scheduleController.getClassWeeklySchedule
);

// Get weekly schedule for a teacher - Authenticated users can access
router.get(
  "/teacher/:teacherId/week",
  isAuthenticated,
  scheduleController.getTeacherWeeklySchedule
);

// Get today's schedule for a student - Student can access their own, teachers and admin can access any
router.get(
  "/student/:studentId/today",
  isAuthenticated,
  scheduleController.getStudentTodaySchedule
);

// Get today's schedule for a teacher - Teachers can access their own, admin can access any
router.get(
  "/teacher/:teacherId/today",
  isAuthenticated,
  scheduleController.getTeacherTodaySchedule
);

module.exports = router;
