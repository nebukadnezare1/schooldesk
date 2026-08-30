const frenchMonths = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * The "Mensualité" period/due date for a given academic year, clamped into the year's
 * bounds — before the year starts, everyone is billed for its first month; after it ends,
 * its last month. Shared by ensureStudentFees (student create/edit) and the monthly job
 * (generateMonthlyMensualites), so both agree on what "the current month" means.
 */
export const monthlyFeePeriod = (academicYear: { startsAt: Date; endsAt: Date }, now: Date = new Date()) => {
    const referenceDate = now < academicYear.startsAt ? academicYear.startsAt : now > academicYear.endsAt ? academicYear.endsAt : now;
    const period = `${frenchMonths[referenceDate.getUTCMonth()]} ${referenceDate.getUTCFullYear()}`;
    const dueDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 5));
    return { period, dueDate };
};
