#!/bin/sh
# Copie hors NAS, par e-mail, de la DERNIÈRE sauvegarde validée — chiffrée avant l'envoi.
#
# Appelé par scheduler.sh à chaque vérification (toutes les heures par défaut). Ne fait rien si
# DB_BACKUP_EMAIL_ENABLED n'est pas "true". La sauvegarde locale reste la sauvegarde principale :
# ce script ne modifie, ne déplace et ne supprime JAMAIS un fichier schooldesk-*.dump.
#
# - Seul le dump le plus récent au nom exact schooldesk-AAAA-MM-JJ_HH-MM-SS.dump est concerné (ces
#   noms n'existent qu'après validation pg_restore --list et renommage atomique par backup.sh ;
#   jamais de .partial). Il est revalidé avec pg_restore --list avant envoi.
# - Chiffrement OpenPGP symétrique standard RFC 4880 (gpg --rfc4880 : AES-256, intégrité MDC, pas
#   d'AEAD — lisible par tout gpg/OpenPGP, y compris anciennes versions), phrase secrète
#   DB_BACKUP_EMAIL_PASSPHRASE transmise par descripteur (jamais en argument de commande ni dans
#   les logs). La copie chiffrée est vérifiée (déchiffrement → même SHA-256 que le dump), puis
#   seule cette copie est jointe. Elle vit dans un dossier temporaire du conteneur (/tmp), jamais
#   dans le dossier des sauvegardes, et est supprimée après la tentative, succès ou échec.
# - SMTP : mêmes variables SMTP_* que le backend (codes d'inscription). SMTP_SECURE=true → TLS
#   implicite (smtps), sinon STARTTLS OBLIGATOIRE (jamais d'envoi en clair).
# - Une seule copie par dump : marqueurs cachés à côté du dump (.<nom>.email-sent / -attempts /
#   -skipped). Au plus DB_BACKUP_EMAIL_MAX_ATTEMPTS tentatives par dump (une par vérification,
#   donc une par heure par défaut), puis abandon jusqu'au dump suivant. Les marqueurs dont le dump
#   a disparu (rotation) sont nettoyés ici — rotate.sh n'est pas concerné.
# - Copie chiffrée plus grosse que DB_BACKUP_EMAIL_MAX_MB : pas d'envoi, journalisé une fois.
set -u

BACKUP_DIR="${DB_BACKUP_DIR:-/backups}"
MAX_MB="${DB_BACKUP_EMAIL_MAX_MB:-18}"
MAX_ATTEMPTS="${DB_BACKUP_EMAIL_MAX_ATTEMPTS:-3}"

log() { echo "[db-backup-email] $*"; }
err() { echo "[db-backup-email] $*" >&2; }

[ "${DB_BACKUP_EMAIL_ENABLED:-false}" = "true" ] || exit 0

# --- Configuration (seuls des NOMS de variables sont journalisés, jamais leur valeur) ---------
missing=""
for name in DB_BACKUP_EMAIL_TO DB_BACKUP_EMAIL_PASSPHRASE SMTP_HOST SMTP_USER SMTP_PASS; do
    eval "value=\${$name:-}"
    [ -n "$value" ] || missing="$missing $name"
done
unset value
if [ -n "$missing" ]; then
    err "configuration incomplète (variable(s) vide(s) :$missing) — aucune copie envoyée."
    exit 1
fi
if [ "${#DB_BACKUP_EMAIL_PASSPHRASE}" -lt 16 ]; then
    err "DB_BACKUP_EMAIL_PASSPHRASE trop courte (16 caractères minimum) — aucune copie envoyée."
    exit 1
fi
for pair in "DB_BACKUP_EMAIL_MAX_MB:$MAX_MB" "DB_BACKUP_EMAIL_MAX_ATTEMPTS:$MAX_ATTEMPTS"; do
    case "${pair#*:}" in
        ''|*[!0-9]*|0) err "${pair%%:*} invalide (entier >= 1 attendu) — aucune copie envoyée."; exit 1 ;;
    esac
done

# --- Un seul envoi à la fois (lancement manuel pendant la boucle, par exemple) -----------------
exec 9>/tmp/db-backup-email.lock
if ! flock -n 9; then
    log "un envoi est déjà en cours — ignoré."
    exit 0
fi

# --- Nettoyage des marqueurs orphelins (dump supprimé par la rotation) --------------------------
for marker in "$BACKUP_DIR"/.schooldesk-*.dump.email-sent "$BACKUP_DIR"/.schooldesk-*.dump.email-attempts "$BACKUP_DIR"/.schooldesk-*.dump.email-skipped; do
    [ -f "$marker" ] || continue
    dump_name="$(basename "$marker")"
    dump_name="${dump_name#.}"
    dump_name="${dump_name%.email-*}"
    [ -e "$BACKUP_DIR/$dump_name" ] || rm -f -- "$marker"
done

# --- Dernière sauvegarde validée -----------------------------------------------------------------
NAME="$(ls -1 "$BACKUP_DIR" 2>/dev/null | grep -E '^schooldesk-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}\.dump$' | sort -r | head -n 1)"
[ -n "$NAME" ] || exit 0
DUMP="$BACKUP_DIR/$NAME"
SENT="$BACKUP_DIR/.$NAME.email-sent"
SKIPPED="$BACKUP_DIR/.$NAME.email-skipped"
ATTEMPTS_FILE="$BACKUP_DIR/.$NAME.email-attempts"

# Déjà envoyée, ou écartée pour sa taille : rien à faire (silencieux, appelé toutes les heures).
[ -e "$SENT" ] && exit 0
[ -e "$SKIPPED" ] && exit 0

ATTEMPTS="$(cat "$ATTEMPTS_FILE" 2>/dev/null || echo 0)"
case "$ATTEMPTS" in ''|*[!0-9]*) ATTEMPTS=0 ;; esac
[ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ] && exit 0
# Compteur incrémenté AVANT la tentative : un plantage en plein envoi ne peut pas créer de boucle.
ATTEMPTS=$((ATTEMPTS + 1))
umask 077
echo "$ATTEMPTS" > "$ATTEMPTS_FILE"

fail() {
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
        err "$1 — tentative $ATTEMPTS/$MAX_ATTEMPTS, abandon pour $NAME (le dump local reste intact ; prochain essai avec la sauvegarde suivante)."
    else
        err "$1 — tentative $ATTEMPTS/$MAX_ATTEMPTS, nouvel essai à la prochaine vérification (le dump local reste intact)."
    fi
    exit 1
}

if ! pg_restore --list "$DUMP" >/dev/null 2>&1; then
    fail "$NAME n'est pas lisible par pg_restore --list — aucune copie envoyée"
fi

WORK="$(mktemp -d /tmp/db-backup-email.XXXXXX)" || fail "impossible de créer le dossier temporaire"
trap 'rm -rf "$WORK"' EXIT
trap 'rm -rf "$WORK"; exit 1' INT TERM
GNUPGHOME="$WORK/gnupg"
export GNUPGHOME
mkdir -m 700 "$GNUPGHOME"
ENC_NAME="$NAME.gpg"
ENC="$WORK/$ENC_NAME"

# --- Chiffrement (phrase secrète par stdin : printf est une commande interne du shell) ---------
if ! printf '%s' "$DB_BACKUP_EMAIL_PASSPHRASE" | gpg --batch --quiet --yes --no-tty --pinentry-mode loopback \
        --passphrase-fd 0 --symmetric --rfc4880 --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 \
        --s2k-count 65011712 --compress-algo none --output "$ENC" "$DUMP" 2>"$WORK/gpg.log"; then
    sed 's/^/[db-backup-email]   gpg: /' "$WORK/gpg.log" >&2
    fail "échec du chiffrement"
fi
DUMP_SHA="$(sha256sum "$DUMP" | cut -d ' ' -f 1)"
CHECK_SHA="$(printf '%s' "$DB_BACKUP_EMAIL_PASSPHRASE" | gpg --batch --quiet --no-tty --pinentry-mode loopback \
        --passphrase-fd 0 --decrypt "$ENC" 2>/dev/null | sha256sum | cut -d ' ' -f 1)"
[ "$CHECK_SHA" = "$DUMP_SHA" ] || fail "la copie chiffrée ne se déchiffre pas à l'identique — aucune copie envoyée"

DUMP_SIZE="$(wc -c < "$DUMP" | tr -d ' ')"
ENC_SIZE="$(wc -c < "$ENC" | tr -d ' ')"
if [ "$ENC_SIZE" -gt $((MAX_MB * 1024 * 1024)) ]; then
    : > "$SKIPPED"
    rm -f "$ATTEMPTS_FILE"
    err "copie e-mail NON envoyée pour $NAME : copie chiffrée de $ENC_SIZE octets > limite DB_BACKUP_EMAIL_MAX_MB=$MAX_MB Mo. Dump local intact ; copier ce fichier hors NAS autrement."
    exit 0
fi

# --- Message MIME (en-têtes nettoyés de tout retour à la ligne) ---------------------------------
oneline() { printf '%s' "$1" | tr -d '\r\n'; }
FROM_HEADER="$(oneline "${SMTP_FROM:-$SMTP_USER}")"
FROM_ADDR="$(printf '%s' "$FROM_HEADER" | sed -n 's/.*<\([^>]*\)>.*/\1/p')"
[ -n "$FROM_ADDR" ] || FROM_ADDR="$FROM_HEADER"
TO_LIST="$(oneline "$DB_BACKUP_EMAIL_TO" | tr -d ' ')"
STAMP="${NAME#schooldesk-}"
STAMP="${STAMP%.dump}"
DAY="${STAMP%%_*}"
TIME="$(printf '%s' "${STAMP#*_}" | tr '-' ':')"
b64() { printf '%s' "$1" | base64 -w 0; }
BOUNDARY="schooldesk-backup-$(date +%s)-$$"
MSG="$WORK/message.eml"
{
    printf 'From: %s\n' "$FROM_HEADER"
    printf 'To: %s\n' "$(printf '%s' "$TO_LIST" | sed 's/,/, /g')"
    # Objet encodé (RFC 2047) en deux mots encodés pour rester sous 75 caractères chacun.
    printf 'Subject: =?UTF-8?B?%s?=\n =?UTF-8?B?%s?=\n' "$(b64 'SchoolDesk — Sauvegarde ')" "$(b64 "PostgreSQL — $DAY")"
    printf 'Date: %s\n' "$(date -R)"
    printf 'Message-ID: <%s.%s@%s>\n' "$STAMP" "$(date +%s)" "${FROM_ADDR#*@}"
    printf 'MIME-Version: 1.0\n'
    printf 'Content-Type: multipart/mixed; boundary="%s"\n\n' "$BOUNDARY"
    printf -- '--%s\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: base64\n\n' "$BOUNDARY"
    {
        printf 'Copie hors NAS de la sauvegarde PostgreSQL complète de SchoolDesk.\n\n'
        printf 'Date de la sauvegarde : %s %s (fuseau %s)\n' "$DAY" "$TIME" "${TZ:-UTC}"
        printf 'Fichier d’origine     : %s (%s octets)\n' "$NAME" "$DUMP_SIZE"
        printf 'Validation            : réussie (pg_restore --list)\n'
        printf 'SHA-256 du dump       : %s\n' "$DUMP_SHA"
        printf 'Pièce jointe          : %s (%s octets), chiffrée OpenPGP AES-256 (phrase secrète)\n\n' "$ENC_NAME" "$ENC_SIZE"
        printf 'Déchiffrement : gpg --decrypt --output %s %s\n' "$NAME" "$ENC_NAME"
        printf 'Restauration  : voir README de SchoolDesk, section « Sauvegardes ».\n'
    } | base64 -w 76
    printf '\n--%s\nContent-Type: application/octet-stream; name="%s"\nContent-Disposition: attachment; filename="%s"\nContent-Transfer-Encoding: base64\n\n' "$BOUNDARY" "$ENC_NAME" "$ENC_NAME"
    base64 -w 76 "$ENC"
    printf '\n--%s--\n' "$BOUNDARY"
} > "$MSG"

# --- Envoi (identifiants passés à curl par sa configuration sur stdin, jamais en argument) ------
if [ "${SMTP_SECURE:-true}" = "true" ]; then
    URL="smtps://$SMTP_HOST:${SMTP_PORT:-465}"
    TLS_OPTION=""
else
    URL="smtp://$SMTP_HOST:${SMTP_PORT:-465}"
    TLS_OPTION="--ssl-reqd"
fi
curl_quote() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
set --
OLD_IFS="$IFS"
IFS=','
for rcpt in $TO_LIST; do
    [ -n "$rcpt" ] && set -- "$@" --mail-rcpt "$rcpt"
done
IFS="$OLD_IFS"
if ! printf 'user = "%s:%s"\n' "$(curl_quote "$SMTP_USER")" "$(curl_quote "$SMTP_PASS")" \
        | curl --silent --show-error --config - --url "$URL" $TLS_OPTION --mail-from "$FROM_ADDR" "$@" \
            --upload-file "$MSG" --crlf --connect-timeout 30 --max-time 600 2>"$WORK/curl.log"; then
    sed 's/^/[db-backup-email]   /' "$WORK/curl.log" >&2
    fail "échec de l'envoi SMTP vers $SMTP_HOST"
fi

: > "$SENT"
rm -f "$ATTEMPTS_FILE"
log "copie chiffrée envoyée : $ENC_NAME ($ENC_SIZE octets) — tentative $ATTEMPTS. Dump local intact."
