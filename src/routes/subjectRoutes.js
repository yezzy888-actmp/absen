// src/routes/subjectRoutes.js
const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const subjectController = require("../controllers/subjectController");
const authMiddleware = require("../middlewares/authMiddleware");

/**
 * Subject routes with authorization middleware
 * Admin can perform all operations
 * Teachers can view subjects and their assigned subjects
 * Students can only view subjects (for their schedules and scores)
 */

// GET all subjects with pagination - accessible by all authenticated users
router.get(
  "/",
  authMiddleware.isAuthenticated,
  subjectController.getAllSubjects
);

// GET subject by ID - accessible by all authenticated users
router.get(
  "/:id",
  authMiddleware.isAuthenticated,
  subjectController.getSubjectById
);

// GET teachers assigned to a subject - accessible by all authenticated users
router.get(
  "/:id/teachers",
  authMiddleware.isAuthenticated,
  subjectController.getSubjectTeachers
);

// POST create a new subject - only admin
router.post(
  "/",
  authMiddleware.isAdmin,
  [body("name").notEmpty().withMessage("Subject name is required")],
  subjectController.createSubject
);

// PUT update a subject - only admin
router.put(
  "/:id",
  authMiddleware.isAdmin,
  [body("name").notEmpty().withMessage("Subject name is required")],
  subjectController.updateSubject
);

// DELETE a subject - only admin
router.delete("/:id", authMiddleware.isAdmin, subjectController.deleteSubject);

// POST assign teacher to subject - only admin
router.post(
  "/:id/assign-teacher",
  authMiddleware.isAdmin,
  [body("teacherId").notEmpty().withMessage("Teacher ID is required")],
  subjectController.assignTeacher
);

// DELETE remove teacher from subject - only admin
router.delete(
  "/:id/remove-teacher/:teacherId",
  authMiddleware.isAdmin,
  subjectController.removeTeacher
);

module.exports = router;
