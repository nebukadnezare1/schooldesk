#!/bin/sh
# Lance les tests backend contre une base PostgreSQL jetable (docker-compose.test.yml), puis supprime
# systématiquement conteneurs et réseau de test, même en cas d'échec. Ne touche jamais à la pile
# docker-compose.yml du projet (nom de projet Compose distinct : schooldesk-test).
cd "$(dirname "$0")" || exit 1
compose="docker compose -f docker-compose.test.yml"
$compose up --build --abort-on-container-exit --exit-code-from tests
status=$?
$compose down -v --remove-orphans
exit $status
