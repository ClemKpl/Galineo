# PRD - Galineo
## Product Requirements Document

**Version:** 1.1  
**Date:** 10 avril 2026  
**Statut:** Working Draft

---

## 1. Vision produit

Galineo est une plateforme de gestion de projets collaborative pour equipes francophones. Le produit centralise la planification, l'execution, la communication, le calendrier, les notifications et l'assistance IA dans une interface unique, simple a deployer et utilisable sur desktop comme sur mobile.

---

## 2. Objectifs

| Objectif | Indicateur de succes |
|---|---|
| Suivre l'avancement d'un projet sans outil externe | Progression des taches visible en temps reel sur dashboard et vues taches |
| Reduire la friction de communication interne | Usage regulier du chat projet, des groupes prives et des mentions |
| Donner une vision operationnelle claire au proprietaire | Dashboard projet avec stats, urgences, charge par membre |
| Accelérer l'execution | IA projet capable d'aider a creer, modifier et organiser selon permissions |
| Monetiser les usages avances | Conversion vers Premium et gestion de facturation Stripe |

---

## 3. Perimetre

### 3.1 Dans le perimetre

- Gestion de projets: creation, edition, completion, corbeille, restauration, suppression definitive
- Vider completement la corbeille
- Gestion de taches hierarchiques: fonctionnalites + sous-taches
- Vue liste et vue Kanban
- Dashboard global et dashboard projet
- Gestion des membres, roles et permissions
- Chat projet avec mentions
- Groupes de discussion prives hors projet
- Calendrier projet et evenements
- Notifications internes
- Parametres utilisateur
- Import/export CSV des taches
- Assistant IA global
- Assistant IA projet avec historique partage
- Reglages d'autorisations IA par projet
- Invitations et liens de partage projet
- Abonnement Premium via Stripe
- Portail de facturation Stripe

### 3.2 Hors perimetre

- Application mobile native
- Temps reel strict par WebSocket
- Integrations Slack, GitHub, Jira, Notion
- Multi-workspace / multi-organisation
- API publique
- Multi-langue

---

## 4. Utilisateurs cibles

### Proprietaire
Cree les projets, gere les membres, pilote les permissions et suit l'avancement global.

### Admin
Peut administrer un projet sans en etre proprietaire.

### Membre
Execute les taches, participe au chat, au calendrier et aux groupes prives.

### Observateur
Acces majoritairement en lecture.

### Utilisateur Premium
Debloque les usages avances selon le plan defini par le produit.

---

## 5. Fonctionnalites

### 5.1 Authentification et compte

| ID | Fonctionnalite | Priorite |
|---|---|---|
| AUTH-01 | Creer un compte | P0 |
| AUTH-02 | Se connecter par email et mot de passe | P0 |
| AUTH-03 | Se deconnecter | P0 |
| AUTH-04 | Modifier profil, email et avatar | P1 |
| AUTH-05 | Changer son mot de passe | P1 |
| AUTH-06 | Supprimer son compte | P2 |
| AUTH-07 | Reinitialiser son espace utilisateur | P2 |

### 5.2 Gestion de projets

| ID | Fonctionnalite | Priorite |
|---|---|---|
| PROJ-01 | Creer un projet | P0 |
| PROJ-02 | Lister mes projets actifs | P0 |
| PROJ-03 | Modifier un projet | P1 |
| PROJ-04 | Marquer un projet comme termine | P1 |
| PROJ-05 | Envoyer un projet dans la corbeille | P1 |
| PROJ-06 | Restaurer un projet depuis la corbeille | P1 |
| PROJ-07 | Supprimer definitivement un projet | P2 |
| PROJ-08 | Vider toute la corbeille | P2 |
| PROJ-09 | Voir l'historique des projets termines | P2 |
| PROJ-10 | Mettre un projet en favori | P2 |
| PROJ-11 | Generer et revoquer des liens de partage | P2 |

**Regles metier**
- Un projet a un statut: `active`, `completed`, `deleted`.
- Une suppression normale est un soft delete.
- Une suppression definitive doit supprimer les dependances liees avant d'effacer le projet.

### 5.3 Membres et permissions

| ID | Fonctionnalite | Priorite |
|---|---|---|
| TEAM-01 | Ajouter un membre a un projet | P0 |
| TEAM-02 | Inviter par email | P1 |
| TEAM-03 | Modifier le role d'un membre | P1 |
| TEAM-04 | Retirer un membre | P1 |
| TEAM-05 | Quitter un projet | P2 |
| TEAM-06 | Transferer la propriete lors d'un depart | P2 |

**Roles**

| Role | Capacites |
|---|---|
| Proprietaire | Toutes |
| Admin | Administration operationnelle |
| Membre | Participation standard |
| Observateur | Lecture principalement |

### 5.4 Taches et fonctionnalites

| ID | Fonctionnalite | Priorite |
|---|---|---|
| TASK-01 | Creer une fonctionnalite parent | P0 |
| TASK-02 | Creer une sous-tache | P0 |
| TASK-03 | Modifier une tache | P0 |
| TASK-04 | Supprimer une tache | P1 |
| TASK-05 | Changer le statut d'une tache | P0 |
| TASK-06 | Changer le statut en Kanban | P1 |
| TASK-07 | Ajouter des commentaires | P1 |
| TASK-08 | Voir l'historique de commentaires | P1 |
| TASK-09 | Importer un CSV | P2 |
| TASK-10 | Exporter un CSV | P2 |
| TASK-11 | Voir mes taches assignees tous projets confondus | P0 |

**Statuts**

`todo` -> `in_progress` -> `done`

**Regles metier**
- Une fonctionnalite est une tache parent.
- Une sous-tache ne peut pas avoir d'enfant.
- Si toutes les sous-taches sont terminees, la fonctionnalite passe automatiquement a `done`.
- Si une fonctionnalite est forcee en `done` ou `todo`, le statut est propage a ses sous-taches.
- La suppression d'un parent supprime ses sous-taches.

### 5.5 Dashboard global

| ID | Fonctionnalite | Priorite |
|---|---|---|
| GLOB-01 | Voir mes projets | P0 |
| GLOB-02 | Voir mes taches assignees | P0 |
| GLOB-03 | Voir mes prochains evenements | P0 |
| GLOB-04 | Creer un projet depuis le dashboard | P0 |

### 5.6 Dashboard projet

| ID | Fonctionnalite | Priorite |
|---|---|---|
| DASH-01 | Voir les stats du projet | P0 |
| DASH-02 | Voir les urgences | P1 |
| DASH-03 | Voir la charge par membre | P1 |
| DASH-04 | Voir les prochaines echeances | P1 |

### 5.7 Chat projet

| ID | Fonctionnalite | Priorite |
|---|---|---|
| CHAT-01 | Envoyer un message | P0 |
| CHAT-02 | Mentionner un membre | P1 |
| CHAT-03 | Modifier un message | P2 |
| CHAT-04 | Supprimer un message | P2 |
| CHAT-05 | Rafraichissement automatique | P1 |

### 5.8 Groupes prives hors projet

| ID | Fonctionnalite | Priorite |
|---|---|---|
| DM-01 | Lister mes groupes prives | P1 |
| DM-02 | Creer un groupe prive | P1 |
| DM-03 | Envoyer des messages dans un groupe | P1 |
| DM-04 | Modifier le groupe et ses membres | P2 |
| DM-05 | Supprimer definitivement un groupe | P2 |

**Regles metier**
- Les discussions privees sont independantes des projets.
- Sur mobile, la zone de saisie doit rester visible au-dessus de la navigation systeme/app.

### 5.9 Calendrier projet

| ID | Fonctionnalite | Priorite |
|---|---|---|
| CAL-01 | Voir le calendrier du projet | P0 |
| CAL-02 | Creer un evenement | P0 |
| CAL-03 | Modifier un evenement | P1 |
| CAL-04 | Supprimer un evenement | P1 |
| CAL-05 | Gerer les participants | P1 |

### 5.10 Notifications

| ID | Fonctionnalite | Priorite |
|---|---|---|
| NOTIF-01 | Lister les notifications | P0 |
| NOTIF-02 | Afficher le badge non lu | P0 |
| NOTIF-03 | Marquer comme lu | P1 |
| NOTIF-04 | Tout marquer lu | P1 |
| NOTIF-05 | Supprimer une notification | P2 |

### 5.11 IA

| ID | Fonctionnalite | Priorite |
|---|---|---|
| AI-01 | Assistant IA global | P1 |
| AI-02 | Assistant IA projet | P0 |
| AI-03 | Historique IA projet partage | P1 |
| AI-04 | Permissions IA par projet | P1 |
| AI-05 | Reinitialiser l'historique IA projet | P2 |
| AI-06 | Regler la duree d'historique IA utilisateur | P2 |

### 5.12 Facturation et plans

| ID | Fonctionnalite | Priorite |
|---|---|---|
| BILL-01 | Ouvrir Stripe Checkout pour Premium | P1 |
| BILL-02 | Mettre a jour le plan via webhook Stripe | P1 |
| BILL-03 | Ouvrir le portail Stripe | P1 |
| BILL-04 | Afficher le plan actuel | P0 |
| BILL-05 | Afficher un message de remerciement apres upgrade | P1 |
| BILL-06 | Bouton experimental Premium -> Free pour test | P2 |

---

## 6. Modele de donnees

### Entites principales

```txt
users
  id, name, email, password_hash, avatar, plan,
  stripe_customer_id, stripe_subscription_id,
  ai_prompts_count, ai_history_duration,
  notif_project_updates, notif_added_to_project, notif_deadlines,
  last_login_at, created_at

projects
  id, title, description, deadline, start_date,
  status, owner_id, avatar, created_at

project_members
  project_id, user_id, role_id, is_favorite

roles
  id, name, is_default

permissions
  id, name, description

role_permissions
  role_id, permission_id

tasks
  id, project_id, parent_id, title, description,
  status, priority, phase, start_date, due_date,
  created_by, assigned_to, color, created_at

task_comments
  id, task_id, user_id, content, created_at

messages
  id, project_id, user_id, content, created_at

chat_groups
  id, title, description, avatar, created_at

chat_group_members
  group_id, user_id

calendar_events
  id, project_id, title, description,
  start_datetime, end_datetime, location,
  created_by, created_at

event_attendees
  event_id, user_id, notified

notifications
  id, user_id, type, title, message,
  project_id, task_id, from_user_id,
  is_read, created_at

project_ai_settings
  project_id, allow_create, allow_modify, allow_members, allow_delete

project_share_links
  id, project_id, role_id, token, expires_at, created_at

invitations
  id, project_id, email, role_id, inviter_id, token, status, created_at
```

---

## 7. Architecture technique

### Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Base de donnees | SQLite en dev, PostgreSQL en prod |
| Auth | JWT + bcrypt |
| Paiement | Stripe Checkout, Billing Portal, Webhooks |
| Email | Nodemailer |

### Principes clefs

- Frontend et backend separes
- SQL compatible SQLite/PostgreSQL via couche d'abstraction
- Permissions scopees au projet
- Polling HTTP pour plusieurs flux de donnees
- Soft delete pour les projets
- Suppression definitive avec nettoyage explicite des dependances

### Routes API principales

```txt
POST   /auth/register
POST   /auth/login

GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
PATCH  /projects/:id/complete
PATCH  /projects/:id/restore
DELETE /projects/trash/empty
DELETE /projects/:id/hard

POST   /projects/:id/members
PATCH  /projects/:id/members/:uid
DELETE /projects/:id/members/:uid

GET    /projects/:projectId/tasks
POST   /projects/:projectId/tasks
PATCH  /projects/:projectId/tasks/:tid
DELETE /projects/:projectId/tasks/:tid
GET    /projects/:projectId/tasks/export
POST   /projects/:projectId/tasks/import
GET    /projects/:projectId/tasks/:tid/comments
POST   /projects/:projectId/tasks/:tid/comments

GET    /tasks/assigned

GET    /projects/:projectId/messages
POST   /projects/:projectId/messages

GET    /chat-groups
POST   /chat-groups
GET    /chat-groups/:id
PATCH  /chat-groups/:id
DELETE /chat-groups/:id
GET    /chat-groups/:id/messages
POST   /chat-groups/:id/messages

GET    /projects/:projectId/events
POST   /projects/:projectId/events
PATCH  /projects/:projectId/events/:eid
DELETE /projects/:projectId/events/:eid
GET    /events/upcoming

GET    /notifications
GET    /notifications/unread-count
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
DELETE /notifications/:id

GET    /users/me
PATCH  /users/me
PATCH  /users/me/password
PATCH  /users/me/ai-settings
DELETE /users/me

POST   /billing/checkout
POST   /billing/portal
GET    /billing/status
POST   /billing/test/downgrade

POST   /ai/chat
GET    /ai/history/:projectId
GET    /ai/active-task/:projectId
```

---

## 8. Experience utilisateur

### Pages principales

| Route | Description |
|---|---|
| `/login` | Connexion |
| `/register` | Inscription |
| `/dashboard` | Dashboard global |
| `/projects/[id]` | Dashboard projet |
| `/projects/[id]/tasks` | Taches |
| `/projects/[id]/chat` | Chat projet |
| `/projects/[id]/calendar` | Calendrier projet |
| `/projects/[id]/ai` | Assistant IA projet |
| `/messages` | Groupes prives |
| `/messages/[id]` | Discussion privee |
| `/notifications` | Notifications |
| `/history` | Projets termines |
| `/trash` | Corbeille |
| `/settings` | Parametres utilisateur |

### Principes UX

- Interface en francais
- Navigation mobile persistante
- Zone de saisie mobile protegee des overlays de navigation
- Feedback immediat apres actions critiques
- Cohabitation claire entre projet, messagerie et IA

---

## 9. Securite

| Risque | Mitigation |
|---|---|
| Injection SQL | Requetes preparees |
| Acces projet non autorise | Verification d'appartenance et de role |
| Elevation de privilege | Verification des permissions avant action sensible |
| Fuite mot de passe | bcrypt + jamais renvoye dans les reponses |
| Mauvaise suppression definitive | Nettoyage des dependances avant suppression du projet |
| Usage non maitrise des outils de test billing | Marquage experimental et usage reserve aux tests |

---

## 10. Criteres d'acceptation globaux

- [ ] Un utilisateur peut creer un compte et acceder au dashboard.
- [ ] Un projet peut etre cree, rempli en taches et partager avec des membres.
- [ ] Une tache change de statut sans rechargement complet.
- [ ] Une fonctionnalite peut propager son statut a ses sous-taches.
- [ ] La corbeille peut restaurer et vider definitivement les projets supprimes.
- [ ] Les groupes prives hors projet fonctionnent aussi sur mobile.
- [ ] Le passage Premium est reflechi dans l'application apres retour Stripe.
- [ ] Le bouton experimental de downgrade Premium -> Free fonctionne pour les tests.
- [ ] L'assistant IA projet respecte les permissions du projet.

---

## 11. Roadmap post-v1

| Priorite | Fonctionnalite |
|---|---|
| P1 | Temps reel WebSocket |
| P1 | Pieces jointes |
| P1 | Gantt |
| P2 | Sous-taches multi-niveaux |
| P2 | Tableaux de bord personnalisables |
| P2 | Integrations externes |
| P3 | API publique |
| P3 | Application mobile native |

---

*Document maintenu pour reflet produit et cadrage fonctionnel. Toute evolution majeure doit mettre a jour ce PRD.*
