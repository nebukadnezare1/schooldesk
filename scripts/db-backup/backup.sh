#!/bin/sh
# Sauvegarde complète de la base PostgreSQL SchoolDesk (toutes les écoles), format custom pg_dump.
#
# - Identifiants lus depuis l'environnement standard libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD,
#   PGDATABASE), posé par docker-compose.yml à partir du .env — rien n'est codé en dur ici.
# - Écriture atomique : dump dans un fichier temporaire caché (.partial), vérifié avec
#   pg_restore --list, puis seulement renommé vers son nom final. Un fichier
#   schooldesk-*.dump présent dans le dossier est donc toujours un dump complet et lisible.
# - Rotation ensuite (rotate.sh) : seuls les DB_BACKUP_RETENTION dumps les plus récents restent.
set -eu

BACKUP_DIR="${DB_BACKUP_DIR:-/backups}"
RETENTION="${DB_BACKUP_RETENTION:-14}"

umask 077
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FINAL="$BACKUP_DIR/schooldesk-$STAMP.dump"
TMP="$BACKUP_DIR/.schooldesk-$STAMP.dump.partial"

cleanup() { rm -f "$TMP"; }
trap cleanup EXIT INT TERM

if [ -e "$FINAL" ]; then
    echo "[db-backup] $FINAL existe déjà — abandon pour ne rien écraser." >&2
    exit 1
fi

echo "[db-backup] $(date '+%Y-%m-%d %H:%M:%S') début de la sauvegarde -> $(basename "$FINAL")"

if ! pg_dump --format=custom --no-owner --file="$TMP"; then
    echo "[db-backup] ÉCHEC de pg_dump — aucune sauvegarde créée." >&2
    exit 1
fi

if [ ! -s "$TMP" ]; then
    echo "[db-backup] ÉCHEC : fichier de sauvegarde vide — aucune sauvegarde créée." >&2
    exit 1
fi

if ! pg_restore --list "$TMP" >/dev/null; then
    echo "[db-backup] ÉCHEC : le dump produit n'est pas lisible par pg_restore — aucune sauvegarde créée." >&2
    exit 1
fi

mv "$TMP" "$FINAL"
trap - EXIT INT TERM

echo "[db-backup] sauvegarde réussie : $(basename "$FINAL") ($(du -h "$FINAL" | cut -f1))"

/usr/local/bin/db-backup-rotate.sh "$BACKUP_DIR" "$RETENTION"
