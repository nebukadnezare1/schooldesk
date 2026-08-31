import { createHash } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { authenticate, clearSessionCookie, createSession, revokeSession, setSessionCookie, verifyPassword } from './auth.js';
import { sendVerificationCodeEmail } from './mailer.js';
import { isKnownCountryCode, isKnownCurrencyCode } from './currency.js';

const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));
const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

// Détermine l'année scolaire "en cours" à partir de la date du jour (rentrée en septembre) :
// avant juillet, l'année en cours a commencé en septembre dernier ; à partir de juillet
// (vacances/rentrée proche), on bascule déjà sur la prochaine rentrée de septembre.
const currentAcademicYearRange = (now: Date) => {
    const startYear = now.getUTCMonth() + 1 >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return {
        label: `${startYear}-${startYear + 1}`,
        startsAt: new Date(Date.UTC(startYear, 8, 1)),
        endsAt: new Date(Date.UTC(startYear + 1, 5, 30))
    };
};

export const createAuthRouter = (prisma: PrismaClient) => {
    const router = Router();

    router.post('/register/request-code', async (request, response) => {
        const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
        if (!isValidEmail(email)) return response.status(400).json({ error: 'Email invalide.' });

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return response.status(409).json({ error: 'Cet email est déjà utilisé.' });

        const recent = await prisma.registrationCode.findFirst({ where: { email, createdAt: { gt: new Date(Date.now() - CODE_RESEND_COOLDOWN_MS) } } });
        if (recent) return response.status(429).json({ error: 'Merci de patienter une minute avant de redemander un code.' });

        const code = generateCode();
        try {
            await sendVerificationCodeEmail(email, code);
        } catch {
            return response.status(502).json({ error: "Impossible d'envoyer l'email de vérification. Vérifiez l'adresse et réessayez." });
        }

        // Invalide les codes précédents pour cet email : un seul code valide à la fois.
        await prisma.$transaction([
            prisma.registrationCode.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } }),
            prisma.registrationCode.create({ data: { email, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) } })
        ]);

        return response.json({ ok: true });
    });

    router.post('/login', async (request, response) => {
        const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
        const password = typeof request.body.password === 'string' ? request.body.password : '';
        if (!email || !password) return response.status(400).json({ error: 'Email et mot de passe requis.' });

        const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
        if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(password, user.passwordHash))) {
            return response.status(401).json({ error: 'Identifiants invalides.' });
        }

        const session = await createSession(prisma, user.id);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        setSessionCookie(response, session.token, session.expiresAt);
        const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
        return response.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role.name, schoolName: school?.name ?? '', currencyCode: school?.currencyCode ?? 'MAD' } });
    });

    router.post('/register', async (request, response) => {
        const schoolName = typeof request.body.schoolName === 'string' ? request.body.schoolName.trim() : '';
        const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
        const password = typeof request.body.password === 'string' ? request.body.password : '';
        const code = typeof request.body.code === 'string' ? request.body.code.trim() : '';
        const countryCode = typeof request.body.countryCode === 'string' ? request.body.countryCode.trim().toUpperCase() : '';
        const currencyCode = typeof request.body.currencyCode === 'string' ? request.body.currencyCode.trim().toUpperCase() : '';
        if (!schoolName) return response.status(400).json({ error: "Le nom de l'école est requis." });
        if (!isValidEmail(email)) return response.status(400).json({ error: 'Email invalide.' });
        if (password.length < 8) return response.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
        if (!code) return response.status(400).json({ error: 'Code de vérification requis.' });
        if (!isKnownCountryCode(countryCode)) return response.status(400).json({ error: 'Pays invalide — sélectionnez un pays dans la liste.' });
        if (!isKnownCurrencyCode(currencyCode)) return response.status(400).json({ error: 'Devise invalide — sélectionnez une devise dans la liste.' });

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return response.status(409).json({ error: 'Cet email est déjà utilisé.' });

        const pendingCode = await prisma.registrationCode.findFirst({ where: { email, consumedAt: null }, orderBy: { createdAt: 'desc' } });
        if (!pendingCode || pendingCode.expiresAt < new Date()) return response.status(400).json({ error: "Aucun code valide pour cet email — demandez-en un nouveau." });
        if (pendingCode.attempts >= CODE_MAX_ATTEMPTS) return response.status(400).json({ error: 'Trop de tentatives — demandez un nouveau code.' });
        if (pendingCode.codeHash !== hashCode(code)) {
            await prisma.registrationCode.update({ where: { id: pendingCode.id }, data: { attempts: { increment: 1 } } });
            return response.status(400).json({ error: 'Code de vérification incorrect.' });
        }

        const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
        if (!adminRole) return response.status(500).json({ error: "Configuration incomplète : rôle administrateur introuvable." });

        try {
            const user = await prisma.$transaction(async (transaction) => {
                const school = await transaction.school.create({ data: { name: schoolName, countryCode, currencyCode } });
                const { label, startsAt, endsAt } = currentAcademicYearRange(new Date());
                await transaction.academicYear.create({ data: { schoolId: school.id, label, startsAt, endsAt, status: 'ACTIVE' } });
                const created = await transaction.user.create({
                    data: {
                        schoolId: school.id,
                        email,
                        passwordHash: await hashPassword(password),
                        firstName: 'Administrateur',
                        lastName: schoolName,
                        roleId: adminRole.id,
                        lastLoginAt: new Date()
                    },
                    include: { role: true }
                });
                await transaction.registrationCode.update({ where: { id: pendingCode.id }, data: { consumedAt: new Date() } });
                return created;
            });
            const session = await createSession(prisma, user.id);
            setSessionCookie(response, session.token, session.expiresAt);
            return response.status(201).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role.name, schoolName, currencyCode } });
        } catch {
            return response.status(400).json({ error: 'Inscription impossible.' });
        }
    });

    router.get('/me', authenticate(prisma), async (request, response) => {
        const user = request.authUser!;
        const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
        return response.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role.name, permissions: user.role.permissions.map(({ permission }) => permission.code), schoolName: school?.name ?? '', currencyCode: school?.currencyCode ?? 'MAD' } });
    });

    router.post('/logout', async (request, response) => {
        const token = request.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith('ecole_garden_session='))?.split('=')[1];
        await revokeSession(prisma, token);
        clearSessionCookie(response);
        return response.status(204).send();
    });

    return router;
};

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
