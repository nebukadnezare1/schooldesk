-- Offline-first : chaque paiement/dépense/versement de salaire/avance porte désormais un
-- identifiant technique client (clientOperationId) permettant de rejouer sans risque de
-- doublon une opération créée hors connexion (idempotence à la synchronisation).
-- Colonnes ajoutées nullable puis backfillées avant la contrainte NOT NULL/UNIQUE, car des
-- lignes existantes doivent recevoir une valeur avant que la contrainte ne puisse s'appliquer
-- (même méthode que les migrations précédentes du 25/08 et du 27/08).

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "clientOperationId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "clientOperationId" TEXT;
ALTER TABLE "PayrollPayment" ADD COLUMN "clientOperationId" TEXT;
ALTER TABLE "SalaryAdvance" ADD COLUMN "clientOperationId" TEXT;

-- Backfill : chaque ligne déjà existante reçoit un identifiant technique unique généré côté
-- base (gen_random_uuid(), disponible nativement depuis PostgreSQL 13) — ces lignes n'ont
-- jamais transité par le mécanisme de synchronisation hors-ligne, la valeur ne sert ici qu'à
-- satisfaire la contrainte NOT NULL/UNIQUE rétroactivement, sans aucune signification métier.
UPDATE "Payment" SET "clientOperationId" = gen_random_uuid()::text WHERE "clientOperationId" IS NULL;
UPDATE "Expense" SET "clientOperationId" = gen_random_uuid()::text WHERE "clientOperationId" IS NULL;
UPDATE "PayrollPayment" SET "clientOperationId" = gen_random_uuid()::text WHERE "clientOperationId" IS NULL;
UPDATE "SalaryAdvance" SET "clientOperationId" = gen_random_uuid()::text WHERE "clientOperationId" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "clientOperationId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "clientOperationId" SET NOT NULL;
ALTER TABLE "PayrollPayment" ALTER COLUMN "clientOperationId" SET NOT NULL;
ALTER TABLE "SalaryAdvance" ALTER COLUMN "clientOperationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_clientOperationId_key" ON "Payment"("clientOperationId");
CREATE UNIQUE INDEX "Expense_clientOperationId_key" ON "Expense"("clientOperationId");
CREATE UNIQUE INDEX "PayrollPayment_clientOperationId_key" ON "PayrollPayment"("clientOperationId");
CREATE UNIQUE INDEX "SalaryAdvance_clientOperationId_key" ON "SalaryAdvance"("clientOperationId");

-- paymentNumber supprimé : jamais affiché à l'utilisateur (seul receiptNumber l'était),
-- toujours généré avec la même séquence que receiptNumber — champ redondant, un seul
-- identifiant définitif désormais (receiptNumber, préfixe "PAY-"). Les valeurs historiques de
-- receiptNumber ne sont pas touchées : aucun reçu déjà émis ne change de numéro.
DROP INDEX "Payment_schoolId_paymentNumber_key";
ALTER TABLE "Payment" DROP COLUMN "paymentNumber";
