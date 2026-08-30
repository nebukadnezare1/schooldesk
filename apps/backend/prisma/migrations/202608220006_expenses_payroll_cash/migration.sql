CREATE TYPE "ExpenseCategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CashTransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "PayrollStatus" AS ENUM ('TO_PAY', 'PARTIALLY_PAID', 'PAID');
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('OPEN', 'RECOVERED', 'CANCELLED');

CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ExpenseCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "beneficiary" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "comment" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "bonuses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PayrollStatus" NOT NULL DEFAULT 'TO_PAY',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "recoveryMonth" TEXT NOT NULL,
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "type" "CashTransactionType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "expenseId" TEXT,
    "payrollId" TEXT,
    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE UNIQUE INDEX "Expense_number_key" ON "Expense"("number");
CREATE INDEX "Expense_occurredAt_idx" ON "Expense"("occurredAt");
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE UNIQUE INDEX "Payroll_employeeId_month_key" ON "Payroll"("employeeId", "month");
CREATE INDEX "Payroll_month_status_idx" ON "Payroll"("month", "status");
CREATE INDEX "SalaryAdvance_employeeId_recoveryMonth_idx" ON "SalaryAdvance"("employeeId", "recoveryMonth");
CREATE UNIQUE INDEX "CashTransaction_sourceType_sourceId_key" ON "CashTransaction"("sourceType", "sourceId");
CREATE UNIQUE INDEX "CashTransaction_expenseId_key" ON "CashTransaction"("expenseId");
CREATE INDEX "CashTransaction_occurredAt_type_idx" ON "CashTransaction"("occurredAt", "type");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
