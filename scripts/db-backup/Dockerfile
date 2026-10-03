# Service de sauvegarde automatique de la base PostgreSQL complète.
# Même image que le service postgres : pg_dump/pg_restore exactement dans la même version majeure.
FROM postgres:16-alpine

# Copie hors NAS par e-mail (optionnelle, voir email.sh) : gpg pour le chiffrement OpenPGP,
# curl pour l'envoi SMTP/SMTPS.
RUN apk add --no-cache gpg gpg-agent curl

COPY scripts/db-backup/backup.sh /usr/local/bin/db-backup.sh
COPY scripts/db-backup/rotate.sh /usr/local/bin/db-backup-rotate.sh
COPY scripts/db-backup/scheduler.sh /usr/local/bin/db-backup-scheduler.sh
COPY scripts/db-backup/email.sh /usr/local/bin/db-backup-email.sh

# Filet de sécurité si les scripts ont été extraits avec des fins de ligne Windows (CRLF).
RUN sed -i 's/\r$//' /usr/local/bin/db-backup*.sh \
    && chmod 755 /usr/local/bin/db-backup*.sh

# Sain tant qu'il existe une sauvegarde valide de moins de 26h dans le dossier.
HEALTHCHECK --interval=5m --timeout=10s --start-period=2m --retries=3 \
    CMD find "${DB_BACKUP_DIR:-/backups}" -maxdepth 1 -name 'schooldesk-*.dump' -mmin -1560 | grep -q . || exit 1

ENTRYPOINT []
CMD ["/usr/local/bin/db-backup-scheduler.sh"]
