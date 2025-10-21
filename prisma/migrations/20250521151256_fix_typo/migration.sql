/*
  Warnings:

  - You are about to drop the column `descriptiton` on the `Score` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Score" DROP COLUMN "descriptiton",
ADD COLUMN     "description" TEXT;
