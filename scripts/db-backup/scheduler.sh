#!/bin/sh
# Boucle du service db-backup : une sauvegarde par jour calendaire (fuseau TZ du conteneur).
#
# Toutes les DB_BACKUP_CHECK_INTERVAL secondes (1h par défaut), vérifie si une sauvegarde
# datée d'aujourd'hui existe déjà ; sinon en lance une. Conséquences :
#   - au premier démarrage (ou après un arrêt), la sauvegarde du jour est faite immédiatement ;
#   - les redémarrages/déploiements répétés ne multiplient pas les sauvegardes du même jour ;
#   - en cas d'échec (base indisponible...), nouvel essai à la vérification suivante.
# Ensuite, à chaque vérification : copie hors NAS par e-mail (chiffrée) de la dernière sauvegarde
# si DB_BACKUP_EMAIL_ENABLED=true — une seule fois par dump, voir email.sh. Un échec d'envoi
# n'affecte jamais la sauvegarde locale.
set -u

BACKUP_DIR="${DB_BACKUP_DIR:-/backups}"
INTERVAL="${DB_BACKUP_CHECK_INTERVAL:-3600}"

mkdir -p "$BACKUP_DIR"
echo "[db-backup] démarré — dossier $BACKUP_DIR, rétention ${DB_BACKUP_RETENTION:-14}, vérification toutes les ${INTERVAL}s, fuseau ${TZ:-UTC}, copie e-mail ${DB_BACKUP_EMAIL_ENABLED:-false}."

while true; do
    TODAY="$(date +%Y-%m-%d)"
    if ls "$BACKUP_DIR"/schooldesk-"$TODAY"_*.dump >/dev/null 2>&1; then
        :
    else
        if ! /usr/local/bin/db-backup.sh; then
            echo "[db-backup] la sauvegarde du $TODAY a échoué — nouvel essai dans ${INTERVAL}s." >&2
        fi
    fi
    /usr/local/bin/db-backup-email.sh || true
    sleep "$INTERVAL"
done
