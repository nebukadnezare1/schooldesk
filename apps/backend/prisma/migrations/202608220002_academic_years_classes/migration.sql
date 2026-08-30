-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('FUTURE', 'ACTIVE', 'CLOSED');
CREATE TYPE "SchoolClassStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'FUTURE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "room" TEXT,
    "capacity" INTEGER NOT NULL,
    "status" "SchoolClassStatus" NOT NULL DEFAULT 'ACTIVE',
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicYear_label_key" ON "AcademicYear"("label");
CREATE UNIQUE INDEX "SchoolClass_academicYearId_name_key" ON "SchoolClass"("academicYearId", "name");
CREATE INDEX "SchoolClass_academicYearId_idx" ON "SchoolClass"("academicYearId");
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
