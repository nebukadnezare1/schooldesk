# Réinitialisation complète et suppression des données de démo — 24 août 2026

## Contexte

Après la refonte des frais par élève, l'utilisateur a demandé de vider la base de données pour repartir de zéro pendant ses tests (« supprime la db pour reparti de 0 »), puis est allé plus loin en demandant de supprimer aussi les données de démonstration du seed (« supprime meme les donner demo comme sa je par vraiment de 0 »), pas seulement de réinitialiser en les recréant.

## État de départ

- `docker compose down` + suppression du volume `ecole-garden_postgres_data` + `docker compose up -d` réinitialise déjà la base à chaque fois, car le `CMD` du Dockerfile backend relance automatiquement `prisma migrate deploy` puis `npm run prisma:seed` au démarrage.
- Le seed existant (`apps/backend/prisma/seed.ts`) créait des données fictives complètes : année scolaire 2026-2027, classe « Petite Section A », employée « Samira Alaoui », tutrice « Nadia Bennani », élève « Yasmine Bennani », inscription, type de frais « Mensualité » (500 DH), catégorie de dépense « Fournitures », dépense de démonstration.
- Avant de supprimer ces données, vérification qu'aucune fonctionnalité ne serait bloquée pour un utilisateur partant réellement de zéro. Deux manques identifiés : **aucune interface pour créer une année scolaire**, ni **un type de frais** — seuls des menus déroulants existaient, alimentés uniquement par les données de démo. Sans année scolaire, impossible de créer une classe ; sans type de frais, impossible d'encaisser un nouveau paiement.

## Changements apportés

### Backend

- `apps/backend/src/academic-routes.ts` : `POST /api/academic-years` clôture désormais automatiquement toute année déjà active si la nouvelle année est créée directement avec le statut « Active » (même logique de transaction que celle déjà en place sur `PATCH /academic-years/:id/status`, pour ne jamais se retrouver avec deux années actives simultanément).
- `apps/backend/prisma/seed.ts` réduit au strict bootstrap : `Setting('school.currency')`, `Role('ADMIN')` + toutes les permissions + `RolePermission`, et l'utilisateur administrateur. Toute donnée métier fictive supprimée.

### Frontend

- `apps/frontend/src/pages.tsx` — `ClassesPage` : bouton « + Année scolaire » (à côté de « + Nouvelle classe »), ouvrant une fenêtre modale avec libellé (format AAAA-AAAA), date de début, date de fin et statut, avec une note précisant que choisir « Active » clôture automatiquement l'année active existante.
- `apps/frontend/src/pages.tsx` — `PaymentsPage` : lien « + Nouveau type de frais » sous le sélecteur de type, dans la fenêtre « Nouvel encaissement » et dans la fenêtre « Nouveau frais manuel », ouvrant une fenêtre modale (nom, montant par défaut, fréquence) — même principe que le bouton d'ajout rapide de catégorie déjà présent dans Dépenses.
- `apps/frontend/src/App.tsx` : nouveaux handlers `createAcademicYear` et `createFeeType`, nouvelles clés `yearLabel`/`yearStartsAt`/`yearEndsAt`/`yearStatus`/`newFeeTypeName`/`newFeeTypeAmount`/`newFeeTypeFrequency` dans l'état des formulaires.

## Fichiers modifiés

- Backend : `apps/backend/src/academic-routes.ts`, `apps/backend/prisma/seed.ts`.
- Frontend : `apps/frontend/src/pages.tsx`, `apps/frontend/src/App.tsx`.

## Tests effectués

- `docker compose build backend frontend` : les deux images se construisent sans erreur (le build frontend exécute `tsc -b` avant Vite, donc toute erreur de type aurait bloqué le build).
- Base réinitialisée une nouvelle fois (volume supprimé, conteneurs relancés) : logs backend confirmant les 10 migrations appliquées et le seed réduit exécuté sans erreur, aucune donnée métier créée.
- Parcours Playwright complet simulant un utilisateur partant d'une base vide : connexion → page Classes affichant « — » comme année scolaire (aucune active) → création d'une année « 2026-2027 » via la nouvelle fenêtre, statut Active → l'eyebrow de la page affiche bien la nouvelle année → création d'une classe « Petite Section A » → page Élèves : création d'un élève avec mensualité (400 DH) et assurance (200 DH) propres → page Paiements : élève sélectionnable, « Aucun frais enregistré », « Aucun paiement » (état vraiment vide confirmé) → création du type de frais « Mensualité » depuis la fenêtre d'encaissement.
- Vérifié en base (`psql`) : les deux types de frais présents après le test sont « Assurance » (créé automatiquement par la migration `202608240002`) et « Mensualité » (créé via la nouvelle interface) — aucune trace de données de démo.
- Navigation complète de toutes les pages de l'application (Élèves, Classes, Présences, Personnel, Paiements, Impayés, Dépenses, Salaires, Caisse) sur la base vide : aucune erreur console.

## Écarts connus restants

- Pas d'interface pour modifier ou clôturer une année scolaire après création autrement que via une nouvelle création avec statut « Active » (qui clôture automatiquement l'ancienne) — il n'y a pas d'écran dédié pour éditer une année existante.
- Pas d'interface pour modifier le montant par défaut ou la fréquence d'un type de frais après sa création, ni pour le désactiver.
