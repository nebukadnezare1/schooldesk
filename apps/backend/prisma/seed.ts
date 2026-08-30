import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const permissions = ['dashboard.view', 'users.manage', 'academic-years.manage', 'classes.view', 'classes.manage', 'students.view', 'students.manage', 'guardians.manage', 'enrollments.manage', 'employees.view', 'employees.manage', 'attendance.view', 'attendance.manage', 'fees.view', 'fees.manage', 'payments.view', 'payments.manage', 'expenses.view', 'expenses.manage', 'payroll.view', 'payroll.manage', 'cash.view', 'settings.manage', 'backup.manage'];

try {
    // Global catalog shared by every school — always kept up to date, never tied to a
    // specific school's existence.
    const adminRole = await prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: { name: 'ADMIN', description: 'Accès complet' }
    });

    for (const code of permissions) {
        const permission = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
            update: {},
            create: { roleId: adminRole.id, permissionId: permission.id }
        });
    }

    // Bootstrap the very first school from ADMIN_EMAIL/ADMIN_PASSWORD, but only on a truly
    // fresh deployment (no School exists yet). Once at least one school exists — whether from
    // this bootstrap, self-registration, or the multi-tenant migration's backfill of pre-existing
    // single-tenant data — this block never runs again, so it can't clobber real schools' data.
    const schoolCount = await prisma.school.count();
    if (schoolCount === 0) {
        const email = (process.env.ADMIN_EMAIL ?? 'admin@ecole-garden.local').toLowerCase();
        const password = process.env.ADMIN_PASSWORD ?? 'change-this-password';

        const school = await prisma.school.create({ data: { name: 'École Garden' } });
        await prisma.setting.create({ data: { schoolId: school.id, key: 'school.currency', value: 'MAD / DH' } });
        await prisma.user.create({
            data: {
                schoolId: school.id,
                email,
                passwordHash: await bcrypt.hash(password, 12),
                firstName: 'Administrateur',
                lastName: 'École Garden',
                roleId: adminRole.id
            }
        });
    }
} finally {
    await prisma.$disconnect();
}
