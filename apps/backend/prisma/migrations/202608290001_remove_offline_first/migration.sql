-- Retrait du mode hors-ligne (28/08) à la demande de l'utilisateur (29/08) : l'application
-- reste "toujours connectée". La consolidation paymentNumber/receiptNumber en un seul champ
-- (migration 202608280001) reste en place, décision indépendante et toujours valable — seule
-- la colonne technique clientOperationId (idempotence hors-ligne, plus utile) est retirée.

DROP INDEX "Payment_clientOperationId_key";
ALTER TABLE "Payment" DROP COLUMN "clientOperationId";

DROP INDEX "Expense_clientOperationId_key";
ALTER TABLE "Expense" DROP COLUMN "clientOperationId";

DROP INDEX "PayrollPayment_clientOperationId_key";
ALTER TABLE "PayrollPayment" DROP COLUMN "clientOperationId";

DROP INDEX "SalaryAdvance_clientOperationId_key";
ALTER TABLE "SalaryAdvance" DROP COLUMN "clientOperationId";
