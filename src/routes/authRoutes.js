// src/routes/authRoutes.js
const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @route POST /api/auth/login/student
 * @desc Login as student
 * @access Public
 */
router.post(
  "/login/student",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.loginStudent
);

/**
 * @route POST /api/auth/login/teacher
 * @desc Login as teacher
 * @access Public
 */
router.post(
  "/login/teacher",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.loginTeacher
);

/**
 * @route POST /api/auth/login/admin
 * @desc Login as admin
 * @access Public
 */
router.post(
  "/login/admin",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.loginAdmin
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Authenticated
 */
router.post("/logout", authMiddleware.isAuthenticated, authController.logout);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Authenticated
 */
router.get("/me", authMiddleware.isAuthenticated, authController.getMe);

/**
 * @route PUT /api/auth/change-password
 * @desc Change user password
 * @access Authenticated
 */
router.put(
  "/change-password",
  authMiddleware.isAuthenticated,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters long"),
  ],
  authController.changePassword
);

module.exports = router;
