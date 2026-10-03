#!/usr/bin/env bash
# Tests réels du service db-backup (sauvegarde, rotation, copie e-mail chiffrée) sur le banc jetable
# docker-compose.test.yml. Aucun e-mail réel (faux SMTP Mailpit), aucune donnée réelle.
# Usage (Git Bash ou Linux) : sh scripts/db-backup/tests/run-tests.sh   → code 0 si tout passe.
set -u
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")" || exit 1
C="docker compose -f docker-compose.test.yml"
PASSPHRASE="test-passphrase-ne-pas-utiliser-0123456789"
SMTP_SECRET="test-smtp-password-123"
PASS=0; FAIL=0
ok() { echo "  OK  $1"; PASS=$((PASS + 1)); }
ko() { echo "  KO  $1"; FAIL=$((FAIL + 1)); }
eq() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else ko "$1 (attendu « $3 », obtenu « $2 »)"; fi; }
has() { if printf '%s' "$2" | grep -qF -- "$3"; then ok "$1"; else ko "$1 (« $3 » absent)"; printf '%s\n' "$2" | sed 's/^/        | /'; fi; }
hasnot() { if printf '%s' "$2" | grep -qF -- "$3"; then ko "$1"; else ok "$1"; fi; }
db() { $C exec -T db-backup sh -c "$1"; }
tester() { $C exec -T tester sh -c "$1"; }
# Lance email.sh avec des variables supplémentaires ; renvoie sa sortie + « EXIT=<code> ».
email() { $C exec -T -e DB_BACKUP_EMAIL_ENABLED=true "$@" db-backup sh -c 'db-backup-email.sh 2>&1; echo "EXIT=$?"'; }
total() { tester "curl -s http://${1:-mailpit}:8025/api/v1/messages | jq .total"; }
# Champ JSON d'un message Mailpit (jq exécuté dans le conteneur tester).
msg() { tester "curl -s http://mailpit:8025/api/v1/message/$1 | jq -r '$2'"; }
latest() { db "ls -1 /backups | grep -E '^schooldesk-[0-9_-]+\.dump\$' | sort -r | head -n 1"; }
sha() { db "sha256sum /backups/$1 | cut -d ' ' -f 1"; }
nosecret() { hasnot "$1 : aucune phrase secrète" "$2" "$PASSPHRASE"; hasnot "$1 : aucun mot de passe SMTP" "$2" "$SMTP_SECRET"; }
new_dump() { sleep 1; db "db-backup.sh" >/dev/null 2>&1; latest; }

echo "== Préparation du banc jetable =="
$C --profile scheduler down -v --remove-orphans >/dev/null 2>&1
$C up -d --build db-backup tester >/dev/null 2>&1 || { echo "échec du démarrage du banc"; exit 1; }
tester "apk add --no-cache -q jq" >/dev/null
db "psql -q -c 'CREATE TABLE eleves (id serial PRIMARY KEY, nom text); INSERT INTO eleves (nom) SELECT md5(i::text) FROM generate_series(1, 1000) i;'"

echo "== 1-2. Sauvegarde normale, copie e-mail désactivée =="
OUT="$(db 'db-backup.sh 2>&1; echo EXIT=$?')"
has "db-backup.sh réussit" "$OUT" "EXIT=0"
N1="$(latest)"
eq "dump au nom attendu" "$(printf '%s' "$N1" | grep -cE '^schooldesk-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}\.dump$')" "1"
eq "dump validé par pg_restore --list" "$(db "pg_restore --list /backups/$N1 >/dev/null && echo valide")" "valide"
eq "droits du dump inchangés (600 root)" "$(db "stat -c '%a %U' /backups/$N1")" "600 root"
eq "aucun .partial restant" "$(db "ls -a /backups | grep -c partial")" "0"
OUT="$($C exec -T db-backup sh -c 'db-backup-email.sh 2>&1; echo "EXIT=$?"')"
eq "email.sh désactivé : silencieux, code 0" "$OUT" "EXIT=0"
eq "désactivé : aucun e-mail" "$(total)" "0"
eq "désactivé : aucun marqueur" "$(db "ls -a /backups | grep -c email-")" "0"
eq "healthcheck db-backup OK" "$(db "find /backups -maxdepth 1 -name 'schooldesk-*.dump' -mmin -1560 | grep -q . && echo sain")" "sain"

echo "== 3-7. Envoi chiffré (STARTTLS obligatoire + authentification) =="
SHA1="$(sha "$N1")"
OUT="$(email)"
has "envoi réussi" "$OUT" "EXIT=0"
has "log de succès" "$OUT" "copie chiffrée envoyée : $N1.gpg"
nosecret "log d'envoi" "$OUT"
eq "un e-mail reçu" "$(total)" "1"
ID="$(tester "curl -s http://mailpit:8025/api/v1/messages | jq -r '.messages[0].ID'")"
DAY="$(printf '%s' "$N1" | cut -c 12-21)"
eq "objet" "$(msg "$ID" .Subject)" "SchoolDesk — Sauvegarde PostgreSQL — $DAY"
eq "destinataire" "$(msg "$ID" '.To[0].Address')" "backup-destinataire@example.test"
eq "une seule pièce jointe" "$(msg "$ID" '.Attachments | length')" "1"
eq "pièce jointe = copie chiffrée" "$(msg "$ID" '.Attachments[0].FileName')" "$N1.gpg"
BODY="$(msg "$ID" .Text)"
has "corps : nom du fichier" "$BODY" "$N1"
has "corps : validation" "$BODY" "réussie (pg_restore --list)"
has "corps : SHA-256" "$BODY" "$SHA1"
PART="$(msg "$ID" '.Attachments[0].PartID')"
tester "curl -s -o /tmp/att.gpg http://mailpit:8025/api/v1/message/$ID/part/$PART"
eq "pièce jointe non lisible en clair (pas d'en-tête PGDMP)" "$(tester "head -c 5 /tmp/att.gpg | grep -c PGDMP")" "0"
PACKETS="$(tester "export GNUPGHOME=\$(mktemp -d); printf '%s' '$PASSPHRASE' | gpg --batch --pinentry-mode loopback --passphrase-fd 0 --list-packets /tmp/att.gpg 2>&1")"
has "pièce jointe = OpenPGP RFC 4880, AES-256 (cipher 9), sans AEAD" "$PACKETS" "symkey enc packet: version 4, cipher 9, aead 0"
has "pièce jointe = intégrité MDC" "$PACKETS" "mdc_method: 2"
tester "export GNUPGHOME=\$(mktemp -d); printf '%s' '$PASSPHRASE' | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 --decrypt --output /tmp/dec.dump /tmp/att.gpg"
eq "déchiffrement : SHA-256 identique au dump d'origine" "$(tester "sha256sum /tmp/dec.dump | cut -d ' ' -f 1")" "$SHA1"
eq "dump déchiffré validé par pg_restore --list" "$(tester "pg_restore --list /tmp/dec.dump >/dev/null && echo valide")" "valide"
eq "mauvaise phrase secrète refusée" "$(tester "export GNUPGHOME=\$(mktemp -d); printf 'mauvaise' | gpg --batch --pinentry-mode loopback --passphrase-fd 0 --decrypt /tmp/att.gpg >/dev/null 2>&1 && echo dechiffre || echo refuse")" "refuse"
RAW="$(tester "curl -s http://mailpit:8025/api/v1/message/$ID/raw")"
nosecret "message brut" "$RAW"
eq "dump d'origine intact (SHA-256)" "$(sha "$N1")" "$SHA1"
eq "dump d'origine : droits inchangés" "$(db "stat -c '%a %U' /backups/$N1")" "600 root"
eq "temporaire chiffré supprimé (/tmp)" "$(db "find /tmp -maxdepth 1 -type d -name 'db-backup-email.*' | wc -l")" "0"
eq "aucun .gpg dans le dossier des sauvegardes" "$(db "ls -a /backups | grep -c gpg")" "0"
eq "marqueur d'envoi posé" "$(db "test -f /backups/.$N1.email-sent && echo oui")" "oui"

echo "== 9a. Pas de doublon (nouvelle vérification) =="
OUT="$(email)"
eq "déjà envoyé : silencieux, code 0" "$OUT" "EXIT=0"
eq "toujours un seul e-mail" "$(total)" "1"

echo "== 8. Échec SMTP puis nouvel essai réussi =="
N2="$(new_dump)"; SHA2="$(sha "$N2")"
OUT="$(email -e SMTP_PASS=mauvais-mot-de-passe)"
has "authentification refusée → échec" "$OUT" "EXIT=1"
has "tentative 1/3 journalisée" "$OUT" "tentative 1/3"
nosecret "log d'échec" "$OUT"
OUT="$(email -e SMTP_HOST=hote-inexistant.invalid)"
has "SMTP injoignable → échec" "$OUT" "tentative 2/3"
eq "aucun e-mail pendant les échecs" "$(total)" "1"
eq "dump intact après échecs" "$(sha "$N2")" "$SHA2"
eq "temporaire supprimé après échec" "$(db "find /tmp -maxdepth 1 -type d -name 'db-backup-email.*' | wc -l")" "0"
eq "pas de marqueur d'envoi après échec" "$(db "test -f /backups/.$N2.email-sent && echo oui || echo non")" "non"
OUT="$(email)"
has "nouvel essai réussi" "$OUT" "tentative 3"
eq "e-mail envoyé une seule fois" "$(total)" "2"
eq "compteur de tentatives nettoyé" "$(db "test -f /backups/.$N2.email-attempts && echo oui || echo non")" "non"

echo "== 9b. Plafond de tentatives : pas de boucle d'envoi =="
N3="$(new_dump)"
for i in 1 2 3; do OUT="$(email -e SMTP_PASS=mauvais-mot-de-passe)"; done
has "3e échec : abandon journalisé" "$OUT" "abandon pour $N3"
OUT="$(email -e SMTP_PASS=mauvais-mot-de-passe)"
eq "4e vérification : plus aucune tentative" "$OUT" "EXIT=0"
eq "compteur bloqué à 3" "$(db "cat /backups/.$N3.email-attempts")" "3"
OUT="$(email)"
eq "dump abandonné jamais renvoyé (même SMTP rétabli)" "$(total)" "2"
N4="$(new_dump)"
OUT="$(email)"
has "dump suivant envoyé normalement" "$OUT" "copie chiffrée envoyée : $N4.gpg"
eq "total e-mails" "$(total)" "3"

echo "== Validation obligatoire : jamais de dump invalide ni de .partial =="
db "printf 'pas un dump' > /backups/schooldesk-2099-12-31_00-00-00.dump && chmod 600 /backups/schooldesk-2099-12-31_00-00-00.dump"
OUT="$(email)"
has "dump invalide refusé" "$OUT" "n'est pas lisible par pg_restore --list"
eq "rien envoyé" "$(total)" "3"
db "rm -f /backups/schooldesk-2099-12-31_00-00-00.dump /backups/.schooldesk-2099-12-31_00-00-00.dump.email-attempts"
db "cp /backups/$N4 /backups/.schooldesk-2099-12-31_00-00-00.dump.partial"
OUT="$(email)"
eq ".partial ignoré" "$OUT" "EXIT=0"
eq "rien envoyé" "$(total)" "3"
db "rm -f /backups/.schooldesk-2099-12-31_00-00-00.dump.partial"

echo "== TLS implicite (SMTP_SECURE=true) =="
N5="$(new_dump)"
OUT="$(email -e SMTP_HOST=mailpit-tls -e SMTP_SECURE=true)"
has "envoi en TLS implicite" "$OUT" "copie chiffrée envoyée : $N5.gpg"
eq "reçu par le serveur TLS" "$(total mailpit-tls)" "1"

echo "== Configuration incomplète ou faible =="
N6="$(new_dump)"
OUT="$(email -e DB_BACKUP_EMAIL_PASSPHRASE=)"
has "phrase secrète absente : refus nommant la variable" "$OUT" "DB_BACKUP_EMAIL_PASSPHRASE"
has "phrase secrète absente : code 1" "$OUT" "EXIT=1"
OUT="$(email -e DB_BACKUP_EMAIL_PASSPHRASE=courte)"
has "phrase secrète trop courte refusée" "$OUT" "trop courte"
nosecret "log de configuration" "$OUT"
eq "aucune tentative consommée" "$(db "test -f /backups/.$N6.email-attempts && echo oui || echo non")" "non"
OUT="$(email)"
has "puis envoi normal" "$OUT" "copie chiffrée envoyée : $N6.gpg"
eq "total e-mails" "$(total)" "4"

echo "== 10. Limite de taille =="
db "psql -q -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE TABLE gros (donnees bytea); INSERT INTO gros SELECT gen_random_bytes(1024) FROM generate_series(1, 3000);'"
N7="$(new_dump)"; SHA7="$(sha "$N7")"
OUT="$(email -e DB_BACKUP_EMAIL_MAX_MB=1)"
has "dépassement : non envoyé, message clair" "$OUT" "NON envoyée pour $N7"
has "dépassement : code 0 (pas d'erreur d'envoi)" "$OUT" "EXIT=0"
nosecret "log de taille" "$OUT"
eq "aucun e-mail" "$(total)" "4"
eq "dump intact" "$(sha "$N7")" "$SHA7"
eq "marqueur « écarté » posé" "$(db "test -f /backups/.$N7.email-skipped && echo oui")" "oui"
OUT="$(email -e DB_BACKUP_EMAIL_MAX_MB=1)"
eq "pas de nouvelle tentative ni de log répété" "$OUT" "EXIT=0"
N8="$(new_dump)"; SIZE8="$(db "wc -c < /backups/$N8")"
OUT="$(email)"
has "dump de ~3 Mo envoyé sous la limite par défaut (18 Mo)" "$OUT" "copie chiffrée envoyée : $N8.gpg"
eq "total e-mails" "$(total)" "5"
ID8="$(tester "curl -s http://mailpit:8025/api/v1/messages | jq -r '.messages[0].ID'")"
PART8="$(tester "curl -s http://mailpit:8025/api/v1/message/$ID8 | jq -r '.Attachments[0].PartID'")"
tester "curl -s -o /tmp/att8.gpg http://mailpit:8025/api/v1/message/$ID8/part/$PART8; export GNUPGHOME=\$(mktemp -d); printf '%s' '$PASSPHRASE' | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 --decrypt --output /tmp/dec8.dump /tmp/att8.gpg"
eq "gros dump déchiffré identique" "$(tester "sha256sum /tmp/dec8.dump | cut -d ' ' -f 1")" "$(sha "$N8")"
eq "gros dump déchiffré : pg_restore --list" "$(tester "pg_restore --list /tmp/dec8.dump >/dev/null && echo valide")" "valide"
echo "        (taille du gros dump : $SIZE8 octets)"

echo "== 11. Rotation des 14 sauvegardes + marqueurs =="
db "for d in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20; do cp -p /backups/$N1 /backups/schooldesk-2026-01-\${d}_00-00-00.dump; done; for d in 01 02 20; do : > /backups/.schooldesk-2026-01-\${d}_00-00-00.dump.email-sent; done; echo x > /backups/other.dump; echo x > /backups/notes.txt"
N9="$(new_dump)"
eq "14 sauvegardes conservées" "$(db "ls -1 /backups | grep -cE '^schooldesk-[0-9_-]+\.dump\$'")" "14"
eq "les plus anciennes supprimées" "$(db "ls /backups/schooldesk-2026-01-01_00-00-00.dump 2>/dev/null | wc -l")" "0"
eq "la plus récente factice conservée" "$(db "ls /backups/schooldesk-2026-01-20_00-00-00.dump | wc -l")" "1"
eq "fichiers étrangers intacts" "$(db "ls /backups/other.dump /backups/notes.txt | wc -l")" "2"
OUT="$(email)"
has "dernier dump envoyé après rotation" "$OUT" "copie chiffrée envoyée : $N9.gpg"
eq "marqueurs orphelins nettoyés" "$(db "ls -a /backups | grep -c 'schooldesk-2026-01-0[12]_00-00-00.dump.email'")" "0"
eq "marqueur d'un dump conservé gardé" "$(db "test -f /backups/.schooldesk-2026-01-20_00-00-00.dump.email-sent && echo oui")" "oui"
eq "rotation après marqueurs : toujours 14" "$(db "ls -1 /backups | grep -cE '^schooldesk-[0-9_-]+\.dump\$'")" "14"
eq "healthcheck toujours sain" "$(db "find /backups -maxdepth 1 -name 'schooldesk-*.dump' -mmin -1560 | grep -q . && echo sain")" "sain"

echo "== 9c. Vraie boucle (scheduler) + redémarrage : une seule copie par dump =="
BEFORE="$(total)"
$C --profile scheduler up -d db-backup-scheduler >/dev/null 2>&1
for i in $(seq 1 30); do [ "$(total)" -gt "$BEFORE" ] && break; sleep 2; done
sleep 8
eq "boucle : sauvegarde du jour créée une fois" "$($C exec -T db-backup-scheduler sh -c "ls -1 /backups | grep -cE '^schooldesk-[0-9_-]+\.dump\$'")" "1"
eq "boucle : un seul e-mail après plusieurs vérifications" "$(total)" "$((BEFORE + 1))"
$C --profile scheduler restart db-backup-scheduler >/dev/null 2>&1
sleep 8
eq "après redémarrage : pas de nouvelle sauvegarde" "$($C exec -T db-backup-scheduler sh -c "ls -1 /backups | grep -cE '^schooldesk-[0-9_-]+\.dump\$'")" "1"
eq "après redémarrage : pas de doublon d'e-mail" "$(total)" "$((BEFORE + 1))"
LOGS="$($C --profile scheduler logs db-backup-scheduler 2>&1)"
eq "boucle : « envoyée » journalisé une seule fois" "$(printf '%s' "$LOGS" | grep -c 'copie chiffrée envoyée')" "1"
has "boucle : démarrage annonce la copie e-mail" "$LOGS" "copie e-mail true"
nosecret "logs de la boucle" "$LOGS"
eq "boucle : temporaire supprimé" "$($C exec -T db-backup-scheduler sh -c "find /tmp -maxdepth 1 -type d -name 'db-backup-email.*' | wc -l")" "0"

echo "== Nettoyage du banc =="
$C --profile scheduler down -v --remove-orphans >/dev/null 2>&1
echo
echo "RÉSULTAT : $PASS OK, $FAIL KO"
[ "$FAIL" -eq 0 ]
