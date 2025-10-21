// src/utils/prisma.js
const { PrismaClient } = require("../../generated/prisma");

// Gunakan variabel global untuk menyimpan instance PrismaClient di non-production.
// Ini mencegah pembuatan banyak instance selama hot-reloading (misalnya, pengembangan lokal),
// yang dapat menghabiskan connection pool database.
const prisma =
  global.prisma ||
  new PrismaClient({
    // Opsional: Tambahkan logging untuk debugging yang lebih baik di lingkungan serverless
    // log: ["query", "info", "warn", "error"],
  });

// Di lingkungan non-production, simpan instance ke objek global.
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

module.exports = prisma;
