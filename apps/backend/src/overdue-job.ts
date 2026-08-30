import type { PrismaClient } from '@prisma/client';

/**
 * Flips any UNPAID StudentFee whose due date has passed to OVERDUE, across every school —
 * the same correction GET /unpaid-fees already applies on the fly when someone opens the
 * page (see finance-routes.ts), but run proactively so the status is accurate everywhere
 * (Dashboard included) without depending on a visit to Impayés first.
 */
export const refreshOverdueStatuses = async (prisma: PrismaClient) => {
    const result = await prisma.studentFee.updateMany({
        where: { status: 'UNPAID', dueDate: { lt: new Date() } },
        data: { status: 'OVERDUE' }
    });
    return result.count;
};
