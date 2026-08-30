ALTER TABLE "Student" ADD COLUMN "monthlyFee" DECIMAL(12,2);
ALTER TABLE "Student" ADD COLUMN "insuranceFee" DECIMAL(12,2);

-- Seed the "Assurance" fee type (annual, payable in installments via the existing partial-payment
-- mechanism already used for "Mensualité") so it is available in fee type selectors right away.
-- Guarded on pre-existing data (mirrors the "IF EXISTS (SELECT 1 FROM User)" guard added by the
-- later 202608250001_multi_tenant_schools migration): on a database that already has real users
-- at the time this migration runs, that later migration's backfill assigns this row a schoolId
-- before the column is tightened to NOT NULL. On a genuinely fresh database (no users yet — the
-- normal case for any new install replaying full history before the app's first admin exists),
-- skipping this insert avoids leaving an orphan, unassignable row with no school to belong to;
-- ensureFeeType() (student-routes.ts) creates each school's own "Assurance"/"Mensualité" FeeType
-- lazily on demand regardless, so nothing is lost for schools created after this point.
INSERT INTO "FeeType" (id, name, "defaultAmount", frequency, "isMandatory", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Assurance', 0, 'YEARLY', true, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "FeeType" WHERE name = 'Assurance')
  AND EXISTS (SELECT 1 FROM "User");
