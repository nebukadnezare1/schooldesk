import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { createSession } from '../src/auth.js';
import { createFinanceRouter } from '../src/finance-routes.js';
import { createOperationsRouter } from '../src/operations-routes.js';

/**
 * Garde-fou : les tests écrivent en base, ils ne doivent donc JAMAIS tourner ailleurs que sur la base
 * jetable de tests/docker-compose.test.yml. On lit exclusivement TEST_DATABASE_URL (jamais DATABASE_URL)
 * et on refuse toute base dont le nom ne se termine pas par `_test`.
 */
const resolveTestDatabaseUrl = () => {
    const raw = process.env.TEST_DATABASE_URL;
    if (!raw) throw new Error('TEST_DATABASE_URL manquant — les tests ne tournent que sur la base jetable (npm run test:docker).');
    const url = new URL(raw);
    const database = url.pathname.replace(/^\//, '');
    if (!database.endsWith('_test')) throw new Error(`Refus : la base « ${database} » n'est pas une base de test (suffixe _test attendu).`);
    // Assez de connexions pour que les requêtes simultanées des tests soient réellement concurrentes
    // côté PostgreSQL, au lieu d'être sérialisées par l'attente d'une connexion libre dans le pool.
    url.searchParams.set('connection_limit', '20');
    return url.toString();
};

export const prisma = new PrismaClient({ datasources: { db: { url: resolveTestDatabaseUrl() } } });

const PERMISSIONS = ['fees.view', 'fees.manage', 'payments.view', 'payments.manage', 'expenses.view', 'expenses.manage', 'payroll.view', 'payroll.manage', 'cash.view'];

/** Même montage que server.ts pour les deux routers testés. */
export const startServer = async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createFinanceRouter(prisma));
    app.use('/api', createOperationsRouter(prisma));
    const server: Server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const { port } = server.address() as AddressInfo;
    return { baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
};

const ensureAdminRole = async () => {
    const role = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    for (const code of PERMISSIONS) {
        const permission = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
        await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
    }
    return role;
};

export type SchoolContext = Awaited<ReturnType<typeof seedSchool>>;

/** Une école neuve et isolée par test : admin + session, année active, type « Mensualité », un élève (mensualité 1000), un employé. */
export const seedSchool = async (baseUrl: string) => {
    const tag = randomUUID().slice(0, 8);
    const role = await ensureAdminRole();
    const school = await prisma.school.create({ data: { name: `École test ${tag}` } });
    const user = await prisma.user.create({ data: { schoolId: school.id, email: `admin-${tag}@test.local`, passwordHash: 'non-utilise', firstName: 'Admin', lastName: 'Test', roleId: role.id } });
    const { token } = await createSession(prisma, user.id);
    const academicYear = await prisma.academicYear.create({ data: { schoolId: school.id, label: '2026-2027', status: 'ACTIVE', startsAt: new Date('2026-09-01'), endsAt: new Date('2027-06-30') } });
    const feeType = await prisma.feeType.create({ data: { schoolId: school.id, name: 'Mensualité', defaultAmount: new Prisma.Decimal(1000), frequency: 'MONTHLY' } });
    const student = await prisma.student.create({ data: { schoolId: school.id, matricule: `EL-${tag}`, firstName: 'Élève', lastName: 'Test', birthDate: new Date('2020-01-01'), monthlyFee: new Prisma.Decimal(1000) } });
    const employee = await prisma.employee.create({ data: { schoolId: school.id, matricule: `EMP-${tag}`, firstName: 'Employé', lastName: 'Test', type: 'TEACHER' } });

    const call = async (method: string, path: string, body?: unknown) => {
        const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await response.text();
        return { status: response.status, body: text ? JSON.parse(text) : null };
    };

    return {
        school, user, academicYear, feeType, student, employee,
        post: (path: string, body: unknown) => call('POST', path, body),
        patch: (path: string, body: unknown) => call('PATCH', path, body),
        get: (path: string) => call('GET', path),
        createFee: (period: string, amount: number) => prisma.studentFee.create({ data: { schoolId: school.id, studentId: student.id, feeTypeId: feeType.id, academicYearId: academicYear.id, period, expectedAmount: new Prisma.Decimal(amount), finalAmount: new Prisma.Decimal(amount), dueDate: new Date('2030-01-01') } }),
        createPayroll: (month: string, netSalary: number) => prisma.payroll.create({ data: { schoolId: school.id, employeeId: employee.id, month, baseSalary: new Prisma.Decimal(netSalary), netSalary: new Prisma.Decimal(netSalary) } })
    };
};

const sum = (rows: { amount: Prisma.Decimal }[]) => rows.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0)).toNumber();

/** État financier complet d'une école, lu directement en base (indépendamment des routes testées). */
export const financialState = async (schoolId: string) => {
    const [payments, allocations, cash, sequences, fees, payrolls, payrollPayments] = await Promise.all([
        prisma.payment.findMany({ where: { schoolId }, orderBy: { receiptNumber: 'asc' } }),
        prisma.paymentAllocation.findMany({ where: { payment: { schoolId } } }),
        prisma.cashTransaction.findMany({ where: { schoolId } }),
        prisma.numberSequence.findMany({ where: { schoolId } }),
        prisma.studentFee.findMany({ where: { schoolId } }),
        prisma.payroll.findMany({ where: { schoolId } }),
        prisma.payrollPayment.findMany({ where: { schoolId }, orderBy: { receiptNumber: 'asc' } })
    ]);
    return {
        payments, allocations, cash, fees, payrolls, payrollPayments,
        sequence: (series: string) => sequences.find((row) => row.series === series)?.lastValue ?? 0,
        paidOnFee: (feeId: string) => sum(allocations.filter((row) => row.studentFeeId === feeId && !payments.find((payment) => payment.id === row.paymentId)?.cancelledAt)),
        cashFor: (sourceType: string) => cash.filter((row) => row.sourceType === sourceType),
        sum
    };
};
