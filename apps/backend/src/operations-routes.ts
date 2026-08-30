import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';
import { assertOwned } from './tenant-db.js';
import type { TenantTransaction } from './tenant-db.js';
import { maxNumericSuffix, nextSequenceNumber } from './numbering.js';

const methods = ['CASH', 'TRANSFER', 'CHECK', 'CARD', 'OTHER'] as const;
const advanceStatuses = ['OPEN', 'RECOVERED'] as const;
const isMoney = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
const isReason = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2));
const isMoneyOrZero = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

const refreshPayrollStatus = async (transaction: TenantTransaction, payrollId: string) => {
    const payroll = await transaction.payroll.findUnique({ where: { id: payrollId }, include: { payments: true } });
    if (!payroll) return;
    const amountPaid = payroll.payments.filter((payment) => !payment.cancelledAt).reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));
    const status = amountPaid.gte(payroll.netSalary) ? 'PAID' : amountPaid.gt(0) ? 'PARTIALLY_PAID' : 'TO_PAY';
    await transaction.payroll.update({ where: { id: payrollId }, data: { amountPaid, status, paidAt: status === 'PAID' ? new Date() : null } });
};

export const createOperationsRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/expense-categories', authenticate(prisma), requirePermission('expenses.view'), async (request, response) => response.json({ categories: await request.db!.expenseCategory.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }) }));

    router.post('/expense-categories', authenticate(prisma), requirePermission('expenses.manage'), async (request, response) => {
        const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
        if (!name) return response.status(400).json({ error: 'Nom de catégorie requis.' });
        try { return response.status(201).json({ category: await request.db!.expenseCategory.create({ data: { schoolId: request.authUser!.schoolId, name } }) }); } catch { return response.status(409).json({ error: 'Cette catégorie existe déjà.' }); }
    });

    router.get('/expenses', authenticate(prisma), requirePermission('expenses.view'), async (request, response) => response.json({
        expenses: await request.db!.expense.findMany({
            include: { category: true, cashTransaction: true, recordedBy: { select: { firstName: true, lastName: true } }, cancelledBy: { select: { firstName: true, lastName: true } } },
            orderBy: { occurredAt: 'desc' }
        })
    }));

    router.post('/expenses', authenticate(prisma), requirePermission('expenses.manage'), async (request, response) => {
        const { categoryId, description, beneficiary, amount, method, reference, comment } = request.body;
        if (typeof categoryId !== 'string' || typeof description !== 'string' || !description.trim() || !isMoney(amount) || !methods.includes(method)) return response.status(400).json({ error: 'Dépense invalide.' });
        if (!(await assertOwned(request.db!, 'expenseCategory', categoryId))) return response.status(400).json({ error: 'Catégorie invalide.' });
        try {
            const result = await request.db!.$transaction(async (transaction) => {
                const sequence = await nextSequenceNumber(transaction, request.authUser!.schoolId, 'DEP', async () => maxNumericSuffix((await transaction.expense.findMany({ select: { number: true } })).map((row) => row.number)));
                const expense = await transaction.expense.create({ data: { schoolId: request.authUser!.schoolId, number: `DEP-${new Date().getUTCFullYear()}-${String(sequence).padStart(5, '0')}`, categoryId, description: description.trim(), beneficiary, amount: decimal(amount), method, reference, comment, recordedById: request.authUser!.id } });
                await transaction.cashTransaction.create({ data: { schoolId: request.authUser!.schoolId, type: 'EXPENSE', amount: decimal(amount), description: expense.description, sourceType: 'EXPENSE', sourceId: expense.id, expenseId: expense.id } });
                return expense;
            });
            return response.status(201).json({ expense: result });
        } catch { return response.status(400).json({ error: 'Dépense impossible ou catégorie inexistante.' }); }
    });

    router.post('/expenses/:id/cancel', authenticate(prisma), requirePermission('expenses.manage'), async (request, response) => {
        const expenseId = request.params.id;
        const { reason } = request.body;
        if (typeof expenseId !== 'string' || !isReason(reason)) return response.status(400).json({ error: 'Motif d’annulation requis.' });
        try {
            const current = await request.db!.expense.findUnique({ where: { id: expenseId } });
            if (!current) return response.status(404).json({ error: 'Dépense introuvable.' });
            if (current.cancelledAt) return response.status(400).json({ error: 'Cette dépense est déjà annulée.' });
            const expense = await request.db!.expense.update({ where: { id: expenseId }, data: { cancelledAt: new Date(), cancelReason: reason.trim(), cancelledById: request.authUser!.id } });
            return response.json({ expense });
        } catch { return response.status(400).json({ error: 'Annulation impossible.' }); }
    });

    router.get('/payrolls', authenticate(prisma), requirePermission('payroll.view'), async (request, response) => {
        const month = typeof request.query.month === 'string' ? request.query.month : undefined;
        return response.json({
            payrolls: await request.db!.payroll.findMany({
                where: { month },
                include: { employee: true, payments: { include: { recordedBy: { select: { firstName: true, lastName: true } }, cancelledBy: { select: { firstName: true, lastName: true } } }, orderBy: { paidAt: 'desc' } } },
                orderBy: { month: 'desc' }
            })
        });
    });

    router.post('/payrolls', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const { employeeId, month, baseSalary, bonuses = 0, advances = 0, deductions = 0 } = request.body;
        if (typeof employeeId !== 'string' || !isMonth(month) || !isMoney(baseSalary) || ![bonuses, advances, deductions].every(isMoneyOrZero)) return response.status(400).json({ error: 'Salaire invalide.' });
        const netSalary = baseSalary + bonuses - advances - deductions;
        if (netSalary <= 0) return response.status(400).json({ error: 'Le salaire net doit être positif.' });
        if (!(await assertOwned(request.db!, 'employee', employeeId))) return response.status(400).json({ error: 'Employé invalide.' });
        try { const payroll = await request.db!.payroll.create({ data: { schoolId: request.authUser!.schoolId, employeeId, month, baseSalary: decimal(baseSalary), bonuses: decimal(bonuses), advances: decimal(advances), deductions: decimal(deductions), netSalary: decimal(netSalary) }, include: { employee: true } }); return response.status(201).json({ payroll }); } catch { return response.status(409).json({ error: 'Salaire déjà créé pour cet employé et ce mois.' }); }
    });

    // Modification libre réservée aux salaires sans aucun versement (même annulé) : comme pour la
    // suppression ci-dessous, rien de financier n'a encore eu lieu, donc pas besoin d'une annulation
    // à motif — sert à corriger une erreur de saisie (mauvais mois, montant...) sans passer par
    // supprimer-puis-recréer.
    router.patch('/payrolls/:id', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const payrollId = request.params.id;
        const { month, baseSalary, bonuses = 0, advances = 0, deductions = 0 } = request.body;
        if (typeof payrollId !== 'string' || !isMonth(month) || !isMoney(baseSalary) || ![bonuses, advances, deductions].every(isMoneyOrZero)) return response.status(400).json({ error: 'Salaire invalide.' });
        const netSalary = baseSalary + bonuses - advances - deductions;
        if (netSalary <= 0) return response.status(400).json({ error: 'Le salaire net doit être positif.' });

        const current = await request.db!.payroll.findUnique({ where: { id: payrollId }, include: { _count: { select: { payments: true } } } });
        if (!current) return response.status(404).json({ error: 'Salaire introuvable.' });
        if (current._count.payments > 0) return response.status(400).json({ error: 'Modification impossible : ce salaire a déjà au moins un versement enregistré.' });

        try {
            const payroll = await request.db!.payroll.update({
                where: { id: payrollId },
                data: { month, baseSalary: decimal(baseSalary), bonuses: decimal(bonuses), advances: decimal(advances), deductions: decimal(deductions), netSalary: decimal(netSalary) },
                include: { employee: true }
            });
            return response.json({ payroll });
        } catch { return response.status(409).json({ error: 'Salaire déjà créé pour cet employé et ce mois.' }); }
    });

    // Suppression physique volontaire, réservée aux salaires sans aucun versement (même annulé) :
    // rien de financier n'a encore eu lieu, donc pas besoin du mécanisme d'annulation à motif —
    // sert notamment à corriger une erreur de frappe (mauvais mois) juste après la création.
    // La contrainte FK onDelete: Restrict sur PayrollPayment/CashTransaction empêche déjà la
    // suppression si un versement existe, même annulé — pas besoin de le revérifier ici.
    router.delete('/payrolls/:id', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const payrollId = request.params.id;
        if (typeof payrollId !== 'string') return response.status(400).json({ error: 'Identifiant de salaire invalide.' });
        try {
            await request.db!.payroll.delete({ where: { id: payrollId } });
            return response.status(204).send();
        } catch {
            return response.status(400).json({ error: 'Suppression impossible : ce salaire a déjà au moins un versement enregistré.' });
        }
    });

    router.post('/payrolls/:id/pay', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const payrollId = request.params.id;
        const { amount, method = 'CASH' } = request.body;
        if (typeof payrollId !== 'string' || !isMoney(amount) || !methods.includes(method)) return response.status(400).json({ error: 'Paiement de salaire invalide.' });
        try {
            const payroll = await request.db!.$transaction(async (transaction) => {
                const current = await transaction.payroll.findUnique({ where: { id: payrollId } });
                if (!current) throw new Error('Salaire inexistant.');
                if (new Prisma.Decimal(current.amountPaid).plus(decimal(amount)).gt(current.netSalary)) throw new Error('Le paiement dépasse le salaire net.');
                const sequence = await nextSequenceNumber(transaction, request.authUser!.schoolId, 'BUL', async () => maxNumericSuffix((await transaction.payrollPayment.findMany({ select: { receiptNumber: true } })).map((row) => row.receiptNumber)));
                const receiptNumber = `BUL-${new Date().getUTCFullYear()}-${String(sequence).padStart(5, '0')}`;
                const payment = await transaction.payrollPayment.create({ data: { schoolId: request.authUser!.schoolId, payrollId, receiptNumber, amount: decimal(amount), method, recordedById: request.authUser!.id } });
                await transaction.cashTransaction.create({ data: { schoolId: request.authUser!.schoolId, type: 'EXPENSE', amount: decimal(amount), description: `Salaire ${current.month}`, sourceType: 'PAYROLL_PAYMENT', sourceId: payment.id, payrollId } });
                await refreshPayrollStatus(transaction, payrollId);
                return transaction.payroll.findUniqueOrThrow({ where: { id: payrollId }, include: { employee: true } });
            });
            return response.status(201).json({ payroll });
        } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : 'Paiement impossible.' }); }
    });

    router.get('/payroll-payments/:id', authenticate(prisma), requirePermission('payroll.view'), async (request, response) => {
        const paymentId = request.params.id;
        if (typeof paymentId !== 'string') return response.status(400).json({ error: 'Identifiant de versement invalide.' });
        const payment = await request.db!.payrollPayment.findUnique({
            where: { id: paymentId },
            include: {
                payroll: {
                    include: {
                        employee: {
                            include: {
                                teacherClasses: { where: { status: 'ACTIVE' }, select: { name: true } },
                                assistantClasses: { where: { status: 'ACTIVE' }, select: { name: true } }
                            }
                        }
                    }
                },
                recordedBy: { select: { firstName: true, lastName: true } },
                cancelledBy: { select: { firstName: true, lastName: true } }
            }
        });
        if (!payment) return response.status(404).json({ error: 'Bulletin introuvable.' });
        return response.json({ payment });
    });

    router.post('/payroll-payments/:id/cancel', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const paymentId = request.params.id;
        const { reason } = request.body;
        if (typeof paymentId !== 'string' || !isReason(reason)) return response.status(400).json({ error: 'Motif d’annulation requis.' });
        try {
            const payroll = await request.db!.$transaction(async (transaction) => {
                const current = await transaction.payrollPayment.findUnique({ where: { id: paymentId } });
                if (!current) throw new Error('Paiement introuvable.');
                if (current.cancelledAt) throw new Error('Ce paiement est déjà annulé.');
                await transaction.payrollPayment.update({ where: { id: paymentId }, data: { cancelledAt: new Date(), cancelReason: reason.trim(), cancelledById: request.authUser!.id } });
                await refreshPayrollStatus(transaction, current.payrollId);
                return transaction.payroll.findUniqueOrThrow({ where: { id: current.payrollId }, include: { employee: true } });
            });
            return response.json({ payroll });
        } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : 'Annulation impossible.' }); }
    });

    router.get('/salary-advances', authenticate(prisma), requirePermission('payroll.view'), async (request, response) => {
        const employeeId = typeof request.query.employeeId === 'string' ? request.query.employeeId : undefined;
        return response.json({ advances: await request.db!.salaryAdvance.findMany({ where: { employeeId }, include: { employee: true, cancelledBy: { select: { firstName: true, lastName: true } } }, orderBy: { occurredAt: 'desc' } }) });
    });

    router.post('/salary-advances', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const { employeeId, amount, reason, recoveryMonth } = request.body;
        if (typeof employeeId !== 'string' || !isMoney(amount) || !isMonth(recoveryMonth)) return response.status(400).json({ error: 'Avance invalide.' });
        if (!(await assertOwned(request.db!, 'employee', employeeId))) return response.status(400).json({ error: 'Employé invalide.' });
        try { return response.status(201).json({ advance: await request.db!.salaryAdvance.create({ data: { schoolId: request.authUser!.schoolId, employeeId, amount: decimal(amount), reason, recoveryMonth }, include: { employee: true } }) }); } catch { return response.status(400).json({ error: 'Employé inexistant.' }); }
    });

    router.patch('/salary-advances/:id/status', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const advanceId = request.params.id;
        const { status } = request.body;
        if (typeof advanceId !== 'string' || !advanceStatuses.includes(status)) return response.status(400).json({ error: 'Statut d’avance invalide.' });
        try {
            const current = await request.db!.salaryAdvance.findUnique({ where: { id: advanceId } });
            if (!current) return response.status(404).json({ error: 'Avance introuvable.' });
            if (current.status === 'CANCELLED') return response.status(400).json({ error: 'Cette avance est annulée.' });
            const advance = await request.db!.salaryAdvance.update({ where: { id: advanceId }, data: { status }, include: { employee: true } });
            return response.json({ advance });
        } catch { return response.status(400).json({ error: 'Modification impossible.' }); }
    });

    router.post('/salary-advances/:id/cancel', authenticate(prisma), requirePermission('payroll.manage'), async (request, response) => {
        const advanceId = request.params.id;
        const { reason } = request.body;
        if (typeof advanceId !== 'string' || !isReason(reason)) return response.status(400).json({ error: 'Motif d’annulation requis.' });
        try {
            const current = await request.db!.salaryAdvance.findUnique({ where: { id: advanceId } });
            if (!current) return response.status(404).json({ error: 'Avance introuvable.' });
            if (current.status === 'CANCELLED') return response.status(400).json({ error: 'Cette avance est déjà annulée.' });
            const advance = await request.db!.salaryAdvance.update({ where: { id: advanceId }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.trim(), cancelledById: request.authUser!.id }, include: { employee: true } });
            return response.json({ advance });
        } catch { return response.status(400).json({ error: 'Annulation impossible.' }); }
    });

    router.get('/cash', authenticate(prisma), requirePermission('cash.view'), async (request, response) => {
        const [transactions, cancelledPayments, cancelledExpenses, cancelledPayrollPayments] = await Promise.all([
            request.db!.cashTransaction.findMany({ orderBy: { occurredAt: 'asc' } }),
            request.db!.payment.findMany({ where: { cancelledAt: { not: null } }, select: { id: true } }),
            request.db!.expense.findMany({ where: { cancelledAt: { not: null } }, select: { id: true } }),
            request.db!.payrollPayment.findMany({ where: { cancelledAt: { not: null } }, select: { id: true } })
        ]);

        const paymentIds = transactions.filter((item) => item.sourceType === 'PAYMENT').map((item) => item.sourceId);
        const payrollPaymentIds = transactions.filter((item) => item.sourceType === 'PAYROLL_PAYMENT').map((item) => item.sourceId);
        const [payments, payrollPayments] = await Promise.all([
            paymentIds.length ? request.db!.payment.findMany({
                where: { id: { in: paymentIds } },
                select: {
                    id: true,
                    student: { select: { id: true, firstName: true, lastName: true, enrollments: { where: { status: 'ACTIVE' }, take: 1, select: { schoolClass: { select: { id: true, name: true } } } } } },
                    allocations: { select: { studentFee: { select: { period: true, feeType: { select: { name: true } } } } } }
                }
            }) : [],
            payrollPaymentIds.length ? request.db!.payrollPayment.findMany({
                where: { id: { in: payrollPaymentIds } },
                select: { id: true, payroll: { select: { employee: { select: { firstName: true, lastName: true } } } } }
            }) : []
        ]);
        const paymentInfo = new Map(payments.map((payment) => [payment.id, {
            studentId: payment.student.id,
            linkedName: `${payment.student.firstName} ${payment.student.lastName}`,
            classId: payment.student.enrollments[0]?.schoolClass.id ?? null,
            className: payment.student.enrollments[0]?.schoolClass.name ?? null,
            feePeriod: Array.from(new Set(payment.allocations.map((allocation) => `${allocation.studentFee.feeType.name} · ${allocation.studentFee.period}`))).join(', ') || null
        }]));
        const payrollInfo = new Map(payrollPayments.map((item) => [item.id, { linkedName: `${item.payroll.employee.firstName} ${item.payroll.employee.lastName}` }]));

        const cancelledIds = new Set([
            ...cancelledPayments.map((item) => item.id),
            ...cancelledExpenses.map((item) => item.id),
            ...cancelledPayrollPayments.map((item) => item.id)
        ]);
        const isCancelled = (item: (typeof transactions)[number]) => cancelledIds.has(item.sourceId);
        const active = transactions.filter((item) => !isCancelled(item));
        const income = active.filter((item) => item.type === 'INCOME').reduce((total, item) => total.plus(item.amount), new Prisma.Decimal(0));
        const expenses = active.filter((item) => item.type === 'EXPENSE').reduce((total, item) => total.plus(item.amount), new Prisma.Decimal(0));
        const enriched = transactions.map((item) => ({
            ...item,
            cancelled: isCancelled(item),
            linkedName: paymentInfo.get(item.sourceId)?.linkedName ?? payrollInfo.get(item.sourceId)?.linkedName ?? null,
            studentId: paymentInfo.get(item.sourceId)?.studentId ?? null,
            classId: paymentInfo.get(item.sourceId)?.classId ?? null,
            className: paymentInfo.get(item.sourceId)?.className ?? null,
            feePeriod: paymentInfo.get(item.sourceId)?.feePeriod ?? null
        }));
        return response.json({ transactions: enriched, totals: { income, expenses, balance: income.minus(expenses) } });
    });

    return router;
};
