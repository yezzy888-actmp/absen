// src/middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const { Role } = require("../utils/enum");

/**
 * Middleware to verify JWT token and add user data to request
 */
exports.authenticate = (req, res, next) => {
  try {
    // Get token from request (cookie or Authorization header)
    const token =
      req.cookies.token ||
      (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
        ? req.headers.authorization.split(" ")[1]
        : null);

    // Debug: Log token presence
    console.log("Token present:", !!token);
    console.log("Token source:", req.cookies.token ? "cookie" : "header");

    // Immediately reject if no token is found
    if (!token) {
      return res
        .status(401)
        .json({ message: "Authentication required - No token provided" });
    }

    try {
      // Verify token - this will throw an error if token is invalid
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Debug: Log decoded token content
      console.log("Decoded token:", JSON.stringify(decoded, null, 2));

      // Validate that decoded token has required fields
      // Check for either 'id' or 'userId' field
      const userId = decoded.id || decoded.userId;
      if (!userId) {
        console.error("JWT token missing both 'id' and 'userId' fields");
        return res.status(401).json({
          message: "Invalid token - missing user ID",
        });
      }

      if (!decoded.role) {
        console.error("JWT token missing 'role' field");
        return res.status(401).json({
          message: "Invalid token - missing user role",
        });
      }

      // Add user data to request with consistent field names
      req.user = {
        id: userId, // Normalize to 'id' regardless of source field name
        email: decoded.email,
        role: decoded.role,
        // Include any other fields that might be in the token
        ...decoded,
        // Override to ensure consistency
        id: userId,
      };

      console.log("User set in request:", JSON.stringify(req.user, null, 2));

      next();
    } catch (jwtError) {
      // Specific error for invalid tokens
      console.error("JWT verification error:", jwtError.message);
      return res.status(401).json({
        message: "Invalid or expired token",
        error: jwtError.message,
      });
    }
  } catch (error) {
    console.error("Authentication process error:", error);
    return res.status(500).json({
      message: "Authentication process failed",
      error: error.message,
    });
  }
};

/**
 * Middleware to check if user has required role
 * @param {Array|String} roles - Required role(s)
 */
exports.authorize = (roles) => {
  return (req, res, next) => {
    try {
      // Convert single role to array
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      // Check if user exists (authenticate middleware should run first)
      if (!req.user) {
        return res.status(401).json({
          message: "Authentication required - User not found in request",
        });
      }

      // Check if user has required role
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: `Access forbidden - Required role(s): ${allowedRoles.join(
            ", "
          )}, your role: ${req.user.role}`,
        });
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
};

/**
 * Common middleware combinations for different roles
 */
exports.isAdmin = [exports.authenticate, exports.authorize(Role.ADMIN)];
exports.isTeacher = [exports.authenticate, exports.authorize(Role.TEACHER)];
exports.isStudent = [exports.authenticate, exports.authorize(Role.STUDENT)];
exports.isTeacherOrAdmin = [
  exports.authenticate,
  exports.authorize([Role.TEACHER, Role.ADMIN]),
];
exports.isAuthenticated = exports.authenticate;
