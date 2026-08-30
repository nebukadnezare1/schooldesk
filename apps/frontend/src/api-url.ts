// En production, Nginx sert le frontend et proxifie /api/ vers le backend en interne (voir
// apps/frontend/nginx.conf) — frontend et API sont donc toujours en même origine, quel que soit
// l'environnement (local, LAN, tunnel public) : jamais d'adresse/port de backend à connaître
// côté navigateur. En dev sans Docker (`npm run dev`), le proxy intégré de Vite (vite.config.ts)
// joue exactement le même rôle. Chaîne vide = requêtes toujours relatives à l'origine courante.
export const apiUrl = '';
