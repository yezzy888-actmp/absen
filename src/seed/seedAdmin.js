// src/seeds/seedAdmin.js
require("dotenv").config();
const bcrypt = require("bcrypt");
const prisma = require("../utils/prisma");

async function seedAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: {
        email: "admin@example.com",
      },
    });

    if (existingAdmin) {
      console.log("Admin user already exists, skipping seed");
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("1234567890", 10);

    const admin = await prisma.user.create({
      data: {
        email: "adhamghilbran888@gmail.com",
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    console.log("Admin user created successfully:", admin.id);
  } catch (error) {
    console.error("Error seeding admin user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute seeding function
seedAdmin()
  .then(() => console.log("Admin seeding completed"))
  .catch((error) => {
    console.error("Admin seeding failed:", error);
    process.exit(1);
  });
