# ---- Étape 1 : compilation (Node + Vite) ----
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci

COPY apps/frontend apps/frontend

WORKDIR /app/apps/frontend
RUN npm run build

# ---- Étape 2 : service statique (Nginx) ----
# Le frontend appelle toujours l'API en même origine (/api, proxifié vers le backend par Nginx
# ci-dessous, voir nginx.conf) — aucune adresse/port de backend n'est donc jamais compilé dans
# le JavaScript envoyé au navigateur, quel que soit l'environnement (local, LAN, tunnel public).
FROM nginx:1.27-alpine

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1
