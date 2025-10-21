// src/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { validationResult } = require("express-validator");

// rute
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const classRoutes = require("./routes/classRoutes");
const studentRoutes = require("./routes/studentRoutes"); // <--- INI SUDAH DIPERBAIKI
const teacherSubjectRoutes = require("./routes/teacherSubjectRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");

// Initialize express app
const app = express();
// Variabel PORT dan app.listen() dihapus/dikomentari untuk Vercel.

// CORS configuration - Allow multiple origins
const allowedOrigins = [
  "http://localhost:3000", // React default port
  "http://localhost:5173", // Vite default port
  "http://localhost:3001", // Alternative React port
  process.env.CORS_ORIGIN, // Custom origin from env
].filter(Boolean); // Remove undefined values

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("Origin:", req.headers.origin);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/teacher-subjects", teacherSubjectRoutes);
app.use("/api/schedules", scheduleRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Sistem Absensi API",
    version: "1.0.0",
    status: "running",
    allowedOrigins: allowedOrigins,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

// 404 middleware
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Export Express application for Vercel Serverless Function
module.exports = app;
