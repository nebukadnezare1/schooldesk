# ÉCOLE GARDEN — APPLICATION WEB COMPLÈTE DE GESTION PRÉSCOLAIRE

Tu es chargé de concevoir et développer avec moi une application web complète de gestion pour une petite école préscolaire accueillant des enfants de 3 à 7 ans.

Le projet existe dans le dossier :

`ecole-garden`

L'application sera utilisée principalement par :

* l'administrateur ;
* la directrice ;
* les professeurs.

Elle doit être suffisamment simple pour être utilisée quotidiennement par du personnel non technique, tout en ayant une architecture solide permettant d'ajouter de nouvelles fonctionnalités plus tard.

---

# 1. RÈGLE PRINCIPALE DE TRAVAIL

IMPORTANT : ne génère PAS toute l'application immédiatement.

Nous allons travailler étape par étape.

Avant toute modification importante :

1. analyse l'existant ;
2. vérifie les fichiers présents dans `ecole-garden` ;
3. ne supprime jamais un fichier sans vérifier son contenu ;
4. ne remplace jamais une configuration existante sans raison ;
5. explique brièvement ce que tu vas faire ;
6. effectue les modifications ;
7. indique comment tester ;
8. en cas d'erreur, analyse l'erreur avant de continuer.

Ne change jamais de stack technique en cours de développement sans mon accord.

---

# 2. STACK TECHNIQUE IMPOSÉE

Utiliser :

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* composants UI modernes et réutilisables
* React Router
* Recharts pour les graphiques

## Backend

* Node.js
* TypeScript
* API REST
* architecture claire routes/controllers/services
* validation stricte des données

## Base de données

* PostgreSQL
* Prisma ORM
* migrations Prisma
* seed de données de démonstration

Ne pas utiliser SQLite.

## Infrastructure

* Docker
* Docker Compose
* `.env`
* `.env.example`

Le projet doit pouvoir être lancé avec une commande du type :

`docker compose up -d`

---

# 3. ENVIRONNEMENT DE DÉPLOIEMENT

L'application sera :

1. développée/testée sur mon PC ;
2. lancée avec Docker Desktop ;
3. ensuite déployée sur mon serveur/NAS ;
4. exposée éventuellement via Cloudflare.

Cloudflare est géré séparément.

L'application doit fonctionner correctement derrière un reverse proxy.

Ne jamais coder en dur :

* domaine
* adresse IP
* ports
* mot de passe
* secret
* URL d'API dépendant de l'environnement.

Utiliser les variables d'environnement.

---

# 4. DOCKER

Créer une architecture Docker propre.

Prévoir au minimum :

* frontend
* backend
* PostgreSQL

Créer :

`docker-compose.yml`

ainsi que les Dockerfiles nécessaires.

PostgreSQL doit utiliser un volume persistant.

Un redémarrage ou rebuild des conteneurs ne doit JAMAIS supprimer les données.

Ajouter des healthchecks lorsque pertinent.

---

# 5. UTILISATEURS ET PERMISSIONS

Créer trois rôles principaux.

## ADMIN

Accès complet :

* Dashboard
* Élèves
* Responsables
* Classes
* Personnel
* Présences
* Paiements
* Impayés
* Dépenses
* Salaires
* Caisse
* Rapports
* Documents
* Utilisateurs
* Paramètres
* Audit

## DIRECTRICE

Accès configurable à :

* élèves
* responsables
* classes
* personnel
* présences
* paiements
* certaines informations financières
* rapports

## PROFESSEUR

Accès limité :

* sa fiche
* ses classes
* ses élèves
* présences
* observations autorisées

Les permissions doivent être contrôlées côté BACKEND.

Cacher un bouton dans React ne constitue jamais une protection suffisante.

---

# 6. AUTHENTIFICATION

Créer :

* connexion
* déconnexion
* utilisateur actif/inactif
* gestion sécurisée des sessions/tokens
* mots de passe hashés
* permissions par rôle
* dernière connexion

Prévoir une architecture permettant plus tard :

* réinitialisation du mot de passe
* changement du mot de passe

---

# 7. ANNÉES SCOLAIRES

Créer une gestion des années scolaires.

Exemple :

`2026-2027`

`2027-2028`

Une année peut être :

* future
* active
* clôturée

L'application doit conserver l'historique.

Un enfant changeant de classe l'année suivante ne doit pas perdre ses anciennes données.

---

# 8. MODULE ÉLÈVES

Créer une page :

`Élèves`

avec :

* recherche
* filtres
* pagination
* tri
* bouton `+ Nouvel élève`

## Informations élève

* matricule automatique unique
* photo
* nom
* prénom
* sexe
* date de naissance
* âge calculé
* lieu de naissance
* nationalité
* adresse
* date d'inscription
* année scolaire
* classe
* groupe
* statut

Statuts possibles :

* Actif
* Inactif
* En attente
* Parti
* Archivé

---

# 9. RESPONSABLES / PARENTS / TUTEURS

IMPORTANT :

Ne pas stocker simplement les informations du parent directement dans la table `students`.

Créer des entités séparées.

Un élève peut avoir plusieurs responsables.

Un responsable peut avoir plusieurs enfants.

Informations :

* nom
* prénom
* relation
* téléphone principal
* téléphone secondaire
* WhatsApp si différent
* email
* adresse
* profession
* contact principal oui/non
* autorisé à récupérer l'enfant oui/non

Relations :

`Student <-> StudentGuardian <-> Guardian`

Permettre :

* père
* mère
* tuteur
* tutrice
* autre

---

# 10. PERSONNES AUTORISÉES À RÉCUPÉRER L'ENFANT

Prévoir :

* nom
* prénom
* relation avec l'enfant
* téléphone
* photo optionnelle
* autorisé oui/non
* remarque

---

# 11. INFORMATIONS IMPORTANTES DE L'ENFANT

Prévoir uniquement les informations utiles à l'école :

* allergies signalées
* informations importantes communiquées par le responsable
* contact urgence
* téléphone urgence

Ces informations doivent avoir des permissions d'accès adaptées.

---

# 12. FICHE ÉLÈVE

La fiche individuelle doit avoir des onglets :

* Informations
* Responsables
* Scolarité
* Présences
* Paiements
* Documents
* Observations
* Historique

En haut afficher :

* photo
* nom
* prénom
* matricule
* âge
* classe
* responsable principal
* téléphone
* état des paiements
* état du dossier

---

# 13. CLASSES

Créer un module `Classes`.

Informations :

* nom
* niveau
* année scolaire
* professeur
* assistant éventuel
* salle
* capacité maximale
* statut

Exemples :

* Petite Section
* Moyenne Section
* Grande Section
* Préparatoire

Afficher pour chaque classe :

* nombre d'élèves
* garçons/filles
* professeur
* capacité
* taux de remplissage
* présences

---

# 14. INSCRIPTIONS

Créer une vraie entité `Enrollment`.

Ne pas simplement enregistrer `classId` directement sur l'élève comme seule information historique.

Une inscription doit associer :

* élève
* année scolaire
* classe
* date d'inscription
* date de sortie éventuelle
* statut

Ainsi l'historique scolaire reste disponible.

---

# 15. PERSONNEL

Créer un module `Personnel`.

Il doit pouvoir gérer :

* professeurs
* directrice
* assistants
* administration
* autres employés

Informations :

* matricule
* photo
* nom
* prénom
* téléphone
* email
* adresse
* fonction
* qualification
* date d'embauche
* salaire de base
* type de contrat
* statut
* documents
* notes

---

# 16. PRÉSENCES DES ÉLÈVES

Créer un module :

`Présences`

Sélectionner :

* date
* classe

Afficher tous les élèves.

Statuts :

* Présent
* Absent
* Retard
* Excusé

Ajouter :

`Tout marquer présent`

puis permettre de modifier les exceptions.

Chaque présence doit conserver :

* élève
* date
* statut
* remarque
* utilisateur ayant enregistré l'information
* date/heure de saisie

Empêcher les doublons de présence pour le même élève/date.

---

# 17. PRÉSENCE DU PERSONNEL

Prévoir également une architecture permettant :

* présent
* absent
* retard
* congé
* maladie/autre absence autorisée

Cette partie peut être développée après les présences élèves.

---

# 18. FRAIS SCOLAIRES

Créer une gestion séparée des types de frais.

Exemples :

* inscription
* mensualité
* cantine
* transport
* activité
* fournitures
* uniforme
* assurance
* autre

Un type de frais contient :

* nom
* montant par défaut
* fréquence
* obligatoire oui/non
* actif/inactif

---

# 19. FRAIS DUS PAR ÉLÈVE

IMPORTANT :

Séparer :

1. ce que l'élève DOIT payer ;
2. les VERSEMENTS réellement reçus.

Créer une entité de type :

`StudentFee`

contenant :

* élève
* type de frais
* année scolaire
* période
* montant prévu
* remise
* montant final dû
* date d'échéance
* statut

---

# 20. PAIEMENTS / VERSEMENTS

Créer ensuite les paiements réels.

Un paiement contient :

* numéro unique
* numéro reçu
* élève
* responsable éventuel
* date
* montant
* mode de paiement
* référence
* utilisateur ayant encaissé
* commentaire

Modes :

* espèces
* virement
* chèque
* carte
* autre

Un paiement peut régler totalement ou partiellement un ou plusieurs frais.

Exemple :

Mensualité : 500 DH

Premier versement : 300 DH

Reste : 200 DH

Deuxième versement : 200 DH

Reste : 0 DH

Le système doit conserver LES DEUX versements.

Ne jamais écraser le premier paiement.

---

# 21. STATUT DES FRAIS

Calculer automatiquement :

* Non payé
* Partiellement payé
* Payé
* En retard
* Exonéré
* Annulé

Le statut doit provenir des données financières.

---

# 22. REÇUS

Chaque encaissement doit pouvoir produire un reçu.

Le reçu contient :

* logo école
* nom école
* numéro reçu UNIQUE
* date/heure
* élève
* classe
* responsable
* description
* période
* montant
* mode de paiement
* personne ayant encaissé

Permettre :

* impression
* PDF

---

# 23. IMPAYÉS

Créer une page :

`Impayés`

Afficher :

* élève
* classe
* responsable
* téléphone
* période
* échéance
* montant dû
* montant payé
* reste
* retard

Filtres :

* classe
* période
* année scolaire
* statut

Prévoir éventuellement :

* à contacter
* contacté
* promesse de paiement
* régularisé

---

# 24. DÉPENSES

Créer un module :

`Dépenses`

Informations :

* numéro
* date
* catégorie
* description
* bénéficiaire/fournisseur
* montant
* mode de paiement
* référence
* justificatif
* commentaire
* utilisateur ayant enregistré la dépense

Catégories :

* salaires
* fournitures
* matériel
* entretien
* eau
* électricité
* internet
* loyer
* transport
* cantine
* travaux
* activités
* administration
* autre

Les catégories doivent être configurables.

---

# 25. SALAIRES

Ne pas gérer les salaires uniquement comme de simples dépenses manuelles.

Créer un module :

`Salaires`

Pour chaque période :

* employé
* mois
* année
* salaire de base
* primes
* avances
* retenues
* autres ajustements
* salaire net
* montant payé
* reste
* statut
* date paiement

Statuts :

* À payer
* Partiellement payé
* Payé

Un paiement de salaire doit automatiquement produire le mouvement financier correspondant.

---

# 26. AVANCES

Créer une gestion des avances :

* employé
* date
* montant
* motif
* période de récupération
* statut

Les avances doivent pouvoir être déduites automatiquement du salaire correspondant.

---

# 27. CAISSE

Créer un module :

`Caisse`

La caisse doit afficher chronologiquement toutes les entrées/sorties.

## Entrées

* paiements élèves
* inscriptions
* autres recettes

## Sorties

* dépenses
* salaires
* remboursements
* autres

Afficher :

* solde initial
* total entrées
* total sorties
* solde actuel

Formule :

`Solde = Solde initial + Entrées - Sorties`

Chaque mouvement doit être relié à son opération source.

Ne jamais modifier arbitrairement le solde.

---

# 28. DASHBOARD

Créer un dashboard clair et visuel.

## Élèves

* total actifs
* garçons
* filles
* nouveaux inscrits
* répartition par classe

## Personnel

* personnel actif
* professeurs actifs

## Présences

* présents aujourd'hui
* absents
* retards
* taux de présence

## Finances

* encaissé aujourd'hui
* encaissé ce mois
* attendu ce mois
* impayés
* dépenses du mois
* salaires du mois
* solde/résultat

Comparer si pertinent :

* mois actuel
* mois précédent

---

# 29. GRAPHIQUES

Afficher notamment :

* recettes 12 derniers mois
* dépenses 12 derniers mois
* recettes vs dépenses
* évolution des élèves
* élèves par classe
* paiements payés/partiels/impayés

Les données doivent provenir réellement de PostgreSQL.

Pas de statistiques fictives dans l'application de production.

---

# 30. DASHBOARD — À TRAITER

Ajouter une zone :

`À traiter`

Exemples :

* 8 impayés
* 3 dossiers incomplets
* 5 absents aujourd'hui
* 2 salaires restant à payer

Les éléments doivent être cliquables.

---

# 31. RAPPORTS

Créer :

`Rapports`

Filtres :

* aujourd'hui
* semaine
* mois
* trimestre
* année
* période personnalisée

Rapports :

* recettes
* dépenses
* résultat
* impayés
* élèves
* inscriptions
* présences
* salaires

Prévoir export :

* PDF
* CSV
* Excel si pertinent

---

# 32. DOCUMENTS

Pouvoir joindre des documents à :

* élève
* responsable
* personnel
* dépense

Exemples :

* photo
* document administratif
* certificat
* contrat
* CV
* diplôme
* facture
* reçu

Les fichiers privés ne doivent pas être accessibles via une URL publique prévisible.

---

# 33. OBSERVATIONS

Créer des observations liées aux élèves.

Informations :

* élève
* catégorie
* texte
* auteur
* date/heure

Exemples :

* comportement
* progression
* administratif
* communication parent

Les permissions doivent être respectées.

---

# 34. RECHERCHE GLOBALE

Ajouter une recherche dans la topbar.

Pouvoir chercher :

* élève
* matricule
* responsable
* numéro de téléphone
* professeur
* reçu
* paiement

La recherche doit être rapide.

---

# 35. NOTIFICATIONS

Prévoir :

* paiement en retard
* dossier incomplet
* anniversaire
* salaire à payer
* classe complète
* autre événement important

---

# 36. JOURNAL D'ACTIVITÉ / AUDIT

Créer `AuditLog`.

Enregistrer les opérations importantes :

* utilisateur
* date/heure
* action
* module
* objet concerné
* identifiant
* ancienne valeur lorsque pertinent
* nouvelle valeur lorsque pertinent

Exemples :

`Directrice a enregistré un paiement de 500 DH.`

`Admin a annulé le reçu PAY-2026-00125.`

---

# 37. RÈGLES FINANCIÈRES IMPORTANTES

Les paiements, reçus, dépenses et salaires sont des données sensibles.

Ne jamais effectuer de suppression définitive d'une opération financière validée.

Utiliser :

* annulation
* motif d'annulation
* date d'annulation
* utilisateur ayant annulé

Conserver l'opération originale.

Utiliser des transactions PostgreSQL pour les opérations financières importantes.

Utiliser `DECIMAL/NUMERIC` pour les montants.

JAMAIS `FLOAT`.

Créer des contraintes empêchant autant que possible :

* doublons
* reçus dupliqués
* paiements incohérents

---

# 38. PARAMÈTRES

Créer :

`Paramètres`

## École

* nom
* logo
* adresse
* téléphone
* WhatsApp
* email
* devise
* année scolaire active
* informations reçus

Devise par défaut :

`MAD / DH`

---

# 39. INTERNATIONALISATION

Interface initiale :

`Français`

Préparer l'architecture pour :

* Français
* Arabe
* Amazigh ultérieurement

Prévoir le support RTL pour l'arabe.

Centraliser les textes traduisibles.

---

# 40. DESIGN

Je veux un dashboard moderne mais simple.

Pas de design enfantin excessif.

L'application est destinée aux adultes qui gèrent l'école.

Utiliser une identité visuelle :

* accueillante
* professionnelle
* moderne
* claire

## Sidebar

* Dashboard
* Élèves
* Classes
* Présences
* Personnel
* Paiements
* Impayés
* Dépenses
* Salaires
* Caisse
* Rapports
* Documents
* Utilisateurs
* Paramètres

## Topbar

* recherche
* année scolaire
* notifications
* profil utilisateur

Responsive :

* ordinateur
* tablette
* smartphone

---

# 41. UX

Prévoir :

* tableaux
* pagination
* recherche
* filtres
* badges de statut
* formulaires clairs
* validation visuelle
* confirmations
* notifications toast
* états de chargement
* messages d'erreur compréhensibles
* pages vides propres lorsqu'il n'y a aucune donnée

---

# 42. BASE DE DONNÉES

Analyse précisément le modèle avant de coder.

Tables envisagées :

* User
* Role
* Permission
* AcademicYear
* Student
* Guardian
* StudentGuardian
* AuthorizedPickup
* Class
* Enrollment
* Employee
* Attendance
* EmployeeAttendance
* FeeType
* StudentFee
* Payment
* PaymentAllocation
* Expense
* ExpenseCategory
* Payroll
* SalaryAdvance
* CashTransaction
* Document
* Observation
* Notification
* AuditLog
* Setting

Tu peux améliorer cette structure si nécessaire.

Explique toute modification importante.

---

# 43. RELATIONS IMPORTANTES

Prévoir notamment :

`Student -> Enrollment -> Class -> AcademicYear`

`Student <-> StudentGuardian <-> Guardian`

`Student -> StudentFee`

`StudentFee <-> PaymentAllocation <-> Payment`

`Employee -> Payroll`

`Employee -> SalaryAdvance`

`Payment -> CashTransaction`

`Expense -> CashTransaction`

`Payroll -> CashTransaction`

---

# 44. INDEX ET CONTRAINTES

Ajouter des index appropriés notamment sur :

* matricule élève
* téléphone responsable
* nom/prénom
* année scolaire
* classe
* date paiement
* période
* numéro reçu
* statut
* date dépense

Utiliser les clés étrangères et contraintes PostgreSQL correctement.

---

# 45. SUPPRESSION / ARCHIVAGE

Utiliser le soft-delete ou archivage lorsque nécessaire.

Exemple :

un ancien élève ne doit pas disparaître.

Il doit pouvoir devenir :

`Archivé`

Même principe pour le personnel.

Les données historiques doivent rester disponibles.

---

# 46. SÉCURITÉ

Mettre en œuvre :

* mots de passe hashés
* validation frontend ET backend
* protection injections SQL
* protection XSS
* contrôle des permissions
* sécurité des uploads
* types MIME autorisés
* taille maximale
* noms sécurisés
* secrets dans `.env`
* limitation appropriée des requêtes d'authentification

Ne jamais faire confiance aux données envoyées par React.

---

# 47. SAUVEGARDE

Prévoir une vraie procédure de backup.

Sauvegarder :

1. PostgreSQL
2. documents
3. photos
4. justificatifs

Documenter :

* backup
* restauration
* mise à jour Docker
* rollback si nécessaire

Une sauvegarde du volume Docker seule ne doit pas être la seule stratégie proposée.

---

# 48. IMPORT

Prévoir plus tard un import CSV/Excel.

Exemple :

import d'une liste d'élèves.

Toujours :

1. uploader ;
2. analyser ;
3. afficher prévisualisation ;
4. signaler erreurs ;
5. confirmer ;
6. importer.

---

# 49. EXPORT

Permettre export :

* élèves
* paiements
* impayés
* dépenses
* salaires
* présences
* rapports

Formats selon le contexte :

* CSV
* Excel
* PDF

---

# 50. DONNÉES DE TEST

Créer des seeds avec uniquement des données fictives.

Exemple :

* 20 élèves
* 25 responsables
* 4 professeurs
* 1 directrice
* 1 admin
* 4 classes
* inscriptions
* présences
* frais
* paiements
* impayés
* dépenses
* salaires

Cela doit permettre de tester immédiatement le dashboard.

---

# 51. QUALITÉ DU CODE

Je veux :

* TypeScript strict
* code propre
* composants réutilisables
* architecture modulaire
* gestion centralisée des erreurs
* validation centralisée
* conventions cohérentes
* migrations
* seeds
* README
* `.gitignore`
* `.env.example`

Éviter les fichiers énormes contenant toute la logique.

---

# 52. README

Créer un README expliquant :

* architecture
* prérequis
* installation
* Docker Desktop
* variables `.env`
* lancement
* migrations
* seeds
* backup PostgreSQL
* restauration
* déploiement NAS
* rebuild
* mise à jour sans perte de données

---

# 53. ORDRE DE DÉVELOPPEMENT

Respecter approximativement :

## PHASE 1

Architecture + PostgreSQL + Docker

## PHASE 2

Authentification + rôles + permissions

## PHASE 3

Années scolaires + classes

## PHASE 4

Élèves + responsables + inscriptions

## PHASE 5

Personnel + présences

## PHASE 6

Frais + paiements + reçus + impayés

## PHASE 7

Dépenses + salaires + avances + caisse

## PHASE 8

Dashboard + graphiques

## PHASE 9

Rapports + PDF + exports

## PHASE 10

Documents + notifications + audit

## PHASE 11

Sécurité + backups + tests + optimisation

---

# 54. PREMIÈRE MISSION

Pour ta PREMIÈRE réponse :

NE COMMENCE PAS encore à développer toute l'application.

Analyse d'abord le projet et donne-moi :

1. la structure complète recommandée de `ecole-garden` ;
2. l'architecture frontend/backend ;
3. le schéma de base de données proposé ;
4. les relations Prisma principales ;
5. les services Docker nécessaires ;
6. les volumes persistants nécessaires ;
7. la stratégie d'authentification ;
8. la stratégie de gestion des documents ;
9. la stratégie de sauvegarde ;
10. les éventuels problèmes que tu vois dans ce cahier des charges.

Ensuite, propose-moi la **PHASE 1**.

Attends ma validation avant de commencer les modifications importantes.

---

# 55. RÈGLE FINALE

L'objectif n'est pas simplement de faire une jolie interface.

Je veux une application réellement utilisable quotidiennement par une école, avec :

* données persistantes ;
* historique fiable ;
* finances cohérentes ;
* sécurité ;
* sauvegardes ;
* architecture évolutive ;
* interface simple.

Privilégie toujours l'intégrité des données et la simplicité d'utilisation avant les effets visuels.
