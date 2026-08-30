# Résumé de travail - 22 août 2026

## Projet

École Garden, application de gestion pour une école préscolaire.

## Travail réalisé aujourd'hui

### Phase 1 - Architecture et Docker

- Création du monorepo frontend/backend.
- Mise en place de React, TypeScript, Vite et Tailwind CSS.
- Mise en place du backend Node.js, TypeScript et Express.
- Configuration de Prisma avec PostgreSQL.
- Création de `docker-compose.yml`.
- Ajout des services PostgreSQL, backend et frontend.
- Ajout du volume persistant PostgreSQL.
- Ajout des healthchecks Docker.
- Création des Dockerfiles frontend et backend en mono-stage Node.
- Suppression de nginx à la demande de l'utilisateur.
- Ajout de `.env`, `.env.example`, `.gitignore` et `README.md`.
- Création de l'endpoint `GET /api/health`.

### Phase 2 - Authentification et permissions

- Création des modèles Prisma `User`, `Role`, `Permission`, `RolePermission` et `UserSession`.
- Ajout des mots de passe hashés avec `bcryptjs`.
- Mise en place de sessions persistées et révocables.
- Ajout des routes de connexion, déconnexion et utilisateur courant.
- Ajout du contrôle des permissions côté backend.
- Création du compte administrateur de démonstration.
- Ajout de l'écran de connexion frontend.

Compte de démonstration :

```text
Email : admin@ecole-garden.local
Mot de passe : change-this-password
```

### Phase 3 - Années scolaires et classes

- Création du modèle `AcademicYear`.
- Statuts disponibles : `FUTURE`, `ACTIVE`, `CLOSED`.
- Création du modèle `SchoolClass`.
- Association obligatoire des classes à une année scolaire.
- Ajout d'une contrainte empêchant les doublons de classe dans une même année.
- Ajout des routes de consultation et de création.
- Ajout de données de démonstration pour `2026-2027`.

### Phase 4 - Élèves, responsables et inscriptions

- Création des modèles `Student`, `Guardian`, `StudentGuardian` et `Enrollment`.
- Génération automatique des matricules élèves.
- Gestion des statuts élèves.
- Gestion de plusieurs responsables par élève.
- Gestion de la relation avec le responsable.
- Gestion du contact principal et de l'autorisation de récupération.
- Conservation de l'historique des inscriptions par année scolaire.
- Recherche d'élèves par nom ou matricule.
- Ajout de l'interface de création et de consultation des élèves.
- Correction d'un problème d'affichage : les élèves sans inscription sont maintenant visibles avec la mention `Non inscrit`.

### Phase 5 - Personnel et présences

- Création du modèle `Employee`.
- Gestion des professeurs, directrice, assistants, administration et autres employés.
- Génération automatique des matricules employés.
- Affectation d'un professeur à une classe.
- Création des modèles `Attendance` et `EmployeeAttendance`.
- Gestion des présences élèves : présent, absent, retard, excusé.
- Sélection de la date et de la classe.
- Empêchement des doublons grâce à une contrainte unique élève/date.
- Vérification backend de l'appartenance d'un élève à la classe sélectionnée.
- Ajout de l'interface personnel et présences.

### Phase 6 - Frais et paiements

- Création des modèles `FeeType`, `StudentFee`, `Payment` et `PaymentAllocation`.
- Séparation entre les frais dus et les paiements réellement reçus.
- Utilisation de montants PostgreSQL `DECIMAL`.
- Gestion des types de frais et des périodes.
- Gestion des paiements partiels.
- Création de numéros uniques de paiement et de reçu.
- Calcul automatique des statuts : impayé, partiellement payé, payé ou en retard.
- Paiements enregistrés dans une transaction PostgreSQL.
- Correction du parcours utilisateur selon le fonctionnement comptable demandé.
- L'encaissement peut maintenant se faire directement avec : élève, type de frais, mois/période, montant payé et mode de paiement.
- Création automatique du frais dû lors d'un nouvel encaissement direct.
- Ajout de l'affichage des frais et paiements dans l'interface unique.

Exemple testé avec succès :

```text
Frais : 500 DH
Premier paiement : 300 DH
Statut : PARTIALLY_PAID
Deuxième paiement : 200 DH
Statut final : PAID
Nombre de paiements conservés : 2
```

Un test d'encaissement direct de 125 DH a également créé automatiquement un frais de 500 DH avec le statut `PARTIALLY_PAID`.

### Phase 7 - Dépenses, salaires, avances et caisse

- Création des modèles `ExpenseCategory`, `Expense`, `Payroll`, `SalaryAdvance` et `CashTransaction`.
- Ajout des permissions `expenses.view`, `expenses.manage`, `payroll.view`, `payroll.manage`, `cash.view`.
- Module `Dépenses` : catégories configurables, numérotation automatique (`DEP-AAAA-00000`), chaque dépense crée un mouvement de caisse.
- Module `Salaires` : salaire de base, primes, avances, retenues, calcul automatique du salaire net, paiements partiels ou complets avec statuts `À payer` / `Partiellement payé` / `Payé`, chaque paiement crée un mouvement de caisse distinct (les versements ne s'écrasent jamais).
- Gestion des avances sur salaire avec mois de récupération.
- Module `Caisse` : historique chronologique des entrées/sorties, totaux et solde calculés à partir des mouvements réels.
- Correction importante : les paiements élèves (`/api/payments`) ne créaient encore aucun mouvement de caisse. Ajout de la création automatique d'un `CashTransaction` de type `INCOME` à chaque encaissement, conformément à la relation `Payment -> CashTransaction` prévue dans le cahier des charges.
- Pages frontend `Dépenses`, `Salaires` et `Caisse` créées et reliées aux API (`phase7-pages.tsx`).

Tests réalisés avec succès :

```text
Dépense de 150 DH → mouvement de caisse "sortie" créé
Salaire net 3200 DH (base 3000 + primes 200)
Paiement partiel 1 : 2000 DH → statut PARTIALLY_PAID
Paiement partiel 2 : 1200 DH → statut PAID, salaire soldé
Tentative de dépassement du salaire net → rejetée (400)
Avance sur salaire de 500 DH → enregistrée, statut OPEN
Paiement élève de 250 DH → mouvement de caisse "entrée" créé (après correction)
```

### Phase 8 - Dashboard et graphiques

- Nouveau endpoint `GET /api/dashboard/summary` (`dashboard-routes.ts`) calculant en temps réel, à partir de PostgreSQL :
  - élèves actifs, garçons/filles, nouveaux inscrits ce mois, répartition par classe ;
  - personnel actif et professeurs actifs ;
  - présences du jour (présents, absents, retards, excusés, taux de présence) ;
  - finances : encaissé aujourd'hui/ce mois, attendu ce mois, total des impayés, dépenses du mois, salaires du mois, solde de caisse, comparaison avec le mois précédent ;
  - historique 12 mois recettes/dépenses, répartition des élèves par classe, répartition des frais par statut ;
  - zone « À traiter » : impayés, dossiers incomplets (élève sans responsable), absents du jour, salaires restant à payer.
- Aucune donnée fictive : tout provient de requêtes Prisma (`groupBy`, `aggregate`) sur les tables réelles.
- Nouvelle page `Dashboard` (`phase8-pages.tsx`) avec cartes de métriques, comparaison au mois précédent, zone « À traiter » cliquable (liens directs vers Paiements/Élèves/Présences/Salaires), et graphiques Recharts : courbe recettes vs dépenses (12 mois), histogramme élèves par classe, anneau statut des frais.
- Ajout de la dépendance `recharts` au frontend.

Vérification visuelle effectuée avec Playwright (connexion réelle, capture d'écran du Dashboard, navigation dans toutes les pages) : aucune erreur console, toutes les pages et le Dashboard s'affichent correctement avec les données réelles.

### Compléments Phase 6 - Impayés et reçus

- Nouvel endpoint `GET /api/unpaid-fees` (filtres classe, année scolaire, période, statut) renvoyant élève, classe, responsable/téléphone, montant dû, payé, reste et statut.
- Nouvel endpoint `GET /api/payments/:id` (détail complet d'un paiement : élève, classe, responsable, personne ayant encaissé, allocations) pour la génération du reçu.
- Nouvel endpoint `GET /api/settings` (lecture des paramètres école : nom, adresse, téléphone, devise) avec valeurs par défaut si non configurées.
- Nouvelle page `Impayés` avec filtres et bouton `Encaisser` renvoyant directement vers la page Paiements avec l'élève présélectionné.
- Nouvelle page `Reçu` imprimable (`/receipts/:paymentId`) : logo/nom école, numéro de reçu, date/heure, élève, classe, responsable, détail des frais réglés, mode de paiement, personne ayant encaissé, total. Bouton "Imprimer / PDF" (impression navigateur, l'utilisateur choisit "Enregistrer en PDF"). Page hors du cadre applicatif (sans barre latérale) grâce à des règles CSS `@media print`.
- Remplacement du lien `Frais` (page vide) par `Impayés` dans la barre latérale, conformément à la disposition prévue dans le cahier des charges (section 40).
- Chaque paiement dans la page Paiements a maintenant un bouton `Reçu` qui ouvre le reçu dans un nouvel onglet.

Vérifications effectuées avec Playwright : filtre par statut sur la page Impayés (résultat correct), bouton `Encaisser` redirigeant vers Paiements avec le bon élève présélectionné, ouverture du reçu dans un nouvel onglet avec toutes les données correctes, aucune erreur console.

## Tests réalisés

- Configuration Docker validée.
- Builds frontend et backend validés.
- Prisma Client généré correctement.
- Migrations Prisma appliquées jusqu'à la migration financière.
- PostgreSQL connecté.
- Backend sain.
- Frontend sain.
- Endpoint `/api/health` testé avec succès.
- Connexion administrateur testée.
- Session et déconnexion testées.
- Contrôle d'accès anonyme testé avec réponse `401`.
- Création d'année et de classe testée.
- Doublon de classe testé avec réponse `409`.
- Création d'élève, responsable et inscription testée.
- Doublon d'inscription testé avec réponse `409`.
- Création et modification de présence testées.
- Élève hors classe rejeté avec réponse `400`.
- Paiements partiels testés avec succès.
- Migration `202608220006_expenses_payroll_cash` appliquée avec succès.
- Dépense, salaire (création, paiement partiel puis complet, dépassement rejeté) et avance testés avec succès.
- Paiement élève testé : mouvement de caisse "entrée" bien créé après correction.
- Endpoint `/api/dashboard/summary` testé : données cohérentes avec la caisse et les frais.
- Dashboard vérifié visuellement dans un vrai navigateur (Playwright) : connexion, affichage des métriques et des graphiques, navigation complète sans erreur console.
- Page Impayés testée : filtre par statut fonctionnel, bouton Encaisser redirige vers Paiements avec le bon élève.
- Reçu testé : ouverture dans un nouvel onglet, données complètes et correctes, aucune erreur console.

## État actuel des services

```text
PostgreSQL : healthy
Backend    : healthy
Frontend   : healthy
Frontend   : http://localhost:8080
API        : http://localhost:3000
```

## Point important

L'interface est maintenant multi-pages (React Router) : Dashboard, Élèves, Classes, Présences, Personnel, Paiements, Impayés, Dépenses, Salaires, Caisse — conforme à la disposition de la barre latérale prévue au cahier des charges (section 40).

La Phase 6 est maintenant complète (frais, paiements, reçus, impayés). Écart restant, non bloquant :

- la gestion des types de frais (`FeeType`) n'a pas d'écran de configuration dédié ; elle passe encore par la sélection existante dans la page Paiements (l'API `POST /api/fee-types` existe déjà côté backend).
- le reçu utilise l'impression navigateur ("Imprimer / PDF") plutôt qu'une génération PDF côté serveur ; suffisant pour l'usage quotidien, mais une vraie librairie PDF pourra être introduite plus tard si un format plus contrôlé est nécessaire.

---

# Résumé de travail - 23 août 2026

## Changement de méthode de travail

Avant de continuer avec la Phase 9 (Rapports), l'utilisateur a demandé de revoir l'application section par section pour corriger des points et ajuster l'interface, plutôt que d'avancer phase par phase. On reprend donc les modules déjà existants un par un, sur demande, avant de reprendre l'ordre du cahier des charges.

Préférence notée : donner les instructions directement plutôt que de répondre à des questions à choix multiples.

## Section revue : Élèves

- Remplacement du formulaire minimal (prénom/nom/date de naissance) par une fenêtre modale complète accessible via un bouton `+ Nouvel élève` : prénom, nom, date de naissance, sexe, classe, adresse, puis un bloc tuteur/responsable (prénom, nom, relation, téléphone, email).
- La création de l'élève, la liaison au tuteur et l'inscription dans la classe choisie se font en une seule transaction backend (`POST /api/students`).
- La liste des élèves affiche maintenant : âge calculé, sexe, classe (ou `Non inscrit`), adresse, statut, et le tuteur avec ses coordonnées.
- Ajout de la modification d'un élève (`PATCH /api/students/:id`) : même fenêtre modale, préremplie, avec en plus un sélecteur de statut (Actif/Inactif/En attente/Parti/Archivé) et la possibilité de changer sa classe. Le bloc tuteur n'est pas modifiable depuis ce formulaire (non demandé pour l'instant).
- Ajout de la suppression d'un élève (`DELETE /api/students/:id`) : conformément à la règle du cahier des charges sur l'archivage plutôt que la suppression définitive (section 45), le bouton `Supprimer` archive l'élève (statut `ARCHIVED`) au lieu de le supprimer réellement de la base. Une confirmation est demandée avant l'action. Les élèves archivés disparaissent de la liste mais restent en base pour l'historique.

Vérifications effectuées avec Playwright : création avec classe assignée, modification du nom d'un élève ciblé précisément, archivage d'un élève ciblé précisément (disparaît de la liste, les autres élèves ne sont pas affectés), navigation complète de l'application sans erreur console.

Ajustement demandé ensuite : remplacer la liste de cartes par un vrai tableau pour préparer la montée en charge (100+ élèves), et remplacer les boutons Modifier/Supprimer visibles en permanence par un menu contextuel au clic droit sur la ligne.

- Nouveau tableau avec colonnes : Matricule, Nom, Prénom, Âge, Genre, Classe, Statut, Tuteur (nom + téléphone).
- Clic droit sur une ligne → menu contextuel (Modifier / Supprimer) positionné à l'endroit du clic, avec un calque transparent qui ferme le menu au clic ailleurs.
- Testé avec Playwright : le clic droit sur une ligne précise ouvre bien le menu pour le bon élève, `Modifier` ouvre la fenêtre modale préremplie avec les bonnes données.

Retour utilisateur avec capture d'écran de son propre navigateur (écran large) : le champ Domiciliation existait déjà dans le formulaire mais n'était pas assez visible, et la page laissait beaucoup d'espace inutilisé sur un grand écran.

- Suppression de la largeur maximale fixe (`max-w-6xl`) du conteneur principal (`AppLayout`) : toutes les pages utilisent maintenant tout l'espace disponible à droite de la barre latérale, au lieu d'être centrées dans une colonne étroite. Changement global, visible sur Dashboard et toutes les autres pages.
- Ajout d'une colonne `Domiciliation` dans le tableau des élèves, et renommage du champ du formulaire `Adresse` → `Domiciliation` (avec un texte d'aide) pour être plus explicite.
- Vérifié visuellement en résolution large (1900px) : le tableau et le dashboard utilisent bien l'espace disponible, aucune erreur console, aucune régression sur les autres pages.

Retour utilisateur (captures des deux fenêtres) : la fenêtre "Modifier l'élève" n'affichait pas le bloc tuteur/responsable, contrairement à la fenêtre de création — incohérence corrigée.

- `PATCH /api/students/:id` accepte maintenant aussi un objet `guardian` : s'il existe déjà un tuteur lié à l'élève, ses informations sont mises à jour (et sa relation si elle a changé) ; sinon un nouveau tuteur est créé et lié, comme à la création.
- Le formulaire d'édition affiche désormais le bloc Tuteur / responsable, préreempli avec les données du tuteur existant de l'élève.
- Testé avec Playwright : ouverture de l'édition sur un élève ayant un tuteur → champs correctement préremplis ; modification du téléphone du tuteur → bien répercutée dans la liste après enregistrement.

Demande suivante : rendre le tableau triable sur toutes les colonnes.

- Tri côté frontend (données déjà chargées) sur les 9 colonnes : Matricule, Nom, Prénom, Âge, Genre, Classe, Statut, Domiciliation, Tuteur. Tri numérique pour l'âge, alphabétique (locale française) pour le reste.
- Clic sur un titre de colonne = tri croissant ; reclic sur le même titre = inverse le sens (flèche ▲/▼ affichée sur la colonne active).
- Testé avec Playwright : tri par âge croissant puis décroissant, tri par matricule — résultats corrects à chaque fois.

Signalement utilisateur : « si je modifie que le tuteur il n'est pas modifié, mais si je modifie le tuteur et le GSM ça modifie ».

- Cause identifiée : le téléphone du tuteur est le seul champ réellement obligatoire côté backend pour créer/lier un tuteur (`Guardian.primaryPhone`), mais rien ne le signalait dans le formulaire. Si on ne renseigne que le nom sans le téléphone, la sauvegarde du tuteur était silencieusement ignorée (aucune erreur affichée), d'où l'impression que « la modification du tuteur ne marche pas ».
- Correction : les champs Prénom du tuteur, Nom du tuteur et Téléphone du tuteur sont maintenant mutuellement obligatoires — dès qu'on remplit l'un des trois, les deux autres deviennent requis (blocage natif du formulaire avec message clair), au lieu d'échouer silencieusement. Une phrase d'aide a été ajoutée au-dessus du bloc tuteur pour l'expliquer.
- Testé avec Playwright sur un élève fraîchement créé sans tuteur : remplir uniquement le nom → sauvegarde bloquée, aucune requête envoyée ; compléter prénom + téléphone → sauvegarde réussie, tuteur bien visible dans la liste.

Remarque indépendante : en vérifiant ce bug, l'élève de démonstration « Yasmine Bennani » (EG-DEMO-0001) a été trouvée avec le statut `ARCHIVED` en base, sans lien avec la correction ci-dessus — probablement archivée manuellement pendant les tests. Elle n'a pas été restaurée (pas de certitude que ce n'était pas volontaire).

Nouvelle convention adoptée à la demande de l'utilisateur : en plus de ce journal quotidien, un fichier récapitulatif dédié est créé pour chaque section revue, sous `sections/AAAA-MM-JJ-<nom-section>.md`. Premier fichier créé : `sections/2026-08-23-eleves.md`.

## Section Classes et Personnel

Même traitement que la section Élèves, appliqué directement à la demande de l'utilisateur (« on fait la même chose pour classes, personnel »).

### Classes

- `GET /api/classes` renvoie maintenant aussi le professeur, l'assistant, l'effectif (filles/garçons) et le taux de remplissage, calculés à partir des inscriptions actives.
- `POST` et `PATCH /api/classes/:id` acceptent professeur et assistant (sélection parmi le personnel). `DELETE /api/classes/:id` désactive la classe (statut `INACTIVE`) au lieu de la supprimer.
- Page Classes reconstruite sur le même modèle qu'Élèves : fenêtre modale complète (nom, niveau, salle, capacité, professeur, assistant, statut en édition), tableau triable (Nom, Niveau, Salle, Professeur, Assistant, Filles/Garçons, Remplissage, Statut), menu contextuel clic droit (Modifier/Supprimer).

### Personnel

- `GET /api/employees` renvoie maintenant tous les statuts (au lieu de filtrer uniquement les actifs côté backend) ; le filtrage des employés archivés se fait côté frontend, comme pour les élèves, partout où la liste du personnel est utilisée (Personnel, sélection professeur/assistant dans Classes, sélection employé dans Salaires).
- `POST` et nouveau `PATCH /api/employees/:id` : téléphone, email, adresse, qualification, date d'embauche, salaire de base, type de contrat, statut. `DELETE /api/employees/:id` archive (statut `ARCHIVED`) au lieu de supprimer.
- Page Personnel reconstruite sur le même modèle : fenêtre modale complète, tableau triable (Matricule, Nom, Prénom, Fonction, Téléphone, Email, Embauche, Salaire de base, Statut), menu contextuel clic droit.

### Refactorisation

Le tri par colonne (précédemment codé uniquement pour Élèves) a été généralisé en un hook réutilisable (`useSortedRows`) et un composant `SortHeader` générique, utilisés maintenant par les trois tableaux (Élèves, Classes, Personnel) sans duplication de code.

### Tests effectués

Avec Playwright, sur les deux sections : création avec tous les champs, vérification d'affichage, modification ciblée (capacité de classe, salaire du personnel), désactivation/archivage ciblé (disparaît de la liste). Vérifié que les classes désactivées et le personnel archivé n'apparaissent plus dans les menus déroulants des autres pages (Présences, Salaires). Navigation complète de l'application sans erreur console après chaque étape.

Fichiers de section créés : `sections/2026-08-23-classes.md`, `sections/2026-08-23-personnel.md`.

## Section Impayés

Demande de l'utilisateur : « la même chose avec impayés et aussi vérifie la logique des impayés ».

### Bug de logique trouvé et corrigé

Vérification de la logique métier des impayés : un frais dont l'échéance est dépassée **sans aucun paiement** restait affiché avec le statut `UNPAID` (« Non payé ») indéfiniment, au lieu de passer à `OVERDUE` (« En retard »). Confirmé en base : deux frais avec échéance passée et 0 DH payé étaient bloqués sur `UNPAID`.

- **Cause** : le statut d'un frais n'est recalculé que dans `refreshFeeStatus`, appelée uniquement en réaction à un paiement sur ce frais précis. Un frais qui ne reçoit jamais aucun paiement après son échéance n'est donc jamais réévalué.
- **Correction** (`GET /api/unpaid-fees`) : la route recalcule maintenant un statut effectif à la lecture (si `UNPAID` et échéance dépassée → `OVERDUE`), corrige l'affichage **et** le filtre par statut (avant le correctif, filtrer sur « En retard » ne remontait aucun résultat pour ces frais mal étiquetés), et persiste la correction en base (`updateMany`) pour que les autres pages (Dashboard, Paiements) restent cohérentes après consultation de la page Impayés.
- **Limite connue** : cette correction se déclenche à la consultation de la page Impayés. Un frais qui devient en retard sans que personne ne consulte cette page restera affiché comme « Non payé » ailleurs (Dashboard) jusqu'à la prochaine visite d'Impayés. Pas de tâche planifiée pour recalculer les statuts en continu (pas d'infrastructure de job scheduler dans le projet).

### Tri par colonne

Le tableau Impayés (déjà existant avec filtres) a reçu le même traitement que les tableaux Élèves/Classes/Personnel : toutes les colonnes sont maintenant triables (Élève, Classe, Responsable, Période, Échéance, Dû, Payé, Reste, Statut), via le même hook `useSortedRows` / composant `SortHeader` réutilisé.

### Tests effectués

Vérifié en base que les deux frais concernés sont passés de `UNPAID` à `OVERDUE` et que la correction est persistée. Testé avec Playwright : tri par « Reste » (croissant, valeurs numériques correctes), filtre par statut « En retard » qui retourne maintenant bien les 2 frais concernés (0 avant le correctif). Navigation complète sans erreur console.

Fichier de section créé : `sections/2026-08-23-impayes.md`.

## Section Paiements

Demande de l'utilisateur : « même chose pour paiement ».

### Écart volontaire par rapport aux autres sections

Contrairement à Élèves/Classes/Personnel, un paiement n'a pas reçu de vrai « Modifier/Supprimer » : le cahier des charges interdit explicitement de supprimer définitivement une opération financière validée (section 37 : annulation avec motif, date, utilisateur — l'opération originale doit être conservée). Un paiement encaissé n'est donc ni modifiable ni supprimable ; seule une **annulation** est possible, avec motif obligatoire, en conservant le reçu original.

### Migration

Nouvelle migration `202608230001_payment_cancellation` : ajout de `cancelledAt`, `cancelReason`, `cancelledById` sur `Payment`.

### Backend

- `POST /api/payments/:id/cancel` (motif obligatoire) : marque le paiement annulé sans le supprimer, puis recalcule le statut de chaque frais concerné en excluant les allocations de ce paiement (le frais redevient dû, potentiellement `OVERDUE` si son échéance est dépassée).
- Toutes les lectures financières excluent maintenant les allocations et mouvements de caisse liés à un paiement annulé : `refreshFeeStatus`, `GET /student-fees`, `GET /unpaid-fees`, `GET /cash` (totaux caisse), et `GET /dashboard/summary` (revenus du jour/mois/année, comparaison mois précédent, graphique 12 mois). Sans cette propagation, annuler un paiement aurait laissé la caisse et le tableau de bord afficher de l'argent qui n'a plus lieu d'être compté — c'est le même type de défaut logique que celui trouvé sur les impayés.
- `GET /cash` renvoie aussi un indicateur `cancelled` par mouvement (les lignes restent visibles dans l'historique, seulement exclues des totaux).

### Frontend

- Le composant `ContextMenu` (Élèves/Classes/Personnel) a été généralisé pour accepter une liste d'actions arbitraires au lieu de Modifier/Supprimer fixes, réutilisé ici avec « Voir le reçu » et « Annuler le paiement » (ce dernier absent si déjà annulé).
- Page Paiements : l'historique des paiements est maintenant un tableau triable (Reçu, Date, Montant, Mode, Statut) au lieu d'une liste de lignes.
- Fenêtre de confirmation d'annulation avec motif obligatoire, rappelant que l'action est irréversible et que le frais redeviendra dû.
- Le reçu imprimable affiche un bandeau « REÇU ANNULÉ » (date, auteur, motif) quand le paiement a été annulé, plutôt que de continuer à ressembler à un reçu valide.

### Tests effectués

Annulé un paiement de 300 DH via curl puis via l'interface : le solde de caisse baisse du même montant, le frais associé repasse de `PAID` à `PARTIALLY_PAID` (ou `OVERDUE` si plus aucun paiement actif et échéance dépassée), une seconde tentative d'annulation est rejetée (« déjà annulé »), le paiement original reste consultable et visible dans l'historique avec le badge « Annulé ». Vérifié en base que les 11 paiements existants sont tous préservés (aucune suppression), seuls 2 marqués annulés. Reçu imprimable testé avec le bandeau d'annulation. Navigation complète sans erreur console.

Fichier de section créé : `sections/2026-08-23-paiements.md`.

### Correctif de clarté suite à une incompréhension utilisateur

Retour utilisateur avec capture d'écran : après un paiement de 220 DH, la ligne du frais affichait « 500 DH · PARTIALLY_PAID », ce qui a été compris comme une incohérence (« pourquoi 500 DH alors que le paiement est de 220 DH ? »). En réalité 500 DH est le montant **dû** pour le mois (Mensualité), pas le paiement — mais rien à l'écran ne montrait le montant déjà payé ni le reste, d'où la confusion légitime.

- `GET /api/student-fees` renvoie maintenant aussi `paidAmount` et `remaining` par frais (calculés en excluant les allocations de paiements annulés, comme partout ailleurs).
- La page Paiements affiche désormais chaque frais sous la forme claire : `Dû 500 DH · Payé 220 DH · Reste 280 DH · Partiellement payé` (statuts traduits en français) au lieu de `500 DH · PARTIALLY_PAID`.

Deuxième question de l'utilisateur : pourquoi impossible de modifier un paiement. Réponse donnée et confirmée volontaire : conforme à la section 37 du cahier des charges (jamais modifier/supprimer une opération financière validée), le correctif est de l'annuler (motif obligatoire) puis d'en recréer un correct — expliqué explicitement dans la réponse plutôt que silencieusement supposé compris.

Testé avec Playwright sur le cas exact signalé (élève « azzedine fetouaki », frais « Mensualité · 11 ») : affichage clair confirmé (Dû 500 DH · Payé 220 DH · Reste 280 DH). Navigation complète sans erreur console.

## Prochaine étape

Continuer la revue section par section à la demande de l'utilisateur. Phase 9 (Rapports + exports) reste à faire une fois la revue de l'interface terminée.

---

# Résumé de travail - 24 août 2026

## Section Dépenses et Salaires

Demande de l'utilisateur, en réponse à la question « d'où viennent les 500 DH » (réponse : montant par défaut du type de frais « Mensualité », vérifié en base) : « utilise le fichier 2026-08-23-eleves.md pour l'appliquer à paiement, impayé, dépense et salaire, comme ça on a la même logique d'affichage et de gestion des nouveaux cas ». Paiements et Impayés avaient déjà reçu ce traitement la veille ; restait Dépenses et Salaires, qui étaient encore sur l'ancien modèle (liste simple, formulaire en bas de page, aucune modification ni annulation possible).

### Écart architectural découvert et corrigé : les versements de salaire n'étaient pas des enregistrements distincts

En reproduisant le modèle Élèves sur Salaires, un vrai défaut de conception a été trouvé : contrairement aux paiements élèves (une ligne `Payment` par versement), un versement de salaire ne faisait qu'incrémenter un compteur `Payroll.amountPaid` et créer un `CashTransaction` avec un identifiant synthétique — aucun enregistrement individuel du versement n'existait, donc impossible d'annuler un versement précis sans tout réinitialiser.

- Nouveau modèle `PayrollPayment` (miroir de `Payment`) : un enregistrement par versement, avec `cancelledAt`/`cancelReason`/`cancelledById`.
- Migration `202608240001_financial_cancellation` avec **rétro-remplissage automatique** : les anciens `CashTransaction` de type `PAYROLL_PAYMENT` ont été convertis en véritables `PayrollPayment` (un par versement historique), et leur `sourceId` repointé dessus — aucune donnée existante perdue, vérifié en base après migration (2000 DH + 1200 DH reconstitués pour le salaire d'août).
- `Payroll.amountPaid`/`status` sont maintenant recalculés à partir de la somme des `PayrollPayment` non annulés (`refreshPayrollStatus`, même principe que `refreshFeeStatus` pour les frais élèves).

### Dépenses

- Ajout de `cancelledAt`/`cancelReason`/`cancelledById` sur `Expense`. Nouvelle route `POST /api/expenses/:id/cancel` (motif obligatoire).
- Page Dépenses reconstruite : fenêtre modale complète (catégorie, description, bénéficiaire, montant, mode, référence, commentaire) + ajout rapide de nouvelle catégorie, tableau triable (Numéro, Date, Catégorie, Description, Montant, Mode, Statut), menu contextuel « Annuler la dépense ».

### Salaires

- Nouvelles routes : `POST /api/payroll-payments/:id/cancel` (motif obligatoire, recalcule le salaire), `PATCH /api/salary-advances/:id/status` (marquer récupérée), `POST /api/salary-advances/:id/cancel` (motif obligatoire).
- `SalaryAdvance` reçoit aussi `cancelledAt`/`cancelReason`/`cancelledById` pour la même traçabilité.
- Page Salaires reconstruite en deux tableaux triables : Salaires (Employé, Mois, Base, Net, Payé, Reste, Statut — clic droit : enregistrer un versement / voir l'historique des versements avec annulation individuelle) et Avances (Employé, Date, Montant, Récupération, Statut — clic droit : marquer récupérée / annuler).

### Propagation à la caisse et au dashboard

`GET /api/cash` et `GET /api/dashboard/summary` excluent désormais des totaux les dépenses et versements de salaire annulés, en plus des paiements annulés (élargissement du correctif fait la veille sur les paiements élèves). Les mouvements annulés restent visibles dans la page Caisse, barrés, avec un badge « Annulé ».

### Refactorisation partagée

Les composants génériques déjà utilisés pour Élèves/Classes/Personnel/Paiements (`Modal`, `ContextMenu` généralisé, `SortHeader`, `useSortedRows`, `Field`) ont été exportés depuis `pages.tsx` et réutilisés tels quels dans `phase7-pages.tsx`, ainsi qu'une nouvelle `CancelReasonModal` générique (généralisée à partir de celle créée la veille pour les paiements) réutilisée pour dépenses, versements de salaire et avances — aucune duplication de logique de tri, de menu contextuel ou de fenêtre d'annulation.

### Bug trouvé et corrigé pendant les tests

Après annulation d'un versement de salaire depuis la fenêtre « Voir les versements », la fenêtre d'annulation se fermait mais la fenêtre des versements restait ouverte et bloquait tout clic ultérieur (calque invisible au-dessus de la page). Corrigé : les deux fenêtres se ferment ensemble après confirmation.

## Tests effectués

- Vérifié en base après migration : les versements historiques de salaire reconstitués correctement (2000 + 1200 = 3200, statut `PAID` inchangé).
- Dépenses : création complète, annulation avec motif, badge « Annulé » affiché — testé avec Playwright.
- Salaires : création, versement partiel, consultation de l'historique des versements, annulation d'un versement précis (le salaire redevient « Partiellement payé »/« À payer » selon le cas) — testé avec Playwright sur un mois neuf pour éviter toute interférence avec les données de tests précédents.
- Avances : création testée.
- Caisse : vérifié visuellement que les mouvements annulés (dépense, salaire, paiement) apparaissent barrés avec badge « Annulé » et sont exclus des totaux Entrées/Sorties/Solde.
- Dashboard : rechargé sans erreur après les changements d'exclusion des mouvements annulés.
- Navigation complète de l'application après chaque étape : aucune erreur console, aucune régression.

Fichiers de section créés : `sections/2026-08-24-depenses.md`, `sections/2026-08-24-salaires.md`.

## Correctif Paiements — oubli du passage en fenêtre modale

Retour utilisateur avec capture d'écran : la page Paiements avait déjà reçu le tableau triable et l'affichage clair des frais (Dû/Payé/Reste), mais le formulaire d'encaissement était resté un formulaire en ligne en bas de page — pas dans une fenêtre modale comme Élèves/Classes/Personnel/Dépenses/Salaires. Incohérence, pas un choix voulu : corrigé.

- Ajout des boutons « + Nouvel encaissement » et « + Frais manuel » au-dessus de la liste des frais de l'élève, chacun ouvrant sa propre fenêtre modale (réutilisant le composant `Modal` déjà partagé).
- Suppression du formulaire en ligne en bas de page.
- Les deux boutons sont désactivés tant qu'aucun élève n'est sélectionné.

Testé avec Playwright : ouverture de la fenêtre, encaissement d'un nouveau paiement (150 DH sur un nouveau frais « Mensualité · 12 »), fermeture automatique de la fenêtre après enregistrement, paiement bien visible dans l'historique et le frais mis à jour (Payé 150 DH · Reste 350 DH). Navigation complète sans erreur console.

## Refonte de la logique des frais — montants propres à l'élève

L'utilisateur a insisté une deuxième fois pour comprendre l'origine des 500 DH (nouvel exemple : Mehdi Fetouaki, encaissement de 230 DH, frais créé à 500 DH). Réponse honnête donnée : ce n'était pas une règle que l'utilisateur avait validée, seulement un choix d'implémentation d'une session précédente (montant par défaut du type de frais « Mensualité »). Décision de l'utilisateur pour simplifier durablement : fixer le prix de la mensualité et de l'assurance **sur la fiche de chaque élève**, et faire en sorte que les encaissements suivent ces montants — plus aucune supposition cachée. Ajout aussi d'un type de frais « Assurance » (annuelle, payable en plusieurs fois via le mécanisme de paiement partiel déjà en place).

### Backend

- Migration `202608240002_student_fee_amounts` : ajout de `monthlyFee` et `insuranceFee` (nullable) sur `Student`, et création automatique du type de frais « Assurance » (fréquence `YEARLY`) s'il n'existe pas déjà.
- `POST`/`PATCH /api/students` acceptent désormais `monthlyFee` et `insuranceFee`.
- `POST /api/payments` : quand un encaissement direct doit créer un nouveau frais (aucun frais existant pour la période), le montant dû suit maintenant le prix configuré sur la fiche de l'élève (`monthlyFee` pour « Mensualité », `insuranceFee` pour « Assurance ») — le tarif par défaut du type ne sert plus que de repli si l'élève n'a pas de montant configuré.

### Frontend

- Formulaire élève (création et modification) : nouveau bloc « Frais de scolarité » avec les champs Mensualité (DH) et Assurance annuelle (DH), avec une note expliquant que ces montants sont ceux appliqués automatiquement lors d'un encaissement.
- Fenêtre « Nouvel encaissement » : affichage en direct, avant validation, du montant qui sera dû pour le type et la période choisis — soit le frais déjà existant (« Frais déjà existant : X DH dû, reste Y DH »), soit ce qui sera créé (« Nouveau frais : X DH seront dus… », en précisant si c'est le montant configuré pour l'élève ou le tarif par défaut du type). Objectif : que la confusion initiale (« d'où viennent les 500 DH ? ») ne puisse plus se reproduire, la source du montant étant visible avant de cliquer sur « Enregistrer ».

### Tests effectués

Testé avec Playwright sur le cas exact qui a motivé le changement : mensualité de Mehdi Fetouaki fixée à 300 DH et assurance à 150 DH sur sa fiche ; nouvel encaissement « Mensualité » sur une période neuve → aperçu affiche bien « 300 DH... montant configuré pour cet élève » avant validation, frais créé à 300 DH (pas 500), entièrement payé avec un versement de 300 DH. Même vérification pour « Assurance » → aperçu à 150 DH. Vérifié en base que les anciens frais de l'élève n'ont pas été modifiés rétroactivement (seul le nouveau frais utilise le nouveau montant). Navigation complète sans erreur console.

Fichier de section créé : `sections/2026-08-24-frais-eleves.md`.

## Réinitialisation complète de la base et suppression des données de démo

L'utilisateur a d'abord demandé de vider la base pour repartir de zéro pour ses tests (`docker compose down`, suppression du volume `ecole-garden_postgres_data`, `docker compose up -d` — migrations et seed se relancent automatiquement au démarrage du conteneur backend). Puis il est allé plus loin : « supprime meme les donner demo comme sa je par vraiment de 0 », c'est-à-dire supprimer aussi les données fictives du seed (pas seulement réinitialiser avec elles).

Avant de le faire, vérification qu'aucune fonctionnalité ne resterait bloquée : deux entités n'avaient **aucune interface de création**, seulement des menus déroulants alimentés par les données de démo qu'on s'apprêtait à supprimer — l'année scolaire et le type de frais. Sans ces interfaces, un utilisateur partant d'une base vide n'aurait pas pu créer de classe (qui nécessite une année scolaire) ni encaisser un paiement pour un nouveau type de frais.

### Ajouts avant la suppression du seed

- **Backend** (`apps/backend/src/academic-routes.ts`) : `POST /api/academic-years` clôture désormais automatiquement l'année active existante si la nouvelle année est créée avec le statut « Active » (même logique que celle déjà existante sur `PATCH /academic-years/:id/status`, pour éviter deux années actives en même temps).
- **Frontend — Classes** (`apps/frontend/src/pages.tsx`) : bouton « + Année scolaire » à côté de « + Nouvelle classe », ouvrant une fenêtre modale (libellé AAAA-AAAA, dates de début/fin, statut).
- **Frontend — Paiements** : bouton « + Nouveau type de frais » sous le sélecteur de type, dans les deux fenêtres (nouvel encaissement et frais manuel), ouvrant une fenêtre modale (nom, montant par défaut, fréquence) — sur le même principe que le bouton d'ajout rapide de catégorie déjà présent dans Dépenses.
- `apps/backend/prisma/seed.ts` réduit au strict minimum : `Setting` (devise), rôle ADMIN + permissions, utilisateur administrateur. Toutes les données fictives supprimées (année scolaire, classe, employé, tuteur, élève, inscription, type de frais « Mensualité », catégorie de dépense, dépense de démonstration).

### Vérification

Images Docker reconstruites (`docker compose build backend frontend`, aucune erreur TypeScript). Base réinitialisée une seconde fois avec le nouveau seed réduit — démarrage propre confirmé dans les logs (10 migrations appliquées, seed exécuté sans erreur). Test Playwright complet simulant un utilisateur partant de zéro : connexion → création d'une année scolaire 2026-2027 (active) → création d'une classe → création d'un élève avec mensualité/assurance propres → création du type de frais « Mensualité » depuis la fenêtre d'encaissement. Chaque étape confirmée en base et à l'écran, aucune erreur console sur l'ensemble du parcours ni sur la navigation complète de l'application.

## Bug — le dashboard ne se mettait pas à jour après un encaissement

L'utilisateur a montré une capture : après avoir encaissé de l'argent, le dashboard restait à 0 DH partout, et ne se corrigeait qu'après reconnexion. Cause réelle : `createFee` et `createPayment` (dans `App.tsx`) ne rafraîchissaient que la fiche financière de l'élève (`loadFinance`), pas les données globales (`loadData`, qui recharge caisse, impayés et résumé du dashboard) — contrairement à l'annulation d'un paiement, qui le faisait déjà correctement. Corrigé en faisant appeler `loadData()` en plus de `loadFinance()` dans ces deux handlers. Vérifié avec Playwright : un encaissement de 77 DH fait immédiatement passer le solde de caisse de 450 à 527 DH, sans reconnexion.

En testant ce correctif, une ligne de test « Assurance · DASHTEST » (77 DH) est involontairement restée dans les vraies données de l'élève de démonstration — un paiement réel créé par le script de vérification et non nettoyé avant de montrer le résultat. Signalé et corrigé : paiement annulé via le mécanisme officiel (raison enregistrée), puis le frais orphelin (0 DH payé, aucune autre allocation) supprimé — sans perdre la trace du paiement annulé, toujours visible dans l'historique.

## Amélioration — le bouton « Encaisser » d'Impayés ne présélectionnait rien

L'utilisateur a signalé (à juste titre) que cliquer sur « Encaisser » depuis la page Impayés amenait bien sur Paiements avec l'élève sélectionné, mais sans indiquer quel frais régler — il fallait retrouver manuellement le bon type et retaper exactement la même période, avec le risque de créer un nouveau frais au lieu de solder l'existant.

Corrigé : `GET /api/unpaid-fees` renvoie maintenant `feeTypeId` en plus du nom ; le bouton « Encaisser » passe désormais le type, la période et le montant restant du frais impayé ; la page Paiements ouvre automatiquement la fenêtre « Nouvel encaissement » déjà remplie (type, période, montant = solde restant). Un seul clic sur « Enregistrer le paiement » solde l'élève. Vérifié avec Playwright sur le cas réel (Assurance, 100 DH restant sur 200 DH) : aperçu affiche bien « Frais déjà existant... reste 100 DH », montant préempli à 100, et le frais disparaît de la liste des impayés après validation.

## Génération automatique des frais dus à la création de l'élève

L'utilisateur a fait remarquer une incohérence logique : un élève dont on connaît déjà la mensualité et l'assurance (champs ajoutés plus tôt dans la journée) ne remontait dans Impayés qu'après une tentative de paiement — puisque le `StudentFee` n'était créé qu'à ce moment-là (création paresseuse dans `POST /api/payments`). Or si les montants sont connus dès la fiche élève, l'élève devrait apparaître en impayé immédiatement.

Question posée à l'utilisateur sur la portée exacte de la génération pour la mensualité (tous les mois de l'année scolaire d'un coup, ou seulement le mois en cours) : réponse « seulement le mois en cours ». Les mois suivants continueront donc à se créer au moment du premier paiement pour ce mois (comportement existant, inchangé), ou lors d'une future création manuelle.

### Implémentation

- `apps/backend/src/student-routes.ts` : nouvelle fonction `ensureStudentFees(transaction, studentId, academicYearId, monthlyFee, insuranceFee)`, appelée à la fin de la transaction de `POST /api/students` et de `PATCH /api/students/:id`, uniquement quand l'élève est inscrit (classe + année scolaire fournies) :
  - Assurance : un seul `StudentFee` par année scolaire (période = libellé de l'année, échéance = date de début d'année), si `insuranceFee > 0`.
  - Mensualité : un seul `StudentFee` pour le mois en cours (ou le mois de début d'année si celle-ci n'a pas encore commencé), échéance le 5 du mois, si `monthlyFee > 0`.
  - Les deux types de frais (« Assurance », « Mensualité ») sont créés automatiquement s'ils n'existent pas encore (même logique que la migration `202608240002` pour Assurance) — fonctionne donc même sur une base tout juste vidée du seed.
  - Utilise `upsert` avec `update: {}` : idempotent, ne touche jamais un frais déjà existant (préserve tout paiement déjà enregistré), donc sans risque à rejouer sur `PATCH`.

### Tests effectués

Playwright : création d'un élève « Zineb Autofee » avec mensualité 450 DH et assurance 250 DH, sans aucun paiement effectué. Vérifié qu'il apparaît immédiatement dans Impayés avec deux lignes : « Assurance · 2026-2027 » (250 DH, échéance 01/09/2026) et « Mensualité · Septembre 2026 » (450 DH, échéance 05/09/2026), chacune avec le bouton « Encaisser » déjà fonctionnel (grâce au correctif précédent). Aucune erreur console.

## Refonte de la page Paiements pour tenir à l'échelle (100-150 élèves)

L'utilisateur a anticipé un problème de passage à l'échelle : avec 100 à 150 élèves, l'ancien menu déroulant pour choisir un élève avant de voir ses frais deviendrait ingérable. Proposition de l'utilisateur : reprendre le format de la page Élèves (tableau + clic droit) avec « Nouvel encaissement » et « + Frais manuel » dans le menu contextuel, plus un filtre par classe — en laissant la porte ouverte à une meilleure idée.

Amélioration ajoutée : un troisième item de menu « Voir le détail », ouvrant une fenêtre avec la liste des frais et l'historique des paiements de l'élève (repris tel quel de l'ancienne page) — sans ça, la vue d'ensemble et l'historique auraient disparu complètement de l'interface.

### Backend

Nouvel endpoint `GET /api/finance/students-summary?academicYearId=...` (`apps/backend/src/finance-routes.ts`) : agrège en une seule requête, pour chaque élève ayant au moins un frais sur l'année scolaire donnée, le total dû, le total payé, le reste et un statut global (À jour / Non payé / Partiel / En retard) — calculé à partir des `StudentFee` et de leurs allocations non annulées. Conçu pour rester performant même avec 150 élèves (une seule requête groupée, pas une par élève).

### Frontend

- `apps/frontend/src/pages.tsx` — `PaymentsPage` entièrement réécrite : tableau trié/filtrable (Élève, Matricule, Classe, Dû, Payé, Reste, Statut), filtre par classe et champ de recherche (nom/matricule), clic droit sur une ligne → menu « Nouvel encaissement » / « + Frais manuel » / « Voir le détail ». Les fenêtres d'encaissement et de frais manuel (inchangées côté logique : aperçu du montant, type de frais, etc.) s'ouvrent directement avec l'élève de la ligne déjà sélectionné — plus besoin de le rechercher dans un menu déroulant.
- La fenêtre « Voir le détail » reprend l'ancien contenu de la page (liste des frais + historique des paiements avec menu contextuel Voir le reçu/Annuler), désormais accessible par élève à la demande plutôt qu'affichée en permanence.
- `apps/backend`/`apps/frontend/src/types.ts` : nouveau type `FinanceSummaryEntry`. `App.tsx` : nouvel état `financeSummary`, chargé dans `loadData()` en même temps que le reste (donc rafraîchi automatiquement après chaque paiement, frais ou annulation, grâce aux correctifs précédents).
- Le flux « Encaisser » depuis Impayés (préremplissage type/période/montant) continue de fonctionner sans changement, car indépendant de la structure du tableau.

### Tests effectués

Playwright : tableau affiche bien tous les élèves avec leurs totaux ; clic droit → menu à 3 options ; « Voir le détail » ouvre la fenêtre avec frais + historique corrects ; filtre par classe réduit bien la liste ; « Nouvel encaissement » déclenché directement depuis une ligne (sans passer par le détail) ouvre la fenêtre avec le bon élève déjà sélectionné dans le titre. Aucune erreur console après correction d'un oubli de reconstruction du conteneur backend (le nouvel endpoint renvoyait 404 tant que l'image n'était pas reconstruite).

## Prochaine étape

Continuer la revue section par section à la demande de l'utilisateur (Caisse a reçu le tri par colonne dans le cadre de ce travail, donc déjà couverte). Phase 9 (Rapports + exports) reste à faire une fois la revue de l'interface terminée.
