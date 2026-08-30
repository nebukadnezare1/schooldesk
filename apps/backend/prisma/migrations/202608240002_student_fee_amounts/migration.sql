ALTER TABLE "Student" ADD COLUMN "monthlyFee" DECIMAL(12,2);
ALTER TABLE "Student" ADD COLUMN "insuranceFee" DECIMAL(12,2);

-- Seed the "Assurance" fee type (annual, payable in installments via the existing partial-payment
-- mechanism already used for "Mensualité") so it is available in fee type selectors right away.
INSERT INTO "FeeType" (id, name, "defaultAmount", frequency, "isMandatory", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Assurance', 0, 'YEARLY', true, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "FeeType" WHERE name = 'Assurance');
