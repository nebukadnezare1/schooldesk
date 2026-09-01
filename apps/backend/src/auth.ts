import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { PrismaClient, User } from '@prisma/client';
import { forSchool } from './tenant-db.js';
import type { TenantClient } from './tenant-db.js';

const SESSION_COOKIE = 'ecole_garden_session';
const SESSION_DAYS = 7;

type AuthUser = User & { role: { name: string; permissions: { permission: { code: string } }[] } };

declare global {
    namespace Express {
        interface Request {
            authUser?: AuthUser;
            /** School-scoped Prisma client — use this instead of the raw client for any tenant-scoped model. */
            db?: TenantClient;
        }
    }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const createSession = async (prisma: PrismaClient, userId: string) => {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.userSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
    return { token, expiresAt };
};

export const revokeSession = async (prisma: PrismaClient, token: string | undefined) => {
    if (!token) return;
    await prisma.userSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
};

export const authenticate = (prisma: PrismaClient) => async (request: Request, response: Response, next: NextFunction) => {
    const token = request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : request.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);

    if (!token) return response.status(401).json({ error: 'Authentification requise.' });

    const session = await prisma.userSession.findFirst({
        where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE' } },
        include: { user: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
    });

    if (!session) return response.status(401).json({ error: 'Session invalide ou expirée.' });
    request.authUser = session.user;
    request.db = forSchool(prisma, session.user.schoolId);
    return next();
};

export const requirePermission = (code: string) => (request: Request, response: Response, next: NextFunction) => {
    const allowed = request.authUser?.role.permissions.some(({ permission }) => permission.code === code);
    if (!allowed) return response.status(403).json({ error: 'Permission insuffisante.' });
    return next();
};

// Secure uniquement si COOKIE_SECURE=true (à activer sur le NAS, déploiement HTTPS derrière le
// tunnel Cloudflare) — volontairement pas basé sur NODE_ENV, qui vaut "production" aussi bien en
// local (voir .env.example) que sur le NAS dans ce projet : un cookie Secure y casserait la
// connexion en local sur http://localhost:8080 (le navigateur refuse de le stocker/renvoyer sur
// une connexion non chiffrée). Désactivé par défaut si la variable est absente.
const secureAttribute = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';

export const setSessionCookie = (response: Response, token: string, expiresAt: Date) => {
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax${secureAttribute}; Expires=${expiresAt.toUTCString()}`);
};

export const clearSessionCookie = (response: Response) => {
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax${secureAttribute}; Max-Age=0`);
};

export const verifyPassword = (password: string, passwordHash: string) => bcrypt.compare(password, passwordHash);
