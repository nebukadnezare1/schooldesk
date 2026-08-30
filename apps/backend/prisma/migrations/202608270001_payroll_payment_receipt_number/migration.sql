-- AlterTable (nullable first, backfilled below, then locked down — mirrors the backfill
-- pattern used by 202608250001_multi_tenant_schools for a column added to pre-existing rows)
ALTER TABLE "PayrollPayment" ADD COLUMN     "receiptNumber" TEXT;

-- Backfill: one sequential number per school, ordered by creation date, matching the
-- "BUL-<year>-<00001>" format the application will use for every new row going forward
-- (see /payrolls/:id/pay in operations-routes.ts).
DO $$
DECLARE
  row RECORD;
  current_school TEXT;
  seq INT;
BEGIN
  current_school := NULL;
  seq := 0;
  FOR row IN SELECT id, "schoolId", "createdAt" FROM "PayrollPayment" ORDER BY "schoolId", "createdAt" LOOP
    IF row."schoolId" IS DISTINCT FROM current_school THEN
      current_school := row."schoolId";
      seq := 0;
    END IF;
    seq := seq + 1;
    UPDATE "PayrollPayment"
    SET "receiptNumber" = 'BUL-' || EXTRACT(YEAR FROM row."createdAt")::text || '-' || LPAD(seq::text, 5, '0')
    WHERE id = row.id;
  END LOOP;
END $$;

-- AlterTable
ALTER TABLE "PayrollPayment" ALTER COLUMN "receiptNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_schoolId_receiptNumber_key" ON "PayrollPayment"("schoolId", "receiptNumber");
