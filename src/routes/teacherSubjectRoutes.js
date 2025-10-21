// src/routes/teacherSubjectRoutes.js
const express = require("express");
const { body } = require("express-validator");
const teacherSubjectController = require("../controllers/teacherSubjectController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * Teacher Subject Routes
 * These routes provide teacher-centric management of subject assignments,
 * complementing the subject-centric routes in subjectRoutes.js
 */

/**
 * @route GET /api/teacher-subjects/:teacherId/subjects
 * @desc Get all subjects assigned to a teacher
 * @access Authenticated users
 */
router.get(
  "/:teacherId/subjects",
  authMiddleware.isAuthenticated,
  teacherSubjectController.getTeacherSubjects
);

/**
 * @route POST /api/teacher-subjects/:teacherId/subjects
 * @desc Assign multiple subjects to a teacher at once
 * @access Admin only
 */
router.post(
  "/:teacherId/subjects",
  authMiddleware.isAdmin,
  [
    body("subjectIds")
      .isArray({ min: 1 })
      .withMessage("At least one subject ID must be provided"),
  ],
  teacherSubjectController.assignSubjectsToTeacher
);

/**
 * @route DELETE /api/teacher-subjects/:teacherId/subjects/:subjectId
 * @desc Remove a subject assignment from a teacher
 * @access Admin only
 */
router.delete(
  "/:teacherId/subjects/:subjectId",
  authMiddleware.isAdmin,
  teacherSubjectController.removeSubjectFromTeacher
);

/**
 * @route PUT /api/teacher-subjects/:teacherId/subjects
 * @desc Replace all subject assignments for a teacher
 * @access Admin only
 */
router.put(
  "/:teacherId/subjects",
  authMiddleware.isAdmin,
  [
    body("subjectIds")
      .isArray()
      .withMessage("Subject IDs must be provided as an array"),
  ],
  teacherSubjectController.updateTeacherSubjects
);

module.exports = router;
