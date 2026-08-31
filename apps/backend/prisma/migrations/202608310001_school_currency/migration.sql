-- Adds structured region/currency to School. DEFAULT 'MA'/'MAD' both sets the value for new
-- schools going forward AND backfills every existing school in the same statement (no separate
-- data-migration step needed, no financial amount touched) — see CLAUDE.md currency feature notes.
-- AlterTable
ALTER TABLE "School" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'MA',
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'MAD';
