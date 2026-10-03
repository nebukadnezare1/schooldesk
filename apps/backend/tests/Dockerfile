# Image d'exécution des tests backend (voir docker-compose.test.yml) — calquée sur apps/backend/Dockerfile.
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci

COPY apps/backend apps/backend

WORKDIR /app/apps/backend
RUN npx prisma generate

# Les migrations réelles sont rejouées sur la base jetable avant les tests (DATABASE_URL n'est
# défini que pour cette commande, à partir de TEST_DATABASE_URL).
CMD ["sh", "-c", "DATABASE_URL=\"$TEST_DATABASE_URL\" npx prisma migrate deploy && npm test"]
