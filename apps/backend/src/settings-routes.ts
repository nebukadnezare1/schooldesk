import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';

const defaults: Record<string, string> = {
    'school.name': 'École Garden',
    'school.address': '',
    'school.phone': '',
    'school.whatsapp': '',
    'school.email': '',
    'school.currency': 'MAD / DH'
};

// Keys stored in the Setting table (school.name lives on School.name instead, see PATCH handler).
const editableSettingKeys = ['school.address', 'school.phone', 'school.whatsapp', 'school.email', 'school.currency'];

export const createSettingsRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/settings', authenticate(prisma), async (request, response) => {
        const [school, rows] = await Promise.all([
            prisma.school.findUnique({ where: { id: request.authUser!.schoolId } }),
            request.db!.setting.findMany()
        ]);
        const settings: Record<string, string> = { ...defaults };
        if (school) settings['school.name'] = school.name;
        for (const row of rows) if (row.key in settings) settings[row.key] = row.value;
        return response.json({ settings });
    });

    router.patch('/settings', authenticate(prisma), requirePermission('settings.manage'), async (request, response) => {
        const body = request.body as Record<string, unknown>;
        const schoolId = request.authUser!.schoolId;

        const name = body['school.name'];
        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) return response.status(400).json({ error: "Le nom de l'école est obligatoire." });
            await prisma.school.update({ where: { id: schoolId }, data: { name: name.trim() } });
        }

        for (const key of editableSettingKeys) {
            const value = body[key];
            if (typeof value !== 'string') continue;
            await request.db!.setting.upsert({
                where: { schoolId_key: { schoolId, key } },
                update: { value: value.trim() },
                create: { schoolId, key, value: value.trim() }
            });
        }

        const [school, rows] = await Promise.all([
            prisma.school.findUnique({ where: { id: schoolId } }),
            request.db!.setting.findMany()
        ]);
        const settings: Record<string, string> = { ...defaults };
        if (school) settings['school.name'] = school.name;
        for (const row of rows) if (row.key in settings) settings[row.key] = row.value;
        return response.json({ settings });
    });

    return router;
};
