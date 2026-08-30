import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';
import { assertOwned } from './tenant-db.js';

const isYearLabel = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{4}$/.test(value);
const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const createAcademicRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/academic-years', authenticate(prisma), requirePermission('academic-years.manage'), async (request, response) => {
        const years = await request.db!.academicYear.findMany({ orderBy: { startsAt: 'desc' }, include: { _count: { select: { classes: true } } } });
        return response.json({ academicYears: years });
    });

    router.post('/academic-years', authenticate(prisma), requirePermission('academic-years.manage'), async (request, response) => {
        const { label, startsAt, endsAt, status = 'FUTURE' } = request.body;
        if (!isYearLabel(label) || typeof startsAt !== 'string' || typeof endsAt !== 'string' || !['FUTURE', 'ACTIVE', 'CLOSED'].includes(status)) {
            return response.status(400).json({ error: 'Année scolaire invalide.' });
        }
        const start = new Date(startsAt);
        const end = new Date(endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            return response.status(400).json({ error: 'Les dates de l’année sont invalides.' });
        }
        try {
            const academicYear = await request.db!.$transaction(async (transaction) => {
                if (status === 'ACTIVE') await transaction.academicYear.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'CLOSED' } });
                return transaction.academicYear.create({ data: { schoolId: request.authUser!.schoolId, label, startsAt: start, endsAt: end, status } });
            });
            return response.status(201).json({ academicYear });
        } catch {
            return response.status(409).json({ error: 'Cette année scolaire existe déjà.' });
        }
    });

    router.patch('/academic-years/:id/status', authenticate(prisma), requirePermission('academic-years.manage'), async (request, response) => {
        const { status } = request.body;
        const academicYearId = request.params.id;
        if (!['FUTURE', 'ACTIVE', 'CLOSED'].includes(status)) return response.status(400).json({ error: 'Statut invalide.' });
        if (typeof academicYearId !== 'string') return response.status(400).json({ error: 'Identifiant d’année invalide.' });
        const academicYear = await request.db!.$transaction(async (transaction) => {
            if (status === 'ACTIVE') await transaction.academicYear.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'CLOSED' } });
            return transaction.academicYear.update({ where: { id: academicYearId }, data: { status } });
        });
        return response.json({ academicYear });
    });

    router.get('/classes', authenticate(prisma), requirePermission('classes.view'), async (request, response) => {
        const academicYearId = typeof request.query.academicYearId === 'string' ? request.query.academicYearId : undefined;
        const classes = await request.db!.schoolClass.findMany({
            where: { academicYearId },
            orderBy: { name: 'asc' },
            include: {
                academicYear: true,
                teacher: { select: { id: true, firstName: true, lastName: true } },
                assistant: { select: { id: true, firstName: true, lastName: true } },
                enrollments: { where: { status: 'ACTIVE' }, select: { student: { select: { sex: true } } } }
            }
        });
        const result = classes.map(({ enrollments, ...schoolClass }) => {
            const studentCount = enrollments.length;
            const boys = enrollments.filter((enrollment) => enrollment.student.sex === 'MALE').length;
            const girls = enrollments.filter((enrollment) => enrollment.student.sex === 'FEMALE').length;
            const fillRate = schoolClass.capacity > 0 ? Math.round((studentCount / schoolClass.capacity) * 100) : 0;
            return { ...schoolClass, studentCount, boys, girls, fillRate };
        });
        return response.json({ classes: result });
    });

    router.post('/classes', authenticate(prisma), requirePermission('classes.manage'), async (request, response) => {
        const { name, level, room, capacity, academicYearId, teacherId, assistantId } = request.body;
        if (typeof name !== 'string' || !name.trim() || typeof level !== 'string' || !level.trim() || !isPositiveInteger(capacity) || typeof academicYearId !== 'string') {
            return response.status(400).json({ error: 'Données de classe invalides.' });
        }
        const hasTeacher = typeof teacherId === 'string' && teacherId;
        const hasAssistant = typeof assistantId === 'string' && assistantId;
        const [validYear, validTeacher, validAssistant] = await Promise.all([
            assertOwned(request.db!, 'academicYear', academicYearId),
            hasTeacher ? assertOwned(request.db!, 'employee', teacherId) : Promise.resolve(true),
            hasAssistant ? assertOwned(request.db!, 'employee', assistantId) : Promise.resolve(true)
        ]);
        if (!validYear || !validTeacher || !validAssistant) return response.status(400).json({ error: 'Année scolaire, professeur ou assistant invalide.' });
        try {
            const schoolClass = await request.db!.schoolClass.create({ data: { schoolId: request.authUser!.schoolId, name: name.trim(), level: level.trim(), room: typeof room === 'string' && room.trim() ? room.trim() : undefined, capacity, academicYearId, teacherId: hasTeacher ? teacherId : undefined, assistantId: hasAssistant ? assistantId : undefined } });
            return response.status(201).json({ schoolClass });
        } catch {
            return response.status(409).json({ error: 'Classe dupliquée ou année scolaire inexistante.' });
        }
    });

    router.patch('/classes/:id', authenticate(prisma), requirePermission('classes.manage'), async (request, response) => {
        const classId = request.params.id;
        if (typeof classId !== 'string') return response.status(400).json({ error: 'Identifiant de classe invalide.' });
        const { name, level, room, capacity, teacherId, assistantId, status } = request.body;
        const classStatuses = ['ACTIVE', 'INACTIVE'] as const;
        if (typeof name !== 'string' || !name.trim() || typeof level !== 'string' || !level.trim() || !isPositiveInteger(capacity) || (status !== undefined && !classStatuses.includes(status))) {
            return response.status(400).json({ error: 'Données de classe invalides.' });
        }
        const nextStatus = typeof status === 'string' ? status as (typeof classStatuses)[number] : undefined;
        const hasTeacher = typeof teacherId === 'string' && teacherId;
        const hasAssistant = typeof assistantId === 'string' && assistantId;
        const [validTeacher, validAssistant] = await Promise.all([
            hasTeacher ? assertOwned(request.db!, 'employee', teacherId) : Promise.resolve(true),
            hasAssistant ? assertOwned(request.db!, 'employee', assistantId) : Promise.resolve(true)
        ]);
        if (!validTeacher || !validAssistant) return response.status(400).json({ error: 'Professeur ou assistant invalide.' });
        try {
            const schoolClass = await request.db!.schoolClass.update({
                where: { id: classId },
                data: {
                    name: name.trim(),
                    level: level.trim(),
                    room: typeof room === 'string' && room.trim() ? room.trim() : null,
                    capacity,
                    teacherId: hasTeacher ? teacherId : null,
                    assistantId: hasAssistant ? assistantId : null,
                    status: nextStatus
                }
            });
            return response.json({ schoolClass });
        } catch {
            return response.status(409).json({ error: 'Classe dupliquée ou donnée invalide.' });
        }
    });

    router.delete('/classes/:id', authenticate(prisma), requirePermission('classes.manage'), async (request, response) => {
        const classId = request.params.id;
        if (typeof classId !== 'string') return response.status(400).json({ error: 'Identifiant de classe invalide.' });
        try {
            const schoolClass = await request.db!.schoolClass.update({ where: { id: classId }, data: { status: 'INACTIVE' } });
            return response.json({ schoolClass });
        } catch {
            return response.status(404).json({ error: 'Classe introuvable.' });
        }
    });

    return router;
};
