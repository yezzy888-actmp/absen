-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "scannedLatitude" DOUBLE PRECISION,
ADD COLUMN     "scannedLongitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "radiusMeters" INTEGER;
