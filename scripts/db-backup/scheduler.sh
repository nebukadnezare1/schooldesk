#!/bin/sh
# Boucle du service db-backup : une sauvegarde par jour calendaire (fuseau TZ du conteneur).
#
# Toutes les DB_BACKUP_CHECK_INTERVAL secondes (1h par défaut), vérifie si une sauvegarde
# datée d'aujourd'hui existe déjà ; sinon en lance une. Conséquences :
#   - au premier démarrage (ou après un arrêt), la sauvegarde du jour est faite immédiatement ;
#   - les redémarrages/déploiements répétés ne multiplient pas les sauvegardes du même jour ;
#   - en cas d'échec (base indisponible...), nouvel essai à la vérification suivante.
set -u

BACKUP_DIR="${DB_BACKUP_DIR:-/backups}"
INTERVAL="${DB_BACKUP_CHECK_INTERVAL:-3600}"

mkdir -p "$BACKUP_DIR"
echo "[db-backup] démarré — dossier $BACKUP_DIR, rétention ${DB_BACKUP_RETENTION:-14}, vérification toutes les ${INTERVAL}s, fuseau ${TZ:-UTC}."

while true; do
    TODAY="$(date +%Y-%m-%d)"
    if ls "$BACKUP_DIR"/schooldesk-"$TODAY"_*.dump >/dev/null 2>&1; then
        :
    else
        if ! /usr/local/bin/db-backup.sh; then
            echo "[db-backup] la sauvegarde du $TODAY a échoué — nouvel essai dans ${INTERVAL}s." >&2
        fi
    fi
    sleep "$INTERVAL"
done
