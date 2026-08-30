import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';
import { assertOwned } from './tenant-db.js';
import type { TenantTransaction } from './tenant-db.js';
import { maxNumericSuffix, nextSequenceNumber } from './numbering.js';

const frequencies = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'OTHER'] as const;
const methods = ['CASH', 'TRANSFER', 'CHECK', 'CARD', 'OTHER'] as const;
const feeStatuses = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'EXEMPT', 'CANCELLED'] as const;
const unpaidStatuses = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;
const isMoney = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2));
type PaymentAllocationInput = { studentFeeId: string; amount: number };

const refreshFeeStatus = async (transaction: TenantTransaction, feeId: string) => {
    const fee = await transaction.studentFee.findUnique({ where: { id: feeId }, include: { allocations: { include: { payment: { select: { cancelledAt: true } } } } } });
    if (!fee) return;
    const paid = fee.allocations.filter((allocation) => !allocation.payment.cancelledAt).reduce((total, allocation) => total.plus(allocation.amount), new Prisma.Decimal(0));
    const status = paid.gte(fee.finalAmount) ? 'PAID' : paid.gt(0) ? 'PARTIALLY_PAID' : fee.dueDate < new Date() ? 'OVERDUE' : 'UNPAID';
    await transaction.studentFee.update({ where: { id: feeId }, data: { status } });
};

export const createFinanceRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/fee-types', authenticate(prisma), requirePermission('fees.view'), async (request, response) => {
        const feeTypes = await request.db!.feeType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
        // Mensualité is by far the most commonly used type at encaissement time — surfaced first so staff rarely need to scroll/search for it.
        feeTypes.sort((a, b) => (a.name === 'Mensualité' ? -1 : b.name === 'Mensualité' ? 1 : 0));
        return response.json({ feeTypes });
    });

    router.post('/fee-types', authenticate(prisma), requirePermission('fees.manage'), async (request, response) => {
        const { name, defaultAmount, frequency = 'ONE_TIME', isMandatory = false } = request.body;
        if (typeof name !== 'string' || !name.trim() || !isMoney(defaultAmount) || !frequencies.includes(frequency) || typeof isMandatory !== 'boolean') return response.status(400).json({ error: 'Type de frais invalide.' });
        try {
            const feeType = await request.db!.feeType.create({ data: { schoolId: request.authUser!.schoolId, name: name.trim(), defaultAmount: decimal(defaultAmount), frequency, isMandatory } });
            return response.status(201).json({ feeType });
        } catch {
            return response.status(409).json({ error: 'Ce type de frais existe déjà.' });
        }
    });

    router.get('/finance/students-summary', authenticate(prisma), requirePermission('fees.view'), async (request, response) => {
        const academicYearId = typeof request.query.academicYearId === 'string' && request.query.academicYearId ? request.query.academicYearId : undefined;
        const fees = await request.db!.studentFee.findMany({
            where: { academicYearId },
            include: { allocations: { include: { payment: { select: { cancelledAt: true } } } } }
        });
        const now = new Date();
        const byStudent = new Map<string, { totalDue: Prisma.Decimal; totalPaid: Prisma.Decimal; overdue: boolean }>();
        for (const fee of fees) {
            const paid = fee.allocations.filter((allocation) => !allocation.payment.cancelledAt).reduce((total, allocation) => total.plus(allocation.amount), new Prisma.Decimal(0));
            const entry = byStudent.get(fee.studentId) ?? { totalDue: new Prisma.Decimal(0), totalPaid: new Prisma.Decimal(0), overdue: false };
            entry.totalDue = entry.totalDue.plus(fee.finalAmount);
            entry.totalPaid = entry.totalPaid.plus(paid);
            if (paid.lt(fee.finalAmount) && fee.dueDate < now) entry.overdue = true;
            byStudent.set(fee.studentId, entry);
        }
        const summary = Array.from(byStudent.entries()).map(([studentId, entry]) => {
            const remaining = entry.totalDue.minus(entry.totalPaid);
            const status = remaining.lte(0) ? 'PAID' : entry.overdue ? 'OVERDUE' : entry.totalPaid.gt(0) ? 'PARTIALLY_PAID' : 'UNPAID';
            return { studentId, totalDue: entry.totalDue, totalPaid: entry.totalPaid, remaining, status };
        });
        return response.json({ summary });
    });

    router.get('/student-fees', authenticate(prisma), requirePermission('fees.view'), async (request, response) => {
        const studentId = typeof request.query.studentId === 'string' ? request.query.studentId : '';
        if (!studentId) return response.status(400).json({ error: 'Élève requis.' });
        const fees = await request.db!.studentFee.findMany({ where: { studentId }, include: { feeType: true, academicYear: true, allocations: { include: { payment: { select: { cancelledAt: true } } } } }, orderBy: { dueDate: 'asc' } });
        const rows = fees.map((fee) => {
            const paidAmount = fee.allocations.filter((allocation) => !allocation.payment.cancelledAt).reduce((total, allocation) => total.plus(allocation.amount), new Prisma.Decimal(0));
            return { ...fee, paidAmount, remaining: fee.finalAmount.minus(paidAmount) };
        });
        return response.json({ fees: rows });
    });

    router.get('/student-fees/:id/payments', authenticate(prisma), requirePermission('payments.view'), async (request, response) => {
        const feeId = request.params.id;
        if (typeof feeId !== 'string') return response.status(400).json({ error: 'Identifiant de frais invalide.' });
        const fee = await request.db!.studentFee.findUnique({ where: { id: feeId }, include: { feeType: true, student: true } });
        if (!fee) return response.status(404).json({ error: 'Frais introuvable.' });
        const payments = await request.db!.payment.findMany({
            where: { allocations: { some: { studentFeeId: feeId } } },
            include: {
                student: { include: { enrollments: { include: { schoolClass: true }, orderBy: { enrolledAt: 'desc' }, take: 1 } } },
                guardian: true,
                recordedBy: { select: { firstName: true, lastName: true } },
                cancelledBy: { select: { firstName: true, lastName: true } },
                allocations: { include: { studentFee: { include: { feeType: true } } } }
            },
            orderBy: { paidAt: 'asc' }
        });
        return response.json({ fee, payments });
    });

    router.post('/student-fees', authenticate(prisma), requirePermission('fees.manage'), async (request, response) => {
        const { studentId, feeTypeId, academicYearId, period, expectedAmount, discount = 0, dueDate } = request.body;
        if (typeof studentId !== 'string' || typeof feeTypeId !== 'string' || typeof academicYearId !== 'string' || typeof period !== 'string' || !period.trim() || !isMoney(expectedAmount) || !isMoney(discount) || discount > expectedAmount || !isDate(dueDate)) return response.status(400).json({ error: 'Frais élève invalides.' });
        const [validStudent, validFeeType, validYear] = await Promise.all([assertOwned(request.db!, 'student', studentId), assertOwned(request.db!, 'feeType', feeTypeId), assertOwned(request.db!, 'academicYear', academicYearId)]);
        if (!validStudent || !validFeeType || !validYear) return response.status(400).json({ error: 'Élève, type de frais ou année scolaire invalide.' });
        const student = await request.db!.student.findUnique({ where: { id: studentId }, select: { status: true, firstName: true, lastName: true } });
        if (student && (student.status === 'LEFT' || student.status === 'ARCHIVED')) return response.status(400).json({ error: `${student.firstName} ${student.lastName} a quitté l'école — impossible d'ajouter un frais pour cet élève.` });
        try {
            const fee = await request.db!.studentFee.create({ data: { schoolId: request.authUser!.schoolId, studentId, feeTypeId, academicYearId, period: period.trim(), expectedAmount: decimal(expectedAmount), discount: decimal(discount), finalAmount: decimal(expectedAmount - discount), dueDate: new Date(dueDate) }, include: { feeType: true } });
            return response.status(201).json({ fee });
        } catch {
            return response.status(409).json({ error: 'Frais dupliqués ou relation inexistante.' });
        }
    });

    router.post('/payments', authenticate(prisma), requirePermission('payments.manage'), async (request, response) => {
        const { studentId, guardianId, amount, method, reference, comment, allocations, academicYearId, feeTypeId, period, dueDate, paidAt } = request.body;
        if (typeof studentId !== 'string' || !isMoney(amount) || amount <= 0 || !methods.includes(method) || (paidAt !== undefined && !isDate(paidAt))) return response.status(400).json({ error: 'Paiement invalide.' });
        let paymentAllocations: PaymentAllocationInput[] = allocations;
        const autoCreate = !Array.isArray(paymentAllocations) || paymentAllocations.length === 0;
        if (autoCreate) {
            if (typeof academicYearId !== 'string' || typeof feeTypeId !== 'string' || typeof period !== 'string' || !period.trim()) return response.status(400).json({ error: 'Élève, mois et type de frais requis.' });
            paymentAllocations = [{ studentFeeId: '', amount }];
        }
        if (paymentAllocations.some((allocation) => (allocation.studentFeeId !== '' && typeof allocation.studentFeeId !== 'string') || !isMoney(allocation.amount) || allocation.amount <= 0)) return response.status(400).json({ error: 'Allocation invalide.' });
        const allocationTotal = paymentAllocations.reduce((total, allocation) => total + allocation.amount, 0);
        if (Math.abs(allocationTotal - amount) > 0.001) return response.status(400).json({ error: 'Le total des allocations doit correspondre au paiement.' });

        const ownershipChecks = [assertOwned(request.db!, 'student', studentId)];
        if (typeof guardianId === 'string' && guardianId) ownershipChecks.push(assertOwned(request.db!, 'guardian', guardianId));
        if (autoCreate) ownershipChecks.push(assertOwned(request.db!, 'academicYear', academicYearId));
        if ((await Promise.all(ownershipChecks)).some((ok) => !ok)) return response.status(400).json({ error: 'Élève, responsable ou année scolaire invalide.' });
        const payingStudent = await request.db!.student.findUnique({ where: { id: studentId }, select: { status: true, firstName: true, lastName: true } });
        if (payingStudent && (payingStudent.status === 'LEFT' || payingStudent.status === 'ARCHIVED')) return response.status(400).json({ error: `${payingStudent.firstName} ${payingStudent.lastName} a quitté l'école — impossible d'enregistrer un encaissement pour cet élève.` });

        try {
            const result = await request.db!.$transaction(async (transaction) => {
                if (paymentAllocations[0].studentFeeId === '') {
                    const existingFee = await transaction.studentFee.findUnique({ where: { studentId_feeTypeId_academicYearId_period: { studentId, feeTypeId, academicYearId, period: period.trim() } } });
                    let fee = existingFee;
                    if (!fee) {
                        const [type, student] = await Promise.all([
                            transaction.feeType.findUnique({ where: { id: feeTypeId } }),
                            transaction.student.findUnique({ where: { id: studentId }, select: { monthlyFee: true, insuranceFee: true } })
                        ]);
                        if (!type) throw new Error('Type de frais inexistant.');
                        if (!student) throw new Error('Élève inexistant.');
                        // The amount actually due follows the price set on the student's file (Mensualité / Assurance),
                        // not the type's generic default — a direct encaissement must never invent a due amount that
                        // differs from what the school actually agreed with the family.
                        const studentAmount = type.name === 'Mensualité' ? student.monthlyFee : type.name === 'Assurance' ? student.insuranceFee : null;
                        const dueAmount = studentAmount ?? type.defaultAmount;
                        const feeDueDate = isDate(dueDate) ? new Date(dueDate) : new Date();
                        fee = await transaction.studentFee.create({ data: { schoolId: request.authUser!.schoolId, studentId, feeTypeId, academicYearId, period: period.trim(), expectedAmount: dueAmount, finalAmount: dueAmount, dueDate: feeDueDate } });
                    }
                    paymentAllocations = [{ studentFeeId: fee.id, amount }];
                }
                const feeIds = paymentAllocations.map((allocation) => allocation.studentFeeId);
                const fees = await transaction.studentFee.findMany({ where: { id: { in: feeIds }, studentId }, include: { allocations: { include: { payment: { select: { cancelledAt: true } } } } } });
                if (fees.length !== new Set(feeIds).size) throw new Error('Frais inexistants.');
                for (const allocation of paymentAllocations) {
                    const fee = fees.find((item) => item.id === allocation.studentFeeId)!;
                    const paid = fee.allocations.filter((item) => !item.payment.cancelledAt).reduce((total, item) => total.plus(item.amount), new Prisma.Decimal(0));
                    if (paid.plus(decimal(allocation.amount)).gt(fee.finalAmount)) throw new Error('Allocation supérieure au reste dû.');
                }
                const sequence = await nextSequenceNumber(transaction, request.authUser!.schoolId, 'PAY', async () => maxNumericSuffix((await transaction.payment.findMany({ select: { receiptNumber: true } })).map((row) => row.receiptNumber)));
                const receiptNumber = `PAY-${new Date().getUTCFullYear()}-${String(sequence).padStart(5, '0')}`;
                const payment = await transaction.payment.create({ data: { schoolId: request.authUser!.schoolId, receiptNumber, studentId, guardianId: typeof guardianId === 'string' ? guardianId : undefined, paidAt: isDate(paidAt) ? new Date(paidAt) : undefined, amount: decimal(amount), method, reference, comment, recordedById: request.authUser!.id, allocations: { create: paymentAllocations.map((allocation) => ({ studentFeeId: allocation.studentFeeId, amount: decimal(allocation.amount) })) } }, include: { allocations: true, student: true } });
                await transaction.cashTransaction.create({ data: { schoolId: request.authUser!.schoolId, type: 'INCOME', occurredAt: payment.paidAt, amount: decimal(amount), description: `Paiement ${payment.receiptNumber}`, sourceType: 'PAYMENT', sourceId: payment.id } });
                for (const feeId of feeIds) await refreshFeeStatus(transaction, feeId);
                return payment;
            });
            return response.status(201).json({ payment: result });
        } catch (error) {
            return response.status(400).json({ error: error instanceof Error ? error.message : 'Paiement impossible.' });
        }
    });

    router.get('/payments', authenticate(prisma), requirePermission('payments.view'), async (request, response) => {
        const studentId = typeof request.query.studentId === 'string' ? request.query.studentId : undefined;
        const payments = await request.db!.payment.findMany({
            where: { studentId },
            include: {
                student: true,
                recordedBy: { select: { firstName: true, lastName: true } },
                cancelledBy: { select: { firstName: true, lastName: true } },
                allocations: { include: { studentFee: { include: { feeType: true } } } }
            },
            orderBy: { paidAt: 'desc' }
        });
        return response.json({ payments });
    });

    router.get('/payments/:id', authenticate(prisma), requirePermission('payments.view'), async (request, response) => {
        const paymentId = request.params.id;
        if (typeof paymentId !== 'string') return response.status(400).json({ error: 'Identifiant de paiement invalide.' });
        const payment = await request.db!.payment.findUnique({
            where: { id: paymentId },
            include: {
                student: { include: { enrollments: { include: { schoolClass: true }, orderBy: { enrolledAt: 'desc' }, take: 1 } } },
                guardian: true,
                recordedBy: { select: { firstName: true, lastName: true } },
                cancelledBy: { select: { firstName: true, lastName: true } },
                allocations: { include: { studentFee: { include: { feeType: true } } } }
            }
        });
        if (!payment) return response.status(404).json({ error: 'Reçu introuvable.' });
        return response.json({ payment });
    });

    router.post('/payments/:id/cancel', authenticate(prisma), requirePermission('payments.manage'), async (request, response) => {
        const paymentId = request.params.id;
        if (typeof paymentId !== 'string') return response.status(400).json({ error: 'Identifiant de paiement invalide.' });
        const { reason } = request.body;
        if (typeof reason !== 'string' || !reason.trim()) return response.status(400).json({ error: 'Motif d’annulation requis.' });
        try {
            const payment = await request.db!.$transaction(async (transaction) => {
                const current = await transaction.payment.findUnique({ where: { id: paymentId }, include: { allocations: true } });
                if (!current) throw new Error('Paiement introuvable.');
                if (current.cancelledAt) throw new Error('Ce paiement est déjà annulé.');
                const updated = await transaction.payment.update({ where: { id: paymentId }, data: { cancelledAt: new Date(), cancelReason: reason.trim(), cancelledById: request.authUser!.id } });
                for (const allocation of current.allocations) await refreshFeeStatus(transaction, allocation.studentFeeId);
                return updated;
            });
            return response.json({ payment });
        } catch (error) {
            return response.status(400).json({ error: error instanceof Error ? error.message : 'Annulation impossible.' });
        }
    });

    router.get('/unpaid-fees', authenticate(prisma), requirePermission('fees.view'), async (request, response) => {
        const schoolClassId = typeof request.query.schoolClassId === 'string' && request.query.schoolClassId ? request.query.schoolClassId : undefined;
        const academicYearId = typeof request.query.academicYearId === 'string' && request.query.academicYearId ? request.query.academicYearId : undefined;
        const period = typeof request.query.period === 'string' ? request.query.period.trim() : '';
        const requestedStatus = typeof request.query.status === 'string' && feeStatuses.includes(request.query.status as (typeof feeStatuses)[number]) ? request.query.status as (typeof feeStatuses)[number] : undefined;

        // Fetch the full UNPAID/PARTIALLY_PAID/OVERDUE universe from the stored status, because a fee whose
        // due date has passed with zero payment never gets its status flipped to OVERDUE by itself: that only
        // happens as a side effect of a payment being recorded against it (see refreshFeeStatus). Effective
        // status below recomputes OVERDUE from the due date so it is always accurate, and any status filter
        // requested by the caller is applied against that corrected value instead of the possibly stale one.
        const fees = await request.db!.studentFee.findMany({
            where: {
                status: { in: [...unpaidStatuses] },
                academicYearId,
                period: period ? { contains: period, mode: 'insensitive' } : undefined,
                student: schoolClassId ? { enrollments: { some: { schoolClassId, status: 'ACTIVE' } } } : undefined
            },
            include: {
                feeType: true,
                allocations: { include: { payment: { select: { cancelledAt: true } } } },
                student: { include: { enrollments: { include: { schoolClass: true }, orderBy: { enrolledAt: 'desc' } }, guardians: { include: { guardian: true } } } }
            },
            orderBy: { dueDate: 'asc' }
        });

        const toCorrect: string[] = [];
        const rows = fees
            .map((fee) => {
                const paid = fee.allocations.filter((allocation) => !allocation.payment.cancelledAt).reduce((total, allocation) => total.plus(allocation.amount), new Prisma.Decimal(0));
                const enrollment = fee.student.enrollments.find((item) => item.academicYearId === fee.academicYearId) ?? fee.student.enrollments[0];
                const primaryLink = fee.student.guardians.find((link) => link.isPrimaryContact) ?? fee.student.guardians[0];
                const effectiveStatus = fee.status === 'UNPAID' && fee.dueDate < new Date() ? 'OVERDUE' : fee.status;
                if (effectiveStatus !== fee.status) toCorrect.push(fee.id);
                return {
                    id: fee.id,
                    student: { id: fee.student.id, firstName: fee.student.firstName, lastName: fee.student.lastName, matricule: fee.student.matricule },
                    schoolClass: enrollment?.schoolClass.name ?? 'Non inscrit',
                    guardian: primaryLink ? { name: `${primaryLink.guardian.firstName} ${primaryLink.guardian.lastName}`, phone: primaryLink.guardian.primaryPhone } : null,
                    feeType: fee.feeType.name,
                    feeTypeId: fee.feeTypeId,
                    period: fee.period,
                    dueDate: fee.dueDate,
                    expectedAmount: fee.finalAmount,
                    paidAmount: paid,
                    remaining: fee.finalAmount.minus(paid),
                    status: effectiveStatus
                };
            })
            .filter((row) => !requestedStatus || row.status === requestedStatus);

        if (toCorrect.length > 0) await request.db!.studentFee.updateMany({ where: { id: { in: toCorrect } }, data: { status: 'OVERDUE' } });

        return response.json({ fees: rows });
    });

    return router;
};
