// src/routes/classRoutes.js
const express = require("express");
const { body } = require("express-validator");
const classController = require("../controllers/classController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @route GET /api/classes
 * @desc Get all classes with pagination and filtering
 * @access Admin, Teacher
 */
router.get("/", authMiddleware.isTeacherOrAdmin, classController.getAllClasses);

/**
 * @route GET /api/classes/:id
 * @desc Get class by ID with student and schedule data
 * @access Admin, Teacher, Student (their own class only)
 */
router.get(
  "/:id",
  authMiddleware.isAuthenticated,
  classController.getClassById
);

/**
 * @route GET /api/classes/:id/schedule
 * @desc Get schedule for a specific class
 * @access Admin, Teacher, Student (their own class)
 */
router.get(
  "/:id/schedule",
  authMiddleware.isAuthenticated,
  classController.getClassSchedule
);

/**
 * @route GET /api/classes/:id/students
 * @desc Get students in a class
 * @access Admin, Teacher (assigned to class)
 */
router.get(
  "/:id/students",
  authMiddleware.isTeacherOrAdmin,
  classController.getClassStudents
);

/**
 * @route POST /api/classes
 * @desc Create a new class
 * @access Admin
 */
router.post(
  "/",
  authMiddleware.isAdmin,
  [
    body("name")
      .notEmpty()
      .withMessage("Class name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Class name must be between 2 and 50 characters")
      .trim(),
  ],
  classController.createClass
);

/**
 * @route PUT /api/classes/:id
 * @desc Update a class
 * @access Admin
 */
router.put(
  "/:id",
  authMiddleware.isAdmin,
  [
    body("name")
      .notEmpty()
      .withMessage("Class name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Class name must be between 2 and 50 characters")
      .trim(),
  ],
  classController.updateClass
);

/**
 * @route DELETE /api/classes/:id
 * @desc Delete a class
 * @access Admin
 */
router.delete("/:id", authMiddleware.isAdmin, classController.deleteClass);

module.exports = router;
