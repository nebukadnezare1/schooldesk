import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';

const startOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addMonths = (date: Date, count: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const toNumber = (value: Prisma.Decimal | null | undefined) => (value ? Number(value) : 0);
const sumByType = (groups: { type: string; _sum: { amount: Prisma.Decimal | null } }[], type: string) => toNumber(groups.find((group) => group.type === type)?._sum.amount);

export const createDashboardRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/dashboard/summary', authenticate(prisma), requirePermission('dashboard.view'), async (request, response) => {
        const now = new Date();
        const todayStart = startOfDay(now);
        const currentMonthKey = monthKey(now);
        const requestedMonth = typeof request.query.month === 'string' && /^\d{4}-\d{2}$/.test(request.query.month) ? request.query.month : currentMonthKey;
        const [requestedYear, requestedMonthIndex] = requestedMonth.split('-').map(Number);
        const monthStart = new Date(Date.UTC(requestedYear, requestedMonthIndex - 1, 1));
        const nextMonthStart = addMonths(monthStart, 1);
        const previousMonthStart = addMonths(monthStart, -1);

        const activeYear = await request.db!.academicYear.findFirst({ where: { status: 'ACTIVE' } });
        const [cancelledPayments, cancelledExpenses, cancelledPayrollPayments] = await Promise.all([
            request.db!.payment.findMany({ where: { cancelledAt: { not: null } }, select: { id: true } }),
            request.db!.expense.findMany({ where: { cancelledAt: { not: null } }, select: { id: true } }),
            request.db!.payrollPayment.findMany({ where: { cancelledAt: { not: null } }, select: { id: true } })
        ]);
        const cancelledIds = [...cancelledPayments, ...cancelledExpenses, ...cancelledPayrollPayments].map((item) => item.id);
        const excludeCancelledPayments = cancelledIds.length > 0 ? { NOT: { sourceId: { in: cancelledIds } } } : {};

        const [
            studentsActive,
            studentsBySex,
            newStudentsToday,
            teachersActive,
            staffActive,
            studentsWithoutGuardians,
            classesWithCounts,
            attendanceTodayGroups,
            payrollsToPay,
            liveUnpaidFees,
            monthFeeStatusGroups,
            monthExpectedFees,
            todayCash,
            monthCash,
            previousMonthCash,
            cumulativeCash
        ] = await Promise.all([
            request.db!.student.count({ where: { status: 'ACTIVE' } }),
            request.db!.student.groupBy({ by: ['sex'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
            request.db!.student.count({ where: { status: 'ACTIVE', registrationDate: { gte: startOfMonth(now) } } }),
            request.db!.employee.count({ where: { status: 'ACTIVE', type: 'TEACHER' } }),
            request.db!.employee.count({ where: { status: 'ACTIVE' } }),
            request.db!.student.count({ where: { status: 'ACTIVE', guardians: { none: {} } } }),
            activeYear
                ? request.db!.schoolClass.findMany({
                    where: { academicYearId: activeYear.id },
                    orderBy: { name: 'asc' },
                    select: { name: true, _count: { select: { enrollments: { where: { enrolledAt: { lt: nextMonthStart }, OR: [{ endedAt: null }, { endedAt: { gte: monthStart } }] } } } } }
                })
                : Promise.resolve([]),
            request.db!.attendance.groupBy({ by: ['status'], where: { date: todayStart }, _count: { _all: true } }),
            request.db!.payroll.count({ where: { status: { in: ['TO_PAY', 'PARTIALLY_PAID'] } } }),
            request.db!.studentFee.findMany({ where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } }, include: { allocations: { include: { payment: { select: { cancelledAt: true } } } } } }),
            request.db!.studentFee.groupBy({ by: ['status'], where: { dueDate: { gte: monthStart, lt: nextMonthStart } }, _count: { _all: true } }),
            activeYear
                ? request.db!.studentFee.aggregate({ _sum: { finalAmount: true }, where: { academicYearId: activeYear.id, dueDate: { gte: monthStart, lt: nextMonthStart } } })
                : Promise.resolve({ _sum: { finalAmount: null } }),
            request.db!.cashTransaction.groupBy({ by: ['type'], where: { ...excludeCancelledPayments, occurredAt: { gte: todayStart } }, _sum: { amount: true } }),
            request.db!.cashTransaction.groupBy({ by: ['type', 'sourceType'], where: { ...excludeCancelledPayments, occurredAt: { gte: monthStart, lt: nextMonthStart } }, _sum: { amount: true } }),
            request.db!.cashTransaction.groupBy({ by: ['type'], where: { ...excludeCancelledPayments, occurredAt: { gte: previousMonthStart, lt: monthStart } }, _sum: { amount: true } }),
            request.db!.cashTransaction.groupBy({ by: ['type'], where: { ...excludeCancelledPayments, occurredAt: { lt: nextMonthStart } }, _sum: { amount: true } })
        ]);

        const sumUnpaid = (fees: typeof liveUnpaidFees) => fees.reduce((total, fee) => {
            const paid = fee.allocations.filter((allocation) => !allocation.payment.cancelledAt).reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));
            return total + Math.max(toNumber(fee.finalAmount) - toNumber(paid), 0);
        }, 0);

        const monthExpensesOnly = toNumber(
            monthCash.find((group) => group.type === 'EXPENSE' && group.sourceType === 'EXPENSE')?._sum.amount
        );
        const monthPayroll = toNumber(
            monthCash.find((group) => group.type === 'EXPENSE' && group.sourceType === 'PAYROLL_PAYMENT')?._sum.amount
        );
        const monthIncome = monthCash.filter((group) => group.type === 'INCOME').reduce((total, group) => total + toNumber(group._sum.amount), 0);

        const attendanceCount = (status: string) => attendanceTodayGroups.find((group) => group.status === status)?._count._all ?? 0;
        const present = attendanceCount('PRESENT');
        const absent = attendanceCount('ABSENT');
        const late = attendanceCount('LATE');
        const excused = attendanceCount('EXCUSED');
        const attendanceMarked = present + absent + late + excused;

        const boys = studentsBySex.find((group) => group.sex === 'MALE')?._count._all ?? 0;
        const girls = studentsBySex.find((group) => group.sex === 'FEMALE')?._count._all ?? 0;

        return response.json({
            month: requestedMonth,
            isCurrentMonth: requestedMonth === currentMonthKey,
            students: {
                active: studentsActive,
                boys,
                girls,
                newThisMonth: newStudentsToday,
                byClass: classesWithCounts.map((schoolClass) => ({ className: schoolClass.name, count: schoolClass._count.enrollments }))
            },
            staff: { active: staffActive, teachersActive },
            attendanceToday: { present, absent, late, excused, rate: attendanceMarked > 0 ? Math.round((present / attendanceMarked) * 100) : 0 },
            finance: {
                todayIncome: sumByType(todayCash, 'INCOME'),
                monthIncome,
                monthExpected: toNumber(monthExpectedFees._sum.finalAmount),
                unpaidTotal: sumUnpaid(liveUnpaidFees),
                monthExpenses: monthExpensesOnly,
                monthPayroll,
                balance: sumByType(cumulativeCash, 'INCOME') - sumByType(cumulativeCash, 'EXPENSE'),
                previousMonthIncome: sumByType(previousMonthCash, 'INCOME'),
                previousMonthExpenses: sumByType(previousMonthCash, 'EXPENSE')
            },
            charts: {
                studentsByClass: classesWithCounts.map((schoolClass) => ({ className: schoolClass.name, count: schoolClass._count.enrollments })),
                feeStatus: monthFeeStatusGroups.map((group) => ({ status: group.status, count: group._count._all }))
            },
            toDo: {
                unpaidCount: liveUnpaidFees.length,
                absentToday: absent,
                payrollsToPay,
                incompleteDossiers: studentsWithoutGuardians
            }
        });
    });

    return router;
};
