/*
  Warnings:

  - A unique constraint covering the columns `[studentId,sessionId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_sessionId_key" ON "Attendance"("studentId", "sessionId");
