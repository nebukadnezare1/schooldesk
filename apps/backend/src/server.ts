import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthRouter } from './auth-routes.js';
import { createAcademicRouter } from './academic-routes.js';
import { createStudentRouter } from './student-routes.js';
import { createStaffAttendanceRouter } from './staff-attendance-routes.js';
import { createFinanceRouter } from './finance-routes.js';
import { createOperationsRouter } from './operations-routes.js';
import { createDashboardRouter } from './dashboard-routes.js';
import { createSettingsRouter } from './settings-routes.js';
import { createBackupRouter } from './backup-routes.js';
import { generateMonthlyMensualites } from './monthly-fees-job.js';
import { refreshOverdueStatuses } from './overdue-job.js';
import { generateMonthlyPayrolls } from './monthly-payroll-job.js';

const app = express();
// Un seul saut de proxy de confiance (Nginx, même réseau Docker interne — voir nginx.conf,
// X-Forwarded-For déjà transmis) : nécessaire pour que express-rate-limit (login) identifie le
// vrai visiteur plutôt que de compter toutes les requêtes comme venant de Nginx.
app.set('trust proxy', 1);
const prisma = new PrismaClient();
const port = Number(process.env.BACKEND_PORT ?? 3000);

// Autorise l'origine configurée (production) ainsi que toute origine locale ou sur le même
// réseau privé (LAN) — nécessaire pour utiliser l'app depuis un téléphone/tablette connecté
// au même Wi-Fi que le poste qui héberge Docker, sans avoir à figer une IP à l'avance.
const configuredOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:8080';
const privateNetworkOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin === configuredOrigin || privateNetworkOriginPattern.test(origin)) { callback(null, true); return; }
        callback(new Error('Origine non autorisée par CORS.'));
    },
    credentials: true
}));
// Mounted before the app-wide express.json() below: /api/backup/restore needs a much larger body
// limit than the 100kb default (a real school's backup), applied only to that one route — see
// backup-routes.ts. Every other path falls through unaffected to the global parser right after.
app.use('/api', createBackupRouter(prisma));
app.use(express.json());
app.use('/api/auth', createAuthRouter(prisma));
app.use('/api', createAcademicRouter(prisma));
app.use('/api', createStudentRouter(prisma));
app.use('/api', createStaffAttendanceRouter(prisma));
app.use('/api', createFinanceRouter(prisma));
app.use('/api', createOperationsRouter(prisma));
app.use('/api', createDashboardRouter(prisma));
app.use('/api', createSettingsRouter(prisma));

app.get('/api/health', async (_request, response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        response.json({ status: 'ok', database: 'connected' });
    } catch {
        response.status(503).json({ status: 'error', database: 'unavailable' });
    }
});

// Catches body-parser rejections (oversized payload, malformed JSON) so they come back as the
// same JSON error shape as every other route, instead of Express's default HTML error page.
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    if (status === 413) return response.status(413).json({ error: 'Fichier trop volumineux.' });
    if (status === 400) return response.status(400).json({ error: 'Requête invalide.' });
    console.error('Erreur non gérée :', error);
    return response.status(500).json({ error: 'Erreur interne du serveur.' });
});

const server = app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
});

// Tâches de fond, toutes écoles confondues — au démarrage puis une fois par jour, pour que
// l'application reste à jour sans qu'un humain n'ait besoin d'éditer une fiche élève ou
// d'ouvrir la page Impayés : (1) génère la Mensualité du mois pour chaque élève actif inscrit,
// (2) fait basculer en retard tout frais Non payé dont l'échéance est passée,
// (3) génère le salaire « À payer » du mois pour chaque employé actif avec un salaire de base configuré.
const runDailyMaintenanceJobs = () => {
    generateMonthlyMensualites(prisma)
        .then((created) => { if (created > 0) console.log(`Mensualités générées automatiquement : ${created}.`); })
        .catch((error) => console.error('Échec de la génération automatique des mensualités :', error));
    refreshOverdueStatuses(prisma)
        .then((count) => { if (count > 0) console.log(`Frais passés en retard automatiquement : ${count}.`); })
        .catch((error) => console.error('Échec de la mise à jour automatique des frais en retard :', error));
    generateMonthlyPayrolls(prisma)
        .then((created) => { if (created > 0) console.log(`Salaires générés automatiquement : ${created}.`); })
        .catch((error) => console.error('Échec de la génération automatique des salaires :', error));
};
runDailyMaintenanceJobs();
const dailyMaintenanceInterval = setInterval(runDailyMaintenanceJobs, 24 * 60 * 60 * 1000);

const shutdown = async () => {
    clearInterval(dailyMaintenanceInterval);
    server.close();
    await prisma.$disconnect();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
