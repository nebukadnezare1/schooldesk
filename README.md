# SchoolDesk

Application de gestion scolaire (élèves, classes, présences, personnel, paiements, impayés, dépenses, salaires, caisse, dashboard) — multi-tenant, open source, à héberger vous-même.

Stack : React 19 + TypeScript + Vite + Tailwind CSS 4 (frontend), Node.js + Express 5 + Prisma ORM 6 (backend), PostgreSQL 16, Docker Compose.

## Sommaire

- [1. Installation rapide](#1-installation-rapide)
- [2. Première installation](#2-première-installation)
- [3. Accès depuis Internet / HTTPS](#3-accès-depuis-internet--https)
- [4. Données et sauvegardes](#4-données-et-sauvegardes)
- [5. Mise à jour de SchoolDesk](#5-mise-à-jour-de-schooldesk)
- [6. Architecture](#6-architecture)
- [7. Sécurité](#7-sécurité)
- [8. NAS / serveur / VPS](#8-nas--serveur--vps)
- [Développement sans Docker](#développement-sans-docker)
- [Licence](#licence)

## 1. Installation rapide

**Prérequis** : Docker et Docker Compose v2 (`docker compose`, pas l'ancien `docker-compose`).

```bash
git clone https://github.com/nebukadnezare1/schooldesk.git
cd schooldesk
cp .env.example .env
```

Éditez `.env` et renseignez au minimum :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `POSTGRES_PASSWORD` | Oui | Mot de passe de la base — changez la valeur d'exemple, et reportez-la aussi dans `DATABASE_URL` juste en dessous (même mot de passe aux deux endroits). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Oui, à la première installation | Voir [§2](#2-première-installation). |
| `CORS_ORIGIN` | Oui si vous n'accédez pas via `http://localhost:8080` | Voir [§3](#3-accès-depuis-internet--https). |

Variables optionnelles (valeurs par défaut déjà fonctionnelles pour un essai en local) :

| Variable | Rôle |
|---|---|
| `BACKEND_PORT` / `FRONTEND_PORT` | Ports publiés sur l'hôte (3000/8080 par défaut). |
| `NODE_ENV` | Laisser `production` — utilisé pour la configuration du serveur, pas pour distinguer local/production dans ce projet (voir `COOKIE_SECURE` en [§3](#3-accès-depuis-internet--https)). |
| `COOKIE_SECURE` | Voir [§3](#3-accès-depuis-internet--https) — à activer uniquement derrière HTTPS. |
| `SMTP_*` | Optionnel — voir [§7](#7-sécurité). Sans ces variables, l'application fonctionne normalement ; seule la création d'une **école supplémentaire** en libre-service (qui exige une vérification par email) sera indisponible tant qu'elles ne sont pas renseignées. |

Puis démarrez :

```bash
docker compose up -d --build
```

Le premier démarrage télécharge les images, compile le frontend et le backend, crée la base de données, applique les migrations et démarre les trois services — comptez quelques minutes selon votre machine.

**Vérifier que tout est sain** :

```bash
docker compose ps
```

Les trois services (`postgres`, `backend`, `frontend`) doivent afficher `(healthy)` dans la colonne d'état. S'ils restent bloqués sur `starting` ou passent en `unhealthy`, consultez les journaux d'un service précis avec `docker compose logs backend` (ou `postgres`/`frontend`).

**Accès** : `http://localhost:8080` (ou l'IP de la machine qui héberge Docker, si vous y accédez depuis un autre appareil du même réseau). C'est le seul port qui a besoin d'être joignable — le frontend proxifie lui-même les appels `/api/...` vers le backend, en interne.

L'API du backend répond aussi directement sur `http://localhost:3000/api/health` (utile pour un diagnostic rapide) — voir [§6](#6-architecture) pour savoir pourquoi ce port ne doit pas être exposé publiquement au-delà de votre propre machine.

## 2. Première installation

`ADMIN_EMAIL` et `ADMIN_PASSWORD` (dans `.env`) servent **uniquement à créer le tout premier compte administrateur**, la toute première fois que l'application démarre sur une base de données vide. Choisissez-y un email et un mot de passe réels — ils ne sont pas fournis par ce dépôt, il n'existe **aucun identifiant par défaut** : sans ces deux variables correctement renseignées, le démarrage échoue explicitement plutôt que de créer un compte avec un mot de passe prévisible.

Une fois qu'au moins une école existe dans la base (après cette première installation), ces deux variables n'ont plus aucun effet — elles ne sont utiles qu'une seule fois, à la création.

Après votre première connexion, ouvrez **Paramètres** dans l'application pour renseigner le vrai nom, l'adresse et la devise de votre école (l'école créée au tout premier démarrage porte un nom générique de départ, à personnaliser).

D'autres écoles peuvent ensuite être créées librement depuis l'écran de connexion (« Créer une école »), sans passer par `.env` — cela nécessite en revanche que `SMTP_*` soit configuré (voir [§7](#7-sécurité)), car cette inscription en libre-service vérifie l'adresse email par un code envoyé automatiquement.

## 3. Accès depuis Internet / HTTPS

SchoolDesk peut être publié sur votre propre nom de domaine, avec HTTPS. Le principe général : n'importe quel mécanisme qui termine le TLS et redirige le trafic vers le port du frontend (`FRONTEND_PORT`, `8080` par défaut) fonctionne — par exemple :

- un tunnel comme **Cloudflare Tunnel** (aucune ouverture de port entrant nécessaire) ;
- un reverse proxy classique devant Docker, comme **Nginx** ou **Traefik**, avec un certificat (Let's Encrypt, etc.) ;
- tout autre tunnel ou proxy équivalent.

Aucune de ces solutions n'est imposée par le projet — choisissez celle qui correspond à votre infrastructure.

Deux réglages sont nécessaires côté `.env` dès que l'accès se fait réellement en HTTPS (peu importe le mécanisme choisi) :

```bash
COOKIE_SECURE=true
CORS_ORIGIN=https://votre-domaine.example
```

- `COOKIE_SECURE=true` active l'attribut `Secure` sur le cookie de session — à activer **uniquement** si l'accès réel se fait en HTTPS (le laisser à `false` casserait la connexion en HTTP simple, par exemple en local).
- `CORS_ORIGIN` doit correspondre **exactement** à l'adresse publique utilisée pour ouvrir l'application (schéma + domaine, ex. `https://school.example.com`) — le backend rejette toute requête de modification dont l'en-tête `Origin` ne correspond ni à cette valeur, ni à une adresse de réseau local. Les accès depuis le même réseau local (LAN — téléphone/tablette sur le même Wi-Fi que le serveur) sont déjà autorisés automatiquement, sans configuration supplémentaire.

Après avoir modifié `.env`, redémarrez le backend pour que le changement soit pris en compte :

```bash
docker compose up -d backend
```

## 4. Données et sauvegardes

Les données PostgreSQL sont stockées dans un **volume Docker nommé** (`postgres_data`), pas dans le conteneur lui-même — elles survivent à un arrêt, un redémarrage ou une reconstruction de l'application :

```bash
docker compose down    # arrête les conteneurs, les données restent intactes
docker compose up -d --build
```

> ⚠️ **Ne jamais utiliser `docker compose down -v`**, sauf si vous voulez réellement et irréversiblement supprimer toutes les données (élèves, paiements, tout le reste). Le drapeau `-v` supprime aussi les volumes nommés (`postgres_data`, ainsi que `documents_data` et `backups_data`, qui stockent respectivement les documents et les sauvegardes de sécurité générées par l'application).

**Sauvegardez régulièrement**, en plus de la persistance du volume (qui ne protège pas d'une erreur humaine, d'un disque défaillant ou d'une suppression accidentelle) :

- **Depuis l'application** : chaque école peut exporter ses propres données en JSON depuis **Paramètres → Sauvegarder mes données**, et les réimporter en cas de besoin depuis le même écran.
- **Au niveau de la base entière** (recommandé en plus, en particulier si plusieurs écoles partagent le même déploiement) : un `pg_dump` régulier du service `postgres`, par exemple :

  ```bash
  docker compose exec postgres pg_dump -U <POSTGRES_USER> -d <POSTGRES_DB> > sauvegarde.sql
  ```

  À planifier (cron, tâche planifiée de votre NAS, etc.) et à stocker **hors** de la machine qui héberge Docker.

## 5. Mise à jour de SchoolDesk

```bash
git pull
docker compose up -d --build
```

Les migrations de base de données (Prisma) sont appliquées **automatiquement à chaque démarrage** du conteneur backend, avant que le serveur ne se lance — il n'y a aucune commande de migration à exécuter à la main après un `git pull`. Ce mécanisme est idempotent : si aucune migration n'est en attente, cette étape ne fait rien et le démarrage continue normalement.

## 6. Architecture

```
Navigateur → Frontend (Nginx, port 8080 par défaut)
                 │
                 └── /api/... proxifié en interne
                            │
                            ▼
                    Backend (Node/Express, port 3000)
                            │
                            ▼
                    PostgreSQL (interne au réseau Docker)
```

Le frontend est un site statique servi par Nginx, qui proxifie lui-même toute requête `/api/...` vers le backend **à l'intérieur du réseau Docker** — le navigateur ne s'adresse jamais directement au backend, et aucune adresse de backend n'apparaît dans le JavaScript envoyé au client.

Ports par défaut, et ce qui doit ou non être joignable depuis l'extérieur :

| Service | Port par défaut | À exposer publiquement ? |
|---|---|---|
| Frontend (Nginx) | `8080` → `FRONTEND_PORT` | **Oui** — c'est le seul point d'entrée dont l'application a besoin. |
| Backend (API) | `3000` → `BACKEND_PORT` | **Non** — publié sur l'hôte par commodité (debug, appel direct à l'API en local), mais le frontend ne l'utilise jamais pour fonctionner ; ne l'exposez pas sur un pare-feu accessible depuis Internet. |
| PostgreSQL | `5432` | **Jamais** — non publié sur l'hôte par défaut dans ce projet, et ne doit jamais l'être. |

## 7. Sécurité

- **Changez toutes les valeurs d'exemple de `.env`** avant tout déploiement réel (`POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, tout autre secret) — les valeurs de `.env.example` ne sont que des exemples, jamais des identifiants à garder tels quels.
- **Ne publiez jamais votre `.env`** (dépôt Git, capture d'écran, ticket de support…) — il contient des secrets réels dès que vous l'avez configuré. `.env` est déjà exclu du suivi Git par ce dépôt (`.gitignore`) ; ne le committez pas manuellement.
- **Utilisez HTTPS** pour toute installation accessible depuis Internet — voir [§3](#3-accès-depuis-internet--https).
- **Activez `COOKIE_SECURE=true`** dès que l'accès réel se fait en HTTPS (voir [§3](#3-accès-depuis-internet--https)) — sans cela, le cookie de session part sans l'attribut `Secure`.
- **N'exposez jamais PostgreSQL directement sur Internet** — voir [§6](#6-architecture). Ce projet ne publie déjà aucun port pour ce service par défaut.
- **SMTP est optionnel** — nécessaire uniquement pour l'inscription en libre-service de nouvelles écoles (vérification par email), pas pour le fonctionnement du reste de l'application ni pour le tout premier compte administrateur (voir [§2](#2-première-installation)).

Mesures déjà intégrées à l'application, sans configuration supplémentaire : mots de passe hachés (bcrypt), sessions par cookie `HttpOnly`, permissions vérifiées côté serveur, connexion protégée contre les tentatives répétées (limitée par adresse IP), isolation des données entre écoles sur une base partagée.

## 8. NAS / serveur / VPS

SchoolDesk fonctionne sur toute machine capable de faire tourner Docker et Docker Compose v2 — un NAS compatible Docker, un serveur Linux classique ou un VPS conviennent. Le projet **n'a pas été testé officiellement** sur des interfaces propriétaires comme Synology DSM ou QNAP QTS ; si votre NAS expose un Docker standard (accessible en ligne de commande), les instructions de ce README s'appliquent telles quelles, mais aucune garantie de compatibilité spécifique à une marque n'est faite ici.

## Développement sans Docker

```bash
npm run dev:backend     # apps/backend, tsx watch
npm run dev:frontend    # apps/frontend, vite --host
```

Nécessite un PostgreSQL local et un `.env` adapté (le proxy `/api` est alors géré par le serveur de développement Vite plutôt que par Nginx).

## Licence

SchoolDesk est **gratuit et open source**, sous licence [MIT](LICENSE) — utilisez-le, modifiez-le et hébergez-le librement.
