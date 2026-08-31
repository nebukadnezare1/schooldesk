#!/usr/bin/env bash
# Déploie le checkout courant (GITHUB_WORKSPACE) vers DEPLOY_DIR sur le NAS.
#
# Garanties strictes :
#   - ne lit, n'écrit ni ne supprime jamais DEPLOY_DIR/.env
#   - ne touche jamais au volume Docker nommé de PostgreSQL (aucun `down -v`,
#     `docker volume rm`, ni recréation du service postgres lui-même)
#   - sauvegarde pg_dump automatique avant tout déploiement contenant une
#     nouvelle migration Prisma
#   - échec de build/santé => le script s'arrête (set -e), sans jamais
#     exécuter de commande destructive ; les conteneurs existants restent tels
#     quels pour inspection manuelle
#   - n'affiche jamais de secret dans les logs (identifiants Postgres lus par
#     le conteneur lui-même, jamais par ce script)
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:?DEPLOY_DIR doit être défini}"
BACKUP_DIR="${BACKUP_DIR:?BACKUP_DIR doit être défini}"
SOURCE_DIR="${GITHUB_WORKSPACE:?GITHUB_WORKSPACE doit être défini (exécution attendue depuis un job GitHub Actions)}"

log() { printf '\n== %s ==\n' "$1"; }

log "Vérifications préalables"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo "Erreur : $DEPLOY_DIR/.env introuvable — abandon (ce répertoire ne ressemble pas à un déploiement existant)." >&2
    exit 1
fi
if [ ! -f "$DEPLOY_DIR/docker-compose.yml" ]; then
    echo "Erreur : $DEPLOY_DIR/docker-compose.yml introuvable — abandon." >&2
    exit 1
fi
echo "OK — $DEPLOY_DIR est un déploiement existant."
if ! command -v rsync >/dev/null 2>&1; then
    echo "Erreur : rsync introuvable sur ce runner. Installer avec, par exemple, 'sudo apt install rsync' puis relancer." >&2
    exit 1
fi

# Détecte la commande Compose disponible sur ce runner (plugin "docker compose" v2,
# sinon le binaire historique "docker-compose" v1 — présent sur Azhar).
if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
else
    echo "Erreur : ni 'docker compose' (plugin v2) ni 'docker-compose' (v1) ne sont disponibles sur ce runner." >&2
    exit 1
fi
echo "Commande Compose utilisée : ${COMPOSE[*]}"

log "Détection d'une nouvelle migration Prisma"
OLD_MIGRATIONS_DIR="$DEPLOY_DIR/apps/backend/prisma/migrations"
NEW_MIGRATIONS_DIR="$SOURCE_DIR/apps/backend/prisma/migrations"
MIGRATION_PENDING=false
if [ -d "$NEW_MIGRATIONS_DIR" ]; then
    while IFS= read -r name; do
        [ -z "$name" ] && continue
        if [ ! -d "$OLD_MIGRATIONS_DIR/$name" ]; then
            echo "Nouvelle migration détectée : $name"
            MIGRATION_PENDING=true
        fi
    done < <(basename -a "$NEW_MIGRATIONS_DIR"/*/ 2>/dev/null || true)
fi

if [ "$MIGRATION_PENDING" = true ]; then
    log "Sauvegarde PostgreSQL avant migration"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).sql"
    # Les identifiants sont lus par pg_dump DANS le conteneur, depuis les variables
    # d'environnement déjà posées par docker-compose.yml à partir du .env du NAS —
    # ce script ne les manipule ni ne les affiche jamais.
    ( cd "$DEPLOY_DIR" && "${COMPOSE[@]}" exec -T postgres sh -c \
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
        > "$BACKUP_FILE" )
    if [ ! -s "$BACKUP_FILE" ]; then
        echo "Erreur : la sauvegarde pré-migration est vide — abandon sans rien déployer." >&2
        exit 1
    fi
    echo "Sauvegarde écrite : $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "Aucune nouvelle migration — pas de sauvegarde nécessaire."
fi

log "Synchronisation du code vers $DEPLOY_DIR"
rsync -a --delete \
    --exclude='.env' \
    --exclude='.git' \
    --exclude='storage/' \
    "$SOURCE_DIR"/ "$DEPLOY_DIR"/

log "Build des images Docker"
( cd "$DEPLOY_DIR" && "${COMPOSE[@]}" build )

log "Recréation des conteneurs (jamais down -v, jamais docker volume rm)"
( cd "$DEPLOY_DIR" && "${COMPOSE[@]}" up -d )

log "Vérification de l'état de santé (jusqu'à 90s)"
SERVICES="postgres backend frontend"
DEADLINE=$((SECONDS + 90))
for service in $SERVICES; do
    while true; do
        CID=$(cd "$DEPLOY_DIR" && "${COMPOSE[@]}" ps -q "$service")
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CID" 2>/dev/null || echo "unknown")
        if [ "$STATUS" = "healthy" ]; then
            echo "$service : healthy"
            break
        fi
        if [ "$SECONDS" -ge "$DEADLINE" ]; then
            echo "Erreur : $service n'est pas devenu healthy à temps (dernier statut : $STATUS)." >&2
            echo "Aucune action destructive effectuée — inspecter manuellement (${COMPOSE[*]} logs $service)." >&2
            exit 1
        fi
        sleep 5
    done
done

log "Déploiement terminé avec succès"
echo "Commit déployé : ${GITHUB_SHA:-inconnu}"
if [ "$MIGRATION_PENDING" = true ]; then
    echo "Sauvegarde pré-migration : $BACKUP_FILE"
fi
