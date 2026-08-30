# Section Paiements — 23 août 2026

## Contexte

Cinquième section traitée dans la revue section par section, à la demande de l'utilisateur : « même chose pour paiement ». Contrairement aux sections précédentes, un paiement est une opération financière déjà validée : le cahier des charges (section 37) interdit explicitement de la supprimer ou de la modifier librement.

## Écart assumé par rapport au pattern Élèves/Classes/Personnel

Les sections précédentes offraient toutes « Modifier » et « Supprimer » (archivage). Pour les paiements, ce n'est pas approprié :

> « Ne jamais effectuer de suppression définitive d'une opération financière validée. Utiliser : annulation, motif d'annulation, date d'annulation, utilisateur ayant annulé. Conserver l'opération originale. »

Un paiement encaissé n'est donc **ni modifiable, ni supprimable**. La seule action possible est l'**annulation**, avec motif obligatoire, en conservant intégralement l'enregistrement original (montant, date, méthode, encaisseur).

## État de départ

La page Paiements affichait déjà l'historique des paiements d'un élève sous forme de liste simple (numéro de reçu, montant, mode), avec un lien vers le reçu imprimable. Pas de tri, pas d'action d'annulation — un paiement, une fois créé, ne pouvait plus être touché d'aucune façon (ce qui est correct pour la modification/suppression, mais empêchait de corriger une vraie erreur de saisie).

## Changements apportés

### Migration

`202608230001_payment_cancellation` : ajout sur `Payment` de `cancelledAt` (DateTime?), `cancelReason` (String?), `cancelledById` (String?, FK vers `User`). Relation `User -> Payment` désormais nommée explicitement (`PaymentRecordedBy` / `PaymentCancelledBy`) puisqu'il y a maintenant deux relations distinctes vers `User`.

### Backend (`apps/backend/src/finance-routes.ts`)

- `POST /api/payments/:id/cancel` (nouveau, motif obligatoire) : marque le paiement annulé (transaction), puis recalcule le statut de chaque frais concerné (`refreshFeeStatus`) en excluant les allocations du paiement annulé — le frais redevient dû, avec le bon statut (`PARTIALLY_PAID`, `UNPAID` ou `OVERDUE` selon le cas).
- `refreshFeeStatus`, `GET /student-fees`, `GET /unpaid-fees` : le calcul du montant payé d'un frais exclut désormais les allocations dont le paiement parent est annulé.
- `GET /payments` et `GET /payments/:id` : incluent maintenant `cancelledAt`, `cancelReason`, `cancelledBy`.

### Backend — propagation à la caisse et au tableau de bord

Un paiement annulé ne doit plus compter comme argent réellement en caisse. Sans cette propagation, la caisse et le dashboard continueraient à afficher un encaissement qui n'a plus lieu d'être — même défaut logique que celui trouvé et corrigé sur la section Impayés le même jour.

- `GET /api/cash` (`apps/backend/src/operations-routes.ts`) : les mouvements liés à un paiement annulé restent visibles dans l'historique (marqués `cancelled: true`) mais sont exclus des totaux (entrées, sorties, solde).
- `GET /api/dashboard/summary` (`apps/backend/src/dashboard-routes.ts`) : encaissé aujourd'hui/ce mois, comparaison au mois précédent, solde de caisse et graphique 12 mois excluent tous les mouvements de caisse liés à un paiement annulé.

### Frontend

- Généralisation du composant `ContextMenu` (jusque-là câblé sur Modifier/Supprimer pour Élèves/Classes/Personnel) pour accepter une liste d'actions arbitraires (`{ label, onClick, tone }`). Les trois pages existantes ont été mises à jour pour utiliser la nouvelle API sans changement de comportement.
- Page Paiements : l'historique devient un tableau triable (Reçu, Date, Montant, Mode, Statut). Clic droit sur une ligne → « Voir le reçu » (nouvel onglet) et « Annuler le paiement » (masqué si déjà annulé). Les lignes annulées sont grisées et badgées « Annulé ».
- Fenêtre de confirmation d'annulation : motif obligatoire (bouton désactivé tant qu'il est vide), rappel que l'action est irréversible et que le frais redeviendra dû.
- Reçu imprimable (`receipt-page.tsx`) : bandeau rouge « REÇU ANNULÉ » (date, auteur, motif) affiché en haut du reçu quand le paiement est annulé, pour ne jamais faire passer un reçu annulé pour un reçu valide à l'impression.

## Fichiers modifiés

- Backend : `apps/backend/prisma/schema.prisma`, nouvelle migration, `apps/backend/src/finance-routes.ts`, `apps/backend/src/operations-routes.ts`, `apps/backend/src/dashboard-routes.ts`.
- Frontend : `apps/frontend/src/pages.tsx` (généralisation `ContextMenu`, page Paiements), `apps/frontend/src/receipt-page.tsx`, `apps/frontend/src/App.tsx`, `apps/frontend/src/types.ts`.

## Tests effectués

- Annulation testée via `curl` puis via l'interface : solde de caisse réduit du montant annulé, frais associé recalculé au bon statut, seconde tentative d'annulation rejetée (« déjà annulé »).
- Vérifié en base que les 11 paiements existants sont tous préservés après les tests (aucune suppression), seuls ceux explicitement annulés sont marqués.
- Testé avec Playwright : tri du tableau, ouverture du reçu depuis le menu contextuel, annulation avec motif, bandeau d'annulation visible sur le reçu, statut « Annulé » visible dans le tableau et dans la liste des frais de l'élève (le frais repasse de `PAID` à `PARTIALLY_PAID`).
- Navigation complète de l'application après les changements : aucune erreur console, aucune régression.

## Écarts connus restants

- Pas d'interface pour consulter globalement tous les paiements annulés toutes classes confondues (uniquement visible par élève, dans l'historique de la page Paiements).
- Le motif d'annulation n'est pas encore inclus dans un futur rapport d'audit (`AuditLog`, prévu section 36 du cahier des charges, pas encore implémenté).

## Addendum — confusion utilisateur sur l'affichage des frais

L'utilisateur a signalé, capture à l'appui, ne pas comprendre pourquoi un frais affichait « 500 DH · PARTIALLY_PAID » juste après avoir enregistré un paiement de 220 DH. Cause : 500 DH est le montant **dû** pour la période (pas le paiement), mais rien n'affichait le montant déjà payé ni le reste — confusion légitime.

- `GET /api/student-fees` renvoie désormais `paidAmount` et `remaining` par frais.
- Affichage corrigé sur la page Paiements : `Dû 500 DH · Payé 220 DH · Reste 280 DH · Partiellement payé` (statuts traduits) au lieu de `500 DH · PARTIALLY_PAID`.

L'utilisateur a aussi demandé pourquoi un paiement n'est pas modifiable : confirmé volontaire (section 37 du cahier des charges), workflow de correction = annuler puis recréer un paiement correct.

Testé avec Playwright sur le cas exact signalé (élève « azzedine fetouaki », frais « Mensualité · 11 ») : affichage clair confirmé.

## Addendum (24 août) — le formulaire d'encaissement n'était pas passé en fenêtre modale

Retour utilisateur avec capture d'écran : la page avait bien le tableau triable et l'affichage clair des frais, mais le formulaire d'encaissement était resté un formulaire en ligne en bas de page, contrairement au standard désormais appliqué partout ailleurs (Élèves, Classes, Personnel, Dépenses, Salaires). Oubli, pas un choix voulu.

- Ajout de deux boutons au-dessus de la liste des frais : « + Nouvel encaissement » et « + Frais manuel », chacun ouvrant sa propre fenêtre modale.
- Suppression du formulaire en ligne. Les deux boutons sont désactivés tant qu'aucun élève n'est sélectionné.
- Testé avec Playwright : encaissement complet via la fenêtre, fermeture automatique après enregistrement, paiement et frais mis à jour correctement.
