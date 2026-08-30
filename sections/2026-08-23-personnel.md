# Section Personnel — 23 août 2026

## Contexte

Troisième section traitée dans la revue section par section (après Élèves et Classes), à la demande directe de l'utilisateur : « on fait la même chose pour classes, personnel ». Même traitement appliqué à Personnel.

## État de départ

Liste de cartes simples (nom, matricule, fonction affichée en anglais brut comme `TEACHER`), formulaire minimal (prénom, nom, fonction), pas de téléphone/email/adresse/qualification/salaire visibles ni modifiables depuis l'interface, pas de modification, pas de suppression, pas de tri. Le backend filtrait en plus systématiquement sur le statut `ACTIVE`, rendant les employés inactifs invisibles sans possibilité de les consulter.

## Changements apportés

### Backend (`apps/backend/src/staff-attendance-routes.ts`)

- `GET /api/employees` : ne filtre plus sur `status: 'ACTIVE'` côté serveur — renvoie tous les statuts, à charge du frontend de filtrer les archivés (même principe que pour les élèves), pour que le statut `INACTIVE` reste consultable.
- `POST /api/employees` : accepte désormais aussi `address`.
- `PATCH /api/employees/:id` (nouveau) : modification complète (identité, fonction, téléphone, email, adresse, qualification, date d'embauche, salaire de base, type de contrat, statut).
- `DELETE /api/employees/:id` (nouveau) : **archive** l'employé (statut `ARCHIVED`) au lieu de le supprimer, cohérent avec la règle de conservation de l'historique déjà appliquée aux élèves.

### Frontend

- Fenêtre modale complète (`+ Nouveau membre`) : prénom, nom, fonction, statut (en édition), téléphone, email, adresse, qualification, date d'embauche, salaire de base, type de contrat.
- Tableau triable : Matricule, Nom, Prénom, Fonction (libellé français), Téléphone, Email, Date d'embauche, Salaire de base, Statut.
- Menu contextuel au clic droit sur une ligne : Modifier / Supprimer.
- Les employés archivés disparaissent de la liste **et** de tous les sélecteurs de personnel ailleurs dans l'application (professeur/assistant de classe, sélection d'employé pour les salaires), mais restent en base avec leur historique (salaires, présences).

### Refactorisation commune (profite aussi à Élèves et Classes)

Le tri par colonne a été généralisé en un hook réutilisable `useSortedRows` et un composant `SortHeader` générique, utilisés par les trois tableaux (Élèves, Classes, Personnel) sans dupliquer la logique.

## Fichiers modifiés

- Backend : `apps/backend/src/staff-attendance-routes.ts`.
- Frontend : `apps/frontend/src/pages.tsx` (page Personnel + refactorisation du tri), `apps/frontend/src/App.tsx` (état, sauvegarde, filtrage du personnel archivé), `apps/frontend/src/types.ts` (type `Employee` enrichi).

## Tests effectués

Testés en navigateur réel via Playwright :

- Création d'un membre du personnel avec toutes les informations (téléphone, email, qualification, date d'embauche, salaire, type de contrat) → visible dans le tableau.
- Modification du salaire via le menu contextuel → mise à jour visible immédiatement.
- Archivage via le menu contextuel → disparaît du tableau Personnel et du sélecteur d'employé de la page Salaires.
- Navigation complète de l'application après chaque étape : aucune erreur console, aucune régression.

## Écarts connus restants

- Pas de gestion documentaire (CV, diplôme, contrat — section 15 du cahier des charges) : pas d'infrastructure d'upload de fichiers dans l'application pour l'instant.
- Champ « notes » présent dans le modèle de données mais pas encore exposé dans le formulaire.
