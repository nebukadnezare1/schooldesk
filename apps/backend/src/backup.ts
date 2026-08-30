import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { TenantClient } from './tenant-db.js';

export const BACKUP_TYPE = 'schooldesk-backup';
export const BACKUP_VERSION = 1;

/** Hard cap on an uploaded restore file's body size — generous for any realistic school, bounded against abuse. */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

/**
 * Every restorable table, in parent-before-child order (matches the reverse of the deletion
 * order already proven correct by the super-admin's school-deletion transaction). `studentGuardian`
 * and `paymentAllocation` carry no `schoolId` of their own (see tenant-db.ts) — reached only
 * through a scoped parent — everything else is a tenant-scoped model straight from schema.prisma.
 *
 * Deliberately excluded, and never present in a backup: `User`/`UserSession` (login accounts —
 * would expose password hashes in a downloadable file, and restoring them risks locking out
 * whoever runs the restore), `RegistrationCode` (pre-registration artifact, not tied to a school),
 * and the global `Role`/`Permission`/`RolePermission` catalog (shared by every school).
 */
export interface BackupTables {
    setting: unknown[];
    academicYear: unknown[];
    employee: unknown[];
    guardian: unknown[];
    student: unknown[];
    feeType: unknown[];
    expenseCategory: unknown[];
    schoolClass: unknown[];
    studentGuardian: unknown[];
    enrollment: unknown[];
    attendance: unknown[];
    employeeAttendance: unknown[];
    studentFee: unknown[];
    payment: unknown[];
    paymentAllocation: unknown[];
    expense: unknown[];
    payroll: unknown[];
    payrollPayment: unknown[];
    salaryAdvance: unknown[];
    cashTransaction: unknown[];
}

/** Parent-before-child order — the order rows must be reinserted on restore. Deleting must go in reverse. */
export const RESTORE_TABLE_ORDER: (keyof BackupTables)[] = [
    'setting', 'academicYear', 'employee', 'guardian', 'student', 'feeType', 'expenseCategory',
    'schoolClass', 'studentGuardian', 'enrollment', 'attendance', 'employeeAttendance', 'studentFee',
    'payment', 'paymentAllocation', 'expense', 'payroll', 'payrollPayment', 'salaryAdvance', 'cashTransaction'
];

/** The two join tables reached only through a scoped parent — every other key carries its own `schoolId` field. */
const TABLES_WITHOUT_SCHOOL_ID = new Set<keyof BackupTables>(['studentGuardian', 'paymentAllocation']);

/** `studentGuardian` has no synthetic `id` — its primary key is the composite (studentId, guardianId). Every other table has a plain `id` field. */
const rowIdFields = (key: keyof BackupTables): string[] => (key === 'studentGuardian' ? ['studentId', 'guardianId'] : ['id']);

export interface SchoolBackup {
    type: typeof BACKUP_TYPE;
    version: typeof BACKUP_VERSION;
    schoolId: string;
    schoolName: string;
    exportedAt: string;
    tables: BackupTables;
    checksum: string;
}

const checksumOf = (tables: BackupTables) => `sha256:${createHash('sha256').update(JSON.stringify(tables)).digest('hex')}`;

/** Snapshots every restorable row belonging to one school. See `BackupTables` above for scope. */
export const buildSchoolBackup = async (prisma: PrismaClient, db: TenantClient, schoolId: string): Promise<SchoolBackup> => {
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });

    const [setting, academicYear, employee, guardian, student, feeType, expenseCategory, schoolClass, enrollment, attendance, employeeAttendance, studentFee, payment, expense, payroll, payrollPayment, salaryAdvance, cashTransaction] = await Promise.all([
        db.setting.findMany(),
        db.academicYear.findMany(),
        db.employee.findMany(),
        db.guardian.findMany(),
        db.student.findMany(),
        db.feeType.findMany(),
        db.expenseCategory.findMany(),
        db.schoolClass.findMany(),
        db.enrollment.findMany(),
        db.attendance.findMany(),
        db.employeeAttendance.findMany(),
        db.studentFee.findMany(),
        db.payment.findMany(),
        db.expense.findMany(),
        db.payroll.findMany(),
        db.payrollPayment.findMany(),
        db.salaryAdvance.findMany(),
        db.cashTransaction.findMany()
    ]);

    // Not tenant-scoped models (no schoolId column) — filtered explicitly via their scoped parent.
    const [studentGuardian, paymentAllocation] = await Promise.all([
        db.studentGuardian.findMany({ where: { student: { schoolId } } }),
        db.paymentAllocation.findMany({ where: { payment: { schoolId } } })
    ]);

    const tables: BackupTables = {
        setting, academicYear, employee, guardian, student, feeType, expenseCategory, schoolClass,
        studentGuardian, enrollment, attendance, employeeAttendance, studentFee, payment,
        paymentAllocation, expense, payroll, payrollPayment, salaryAdvance, cashTransaction
    };

    return {
        type: BACKUP_TYPE,
        version: BACKUP_VERSION,
        schoolId,
        schoolName: school.name,
        exportedAt: new Date().toISOString(),
        tables,
        checksum: checksumOf(tables)
    };
};

// Combining diacritical marks (U+0300–U+036F) left behind by NFD normalization, e.g. turns "é" into "e" + mark.
const DIACRITICS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');
const slugify = (value: string) => value
    .normalize('NFD').replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ecole';

export const backupFilename = (schoolName: string, at: Date) => `schooldesk-backup-${slugify(schoolName)}-${at.toISOString().slice(0, 10)}.json`;

/** Filesystem-safe timestamp with millisecond precision, for a filename that must never collide. */
export const timestampForFilename = (at: Date) => at.toISOString().replace(/[:.]/g, '-');

export type BackupValidationResult = { ok: true; backup: SchoolBackup } | { ok: false; error: string };

/**
 * Full structural + integrity validation of an uploaded backup, run before any database write.
 * Checks (in order): envelope shape, type/version, `tables` has exactly the 20 expected keys each
 * holding an array, every row is a plain object with a string `id`, checksum recomputed and
 * compared, and every row's own `schoolId` (where present) matches the file's declared `schoolId` —
 * catches a spliced/partially-corrupted file even if its top-level checksum happened to validate.
 * Does NOT check `schoolId` against the caller's session — that's the caller's job (see backup-routes.ts),
 * kept separate so this function stays reusable for a plain "is this file well-formed" check.
 */
export const validateBackupPayload = (input: unknown): BackupValidationResult => {
    if (typeof input !== 'object' || input === null) return { ok: false, error: 'Fichier de sauvegarde invalide.' };
    const candidate = input as Record<string, unknown>;

    if (candidate.type !== BACKUP_TYPE) return { ok: false, error: "Ce fichier n'est pas une sauvegarde SchoolDesk." };
    if (candidate.version !== BACKUP_VERSION) return { ok: false, error: `Version de sauvegarde non prise en charge (${String(candidate.version)}).` };
    if (typeof candidate.schoolId !== 'string' || !candidate.schoolId) return { ok: false, error: 'Fichier de sauvegarde invalide (école manquante).' };
    if (typeof candidate.schoolName !== 'string') return { ok: false, error: 'Fichier de sauvegarde invalide (nom d\'école manquant).' };
    if (typeof candidate.exportedAt !== 'string' || Number.isNaN(new Date(candidate.exportedAt).getTime())) return { ok: false, error: 'Fichier de sauvegarde invalide (date d\'export manquante).' };
    if (typeof candidate.checksum !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(candidate.checksum)) return { ok: false, error: 'Fichier de sauvegarde invalide (empreinte manquante).' };

    if (typeof candidate.tables !== 'object' || candidate.tables === null) return { ok: false, error: 'Fichier de sauvegarde invalide (données manquantes).' };
    const tables = candidate.tables as Record<string, unknown>;
    const actualKeys = Object.keys(tables).sort();
    const expectedKeys = [...RESTORE_TABLE_ORDER].sort();
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
        return { ok: false, error: 'Fichier de sauvegarde invalide (tables manquantes ou inattendues).' };
    }
    for (const key of RESTORE_TABLE_ORDER) {
        const rows = tables[key];
        if (!Array.isArray(rows)) return { ok: false, error: `Fichier de sauvegarde invalide (table "${key}" mal formée).` };
        const idFields = rowIdFields(key);
        for (const row of rows) {
            if (typeof row !== 'object' || row === null || idFields.some((field) => typeof (row as Record<string, unknown>)[field] !== 'string')) {
                return { ok: false, error: `Fichier de sauvegarde invalide (ligne sans identifiant dans "${key}").` };
            }
            if (!TABLES_WITHOUT_SCHOOL_ID.has(key) && (row as Record<string, unknown>).schoolId !== candidate.schoolId) {
                return { ok: false, error: `Fichier de sauvegarde incohérent (donnée d'une autre école dans "${key}").` };
            }
        }
    }

    const recomputed = checksumOf(tables as unknown as BackupTables);
    if (recomputed !== candidate.checksum) return { ok: false, error: 'Fichier corrompu ou modifié (empreinte invalide).' };

    return { ok: true, backup: candidate as unknown as SchoolBackup };
};
