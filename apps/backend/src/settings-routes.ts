import { Router } from 'express';
import type { Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from './auth.js';
import { isKnownCountryCode, isKnownCurrencyCode } from './currency.js';

const defaults: Record<string, string> = {
    'school.name': 'École Garden',
    'school.address': '',
    'school.phone': '',
    'school.whatsapp': '',
    'school.email': ''
};

// Keys stored in the Setting table. school.name/countryCode/currencyCode live on the School row
// itself instead (see the PATCH handler) — currencyCode in particular is a structured ISO 4217
// code on School, never a free-text Setting value (single source of truth for a school's currency).
const editableSettingKeys = ['school.address', 'school.phone', 'school.whatsapp', 'school.email'];

const buildSettings = async (prisma: PrismaClient, request: Request, schoolId: string) => {
    const [school, rows] = await Promise.all([
        prisma.school.findUnique({ where: { id: schoolId } }),
        request.db!.setting.findMany()
    ]);
    const settings: Record<string, string> = { ...defaults };
    if (school) {
        settings['school.name'] = school.name;
        settings['school.countryCode'] = school.countryCode;
        settings['school.currencyCode'] = school.currencyCode;
    }
    for (const row of rows) if (row.key in settings) settings[row.key] = row.value;
    return settings;
};

export const createSettingsRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/settings', authenticate(prisma), async (request, response) => {
        const settings = await buildSettings(prisma, request, request.authUser!.schoolId);
        return response.json({ settings });
    });

    router.patch('/settings', authenticate(prisma), requirePermission('settings.manage'), async (request, response) => {
        const body = request.body as Record<string, unknown>;
        const schoolId = request.authUser!.schoolId;

        const name = body['school.name'];
        const countryCode = body['school.countryCode'];
        const currencyCode = body['school.currencyCode'];
        const schoolUpdate: Record<string, string> = {};
        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) return response.status(400).json({ error: "Le nom de l'école est obligatoire." });
            schoolUpdate.name = name.trim();
        }
        if (countryCode !== undefined) {
            if (typeof countryCode !== 'string' || !isKnownCountryCode(countryCode.toUpperCase())) return response.status(400).json({ error: 'Pays invalide.' });
            schoolUpdate.countryCode = countryCode.toUpperCase();
        }
        if (currencyCode !== undefined) {
            if (typeof currencyCode !== 'string' || !isKnownCurrencyCode(currencyCode.toUpperCase())) return response.status(400).json({ error: 'Devise invalide.' });
            schoolUpdate.currencyCode = currencyCode.toUpperCase();
        }
        if (Object.keys(schoolUpdate).length > 0) await prisma.school.update({ where: { id: schoolId }, data: schoolUpdate });

        for (const key of editableSettingKeys) {
            const value = body[key];
            if (typeof value !== 'string') continue;
            await request.db!.setting.upsert({
                where: { schoolId_key: { schoolId, key } },
                update: { value: value.trim() },
                create: { schoolId, key, value: value.trim() }
            });
        }

        const settings = await buildSettings(prisma, request, schoolId);
        return response.json({ settings });
    });

    return router;
};
