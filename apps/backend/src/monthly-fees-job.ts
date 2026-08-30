import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { monthlyFeePeriod } from './fee-period.js';

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

/**
 * Ensures every actively-enrolled student has a "Mensualité" StudentFee for the current
 * period (see monthlyFeePeriod) without anyone having to create or edit their record first.
 * Idempotent (upsert, never touches an existing fee) — safe to run repeatedly across every school.
 */
export const generateMonthlyMensualites = async (prisma: PrismaClient) => {
    const students = await prisma.student.findMany({
        where: { status: 'ACTIVE', monthlyFee: { gt: 0 } },
        include: { enrollments: { include: { academicYear: true }, orderBy: { enrolledAt: 'desc' }, take: 1 } }
    });

    let created = 0;
    for (const student of students) {
        const enrollment = student.enrollments[0];
        const academicYear = enrollment?.academicYear;
        if (!academicYear || academicYear.status !== 'ACTIVE') continue;

        const feeType = await prisma.feeType.upsert({
            where: { schoolId_name: { schoolId: student.schoolId, name: 'Mensualité' } },
            update: {},
            create: { schoolId: student.schoolId, name: 'Mensualité', defaultAmount: new Prisma.Decimal(0), frequency: 'MONTHLY', isMandatory: true }
        });

        const { period, dueDate } = monthlyFeePeriod(academicYear);
        const amount = decimal(Number(student.monthlyFee));
        const where = { studentId_feeTypeId_academicYearId_period: { studentId: student.id, feeTypeId: feeType.id, academicYearId: academicYear.id, period } };

        const existing = await prisma.studentFee.findUnique({ where });
        if (!existing) created += 1;
        await prisma.studentFee.upsert({
            where,
            update: {},
            create: { schoolId: student.schoolId, studentId: student.id, feeTypeId: feeType.id, academicYearId: academicYear.id, period, expectedAmount: amount, finalAmount: amount, dueDate }
        });
    }
    return created;
};
