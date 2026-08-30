import type { TenantTransaction } from './tenant-db.js';

/** Highest numeric suffix (e.g. "PAY-2026-00025" → 25) found across a list of formatted receipt/expense numbers. 0 if none. */
export const maxNumericSuffix = (values: string[]): number => values.reduce((max, value) => {
    const match = /-(\d+)$/.exec(value);
    const parsed = match ? Number(match[1]) : 0;
    return parsed > max ? parsed : max;
}, 0);

/**
 * Returns the next value of a dedicated, monotonic per-school/per-series counter (`NumberSequence`).
 * Deliberately not derived from `count()` or from the current max in the live table alone: after a
 * backup restore, the live table may have fewer/different rows than were ever actually issued
 * (numbers created between a backup snapshot and a later restore are wiped from the live table but
 * were already handed out on real receipts) — `count()+1` or "current max + 1" could then reissue an
 * already-used number. `NumberSequence` is excluded from restore (see backup.ts) so it keeps
 * incrementing across a restore and can never go backwards.
 *
 * `bootstrapMax` is only evaluated the first time this (schoolId, series) pair is used — it seeds the
 * counter from the highest number already present in the live table, for schools/series that predate
 * this counter.
 */
export const nextSequenceNumber = async (tx: TenantTransaction, schoolId: string, series: string, bootstrapMax: () => Promise<number>): Promise<number> => {
    const existing = await tx.numberSequence.findUnique({ where: { schoolId_series: { schoolId, series } } });
    if (existing) {
        const updated = await tx.numberSequence.update({ where: { schoolId_series: { schoolId, series } }, data: { lastValue: { increment: 1 } } });
        return updated.lastValue;
    }
    const bootstrap = await bootstrapMax();
    // Atomic INSERT ... ON CONFLICT DO UPDATE: if a concurrent request created the row first
    // between the findUnique above and here, this falls through to the increment branch instead
    // of re-creating with a now-stale bootstrap value.
    const created = await tx.numberSequence.upsert({
        where: { schoolId_series: { schoolId, series } },
        create: { schoolId, series, lastValue: bootstrap + 1 },
        update: { lastValue: { increment: 1 } }
    });
    return created.lastValue;
};
