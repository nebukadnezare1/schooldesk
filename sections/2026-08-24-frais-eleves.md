# Frais par élève (Mensualité / Assurance) — 24 août 2026

## Contexte

L'utilisateur a demandé deux fois, à partir de captures d'écran concrètes, pourquoi un encaissement d'un certain montant (220 DH, puis 230 DH) faisait apparaître un frais « dû » de 500 DH. La première réponse expliquait le mécanisme (montant par défaut du type de frais « Mensualité ») mais le qualifiait de « voulu » — l'utilisateur a demandé qui avait décidé ça. Réponse honnête : personne du côté utilisateur ; c'était un choix d'implémentation d'une session précédente de l'assistant, jamais explicitement validé.

Décision de l'utilisateur : simplifier durablement en fixant le prix de la mensualité et de l'assurance **sur la fiche de chaque élève**, pour que les encaissements suivent ces montants sans supposition cachée. L'assurance est annuelle mais peut être payée en plusieurs fois — à intégrer avec le mécanisme déjà existant (pas besoin d'un nouveau système, le paiement partiel fonctionne déjà pour tout frais).

## Ancien comportement (avant ce changement)

Quand un encaissement direct était fait pour une période sans frais existant, le système créait automatiquement un `StudentFee` en utilisant le montant **par défaut du type de frais** (`FeeType.defaultAmount`, une valeur globale partagée par tous les élèves), pas le montant réellement encaissé ni un montant propre à l'élève. Résultat : un parent payant 230 DH voyait apparaître un « dû » de 500 DH, sans rien qui l'explique à l'écran avant de valider.

## Changements apportés

### Migration

`202608240002_student_fee_amounts` :
- Ajout de `monthlyFee` et `insuranceFee` (`Decimal?`, optionnels) sur `Student`.
- Création automatique du type de frais **Assurance** (fréquence `YEARLY`, montant par défaut 0) s'il n'existe pas déjà — pour qu'il soit immédiatement disponible dans les sélecteurs sans étape manuelle.

### Backend (`apps/backend/src/student-routes.ts`, `apps/backend/src/finance-routes.ts`)

- `POST` et `PATCH /api/students` acceptent désormais `monthlyFee` et `insuranceFee` (nombres positifs ou nuls, optionnels).
- `POST /api/payments` : lors de la création automatique d'un frais (encaissement direct sur une période sans frais existant), le montant dû est déterminé ainsi :
  - type « Mensualité » → `student.monthlyFee`, avec repli sur `FeeType.defaultAmount` si non configuré ;
  - type « Assurance » → `student.insuranceFee`, même repli ;
  - tout autre type → `FeeType.defaultAmount` comme avant (comportement inchangé pour d'éventuels futurs types).

### Frontend

- Formulaire élève (création et modification, `apps/frontend/src/pages.tsx`) : nouveau bloc « Frais de scolarité » avec deux champs optionnels, Mensualité (DH) et Assurance annuelle (DH), accompagnés d'une note explicative (« ces montants sont ceux appliqués automatiquement lors d'un encaissement pour cet élève »).
- Fenêtre « Nouvel encaissement » (page Paiements) : affichage en direct, dès que le type et la période sont choisis, du montant qui sera effectivement dû — soit celui d'un frais déjà existant pour cette période (« Frais déjà existant : X DH dû, reste Y DH »), soit une prévisualisation de ce qui sera créé (« Nouveau frais : X DH seront dus… », avec précision explicite si c'est le montant configuré pour l'élève ou, à défaut, le tarif par défaut du type). C'est le cœur du correctif : la source du montant est visible **avant** de valider, la confusion initiale ne peut plus se reproduire silencieusement.

## Fichiers modifiés

- Backend : `apps/backend/prisma/schema.prisma`, migration `202608240002_student_fee_amounts`, `apps/backend/src/student-routes.ts`, `apps/backend/src/finance-routes.ts`.
- Frontend : `apps/frontend/src/pages.tsx` (formulaire élève + fenêtre d'encaissement), `apps/frontend/src/App.tsx`, `apps/frontend/src/types.ts` (type `Student` enrichi).

## Tests effectués

Avec Playwright, sur le cas exact ayant motivé le changement :

- Fiche de Mehdi Fetouaki modifiée : Mensualité = 300 DH, Assurance = 150 DH.
- Nouvel encaissement « Mensualité » sur une période neuve (« 20 ») → aperçu affiché avant validation : « Nouveau frais : 300 DH seront dus pour cette période (montant configuré pour cet élève) ». Paiement de 300 DH enregistré → frais créé à 300 DH (pas 500), statut Payé.
- Nouvel encaissement « Assurance » sur la période « 2026-2027 » → aperçu : « 150 DH… montant configuré pour cet élève ».
- Vérifié en base que les frais déjà existants de l'élève (créés avant ce changement) n'ont pas été modifiés rétroactivement — seuls les nouveaux frais utilisent la nouvelle logique.
- Navigation complète de l'application après les changements : aucune erreur console, aucune régression.

## Écarts connus restants

- Pas de champ équivalent pour d'autres types de frais futurs (cantine, transport, etc. — section 18 du cahier des charges) : seuls Mensualité et Assurance ont un montant dédié sur la fiche élève pour l'instant, conformément à la demande explicite. Un futur type suivrait le tarif par défaut du type tant qu'aucun champ dédié n'est ajouté.
- Le montant par défaut du type « Assurance » reste à 0 DH (seul le montant par élève est utilisé en pratique) ; il n'y a pas d'écran pour modifier le tarif par défaut des types de frais depuis l'interface.
