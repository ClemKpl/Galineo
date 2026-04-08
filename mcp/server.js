#!/usr/bin/env node
/**
 * Galineo MCP Server
 * Exposes the full Galineo REST API as MCP tools.
 *
 * Configuration (environment variables):
 *   GALINEO_API_URL   Base URL of the Galineo backend  (default: http://localhost:3001)
 *   GALINEO_TOKEN     JWT token (optional – use auth_login tool instead)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_URL = (process.env.GALINEO_API_URL || "http://localhost:3001").replace(/\/$/, "");
let authToken = process.env.GALINEO_TOKEN || null;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
async function api(method, path, body = null, { raw = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${path}`, options);

  if (raw) {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
    return await res.text();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// Wrap result as MCP tool content
function ok(data) {
  return {
    content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  // ── AUTH ──────────────────────────────────────────────────────────────────
  {
    name: "auth_login",
    description:
      "Se connecter à Galineo et obtenir un token JWT. À appeler en premier si GALINEO_TOKEN n'est pas défini. Le token est automatiquement réutilisé pour tous les appels suivants dans la session.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Adresse email" },
        password: { type: "string", description: "Mot de passe" },
      },
      required: ["email", "password"],
    },
  },
  {
    name: "auth_register",
    description: "Créer un nouveau compte utilisateur Galineo.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom complet" },
        email: { type: "string", description: "Adresse email" },
        password: { type: "string", description: "Mot de passe (min. 6 caractères)" },
      },
      required: ["name", "email", "password"],
    },
  },

  // ── USERS ─────────────────────────────────────────────────────────────────
  {
    name: "user_get_profile",
    description: "Obtenir le profil de l'utilisateur actuellement connecté.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "user_update_profile",
    description: "Modifier le nom et/ou l'email de l'utilisateur connecté.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nouveau nom" },
        email: { type: "string", description: "Nouvel email" },
      },
    },
  },
  {
    name: "user_change_password",
    description: "Changer le mot de passe de l'utilisateur connecté.",
    inputSchema: {
      type: "object",
      properties: {
        currentPassword: { type: "string", description: "Mot de passe actuel" },
        newPassword: { type: "string", description: "Nouveau mot de passe (min. 6 caractères)" },
      },
      required: ["currentPassword", "newPassword"],
    },
  },
  {
    name: "user_delete_account",
    description: "Supprimer définitivement le compte de l'utilisateur connecté.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "user_search",
    description: "Rechercher des utilisateurs par nom ou email (retourne 10 résultats max, exclut l'utilisateur connecté).",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Terme de recherche" },
      },
      required: ["q"],
    },
  },
  {
    name: "user_list",
    description: "Lister tous les utilisateurs enregistrés sur la plateforme.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── ROLES ─────────────────────────────────────────────────────────────────
  {
    name: "role_list",
    description: "Lister tous les rôles disponibles (Propriétaire, Admin, Membre, Observateur + rôles personnalisés).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "role_list_permissions",
    description: "Lister toutes les permissions disponibles sur la plateforme.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "role_create",
    description: "Créer un rôle personnalisé avec un ensemble de permissions.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du rôle" },
        permissionIds: {
          type: "array",
          items: { type: "number" },
          description: "IDs des permissions à attribuer à ce rôle",
        },
      },
      required: ["name"],
    },
  },

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  {
    name: "project_list",
    description: "Lister tous les projets actifs dont je suis propriétaire ou membre.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "project_list_history",
    description: "Lister les projets terminés (archivés).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "project_list_trash",
    description: "Lister les projets dans la corbeille (soft-deleted).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "project_get",
    description: "Obtenir les détails d'un projet ainsi que la liste de ses membres.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "project_get_dashboard",
    description:
      "Obtenir le tableau de bord analytique d'un projet : statistiques de tâches, liste des tâches urgentes, charge de travail par membre.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "project_create",
    description: "Créer un nouveau projet. Le créateur devient automatiquement Propriétaire.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du projet" },
        description: { type: "string", description: "Description du projet" },
        deadline: { type: "string", description: "Date limite ISO 8601 (ex: 2026-12-31)" },
        members: {
          type: "array",
          description: "Membres à ajouter lors de la création",
          items: {
            type: "object",
            properties: {
              userId: { type: "number", description: "ID de l'utilisateur" },
              roleId: { type: "number", description: "ID du rôle (1=Propriétaire, 2=Admin, 3=Membre, 4=Observateur)" },
            },
            required: ["userId"],
          },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "project_update",
    description: "Modifier le titre, la description ou la deadline d'un projet. Requiert le rôle Propriétaire ou Admin.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        title: { type: "string" },
        description: { type: "string" },
        deadline: { type: "string", description: "ISO 8601" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "project_complete",
    description: "Marquer un projet comme terminé. Il sera déplacé dans l'historique.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "project_delete",
    description: "Supprimer un projet (soft delete → corbeille). Réservé au Propriétaire.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "project_hard_delete",
    description: "Supprimer définitivement un projet depuis la corbeille. Action irréversible. Réservé au Propriétaire.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "project_restore",
    description: "Restaurer un projet depuis la corbeille pour le remettre actif.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },

  // ── MEMBERS ───────────────────────────────────────────────────────────────
  {
    name: "member_add",
    description: "Ajouter un utilisateur comme membre d'un projet. Requiert le rôle Propriétaire ou Admin.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        userId: { type: "number", description: "ID de l'utilisateur à ajouter" },
        roleId: {
          type: "number",
          description: "ID du rôle (1=Propriétaire, 2=Admin, 3=Membre, 4=Observateur). Défaut: 3",
        },
      },
      required: ["projectId", "userId"],
    },
  },
  {
    name: "member_update_role",
    description: "Modifier le rôle d'un membre dans un projet. Requiert le rôle Propriétaire ou Admin.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        userId: { type: "number", description: "ID de l'utilisateur" },
        roleId: { type: "number", description: "Nouveau rôle (1=Propriétaire, 2=Admin, 3=Membre, 4=Observateur)" },
      },
      required: ["projectId", "userId", "roleId"],
    },
  },
  {
    name: "member_remove",
    description: "Retirer un membre d'un projet. Requiert le rôle Propriétaire ou Admin. Le Propriétaire ne peut pas être retiré.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        userId: { type: "number", description: "ID de l'utilisateur à retirer" },
      },
      required: ["projectId", "userId"],
    },
  },

  // ── TASKS ─────────────────────────────────────────────────────────────────
  {
    name: "task_list",
    description: "Lister toutes les tâches et sous-tâches d'un projet.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "task_list_assigned",
    description: "Lister toutes les tâches qui me sont assignées sur tous mes projets, triées par date d'échéance.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "task_create",
    description:
      "Créer une tâche (fonctionnalité) ou une sous-tâche dans un projet. Passer parent_id pour créer une sous-tâche.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        title: { type: "string", description: "Titre de la tâche" },
        description: { type: "string", description: "Description détaillée" },
        parent_id: { type: "number", description: "ID de la tâche parente (crée une sous-tâche)" },
        phase: { type: "string", description: "Phase ou sprint associé" },
        priority: {
          type: "string",
          enum: ["normal", "urgent_important", "urgent_not_important", "not_urgent_important"],
          description: "Priorité de la tâche",
        },
        start_date: { type: "string", description: "Date de début (ISO 8601)" },
        due_date: { type: "string", description: "Date d'échéance (ISO 8601)" },
        assigned_to: { type: "number", description: "ID de l'utilisateur à qui assigner la tâche" },
      },
      required: ["projectId", "title"],
    },
  },
  {
    name: "task_update",
    description: "Modifier une tâche existante (titre, statut, priorité, assignation, dates, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        taskId: { type: "number", description: "ID de la tâche" },
        title: { type: "string" },
        description: { type: "string" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "Statut de la tâche",
        },
        priority: {
          type: "string",
          enum: ["normal", "urgent_important", "urgent_not_important", "not_urgent_important"],
        },
        phase: { type: "string" },
        start_date: { type: "string", description: "ISO 8601" },
        due_date: { type: "string", description: "ISO 8601" },
        assigned_to: { type: ["number", "null"], description: "ID de l'utilisateur assigné (null pour désassigner)" },
        parent_id: { type: ["number", "null"], description: "Changer la tâche parente" },
      },
      required: ["projectId", "taskId"],
    },
  },
  {
    name: "task_delete",
    description: "Supprimer une tâche et toutes ses sous-tâches.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        taskId: { type: "number", description: "ID de la tâche" },
      },
      required: ["projectId", "taskId"],
    },
  },
  {
    name: "task_export_csv",
    description: "Exporter toutes les tâches d'un projet au format CSV (retourne la chaîne CSV brute).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "task_import_csv",
    description:
      "Importer des tâches dans un projet depuis une chaîne CSV. Colonnes attendues: type, title, description, status, priority, phase, start_date, due_date, assigned_email, parent_title.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        csv: { type: "string", description: "Contenu CSV complet (avec en-tête)" },
      },
      required: ["projectId", "csv"],
    },
  },

  // ── TASK COMMENTS ─────────────────────────────────────────────────────────
  {
    name: "task_list_comments",
    description: "Lister tous les commentaires d'une tâche.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        taskId: { type: "number", description: "ID de la tâche" },
      },
      required: ["projectId", "taskId"],
    },
  },
  {
    name: "task_add_comment",
    description: "Ajouter un commentaire sur une tâche.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        taskId: { type: "number", description: "ID de la tâche" },
        content: { type: "string", description: "Contenu du commentaire" },
      },
      required: ["projectId", "taskId", "content"],
    },
  },

  // ── MESSAGES ──────────────────────────────────────────────────────────────
  {
    name: "message_list",
    description: "Lister les messages du chat d'un projet.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "message_send",
    description:
      "Envoyer un message dans le chat d'un projet. Utiliser @Prenom dans le contenu pour mentionner un membre (déclenche une notification).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        content: { type: "string", description: "Contenu du message" },
      },
      required: ["projectId", "content"],
    },
  },
  {
    name: "message_edit",
    description: "Modifier un de ses propres messages dans le chat d'un projet.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        messageId: { type: "number", description: "ID du message" },
        content: { type: "string", description: "Nouveau contenu" },
      },
      required: ["projectId", "messageId", "content"],
    },
  },
  {
    name: "message_delete",
    description: "Supprimer un de ses propres messages dans le chat d'un projet.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        messageId: { type: "number", description: "ID du message" },
      },
      required: ["projectId", "messageId"],
    },
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  {
    name: "notification_list",
    description: "Lister mes 50 notifications les plus récentes (task_assigned, mention, event_invite, event_reminder).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "notification_unread_count",
    description: "Obtenir le nombre de notifications non lues.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "notification_mark_read",
    description: "Marquer une notification spécifique comme lue.",
    inputSchema: {
      type: "object",
      properties: {
        notificationId: { type: "number", description: "ID de la notification" },
      },
      required: ["notificationId"],
    },
  },
  {
    name: "notification_mark_all_read",
    description: "Marquer toutes mes notifications comme lues.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "notification_delete",
    description: "Supprimer une notification.",
    inputSchema: {
      type: "object",
      properties: {
        notificationId: { type: "number", description: "ID de la notification" },
      },
      required: ["notificationId"],
    },
  },

  // ── EVENTS ────────────────────────────────────────────────────────────────
  {
    name: "event_list",
    description: "Lister les événements du calendrier d'un projet, avec filtre optionnel par mois.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        month: { type: "string", description: "Filtre par mois au format YYYY-MM (ex: 2026-04)" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "event_list_upcoming",
    description: "Lister mes 20 prochains événements sur tous mes projets. Déclenche les rappels 24h avant.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "event_create",
    description: "Créer un événement dans le calendrier d'un projet. Le créateur est automatiquement ajouté comme participant.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        title: { type: "string", description: "Titre de l'événement" },
        description: { type: "string", description: "Description" },
        start_datetime: { type: "string", description: "Date et heure de début (ISO 8601)" },
        end_datetime: { type: "string", description: "Date et heure de fin (ISO 8601)" },
        location: { type: "string", description: "Lieu de l'événement" },
        attendee_ids: {
          type: "array",
          items: { type: "number" },
          description: "IDs des participants à inviter (une notification event_invite leur sera envoyée)",
        },
      },
      required: ["projectId", "title", "start_datetime", "end_datetime"],
    },
  },
  {
    name: "event_update",
    description: "Modifier un événement du calendrier (titre, dates, lieu, participants).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        eventId: { type: "number", description: "ID de l'événement" },
        title: { type: "string" },
        description: { type: "string" },
        start_datetime: { type: "string", description: "ISO 8601" },
        end_datetime: { type: "string", description: "ISO 8601" },
        location: { type: "string" },
        attendee_ids: {
          type: "array",
          items: { type: "number" },
          description: "Nouvelle liste complète des participants",
        },
      },
      required: ["projectId", "eventId"],
    },
  },
  {
    name: "event_delete",
    description: "Supprimer un événement du calendrier.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        eventId: { type: "number", description: "ID de l'événement" },
      },
      required: ["projectId", "eventId"],
    },
  },

  // ── DATE NOTES ────────────────────────────────────────────────────────────
  {
    name: "date_note_list",
    description: "Lister les notes attachées à une date précise dans le calendrier d'un projet.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
      },
      required: ["projectId", "date"],
    },
  },
  {
    name: "date_note_add",
    description: "Ajouter une note à une date dans le calendrier d'un projet.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        content: { type: "string", description: "Contenu de la note" },
      },
      required: ["projectId", "date", "content"],
    },
  },
  {
    name: "date_note_delete",
    description: "Supprimer une note de date.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "ID du projet" },
        noteId: { type: "number", description: "ID de la note" },
      },
      required: ["projectId", "noteId"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------
async function executeTool(name, args) {
  switch (name) {
    // ── AUTH ────────────────────────────────────────────────────────────────
    case "auth_login": {
      const data = await api("POST", "/auth/login", { email: args.email, password: args.password });
      authToken = data.token;
      return ok({ message: "Connecté avec succès. Token stocké pour cette session.", user: data.user });
    }
    case "auth_register": {
      const data = await api("POST", "/auth/register", { name: args.name, email: args.email, password: args.password });
      authToken = data.token;
      return ok({ message: "Compte créé et connecté. Token stocké pour cette session.", user: data.user });
    }

    // ── USERS ───────────────────────────────────────────────────────────────
    case "user_get_profile":
      return ok(await api("GET", "/users/me"));
    case "user_update_profile": {
      const body = {};
      if (args.name !== undefined) body.name = args.name;
      if (args.email !== undefined) body.email = args.email;
      return ok(await api("PATCH", "/users/me", body));
    }
    case "user_change_password":
      return ok(await api("PATCH", "/users/me/password", { currentPassword: args.currentPassword, newPassword: args.newPassword }));
    case "user_delete_account":
      return ok(await api("DELETE", "/users/me"));
    case "user_search":
      return ok(await api("GET", `/users/search?q=${encodeURIComponent(args.q)}`));
    case "user_list":
      return ok(await api("GET", "/users"));

    // ── ROLES ───────────────────────────────────────────────────────────────
    case "role_list":
      return ok(await api("GET", "/roles"));
    case "role_list_permissions":
      return ok(await api("GET", "/roles/permissions"));
    case "role_create": {
      const body = { name: args.name };
      if (args.permissionIds) body.permissionIds = args.permissionIds;
      return ok(await api("POST", "/roles", body));
    }

    // ── PROJECTS ────────────────────────────────────────────────────────────
    case "project_list":
      return ok(await api("GET", "/projects"));
    case "project_list_history":
      return ok(await api("GET", "/projects/history"));
    case "project_list_trash":
      return ok(await api("GET", "/projects/trash"));
    case "project_get":
      return ok(await api("GET", `/projects/${args.projectId}`));
    case "project_get_dashboard":
      return ok(await api("GET", `/projects/${args.projectId}/dashboard`));
    case "project_create": {
      const body = { title: args.title };
      if (args.description !== undefined) body.description = args.description;
      if (args.deadline !== undefined) body.deadline = args.deadline;
      if (args.members !== undefined) body.members = args.members;
      return ok(await api("POST", "/projects", body));
    }
    case "project_update": {
      const body = {};
      if (args.title !== undefined) body.title = args.title;
      if (args.description !== undefined) body.description = args.description;
      if (args.deadline !== undefined) body.deadline = args.deadline;
      return ok(await api("PATCH", `/projects/${args.projectId}`, body));
    }
    case "project_complete":
      return ok(await api("PATCH", `/projects/${args.projectId}/complete`));
    case "project_delete":
      return ok(await api("DELETE", `/projects/${args.projectId}`));
    case "project_hard_delete":
      return ok(await api("DELETE", `/projects/${args.projectId}/hard`));
    case "project_restore":
      return ok(await api("PATCH", `/projects/${args.projectId}/restore`));

    // ── MEMBERS ─────────────────────────────────────────────────────────────
    case "member_add": {
      const body = { userId: args.userId };
      if (args.roleId !== undefined) body.roleId = args.roleId;
      return ok(await api("POST", `/projects/${args.projectId}/members`, body));
    }
    case "member_update_role":
      return ok(await api("PATCH", `/projects/${args.projectId}/members/${args.userId}`, { roleId: args.roleId }));
    case "member_remove":
      return ok(await api("DELETE", `/projects/${args.projectId}/members/${args.userId}`));

    // ── TASKS ───────────────────────────────────────────────────────────────
    case "task_list":
      return ok(await api("GET", `/projects/${args.projectId}/tasks`));
    case "task_list_assigned":
      return ok(await api("GET", "/tasks/assigned"));
    case "task_create": {
      const body = { title: args.title };
      const optional = ["description", "parent_id", "phase", "priority", "start_date", "due_date", "assigned_to"];
      for (const key of optional) if (args[key] !== undefined) body[key] = args[key];
      return ok(await api("POST", `/projects/${args.projectId}/tasks`, body));
    }
    case "task_update": {
      const body = {};
      const fields = ["title", "description", "status", "priority", "phase", "start_date", "due_date", "assigned_to", "parent_id"];
      for (const key of fields) if (args[key] !== undefined) body[key] = args[key];
      return ok(await api("PATCH", `/projects/${args.projectId}/tasks/${args.taskId}`, body));
    }
    case "task_delete":
      return ok(await api("DELETE", `/projects/${args.projectId}/tasks/${args.taskId}`));
    case "task_export_csv":
      return ok(await api("GET", `/projects/${args.projectId}/tasks/export`, null, { raw: true }));
    case "task_import_csv":
      return ok(await api("POST", `/projects/${args.projectId}/tasks/import`, { csv: args.csv }));

    // ── TASK COMMENTS ───────────────────────────────────────────────────────
    case "task_list_comments":
      return ok(await api("GET", `/projects/${args.projectId}/tasks/${args.taskId}/comments`));
    case "task_add_comment":
      return ok(await api("POST", `/projects/${args.projectId}/tasks/${args.taskId}/comments`, { content: args.content }));

    // ── MESSAGES ────────────────────────────────────────────────────────────
    case "message_list":
      return ok(await api("GET", `/projects/${args.projectId}/messages`));
    case "message_send":
      return ok(await api("POST", `/projects/${args.projectId}/messages`, { content: args.content }));
    case "message_edit":
      return ok(await api("PATCH", `/projects/${args.projectId}/messages/${args.messageId}`, { content: args.content }));
    case "message_delete":
      return ok(await api("DELETE", `/projects/${args.projectId}/messages/${args.messageId}`));

    // ── NOTIFICATIONS ────────────────────────────────────────────────────────
    case "notification_list":
      return ok(await api("GET", "/notifications"));
    case "notification_unread_count":
      return ok(await api("GET", "/notifications/unread-count"));
    case "notification_mark_read":
      return ok(await api("PATCH", `/notifications/${args.notificationId}/read`));
    case "notification_mark_all_read":
      return ok(await api("PATCH", "/notifications/read-all"));
    case "notification_delete":
      return ok(await api("DELETE", `/notifications/${args.notificationId}`));

    // ── EVENTS ──────────────────────────────────────────────────────────────
    case "event_list": {
      const qs = args.month ? `?month=${encodeURIComponent(args.month)}` : "";
      return ok(await api("GET", `/projects/${args.projectId}/events${qs}`));
    }
    case "event_list_upcoming":
      return ok(await api("GET", "/events/upcoming"));
    case "event_create": {
      const body = { title: args.title, start_datetime: args.start_datetime, end_datetime: args.end_datetime };
      const optional = ["description", "location", "attendee_ids"];
      for (const key of optional) if (args[key] !== undefined) body[key] = args[key];
      return ok(await api("POST", `/projects/${args.projectId}/events`, body));
    }
    case "event_update": {
      const body = {};
      const fields = ["title", "description", "start_datetime", "end_datetime", "location", "attendee_ids"];
      for (const key of fields) if (args[key] !== undefined) body[key] = args[key];
      return ok(await api("PATCH", `/projects/${args.projectId}/events/${args.eventId}`, body));
    }
    case "event_delete":
      return ok(await api("DELETE", `/projects/${args.projectId}/events/${args.eventId}`));

    // ── DATE NOTES ──────────────────────────────────────────────────────────
    case "date_note_list":
      return ok(await api("GET", `/projects/${args.projectId}/date-notes/${args.date}`));
    case "date_note_add":
      return ok(await api("POST", `/projects/${args.projectId}/date-notes/${args.date}`, { content: args.content }));
    case "date_note_delete":
      return ok(await api("DELETE", `/projects/${args.projectId}/date-notes/${args.noteId}`));

    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "galineo", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    return await executeTool(name, args);
  } catch (err) {
    return {
      content: [{ type: "text", text: `Erreur: ${err.message}` }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
