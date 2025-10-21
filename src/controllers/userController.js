// src/controllers/userController.js
const prisma = require("../utils/prisma");
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { Role } = require("../utils/enum");

/**
 * Get all users (for admin)
 * @route GET /api/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    // Optional filtering
    const { role } = req.query;

    const where = {};
    if (role) {
      where.role = role;
    }

    // Get users with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              name: true,
              nis: true,
              gender: true,
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          teacher: {
            select: {
              id: true,
              name: true,
              gender: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({
      message: "Error retrieving users",
      error: error.message,
    });
  }
};

/**
 * Get user by ID (for admin)
 * @route GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
            gender: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        teacher: {
          select: {
            id: true,
            name: true,
            gender: true,
            subjects: {
              select: {
                subject: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get user by ID error:", error);
    return res.status(500).json({
      message: "Error retrieving user",
      error: error.message,
    });
  }
};

/**
 * Create a new user (for admin)
 * @route POST /api/users
 */
exports.createUser = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role, name, nis, gender, classId } = req.body;

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

    // Create transaction to ensure both user and role-specific data are created
    const result = await prisma.$transaction(async (prisma) => {
      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
        },
      });

      // Create role-specific data
      if (role === Role.STUDENT) {
        if (!nis || !name || !gender || !classId) {
          throw new Error(
            "Student registration requires additional fields: name, nis, gender, classId"
          );
        }

        // Verify class exists
        const classExists = await prisma.class.findUnique({
          where: { id: classId },
        });

        if (!classExists) {
          throw new Error("Selected class does not exist");
        }

        // Create student data
        await prisma.student.create({
          data: {
            userId: user.id,
            name,
            nis,
            gender,
            classId,
          },
        });
      } else if (role === Role.TEACHER) {
        if (!name || !gender) {
          throw new Error(
            "Teacher registration requires additional fields: name, gender"
          );
        }

        // Create teacher data
        await prisma.teacher.create({
          data: {
            userId: user.id,
            name,
            gender,
          },
        });
      } else if (role !== Role.ADMIN) {
        throw new Error("Invalid role specified");
      }

      return user;
    });

    // Return success without password
    const { password: _, ...userData } = result;
    return res.status(201).json({
      message: "User created successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      message: "Error creating user",
      error: error.message,
    });
  }
};

/**
 * Update a user (for admin)
 * @route PUT /api/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { email, role, name, nis, gender, classId } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        student: true,
        teacher: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if email is being changed and is already taken
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
      });

      if (emailTaken) {
        return res.status(400).json({ message: "Email is already in use" });
      }
    }

    // Update transaction to handle user and role-specific data
    const result = await prisma.$transaction(async (prisma) => {
      // Update base user data
      const userData = { email };

      // If role is changing, handle role transition
      if (role && role !== existingUser.role) {
        userData.role = role;

        // Handle role transition scenarios
        // Delete old role data if exists
        if (existingUser.student) {
          await prisma.student.delete({
            where: { userId: id },
          });
        }

        if (existingUser.teacher) {
          await prisma.teacher.delete({
            where: { userId: id },
          });
        }

        // Create new role data based on new role
        if (role === Role.STUDENT) {
          if (!name || !gender || !classId || !nis) {
            throw new Error(
              "Student data requires name, gender, classId, and nis"
            );
          }

          await prisma.student.create({
            data: {
              userId: id,
              name,
              nis,
              gender,
              classId,
            },
          });
        } else if (role === Role.TEACHER) {
          if (!name || !gender) {
            throw new Error("Teacher data requires name and gender");
          }

          await prisma.teacher.create({
            data: {
              userId: id,
              name,
              gender,
            },
          });
        }
      } else {
        // Update existing role data without changing role
        if (existingUser.role === Role.STUDENT && existingUser.student) {
          if (name || gender || classId || nis) {
            const studentData = {};
            if (name) studentData.name = name;
            if (gender) studentData.gender = gender;
            if (classId) studentData.classId = classId;
            if (nis) studentData.nis = nis;

            await prisma.student.update({
              where: { userId: id },
              data: studentData,
            });
          }
        } else if (existingUser.role === Role.TEACHER && existingUser.teacher) {
          if (name || gender) {
            const teacherData = {};
            if (name) teacherData.name = name;
            if (gender) teacherData.gender = gender;

            await prisma.teacher.update({
              where: { userId: id },
              data: teacherData,
            });
          }
        }
      }

      // Update user
      return await prisma.user.update({
        where: { id },
        data: userData,
      });
    });

    return res.status(200).json({
      message: "User updated successfully",
      user: result,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      message: "Error updating user",
      error: error.message,
    });
  }
};

/**
 * Delete a user (for admin)
 * @route DELETE /api/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        student: true,
        teacher: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user with cascade
    await prisma.$transaction(async (prisma) => {
      // Handle role-specific data deletion first
      if (user.role === Role.STUDENT && user.student) {
        // Delete all related student data first
        await prisma.attendance.deleteMany({
          where: { studentId: user.student.id },
        });

        await prisma.score.deleteMany({
          where: { studentId: user.student.id },
        });

        // Delete student record
        await prisma.student.delete({
          where: { userId: id },
        });
      } else if (user.role === Role.TEACHER && user.teacher) {
        // Delete all related teacher data first
        await prisma.teacherSubject.deleteMany({
          where: { teacherId: user.teacher.id },
        });

        // Handle sessions and schedules
        const schedules = await prisma.schedule.findMany({
          where: { teacherId: user.teacher.id },
          select: { id: true },
        });

        const scheduleIds = schedules.map((s) => s.id);

        // Delete sessions and related attendance records
        const sessions = await prisma.attendanceSession.findMany({
          where: { scheduleId: { in: scheduleIds } },
          select: { id: true },
        });

        const sessionIds = sessions.map((s) => s.id);

        await prisma.attendance.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        await prisma.attendanceSession.deleteMany({
          where: { scheduleId: { in: scheduleIds } },
        });

        // Delete schedules
        await prisma.schedule.deleteMany({
          where: { teacherId: user.teacher.id },
        });

        // Delete teacher record
        await prisma.teacher.delete({
          where: { userId: id },
        });
      }

      // Finally delete the user
      await prisma.user.delete({
        where: { id },
      });
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({
      message: "Error deleting user",
      error: error.message,
    });
  }
};

/**
 * Reset user password (for admin)
 * @route POST /api/users/:id/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      message: "Error resetting password",
      error: error.message,
    });
  }
};
