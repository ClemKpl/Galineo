# PRD — Galineo
## Product Requirements Document

**Version:** 1.0  
**Date:** 8 avril 2026  
**Statut:** Draft

---

## 1. Vision produit

Galineo est une plateforme de gestion de projets collaborative destinée aux équipes de petite et moyenne taille. Elle centralise la planification des tâches, la communication, la coordination calendaire et le suivi de l'avancement au sein d'un seul et même outil — en français, conçu pour les équipes francophones.

---

## 2. Objectifs

| Objectif | Indicateur de succès |
|---|---|
| Permettre à une équipe de suivre l'avancement d'un projet | Taux de tâches complétées visible en temps réel sur le dashboard |
| Réduire la friction de communication | Utilisation régulière du chat projet et des @mentions |
| Centraliser la coordination des événements | Événements créés et attendus consultés via le calendrier projet |
| Faciliter l'onboarding de nouveaux membres | Ajout d'un membre et premier accès en moins de 2 minutes |

---

## 3. Périmètre

### 3.1 Dans le périmètre (v1)

- Gestion de projets (création, édition, archivage, corbeille)
- Gestion de tâches hiérarchiques (fonctionnalités + sous-tâches)
- Vue Kanban et vue liste des tâches
- Dashboard projet (statistiques, charge membre, tâches urgentes)
- Dashboard global (toutes mes tâches, mes projets)
- Gestion d'équipe avec rôles et permissions
- Chat projet avec @mentions
- Calendrier projet avec événements et notes par date
- Système de notifications (assignation, mention, invitation, rappel)
- Gestion de compte utilisateur
- Import/export CSV des tâches

### 3.2 Hors périmètre (v1)

- Application mobile native
- Intégrations tierces (Slack, GitHub, Jira…)
- Sous-domaines ou espaces de travail multi-organisations
- WebSockets / temps réel strict
- Paiement / modèle freemium
- Internationalisation (multi-langues)

---

## 4. Utilisateurs cibles

### Chef de projet / Propriétaire
Crée les projets, invite les membres, supervise l'avancement, gère les rôles.

### Membre d'équipe
Consulte les tâches qui lui sont assignées, met à jour leur statut, communique via le chat, participe aux événements.

### Admin
Peut gérer les membres et éditer le projet sans en être propriétaire. Délégation de responsabilité opérationnelle.

### Observateur
Accès en lecture seule. Idéal pour un client ou un stakeholder externe.

---

## 5. Fonctionnalités

### 5.1 Authentification

| ID | Fonctionnalité | Priorité |
|---|---|---|
| AUTH-01 | Création de compte (nom, email, mot de passe) | P0 |
| AUTH-02 | Connexion par email + mot de passe, retour d'un JWT | P0 |
| AUTH-03 | Déconnexion (suppression du token local) | P0 |
| AUTH-04 | Modification du profil (nom, email) | P1 |
| AUTH-05 | Changement de mot de passe | P1 |
| AUTH-06 | Suppression de compte | P2 |

**Règles métier**
- Le token JWT expire après 7 jours.
- L'email doit être unique sur la plateforme.
- Le mot de passe n'est jamais stocké en clair (bcrypt).

---

### 5.2 Gestion de projets

| ID | Fonctionnalité | Priorité |
|---|---|---|
| PROJ-01 | Créer un projet (titre, description, deadline optionnelle) | P0 |
| PROJ-02 | Lister les projets dont je suis membre ou propriétaire | P0 |
| PROJ-03 | Modifier les informations d'un projet | P1 |
| PROJ-04 | Marquer un projet comme terminé → déplacement dans l'historique | P1 |
| PROJ-05 | Supprimer un projet (soft delete → corbeille) | P1 |
| PROJ-06 | Restaurer un projet depuis la corbeille | P2 |
| PROJ-07 | Supprimer définitivement un projet depuis la corbeille | P2 |
| PROJ-08 | Consulter l'historique des projets terminés | P2 |

**Statuts d'un projet**

```
active → completed → (historique)
active → deleted   → (corbeille) → active (restauré)
                               → supprimé définitivement
```

---

### 5.3 Gestion des membres et des rôles

| ID | Fonctionnalité | Priorité |
|---|---|---|
| TEAM-01 | Ajouter un membre à un projet (recherche par nom/email) | P0 |
| TEAM-02 | Retirer un membre d'un projet | P1 |
| TEAM-03 | Changer le rôle d'un membre | P1 |
| TEAM-04 | Consulter la liste des membres avec leur rôle | P0 |

**Rôles par défaut**

| Rôle | Permissions |
|---|---|
| Propriétaire | Toutes (manage_members, manage_roles, edit_project, view_project, delete_project) |
| Admin | manage_members, edit_project, view_project |
| Membre | edit_project, view_project |
| Observateur | view_project |

**Règles métier**
- Un projet doit toujours avoir au moins un Propriétaire.
- Seul un Propriétaire ou Admin peut ajouter/retirer des membres.
- Le Propriétaire ne peut pas être retiré par un Admin.

---

### 5.4 Gestion des tâches

| ID | Fonctionnalité | Priorité |
|---|---|---|
| TASK-01 | Créer une fonctionnalité (tâche parent) | P0 |
| TASK-02 | Créer une sous-tâche rattachée à une fonctionnalité | P0 |
| TASK-03 | Éditer une tâche (titre, description, statut, priorité, dates, assigné) | P0 |
| TASK-04 | Supprimer une tâche | P1 |
| TASK-05 | Changer le statut par glisser-déposer (vue Kanban) | P1 |
| TASK-06 | Filtrer/trier les tâches | P2 |
| TASK-07 | Ajouter un commentaire sur une tâche | P1 |
| TASK-08 | Consulter l'historique de commentaires d'une tâche | P1 |
| TASK-09 | Importer des tâches via CSV | P2 |
| TASK-10 | Exporter les tâches en CSV | P2 |
| TASK-11 | Voir mes tâches assignées sur toutes mes projets (dashboard global) | P0 |

**Statuts**

`todo` → `in_progress` → `done`

**Priorités**

| Valeur | Libellé |
|---|---|
| `normal` | Normal |
| `urgent_important` | Urgent & Important |
| `urgent_not_important` | Urgent, non important |
| `not_urgent_important` | Important, non urgent |

**Règles métier**
- Une sous-tâche ne peut pas avoir de sous-tâches (profondeur max = 2).
- L'assignation d'une tâche déclenche une notification de type `task_assigned`.
- La suppression d'une tâche parent supprime en cascade ses sous-tâches.

---

### 5.5 Dashboard projet

| ID | Fonctionnalité | Priorité |
|---|---|---|
| DASH-01 | Taux de complétion global du projet (% tâches done) | P0 |
| DASH-02 | Statistiques tâches : total / done / en cours / à faire / en retard | P0 |
| DASH-03 | Liste des 5 tâches les plus urgentes (deadline la plus proche) | P1 |
| DASH-04 | Charge par membre (tâches assignées / ouvertes / en retard) | P1 |
| DASH-05 | Prochaine deadline du projet | P1 |

---

### 5.6 Dashboard global (page d'accueil)

| ID | Fonctionnalité | Priorité |
|---|---|---|
| GLOB-01 | Mes tâches assignées (tous projets confondus) | P0 |
| GLOB-02 | Mes prochains événements | P0 |
| GLOB-03 | Projets dont je suis propriétaire | P0 |
| GLOB-04 | Projets dont je suis membre | P0 |
| GLOB-05 | Créer un nouveau projet depuis le dashboard | P0 |

---

### 5.7 Chat projet

| ID | Fonctionnalité | Priorité |
|---|---|---|
| CHAT-01 | Envoyer un message dans le fil du projet | P0 |
| CHAT-02 | @mentionner un membre du projet | P1 |
| CHAT-03 | Modifier son propre message | P2 |
| CHAT-04 | Supprimer son propre message | P2 |
| CHAT-05 | Rafraîchissement automatique du fil (polling 5s) | P1 |

**Règles métier**
- Une @mention déclenche une notification de type `mention` pour l'utilisateur ciblé.
- Un Observateur peut lire les messages mais ne peut pas en envoyer.

---

### 5.8 Calendrier projet

| ID | Fonctionnalité | Priorité |
|---|---|---|
| CAL-01 | Afficher le calendrier mensuel du projet | P0 |
| CAL-02 | Créer un événement (titre, description, début, fin, lieu) | P0 |
| CAL-03 | Modifier un événement | P1 |
| CAL-04 | Supprimer un événement | P1 |
| CAL-05 | Gérer les participants d'un événement | P1 |
| CAL-06 | Ajouter une note sur une date spécifique | P2 |
| CAL-07 | Supprimer une note de date | P2 |
| CAL-08 | Afficher les événements à venir dans le dashboard global | P1 |

**Règles métier**
- L'invitation à un événement génère une notification de type `event_invite`.
- Un rappel automatique de type `event_reminder` est envoyé 24h avant l'événement.

---

### 5.9 Notifications

| ID | Fonctionnalité | Priorité |
|---|---|---|
| NOTIF-01 | Consulter la liste de mes notifications | P0 |
| NOTIF-02 | Compteur de notifications non lues (badge) | P0 |
| NOTIF-03 | Marquer une notification comme lue | P1 |
| NOTIF-04 | Marquer toutes les notifications comme lues | P1 |
| NOTIF-05 | Supprimer une notification | P2 |

**Types de notifications**

| Type | Déclencheur |
|---|---|
| `task_assigned` | Une tâche m'est assignée |
| `mention` | Je suis @mentionné dans un message |
| `event_invite` | Je suis invité à un événement |
| `event_reminder` | Un événement auquel je participe commence dans 24h |

---

## 6. Modèle de données

### Entités principales

```
users
  id, name, email, password_hash, avatar, last_login_at, created_at

projects
  id, title, description, deadline, status, owner_id, created_at

project_members
  project_id, user_id, role_id

roles
  id, name, is_default

permissions
  id, name, description

role_permissions
  role_id, permission_id

tasks
  id, project_id, parent_id, title, description,
  status, priority, phase, start_date, due_date,
  created_by, assigned_to, created_at

task_comments
  id, task_id, user_id, content, created_at

messages
  id, project_id, user_id, content, created_at

calendar_events
  id, project_id, title, description,
  start_datetime, end_datetime, location,
  created_by, created_at

event_attendees
  event_id, user_id, notified

calendar_date_notes
  id, project_id, date, content, user_id, created_at

notifications
  id, user_id, type, title, message,
  project_id, task_id, from_user_id,
  is_read, created_at
```

---

## 7. Architecture technique

### Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js, Express.js 5 |
| Base de données | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (7 jours), bcrypt |
| Email | Nodemailer (configuré, non activé v1) |

### Principes clés

- **Séparation frontend/backend** : le frontend Next.js appelle une API REST Express sur un port séparé.
- **Couche d'abstraction DB** : un fichier `db.js` traduit le SQL SQLite en PostgreSQL au runtime, permettant un dev local léger et un déploiement prod robuste.
- **RBAC par projet** : les rôles et permissions sont scoped au projet, pas globaux.
- **Polling HTTP** : pas de WebSockets en v1 ; le chat rafraîchit toutes les 5 secondes, les rappels sont calculés à chaque appel `/events/upcoming`.
- **Soft delete** : les projets ne sont jamais supprimés immédiatement — ils passent par une corbeille.
- **Requêtes préparées** : toutes les requêtes SQL utilisent des paramètres liés pour prévenir les injections SQL.

### Routes API (résumé)

```
POST   /auth/register          Créer un compte
POST   /auth/login             Se connecter

GET    /projects               Lister mes projets
POST   /projects               Créer un projet
GET    /projects/:id           Détail d'un projet
PATCH  /projects/:id           Modifier un projet
DELETE /projects/:id           Soft delete
PATCH  /projects/:id/complete  Terminer un projet
PATCH  /projects/:id/restore   Restaurer depuis la corbeille
DELETE /projects/:id/hard      Supprimer définitivement

POST   /projects/:id/members         Ajouter un membre
PATCH  /projects/:id/members/:uid    Changer le rôle
DELETE /projects/:id/members/:uid    Retirer un membre

GET    /projects/:id/tasks           Lister les tâches
POST   /projects/:id/tasks           Créer une tâche
PATCH  /projects/:id/tasks/:tid      Modifier une tâche
DELETE /projects/:id/tasks/:tid      Supprimer une tâche
GET    /projects/:id/tasks/export    Export CSV
POST   /projects/:id/tasks/import    Import CSV
GET    /projects/:id/tasks/:tid/comments   Commentaires
POST   /projects/:id/tasks/:tid/comments   Ajouter commentaire

GET    /tasks/assigned           Mes tâches (tous projets)

GET    /projects/:id/messages    Messages du chat
POST   /projects/:id/messages    Envoyer un message
PATCH  /projects/:id/messages/:mid  Modifier
DELETE /projects/:id/messages/:mid  Supprimer

GET    /projects/:id/events      Événements (filtre mois)
POST   /projects/:id/events      Créer un événement
PATCH  /projects/:id/events/:eid  Modifier
DELETE /projects/:id/events/:eid  Supprimer
GET    /events/upcoming           Mes prochains événements

GET    /notifications             Mes notifications
GET    /notifications/unread-count  Compteur non lues
PATCH  /notifications/:id/read    Marquer lue
PATCH  /notifications/read-all    Tout marquer lu
DELETE /notifications/:id         Supprimer

GET    /users/me                 Mon profil
PATCH  /users/me                 Modifier profil
PATCH  /users/me/password        Changer mot de passe
DELETE /users/me                 Supprimer compte
GET    /users/search?q=          Rechercher un utilisateur
```

---

## 8. Expérience utilisateur

### Pages principales

| Route | Description |
|---|---|
| `/login` | Connexion |
| `/register` | Inscription |
| `/dashboard` | Dashboard global |
| `/projects/[id]` | Dashboard projet |
| `/projects/[id]/tasks` | Gestion des tâches (Kanban + liste) |
| `/projects/[id]/chat` | Chat projet |
| `/projects/[id]/calendar` | Calendrier projet |
| `/projects/[id]/members` | Gestion des membres |
| `/notifications` | Centre de notifications |
| `/history` | Projets terminés |
| `/trash` | Projets supprimés |
| `/settings` | Paramètres du compte |

### Principes UX

- Interface entièrement en français (fr-FR).
- Dates formatées en locale française (`toLocaleDateString('fr-FR')`).
- Feedback visuel immédiat sur chaque action (modales, erreurs inline).
- Accès rapide aux projets depuis la sidebar et le dashboard.
- Badge de notification en temps quasi-réel (polling).

---

## 9. Sécurité

| Risque | Mitigation |
|---|---|
| Injection SQL | Requêtes préparées systématiques |
| Accès non autorisé à un projet | Vérification d'appartenance sur chaque route protégée |
| Élévation de privilèges | Vérification du rôle + permission avant chaque action sensible |
| Exposition des mots de passe | Hachage bcrypt, jamais renvoyés dans les réponses API |
| Tokens compromis | Expiration 7 jours, stockage localStorage (à migrer vers httpOnly cookie en v2) |
| CSRF | Pas de session serveur en v1 (JWT stateless) |

---

## 10. Critères d'acceptation globaux

- [ ] Un utilisateur peut créer un compte, se connecter et accéder à son dashboard en moins de 60 secondes.
- [ ] Un projet peut être créé, peuplé de tâches et d'une équipe sans rechargement de page complet.
- [ ] Les tâches peuvent être déplacées entre colonnes Kanban et le statut est persisté immédiatement.
- [ ] Une @mention dans le chat génère une notification visible dans les 10 secondes pour le destinataire.
- [ ] Un rappel d'événement apparaît dans les notifications 24h avant l'heure de début.
- [ ] Un Observateur ne peut pas créer, modifier ou supprimer de tâches, messages ou événements.
- [ ] La corbeille permet de restaurer un projet supprimé par erreur.
- [ ] L'export CSV produit un fichier lisible et l'import CSV crée les tâches correspondantes.

---

## 11. Roadmap (post-v1)

| Priorité | Fonctionnalité |
|---|---|
| P1 | WebSockets pour le chat (remplacement du polling) |
| P1 | Notifications email (Nodemailer) |
| P1 | Pièces jointes sur les tâches et messages |
| P2 | Vue Gantt des tâches |
| P2 | Sous-tâches multi-niveaux (depth > 2) |
| P2 | Tableaux de bord personnalisables |
| P3 | Intégration GitHub (lier commits à des tâches) |
| P3 | API publique + webhooks |
| P3 | Application mobile (React Native) |
| P3 | Modèle de projet (templates) |

---

*Document maintenu par l'équipe Galineo. Toute modification majeure doit être versionnée.*
