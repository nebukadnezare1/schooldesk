# SchoolDesk

Application de gestion scolaire (élèves, classes, présences, personnel, paiements, dépenses, salaires, caisse, dashboard) — multi-tenant, open source, à héberger vous-même.

Stack : React 19 + TypeScript + Vite + Tailwind CSS 4 (frontend), Node.js + Express 5 + Prisma ORM 6 (backend), PostgreSQL 16, Docker Compose.

## Prérequis

- Docker Desktop
- Docker Compose v2

## Démarrage

1. Copier `.env.example` vers `.env`.
2. Modifier au minimum `POSTGRES_PASSWORD` (et la valeur correspondante dans `DATABASE_URL`), `ADMIN_EMAIL`/`ADMIN_PASSWORD`, et `CORS_ORIGIN` si l'application n'est pas servie sur `http://localhost:8080`.
3. (Optionnel) Renseigner `SMTP_*` pour activer l'envoi du code de vérification par email à l'inscription d'une nouvelle école.
4. Lancer :

```powershell
docker compose up -d --build
```

L'interface est disponible sur `http://localhost:8080` par défaut (le frontend, servi par Nginx, proxifie lui-même `/api/` vers le backend — aucun autre port n'a besoin d'être exposé).

L'API répond sur `http://localhost:3000/api/health` en interne au réseau Docker.

## Développement sans Docker

```powershell
npm run dev:backend     # apps/backend, tsx watch
npm run dev:frontend    # apps/frontend, vite --host
```

Nécessite un PostgreSQL local et un `.env` adapté.

## Arrêt

```powershell
docker compose down
```

Les données PostgreSQL restent dans le volume Docker `postgres_data`.

## Licence

Ce projet est open source, gratuit à utiliser et à héberger vous-même.
