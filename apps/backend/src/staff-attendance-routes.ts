import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';
import { assertOwned } from './tenant-db.js';
import type { TenantClient } from './tenant-db.js';

const attendanceStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
const employeeTypes = ['TEACHER', 'DIRECTOR', 'ASSISTANT', 'ADMINISTRATION', 'OTHER'] as const;
const employeeStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isStatus = (value: unknown): value is (typeof attendanceStatuses)[number] => typeof value === 'string' && attendanceStatuses.includes(value as (typeof attendanceStatuses)[number]);

const nextEmployeeMatricule = async (db: TenantClient) => `EMP-${String((await db.employee.count()) + 1).padStart(4, '0')}`;

export const createStaffAttendanceRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/employees', authenticate(prisma), requirePermission('employees.view'), async (request, response) => {
        const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
        const employees = await request.db!.employee.findMany({
            where: { OR: search ? [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { matricule: { contains: search, mode: 'insensitive' } }] : undefined },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
        });
        return response.json({ employees });
    });

    router.post('/employees', authenticate(prisma), requirePermission('employees.manage'), async (request, response) => {
        const { firstName, lastName, type, phone, email, address, qualification, hiredAt, baseSalary, contractType } = request.body;
        if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim() || !employeeTypes.includes(type) || (hiredAt !== undefined && hiredAt !== '' && !isDate(hiredAt))) {
            return response.status(400).json({ error: 'Données personnel invalides.' });
        }
        const employee = await request.db!.employee.create({ data: { schoolId: request.authUser!.schoolId, matricule: await nextEmployeeMatricule(request.db!), firstName: firstName.trim(), lastName: lastName.trim(), type, phone: phone || undefined, email: email || undefined, address: address || undefined, qualification: qualification || undefined, hiredAt: hiredAt ? new Date(`${hiredAt}T00:00:00Z`) : undefined, baseSalary: typeof baseSalary === 'number' ? baseSalary : undefined, contractType: contractType || undefined } });
        return response.status(201).json({ employee });
    });

    router.patch('/employees/:id', authenticate(prisma), requirePermission('employees.manage'), async (request, response) => {
        const employeeId = request.params.id;
        if (typeof employeeId !== 'string') return response.status(400).json({ error: 'Identifiant employé invalide.' });
        const { firstName, lastName, type, phone, email, address, qualification, hiredAt, baseSalary, contractType, status } = request.body;
        if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim() || !employeeTypes.includes(type) || (hiredAt !== undefined && hiredAt !== '' && !isDate(hiredAt)) || (status !== undefined && !employeeStatuses.includes(status))) {
            return response.status(400).json({ error: 'Données personnel invalides.' });
        }
        const nextStatus = typeof status === 'string' ? status as (typeof employeeStatuses)[number] : undefined;
        try {
            const employee = await request.db!.employee.update({
                where: { id: employeeId },
                data: {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    type,
                    phone: phone || null,
                    email: email || null,
                    address: address || null,
                    qualification: qualification || null,
                    hiredAt: hiredAt ? new Date(`${hiredAt}T00:00:00Z`) : null,
                    baseSalary: typeof baseSalary === 'number' ? baseSalary : null,
                    contractType: contractType || null,
                    status: nextStatus
                }
            });
            return response.json({ employee });
        } catch {
            return response.status(404).json({ error: 'Employé introuvable.' });
        }
    });

    router.delete('/employees/:id', authenticate(prisma), requirePermission('employees.manage'), async (request, response) => {
        const employeeId = request.params.id;
        if (typeof employeeId !== 'string') return response.status(400).json({ error: 'Identifiant employé invalide.' });
        try {
            const employee = await request.db!.employee.update({ where: { id: employeeId }, data: { status: 'ARCHIVED' } });
            return response.json({ employee });
        } catch {
            return response.status(404).json({ error: 'Employé introuvable.' });
        }
    });

    router.get('/attendance', authenticate(prisma), requirePermission('attendance.view'), async (request, response) => {
        const date = typeof request.query.date === 'string' ? request.query.date : '';
        const schoolClassId = typeof request.query.schoolClassId === 'string' ? request.query.schoolClassId : '';
        if (!isDate(date) || !schoolClassId) return response.status(400).json({ error: 'Date et classe requises.' });
        const attendances = await request.db!.attendance.findMany({ where: { date: new Date(`${date}T00:00:00Z`), student: { enrollments: { some: { schoolClassId, status: 'ACTIVE' } } } }, include: { student: true, recordedBy: { select: { firstName: true, lastName: true } } }, orderBy: { student: { lastName: 'asc' } } });
        return response.json({ attendances });
    });

    router.post('/attendance/bulk', authenticate(prisma), requirePermission('attendance.manage'), async (request, response) => {
        const { date, schoolClassId, entries } = request.body;
        if (!isDate(date) || typeof schoolClassId !== 'string' || !Array.isArray(entries) || entries.length === 0) return response.status(400).json({ error: 'Date, classe et présences requises.' });
        if (entries.some((entry) => typeof entry?.studentId !== 'string' || !isStatus(entry.status) || (entry.note !== undefined && typeof entry.note !== 'string'))) return response.status(400).json({ error: 'Statut de présence invalide.' });
        const studentIds = entries.map((entry) => entry.studentId);
        if (new Set(studentIds).size !== studentIds.length) return response.status(400).json({ error: 'Un élève ne peut apparaître qu’une seule fois.' });
        if (!(await assertOwned(request.db!, 'schoolClass', schoolClassId))) return response.status(400).json({ error: 'Classe invalide.' });
        // Also confirms every studentId belongs to this school: Enrollment itself is tenant-scoped, so a
        // foreign student can never have a matching (schoolId-scoped) enrollment in this class.
        const enrolledCount = await request.db!.enrollment.count({ where: { studentId: { in: studentIds }, schoolClassId, status: 'ACTIVE' } });
        if (enrolledCount !== studentIds.length) return response.status(400).json({ error: 'Un ou plusieurs élèves ne sont pas inscrits dans cette classe.' });
        const day = new Date(`${date}T00:00:00Z`);
        try {
            const saved = await request.db!.$transaction(entries.map((entry) => request.db!.attendance.upsert({ where: { studentId_date: { studentId: entry.studentId, date: day } }, update: { status: entry.status, note: entry.note, recordedById: request.authUser!.id }, create: { schoolId: request.authUser!.schoolId, studentId: entry.studentId, date: day, status: entry.status, note: entry.note, recordedById: request.authUser!.id } })));
            return response.status(201).json({ count: saved.length, attendances: saved });
        } catch {
            return response.status(409).json({ error: 'Présences invalides pour cette classe.' });
        }
    });

    router.get('/employee-attendance', authenticate(prisma), requirePermission('attendance.view'), async (request, response) => {
        const date = typeof request.query.date === 'string' ? request.query.date : '';
        if (!isDate(date)) return response.status(400).json({ error: 'Date requise.' });
        const attendances = await request.db!.employeeAttendance.findMany({ where: { date: new Date(`${date}T00:00:00Z`) }, include: { employee: true }, orderBy: { employee: { lastName: 'asc' } } });
        return response.json({ attendances });
    });

    return router;
};
