import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import express, { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';
import { backupFilename, buildSchoolBackup, MAX_BACKUP_BYTES, timestampForFilename, validateBackupPayload } from './backup.js';

// Backend runs with cwd = apps/backend (both in Docker — WORKDIR /app/apps/backend — and via
// `npm --workspace apps/backend run dev` locally), so this resolves to <repo root>/storage/backups
// — a Docker-volume-backed directory (see docker-compose.yml `backups_data`) that survives a
// container recreate, which a pre-restore safety net absolutely must do.
const BACKUPS_DIR = resolve(process.cwd(), '..', '..', 'storage', 'backups');

export const createBackupRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/backup/export', authenticate(prisma), requirePermission('backup.manage'), async (request, response) => {
        const backup = await buildSchoolBackup(prisma, request.db!, request.authUser!.schoolId);
        const filename = backupFilename(backup.schoolName, new Date());
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        response.send(JSON.stringify(backup, null, 2));
    });

    // Dedicated, size-capped body parser — mounted only for this route, and only reached because
    // this router is registered in server.ts BEFORE the app-wide express.json() (whose default
    // 100kb limit would otherwise reject any real school's backup before it got here).
    router.post('/backup/restore', express.json({ limit: MAX_BACKUP_BYTES }), authenticate(prisma), requirePermission('backup.manage'), async (request, response) => {
        const schoolId = request.authUser!.schoolId;
        const body = request.body as Record<string, unknown>;
        const confirmName = typeof body.confirmName === 'string' ? body.confirmName.trim() : '';

        const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
        if (!confirmName || confirmName !== school.name) {
            return response.status(400).json({ error: "Le nom de l'école saisi ne correspond pas — restauration annulée." });
        }

        const validation = validateBackupPayload(body.backup);
        if (!validation.ok) return response.status(400).json({ error: validation.error });
        const uploaded = validation.backup;

        // The file's own schoolId is only ever used for this identity check (catches "wrong file
        // uploaded by mistake") — every row written below is stamped with `schoolId` from the
        // session, never from the file (see tenant-db.ts forSchool()).
        if (uploaded.schoolId !== schoolId) {
            return response.status(400).json({ error: `Cette sauvegarde appartient à une autre école (« ${uploaded.schoolName} ») — restauration refusée.` });
        }

        // Safety net, entirely written and verified BEFORE the first DELETE. If any step here
        // fails, nothing below is touched and the restore is refused outright.
        let safetyFilename: string;
        try {
            const safety = await buildSchoolBackup(prisma, request.db!, schoolId);
            const dir = join(BACKUPS_DIR, schoolId);
            await mkdir(dir, { recursive: true });
            safetyFilename = `pre-restore-${timestampForFilename(new Date())}.json`;
            const safetyPath = join(dir, safetyFilename);
            // 'wx' fails instead of overwriting if a file with this exact (millisecond-precision)
            // name already exists — a previous automatic safety backup must never be clobbered.
            await writeFile(safetyPath, JSON.stringify(safety, null, 2), { encoding: 'utf-8', flag: 'wx' });
            const reread = JSON.parse(await readFile(safetyPath, 'utf-8'));
            const rereadValidation = validateBackupPayload(reread);
            if (!rereadValidation.ok || rereadValidation.backup.checksum !== safety.checksum) {
                throw new Error('safety backup failed integrity check after write');
            }
        } catch (error) {
            console.error('Échec de la sauvegarde de sécurité pré-restauration :', error);
            return response.status(500).json({ error: 'Échec de la sauvegarde de sécurité automatique — restauration annulée par prudence, aucune donnée touchée.' });
        }

        const t = uploaded.tables;
        try {
            await request.db!.$transaction(async (tx) => {
                // DELETE children -> parents.
                await tx.paymentAllocation.deleteMany({ where: { payment: { schoolId } } });
                await tx.cashTransaction.deleteMany();
                await tx.payrollPayment.deleteMany();
                await tx.salaryAdvance.deleteMany();
                await tx.payroll.deleteMany();
                await tx.expense.deleteMany();
                await tx.expenseCategory.deleteMany();
                await tx.studentFee.deleteMany();
                await tx.payment.deleteMany();
                await tx.feeType.deleteMany();
                await tx.attendance.deleteMany();
                await tx.employeeAttendance.deleteMany();
                await tx.enrollment.deleteMany();
                await tx.studentGuardian.deleteMany({ where: { student: { schoolId } } });
                await tx.schoolClass.deleteMany();
                await tx.student.deleteMany();
                await tx.guardian.deleteMany();
                await tx.employee.deleteMany();
                await tx.academicYear.deleteMany();
                await tx.setting.deleteMany();

                // INSERT parents -> children. Every row's `schoolId` (where present) is
                // overwritten by the tenant-scoping extension regardless of what's in the
                // uploaded data — see tenant-db.ts forSchool(). UUIDs are reused as-is.
                await tx.setting.createMany({ data: t.setting as never[] });
                await tx.academicYear.createMany({ data: t.academicYear as never[] });
                await tx.employee.createMany({ data: t.employee as never[] });
                await tx.guardian.createMany({ data: t.guardian as never[] });
                await tx.student.createMany({ data: t.student as never[] });
                await tx.feeType.createMany({ data: t.feeType as never[] });
                await tx.expenseCategory.createMany({ data: t.expenseCategory as never[] });
                await tx.schoolClass.createMany({ data: t.schoolClass as never[] });
                await tx.studentGuardian.createMany({ data: t.studentGuardian as never[] });
                await tx.enrollment.createMany({ data: t.enrollment as never[] });
                await tx.attendance.createMany({ data: t.attendance as never[] });
                await tx.employeeAttendance.createMany({ data: t.employeeAttendance as never[] });
                await tx.studentFee.createMany({ data: t.studentFee as never[] });
                await tx.payment.createMany({ data: t.payment as never[] });
                await tx.paymentAllocation.createMany({ data: t.paymentAllocation as never[] });
                await tx.expense.createMany({ data: t.expense as never[] });
                await tx.payroll.createMany({ data: t.payroll as never[] });
                await tx.payrollPayment.createMany({ data: t.payrollPayment as never[] });
                await tx.salaryAdvance.createMany({ data: t.salaryAdvance as never[] });
                await tx.cashTransaction.createMany({ data: t.cashTransaction as never[] });
            }, { maxWait: 10_000, timeout: 60_000 });
        } catch (error) {
            console.error('Échec de la restauration (transaction annulée, aucune donnée perdue) :', error);
            return response.status(500).json({ error: `La restauration a échoué et a été entièrement annulée — vos données actuelles n'ont pas été modifiées. Une sauvegarde de sécurité a tout de même été enregistrée (${safetyFilename}).` });
        }

        return response.json({ ok: true, restoredAt: new Date().toISOString(), safetyBackupFile: safetyFilename });
    });

    return router;
};
