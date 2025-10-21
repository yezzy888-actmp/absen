/*
  Warnings:

  - Added the required column `gender` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `Teacher` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('LAKI_LAKI', 'PEREMPUAN');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "gender" "Gender" NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "gender" "Gender" NOT NULL;
