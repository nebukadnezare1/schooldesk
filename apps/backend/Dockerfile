FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci

COPY apps/backend apps/backend

WORKDIR /app/apps/backend
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed && node dist/src/server.js"]
