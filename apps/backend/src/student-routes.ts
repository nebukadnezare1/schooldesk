import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';
import { assertOwned } from './tenant-db.js';
import type { TenantClient, TenantTransaction } from './tenant-db.js';
import { monthlyFeePeriod } from './fee-period.js';

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const isMoneyOrZero = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const studentStatuses = ['ACTIVE', 'INACTIVE', 'PENDING', 'LEFT', 'ARCHIVED'] as const;
const relationships = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'] as const;

const ensureFeeType = async (transaction: TenantTransaction, schoolId: string, name: string, frequency: 'MONTHLY' | 'YEARLY', isMandatory: boolean) => {
    const existing = await transaction.feeType.findUnique({ where: { schoolId_name: { schoolId, name } } });
    if (existing) return existing;
    return transaction.feeType.create({ data: { schoolId, name, defaultAmount: new Prisma.Decimal(0), frequency, isMandatory } });
};

const ensureStudentFees = async (transaction: TenantTransaction, schoolId: string, studentId: string, academicYearId: string, monthlyFee?: number, insuranceFee?: number) => {
    const academicYear = await transaction.academicYear.findUnique({ where: { id: academicYearId } });
    if (!academicYear) return;

    if (typeof insuranceFee === 'number' && insuranceFee > 0) {
        const feeType = await ensureFeeType(transaction, schoolId, 'Assurance', 'YEARLY', false);
        await transaction.studentFee.upsert({
            where: { studentId_feeTypeId_academicYearId_period: { studentId, feeTypeId: feeType.id, academicYearId, period: academicYear.label } },
            update: {},
            create: { schoolId, studentId, feeTypeId: feeType.id, academicYearId, period: academicYear.label, expectedAmount: decimal(insuranceFee), finalAmount: decimal(insuranceFee), dueDate: academicYear.startsAt }
        });
    }

    if (typeof monthlyFee === 'number' && monthlyFee > 0) {
        const feeType = await ensureFeeType(transaction, schoolId, 'Mensualité', 'MONTHLY', true);
        const { period, dueDate } = monthlyFeePeriod(academicYear);
        await transaction.studentFee.upsert({
            where: { studentId_feeTypeId_academicYearId_period: { studentId, feeTypeId: feeType.id, academicYearId, period } },
            update: {},
            create: { schoolId, studentId, feeTypeId: feeType.id, academicYearId, period, expectedAmount: decimal(monthlyFee), finalAmount: decimal(monthlyFee), dueDate }
        });
    }
};

const nextMatricule = async (db: TenantClient) => {
    const year = new Date().getUTCFullYear();
    const count = await db.student.count();
    return `EG-${year}-${String(count + 1).padStart(4, '0')}`;
};

export const createStudentRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/students', authenticate(prisma), requirePermission('students.view'), async (request, response) => {
        const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
        const status = typeof request.query.status === 'string' && studentStatuses.includes(request.query.status as (typeof studentStatuses)[number]) ? request.query.status as (typeof studentStatuses)[number] : undefined;
        const academicYearId = typeof request.query.academicYearId === 'string' ? request.query.academicYearId : undefined;
        const students = await request.db!.student.findMany({
            where: {
                status,
                OR: search ? [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { matricule: { contains: search, mode: 'insensitive' } }] : undefined,
                enrollments: academicYearId ? { some: { academicYearId } } : undefined
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            include: {
                guardians: { include: { guardian: true } },
                enrollments: { include: { academicYear: true, schoolClass: true }, orderBy: { enrolledAt: 'desc' }, take: 1 }
            }
        });
        return response.json({ students });
    });

    router.post('/students', authenticate(prisma), requirePermission('students.manage'), async (request, response) => {
        const { firstName, lastName, birthDate, sex = 'UNSPECIFIED', birthPlace, nationality, address, monthlyFee, insuranceFee, registrationDate, guardian, schoolClassId, academicYearId } = request.body;
        if (
            typeof firstName !== 'string' || !firstName.trim() ||
            typeof lastName !== 'string' || !lastName.trim() ||
            !isDate(birthDate) ||
            !['FEMALE', 'MALE', 'UNSPECIFIED'].includes(sex) ||
            typeof address !== 'string' || !address.trim() ||
            !isMoneyOrZero(monthlyFee) ||
            !isMoneyOrZero(insuranceFee) ||
            typeof schoolClassId !== 'string' || !schoolClassId ||
            typeof academicYearId !== 'string' || !academicYearId
        ) {
            return response.status(400).json({ error: 'Tous les champs de la fiche élève sont obligatoires.' });
        }
        if (!guardian || typeof guardian !== 'object') return response.status(400).json({ error: 'Les informations du tuteur sont obligatoires.' });
        const { firstName: guardianFirstName, lastName: guardianLastName, primaryPhone, email, relationship = 'GUARDIAN' } = guardian;
        if (
            typeof guardianFirstName !== 'string' || !guardianFirstName.trim() ||
            typeof guardianLastName !== 'string' || !guardianLastName.trim() ||
            typeof primaryPhone !== 'string' || !primaryPhone.trim() ||
            typeof email !== 'string' || !email.trim()
        ) {
            return response.status(400).json({ error: 'Les informations du tuteur sont obligatoires.' });
        }
        if (!relationships.includes(relationship)) return response.status(400).json({ error: 'Relation du tuteur invalide.' });
        const guardianInput = { firstName: guardianFirstName.trim(), lastName: guardianLastName.trim(), primaryPhone: primaryPhone.trim(), email: email.trim(), relationship };
        const [validYear, validClass] = await Promise.all([assertOwned(request.db!, 'academicYear', academicYearId), assertOwned(request.db!, 'schoolClass', schoolClassId)]);
        if (!validYear || !validClass) return response.status(400).json({ error: 'Année scolaire ou classe invalide.' });
        const matricule = await nextMatricule(request.db!);
        const schoolId = request.authUser!.schoolId;
        try {
            const studentId = await request.db!.$transaction(async (transaction) => {
                const created = await transaction.student.create({
                    data: {
                        schoolId,
                        matricule,
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        birthDate: new Date(birthDate),
                        sex,
                        birthPlace: typeof birthPlace === 'string' && birthPlace.trim() ? birthPlace.trim() : undefined,
                        nationality: typeof nationality === 'string' && nationality.trim() ? nationality.trim() : undefined,
                        address: address.trim(),
                        monthlyFee: decimal(monthlyFee),
                        insuranceFee: decimal(insuranceFee),
                        registrationDate: isDate(registrationDate) ? new Date(registrationDate) : undefined
                    }
                });
                const createdGuardian = await transaction.guardian.create({ data: { schoolId, firstName: guardianInput.firstName, lastName: guardianInput.lastName, primaryPhone: guardianInput.primaryPhone, email: guardianInput.email } });
                await transaction.studentGuardian.create({ data: { studentId: created.id, guardianId: createdGuardian.id, relationship: guardianInput.relationship, isPrimaryContact: true, authorizedToCollect: true } });
                await transaction.enrollment.create({ data: { schoolId, studentId: created.id, academicYearId, schoolClassId } });
                await ensureStudentFees(transaction, schoolId, created.id, academicYearId, monthlyFee, insuranceFee);
                return created.id;
            });
            const student = await request.db!.student.findUniqueOrThrow({ where: { id: studentId }, include: { guardians: { include: { guardian: true } }, enrollments: { include: { academicYear: true, schoolClass: true }, orderBy: { enrolledAt: 'desc' }, take: 1 } } });
            return response.status(201).json({ student });
        } catch {
            return response.status(400).json({ error: 'Élève invalide ou classe/année scolaire inexistante.' });
        }
    });

    router.patch('/students/:id', authenticate(prisma), requirePermission('students.manage'), async (request, response) => {
        const studentId = request.params.id;
        if (typeof studentId !== 'string') return response.status(400).json({ error: 'Identifiant élève invalide.' });
        const { firstName, lastName, birthDate, sex = 'UNSPECIFIED', birthPlace, nationality, address, monthlyFee, insuranceFee, status, schoolClassId, academicYearId, guardian } = request.body;
        if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim() || !isDate(birthDate) || !['FEMALE', 'MALE', 'UNSPECIFIED'].includes(sex) || (status !== undefined && !studentStatuses.includes(status)) || (monthlyFee !== undefined && !isMoneyOrZero(monthlyFee)) || (insuranceFee !== undefined && !isMoneyOrZero(insuranceFee))) {
            return response.status(400).json({ error: 'Données élève invalides.' });
        }
        let guardianInput: { firstName: string; lastName: string; primaryPhone: string; email?: string; relationship: (typeof relationships)[number] } | undefined;
        if (guardian && typeof guardian === 'object') {
            const { firstName: guardianFirstName, lastName: guardianLastName, primaryPhone, email, relationship = 'GUARDIAN' } = guardian;
            if (typeof guardianFirstName === 'string' && guardianFirstName.trim() && typeof guardianLastName === 'string' && guardianLastName.trim() && typeof primaryPhone === 'string' && primaryPhone.trim()) {
                if (!relationships.includes(relationship)) return response.status(400).json({ error: 'Relation du tuteur invalide.' });
                guardianInput = { firstName: guardianFirstName.trim(), lastName: guardianLastName.trim(), primaryPhone: primaryPhone.trim(), email: typeof email === 'string' && email.trim() ? email.trim() : undefined, relationship };
            }
        }
        const nextStatus = typeof status === 'string' ? status as (typeof studentStatuses)[number] : undefined;
        const enroll = typeof schoolClassId === 'string' && schoolClassId && typeof academicYearId === 'string' && academicYearId;
        if (enroll) {
            const [validYear, validClass] = await Promise.all([assertOwned(request.db!, 'academicYear', academicYearId), assertOwned(request.db!, 'schoolClass', schoolClassId)]);
            if (!validYear || !validClass) return response.status(400).json({ error: 'Année scolaire ou classe invalide.' });
        }
        const schoolId = request.authUser!.schoolId;
        try {
            await request.db!.$transaction(async (transaction) => {
                await transaction.student.update({
                    where: { id: studentId },
                    data: {
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        birthDate: new Date(birthDate),
                        sex,
                        birthPlace: typeof birthPlace === 'string' && birthPlace.trim() ? birthPlace.trim() : undefined,
                        nationality: typeof nationality === 'string' && nationality.trim() ? nationality.trim() : undefined,
                        address: typeof address === 'string' && address.trim() ? address.trim() : undefined,
                        monthlyFee: typeof monthlyFee === 'number' ? decimal(monthlyFee) : undefined,
                        insuranceFee: typeof insuranceFee === 'number' ? decimal(insuranceFee) : undefined,
                        status: nextStatus
                    }
                });
                if (enroll) {
                    const existing = await transaction.enrollment.findUnique({ where: { studentId_academicYearId: { studentId, academicYearId } } });
                    if (!existing) await transaction.enrollment.create({ data: { schoolId, studentId, academicYearId, schoolClassId } });
                    else if (existing.schoolClassId !== schoolClassId) await transaction.enrollment.update({ where: { id: existing.id }, data: { schoolClassId } });
                    await ensureStudentFees(transaction, schoolId, studentId, academicYearId, monthlyFee, insuranceFee);
                }
                if (guardianInput) {
                    const existingLink = await transaction.studentGuardian.findFirst({ where: { studentId }, orderBy: { isPrimaryContact: 'desc' } });
                    if (existingLink) {
                        await transaction.guardian.update({ where: { id: existingLink.guardianId }, data: { firstName: guardianInput.firstName, lastName: guardianInput.lastName, primaryPhone: guardianInput.primaryPhone, email: guardianInput.email } });
                        if (existingLink.relationship !== guardianInput.relationship) await transaction.studentGuardian.update({ where: { studentId_guardianId: { studentId, guardianId: existingLink.guardianId } }, data: { relationship: guardianInput.relationship } });
                    } else {
                        const createdGuardian = await transaction.guardian.create({ data: { schoolId, firstName: guardianInput.firstName, lastName: guardianInput.lastName, primaryPhone: guardianInput.primaryPhone, email: guardianInput.email } });
                        await transaction.studentGuardian.create({ data: { studentId, guardianId: createdGuardian.id, relationship: guardianInput.relationship, isPrimaryContact: true, authorizedToCollect: true } });
                    }
                }
            });
            const student = await request.db!.student.findUniqueOrThrow({ where: { id: studentId }, include: { guardians: { include: { guardian: true } }, enrollments: { include: { academicYear: true, schoolClass: true }, orderBy: { enrolledAt: 'desc' }, take: 1 } } });
            return response.json({ student });
        } catch {
            return response.status(400).json({ error: 'Modification impossible.' });
        }
    });

    router.delete('/students/:id', authenticate(prisma), requirePermission('students.manage'), async (request, response) => {
        const studentId = request.params.id;
        if (typeof studentId !== 'string') return response.status(400).json({ error: 'Identifiant élève invalide.' });
        try {
            const student = await request.db!.student.update({ where: { id: studentId }, data: { status: 'ARCHIVED' } });
            return response.json({ student });
        } catch {
            return response.status(404).json({ error: 'Élève introuvable.' });
        }
    });

    router.post('/guardians', authenticate(prisma), requirePermission('guardians.manage'), async (request, response) => {
        const { firstName, lastName, primaryPhone, secondaryPhone, whatsapp, email, address, profession } = request.body;
        if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim() || typeof primaryPhone !== 'string' || !primaryPhone.trim()) {
            return response.status(400).json({ error: 'Données responsable invalides.' });
        }
        const guardian = await request.db!.guardian.create({ data: { schoolId: request.authUser!.schoolId, firstName: firstName.trim(), lastName: lastName.trim(), primaryPhone: primaryPhone.trim(), secondaryPhone, whatsapp, email, address, profession } });
        return response.status(201).json({ guardian });
    });

    router.post('/students/:studentId/guardians', authenticate(prisma), requirePermission('guardians.manage'), async (request, response) => {
        const { guardianId, relationship, isPrimaryContact = false, authorizedToCollect = true } = request.body;
        const studentId = request.params.studentId;
        if (typeof studentId !== 'string' || typeof guardianId !== 'string' || !relationships.includes(relationship) || typeof isPrimaryContact !== 'boolean' || typeof authorizedToCollect !== 'boolean') {
            return response.status(400).json({ error: 'Lien responsable invalide.' });
        }
        const [validStudent, validGuardian] = await Promise.all([assertOwned(request.db!, 'student', studentId), assertOwned(request.db!, 'guardian', guardianId)]);
        if (!validStudent || !validGuardian) return response.status(404).json({ error: 'Élève ou responsable introuvable.' });
        try {
            const link = await request.db!.studentGuardian.create({ data: { studentId, guardianId, relationship, isPrimaryContact, authorizedToCollect }, include: { guardian: true } });
            return response.status(201).json({ link });
        } catch {
            return response.status(409).json({ error: 'Élève, responsable inexistant ou lien déjà présent.' });
        }
    });

    router.post('/enrollments', authenticate(prisma), requirePermission('enrollments.manage'), async (request, response) => {
        const { studentId, academicYearId, schoolClassId, enrolledAt } = request.body;
        if (typeof studentId !== 'string' || typeof academicYearId !== 'string' || typeof schoolClassId !== 'string' || (enrolledAt !== undefined && !isDate(enrolledAt))) {
            return response.status(400).json({ error: 'Données d’inscription invalides.' });
        }
        const [validStudent, validYear, validClass] = await Promise.all([assertOwned(request.db!, 'student', studentId), assertOwned(request.db!, 'academicYear', academicYearId), assertOwned(request.db!, 'schoolClass', schoolClassId)]);
        if (!validStudent || !validYear || !validClass) return response.status(404).json({ error: 'Élève, année scolaire ou classe introuvable.' });
        try {
            const enrollment = await request.db!.enrollment.create({ data: { schoolId: request.authUser!.schoolId, studentId, academicYearId, schoolClassId, enrolledAt: enrolledAt ? new Date(enrolledAt) : undefined }, include: { student: true, academicYear: true, schoolClass: true } });
            return response.status(201).json({ enrollment });
        } catch {
            return response.status(409).json({ error: 'Inscription dupliquée ou relation inexistante.' });
        }
    });

    return router;
};
