#!/bin/sh
# Rotation des sauvegardes : garde les N dumps les plus récents dans DIR, supprime les autres.
#
# Usage : rotate.sh <dossier> <nombre_a_garder>
#
# - Ne considère QUE les fichiers au nom exact schooldesk-AAAA-MM-JJ_HH-MM-SS.dump : tout autre
#   fichier du dossier (copie manuelle renommée, notes, sous-dossier...) n'est jamais touché.
# - L'ordre est celui de l'horodatage contenu dans le nom (tri lexicographique), pas la date de
#   modification du fichier — une copie/restauration de fichiers ne fausse donc pas la rotation.
# - Supprime aussi les fichiers temporaires .schooldesk-*.dump.partial laissés par une sauvegarde
#   interrompue (jamais considérés comme des sauvegardes valides).
set -eu

DIR="${1:?dossier requis}"
KEEP="${2:?nombre de sauvegardes à garder requis}"

case "$KEEP" in
    ''|*[!0-9]*) echo "[db-backup] rétention invalide : '$KEEP'" >&2; exit 1 ;;
esac
if [ "$KEEP" -lt 1 ]; then
    echo "[db-backup] rétention invalide (< 1) : refus de tout supprimer." >&2
    exit 1
fi

cd "$DIR"

# Partiels abandonnés depuis plus d'une heure (une sauvegarde en cours n'est jamais concernée).
find . -maxdepth 1 -type f -name '.schooldesk-*.dump.partial' -mmin +60 -exec rm -f {} \;

LIST="$(ls -1 2>/dev/null | grep -E '^schooldesk-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}\.dump$' | sort -r || true)"
TOTAL="$(printf '%s' "$LIST" | grep -c . || true)"

if [ "$TOTAL" -le "$KEEP" ]; then
    echo "[db-backup] rotation : $TOTAL sauvegarde(s), limite $KEEP — rien à supprimer."
    exit 0
fi

printf '%s\n' "$LIST" | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
    [ -n "$old" ] || continue
    rm -f -- "$old"
    echo "[db-backup] rotation : supprimé $old"
done
echo "[db-backup] rotation : $KEEP sauvegarde(s) conservée(s) sur $TOTAL."
