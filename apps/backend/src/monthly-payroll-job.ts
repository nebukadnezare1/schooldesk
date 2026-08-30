import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

/**
 * Ensures every active employee with a configured base salary has a "TO_PAY" Payroll for the
 * current calendar month, without anyone having to click "+ Nouveau salaire" first. Idempotent
 * (skips if a Payroll already exists for that employee/month — same @@unique as the manual
 * creation route) — safe to run repeatedly across every school. Staff are paid on the same
 * school-year calendar as students (September–June, see fee-period.ts) — no payroll is
 * generated outside the active academic year's bounds (summer break).
 */
export const generateMonthlyPayrolls = async (prisma: PrismaClient) => {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const activeYears = await prisma.academicYear.findMany({ where: { status: 'ACTIVE' } });
    const activeYearBySchool = new Map(activeYears.map((year) => [year.schoolId, year]));

    const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE', baseSalary: { gt: 0 } } });

    let created = 0;
    for (const employee of employees) {
        const academicYear = activeYearBySchool.get(employee.schoolId);
        if (!academicYear || now < academicYear.startsAt || now > academicYear.endsAt) continue;

        const existing = await prisma.payroll.findUnique({ where: { employeeId_month: { employeeId: employee.id, month } } });
        if (existing) continue;

        const baseSalary = decimal(Number(employee.baseSalary));
        await prisma.payroll.create({
            data: { schoolId: employee.schoolId, employeeId: employee.id, month, baseSalary, bonuses: decimal(0), advances: decimal(0), deductions: decimal(0), netSalary: baseSalary }
        });
        created += 1;
    }
    return created;
};
