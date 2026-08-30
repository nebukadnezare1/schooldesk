-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add schoolId nullable first, backfilled below, tightened to NOT NULL after
ALTER TABLE "AcademicYear" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "CashTransaction" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Employee" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "EmployeeAttendance" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Expense" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "ExpenseCategory" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "FeeType" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Guardian" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Payment" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Payroll" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "PayrollPayment" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "SchoolClass" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Setting" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "Student" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "StudentFee" ADD COLUMN     "schoolId" TEXT;
ALTER TABLE "User" ADD COLUMN     "schoolId" TEXT;

-- Backfill: everything that already exists in this (until now single-tenant) deployment
-- is attributed to one default School. Guarded so a brand-new, empty database does NOT
-- get a phantom School row before prisma/seed.ts runs its own "bootstrap the first school
-- from env vars" logic (which only fires when the School table is still empty).
DO $$
DECLARE
    default_school_id TEXT;
    default_school_name TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM "User") THEN
        SELECT "value" INTO default_school_name FROM "Setting" WHERE "key" = 'school.name';
        IF default_school_name IS NULL OR default_school_name = '' THEN
            default_school_name := 'École Garden';
        END IF;

        default_school_id := gen_random_uuid()::text;
        INSERT INTO "School" ("id", "name", "createdAt", "updatedAt")
        VALUES (default_school_id, default_school_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

        UPDATE "AcademicYear" SET "schoolId" = default_school_id;
        UPDATE "Attendance" SET "schoolId" = default_school_id;
        UPDATE "CashTransaction" SET "schoolId" = default_school_id;
        UPDATE "Employee" SET "schoolId" = default_school_id;
        UPDATE "EmployeeAttendance" SET "schoolId" = default_school_id;
        UPDATE "Enrollment" SET "schoolId" = default_school_id;
        UPDATE "Expense" SET "schoolId" = default_school_id;
        UPDATE "ExpenseCategory" SET "schoolId" = default_school_id;
        UPDATE "FeeType" SET "schoolId" = default_school_id;
        UPDATE "Guardian" SET "schoolId" = default_school_id;
        UPDATE "Payment" SET "schoolId" = default_school_id;
        UPDATE "Payroll" SET "schoolId" = default_school_id;
        UPDATE "PayrollPayment" SET "schoolId" = default_school_id;
        UPDATE "SalaryAdvance" SET "schoolId" = default_school_id;
        UPDATE "SchoolClass" SET "schoolId" = default_school_id;
        UPDATE "Setting" SET "schoolId" = default_school_id;
        UPDATE "Student" SET "schoolId" = default_school_id;
        UPDATE "StudentFee" SET "schoolId" = default_school_id;
        UPDATE "User" SET "schoolId" = default_school_id;
    END IF;
END $$;

-- AlterTable: tighten schoolId to NOT NULL now that every existing row (if any) has one
ALTER TABLE "AcademicYear" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Attendance" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "CashTransaction" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "EmployeeAttendance" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Enrollment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ExpenseCategory" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "FeeType" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Guardian" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Payroll" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PayrollPayment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "SalaryAdvance" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "SchoolClass" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Setting" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentFee" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "schoolId" SET NOT NULL;

-- DropIndex: previously-global unique constraints replaced by per-school composites below
DROP INDEX "AcademicYear_label_key";
DROP INDEX "Employee_matricule_key";
DROP INDEX "Expense_number_key";
DROP INDEX "ExpenseCategory_name_key";
DROP INDEX "FeeType_name_key";
DROP INDEX "Payment_paymentNumber_key";
DROP INDEX "Payment_receiptNumber_key";
DROP INDEX "Setting_key_key";
DROP INDEX "Student_matricule_key";

-- CreateIndex
CREATE INDEX "AcademicYear_schoolId_idx" ON "AcademicYear"("schoolId");
CREATE UNIQUE INDEX "AcademicYear_schoolId_label_key" ON "AcademicYear"("schoolId", "label");

CREATE INDEX "Attendance_schoolId_idx" ON "Attendance"("schoolId");

CREATE INDEX "CashTransaction_schoolId_idx" ON "CashTransaction"("schoolId");

CREATE INDEX "Employee_schoolId_idx" ON "Employee"("schoolId");
CREATE UNIQUE INDEX "Employee_schoolId_matricule_key" ON "Employee"("schoolId", "matricule");

CREATE INDEX "EmployeeAttendance_schoolId_idx" ON "EmployeeAttendance"("schoolId");

CREATE INDEX "Enrollment_schoolId_idx" ON "Enrollment"("schoolId");

CREATE INDEX "Expense_schoolId_idx" ON "Expense"("schoolId");
CREATE UNIQUE INDEX "Expense_schoolId_number_key" ON "Expense"("schoolId", "number");

CREATE INDEX "ExpenseCategory_schoolId_idx" ON "ExpenseCategory"("schoolId");
CREATE UNIQUE INDEX "ExpenseCategory_schoolId_name_key" ON "ExpenseCategory"("schoolId", "name");

CREATE INDEX "FeeType_schoolId_idx" ON "FeeType"("schoolId");
CREATE UNIQUE INDEX "FeeType_schoolId_name_key" ON "FeeType"("schoolId", "name");

CREATE INDEX "Guardian_schoolId_idx" ON "Guardian"("schoolId");

CREATE INDEX "Payment_schoolId_idx" ON "Payment"("schoolId");
CREATE UNIQUE INDEX "Payment_schoolId_paymentNumber_key" ON "Payment"("schoolId", "paymentNumber");
CREATE UNIQUE INDEX "Payment_schoolId_receiptNumber_key" ON "Payment"("schoolId", "receiptNumber");

CREATE INDEX "Payroll_schoolId_idx" ON "Payroll"("schoolId");

CREATE INDEX "PayrollPayment_schoolId_idx" ON "PayrollPayment"("schoolId");

CREATE INDEX "SalaryAdvance_schoolId_idx" ON "SalaryAdvance"("schoolId");

CREATE INDEX "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId");

CREATE INDEX "Setting_schoolId_idx" ON "Setting"("schoolId");
CREATE UNIQUE INDEX "Setting_schoolId_key_key" ON "Setting"("schoolId", "key");

CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");
CREATE UNIQUE INDEX "Student_schoolId_matricule_key" ON "Student"("schoolId", "matricule");

CREATE INDEX "StudentFee_schoolId_idx" ON "StudentFee"("schoolId");

CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeType" ADD CONSTRAINT "FeeType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
