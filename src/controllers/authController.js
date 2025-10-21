// src/controllers/authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const { Role } = require("../utils/enum"); // Fixed: Use Role instead of role
const { validationResult } = require("express-validator");

/**
 * Register a new admin
 * @route POST /api/auth/register-admin
 */
exports.registerAdmin = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Admin registration only
    const userRole = Role.ADMIN; // Fixed: Use Role.ADMIN instead of role.admin

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: userRole,
      },
    });

    // Return success without password
    const { password: _, ...userData } = user;
    return res.status(201).json({
      message: "Admin registered successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "Error registering admin",
      error: error.message,
    });
  }
};

/**
 * Base login function that handles authentication with role checking
 * @private
 */
const _loginWithRoleCheck = async (req, res, expectedRole) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user has the expected role
    if (user.role !== expectedRole) {
      return res.status(403).json({
        message: `Access denied. This endpoint is for ${expectedRole.toLowerCase()} accounts only.`,
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Load role-specific data
    let roleData = null;

    if (user.role === Role.STUDENT) {
      roleData = await prisma.student.findUnique({
        where: { userId: user.id },
        include: { class: true },
      });
    } else if (user.role === Role.TEACHER) {
      roleData = await prisma.teacher.findUnique({
        where: { userId: user.id },
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Set cookie for token
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // Return user data and token
    const { password: _, ...userData } = user;

    return res.status(200).json({
      message: "Login successful",
      user: {
        ...userData,
        profileData: roleData,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Error during login",
      error: error.message,
    });
  }
};

/**
 * Login function for students
 * @route POST /api/auth/login/student
 */
exports.loginStudent = async (req, res) => {
  return _loginWithRoleCheck(req, res, Role.STUDENT);
};

/**
 * Login function for teachers
 * @route POST /api/auth/login/teacher
 */
exports.loginTeacher = async (req, res) => {
  return _loginWithRoleCheck(req, res, Role.TEACHER);
};

/**
 * Login function for admins
 * @route POST /api/auth/login/admin
 */
exports.loginAdmin = async (req, res) => {
  return _loginWithRoleCheck(req, res, Role.ADMIN);
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
exports.logout = (req, res) => {
  try {
    // Clear the token cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      message: "Error during logout",
      error: error.message,
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    // User data is added by the auth middleware
    const userId = req.user.userId || req.user.id; // Handle both userId and id

    // Get user with role-specific data
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get role-specific data
    let roleData = null;

    if (user.role === Role.STUDENT) {
      roleData = await prisma.student.findUnique({
        where: { userId: user.id },
        include: { class: true },
      });
    } else if (user.role === Role.TEACHER) {
      roleData = await prisma.teacher.findUnique({
        where: { userId: user.id },
      });
    }

    // Return user data without password
    const { password: _, ...userData } = user;

    return res.status(200).json({
      user: {
        ...userData,
        profileData: roleData,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    return res.status(500).json({
      message: "Error retrieving user profile",
      error: error.message,
    });
  }
};

/**
 * Change user password
 * @route PUT /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId || req.user.id; // Handle both userId and id

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      message: "Error changing password",
      error: error.message,
    });
  }
};
