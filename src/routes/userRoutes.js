// src/routes/userRoutes.js
const express = require("express");
const { body } = require("express-validator");
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");
const { Role, Gender } = require("../utils/enum");

const router = express.Router();

/**
 * Admin-only routes for user management
 * All routes in this file require admin authentication
 */

/**
 * @route GET /api/users
 * @desc Get all users (with optional filtering)
 * @access Admin
 */
router.get("/", authMiddleware.isAdmin, userController.getAllUsers);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Admin
 */
router.get("/:id", authMiddleware.isAdmin, userController.getUserById);

/**
 * @route POST /api/users
 * @desc Create a new user (admin, teacher, or student)
 * @access Admin
 */
router.post(
  "/",
  authMiddleware.isAdmin,
  [
    // Common validations for all roles
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("role")
      .isIn(Object.values(Role))
      .withMessage("Invalid role specified"),

    // Conditional validations based on role
    body("name")
      .if(body("role").not().equals(Role.ADMIN))
      .notEmpty()
      .withMessage("Name is required for teachers and students"),
    body("gender")
      .if(body("role").not().equals(Role.ADMIN))
      .isIn(Object.values(Gender))
      .withMessage("Valid gender is required for teachers and students"),

    // Student-specific validations
    body("nis")
      .if(body("role").equals(Role.STUDENT))
      .notEmpty()
      .withMessage("NIS is required for students"),
    body("classId")
      .if(body("role").equals(Role.STUDENT))
      .notEmpty()
      .withMessage("Class ID is required for students"),
  ],
  userController.createUser
);

/**
 * @route PUT /api/users/:id
 * @desc Update a user
 * @access Admin
 */
router.put(
  "/:id",
  authMiddleware.isAdmin,
  [
    // Validation for updateable fields
    body("email")
      .optional()
      .isEmail()
      .withMessage("Please provide a valid email"),
    body("role")
      .optional()
      .isIn(Object.values(Role))
      .withMessage("Invalid role specified"),
    body("name").optional(),
    body("gender")
      .optional()
      .isIn(Object.values(Gender))
      .withMessage("Valid gender is required"),
    body("nis").optional(),
    body("classId").optional(),
  ],
  userController.updateUser
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete a user
 * @access Admin
 */
router.delete("/:id", authMiddleware.isAdmin, userController.deleteUser);

/**
 * @route POST /api/users/:id/reset-password
 * @desc Reset a user's password (admin function)
 * @access Admin
 */
router.post(
  "/:id/reset-password",
  authMiddleware.isAdmin,
  [
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters long"),
  ],
  userController.resetPassword
);

module.exports = router;
