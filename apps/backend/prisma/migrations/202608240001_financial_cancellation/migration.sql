ALTER TABLE "Expense" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Expense" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalaryAdvance" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "SalaryAdvance" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollPayment_payrollId_idx" ON "PayrollPayment"("payrollId");

ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: earlier salary payments were only recorded as a running total on Payroll.amountPaid plus a
-- CashTransaction with a synthetic sourceId, with no individual payment record to cancel independently.
-- Reconstruct one PayrollPayment per historical CashTransaction so existing data keeps working under the
-- new model, and repoint each CashTransaction's sourceId at the reconstructed payment.
DO $$
DECLARE
    r RECORD;
    fallback_user_id TEXT;
    new_payment_id TEXT;
BEGIN
    SELECT id INTO fallback_user_id FROM "User" ORDER BY "createdAt" ASC LIMIT 1;
    IF fallback_user_id IS NOT NULL THEN
        FOR r IN SELECT * FROM "CashTransaction" WHERE "sourceType" = 'PAYROLL_PAYMENT' AND "payrollId" IS NOT NULL LOOP
            new_payment_id := gen_random_uuid()::text;
            INSERT INTO "PayrollPayment" (id, "payrollId", amount, method, "paidAt", "recordedById", "createdAt")
            VALUES (new_payment_id, r."payrollId", r.amount, 'CASH', r."occurredAt", fallback_user_id, r."occurredAt");
            UPDATE "CashTransaction" SET "sourceId" = new_payment_id WHERE id = r.id;
        END LOOP;
    END IF;
END $$;
