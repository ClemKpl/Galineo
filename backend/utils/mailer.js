const { Resend } = require('resend');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://galineo.vercel.app';
const FROM = '"Galineo" <contact@flavien-gherardi.fr>';

async function sendMail({ to, subject, html }) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html
  });
  if (error) throw new Error(error.message);
}

function baseTemplate(content) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1c1917;">
      <div style="background: #f97316; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <span style="color: white; font-weight: 700; font-size: 20px; letter-spacing: -0.5px;">Galineo</span>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 12px 12px;">
        ${content}
        <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f5f5f4; font-size: 12px; color: #a8a29e;">
          Vous recevez cet email car vous avez un compte Galineo. Gérez vos préférences dans les <a href="${FRONTEND_URL}/settings" style="color: #f97316;">paramètres</a>.
        </p>
      </div>
    </div>
  `;
}

function btn(url, label) {
  return `<div style="margin-top: 24px;"><a href="${url}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${label}</a></div>`;
}

/**
 * Email quand un utilisateur existant est ajouté à un projet
 */
async function sendMemberAdded({ email, projectName, inviterName, projectId }) {
  const projectUrl = `${FRONTEND_URL}/projects/${projectId}`;
  return sendMail({
    to: email,
    subject: `Vous avez été ajouté au projet : ${projectName}`,
    html: baseTemplate(`
      <h2 style="margin: 0 0 8px; font-size: 20px;">Invitation au projet</h2>
      <p style="color: #57534e;"><strong style="color: #1c1917;">${inviterName}</strong> vous a ajouté au projet <strong style="color: #1c1917;">${projectName}</strong>.</p>
      <p style="color: #57534e;">Vous pouvez maintenant accéder au projet et collaborer avec l'équipe.</p>
      ${btn(projectUrl, 'Accéder au projet')}
      <p style="margin-top: 16px; font-size: 12px; color: #a8a29e;">Lien : ${projectUrl}</p>
    `)
  });
}

/**
 * Email d'invitation pour un nouvel utilisateur (sans compte)
 */
async function sendProjectInvitation({ email, projectName, inviterName, token }) {
  const joinUrl = `${FRONTEND_URL}/register?invite=${token}`;
  return sendMail({
    to: email,
    subject: `Invitation à rejoindre le projet : ${projectName}`,
    html: baseTemplate(`
      <h2 style="margin: 0 0 8px; font-size: 20px;">Vous êtes invité !</h2>
      <p style="color: #57534e;"><strong style="color: #1c1917;">${inviterName}</strong> vous invite à collaborer sur <strong style="color: #1c1917;">${projectName}</strong> via Galineo.</p>
      <p style="color: #57534e;">Créez votre compte gratuitement pour rejoindre l'équipe.</p>
      ${btn(joinUrl, 'Créer mon compte et rejoindre')}
      <p style="margin-top: 16px; font-size: 12px; color: #a8a29e;">Lien : ${joinUrl}</p>
    `)
  });
}

/**
 * Envoi générique d'un email de notification à un utilisateur.
 * Récupère l'email depuis la DB et respecte les préférences.
 */
async function sendNotificationEmail({ userId, type, title, message, projectId, extras = {} }) {
  return new Promise((resolve) => {
    db.get('SELECT email, notif_project_updates, notif_added_to_project, notif_deadlines, notif_mentions, notif_task_completed, notif_ai_responses, notif_chat_messages FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err || !user) return resolve();

      // Respect des préférences utilisateur
      if ((type === 'project_invite' || type === 'added_to_project' || type === 'group_added') && user.notif_added_to_project === 0) return resolve();
      if (type === 'mention' && user.notif_mentions === 0) return resolve();
      if (type === 'task_completed' && user.notif_task_completed === 0) return resolve();
      if (type === 'ai_response' && user.notif_ai_responses === 0) return resolve();
      if (type === 'chat_message' && user.notif_chat_messages === 0) return resolve();
      
      // Fallback
      if (type === 'task_assigned' && user.notif_project_updates === 0) return resolve();
      if (type === 'event_invite' && user.notif_project_updates === 0) return resolve();

      const projectUrl = projectId ? `${FRONTEND_URL}/projects/${projectId}` : FRONTEND_URL;
      let subject = title;
      let bodyContent = '';

      if (type === 'mention') {
        subject = `Vous avez été mentionné dans un projet`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Vous avez été mentionné</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(`${projectUrl}/chat`, 'Voir la discussion') : ''}
        `;
      } else if (type === 'task_assigned') {
        subject = `Une tâche vous a été assignée`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Nouvelle tâche assignée</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(`${projectUrl}/tasks`, 'Voir les tâches') : ''}
        `;
      } else if (type === 'project_invite') {
        subject = `Invitation au projet`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Invitation au projet</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(projectUrl, 'Accéder au projet') : ''}
        `;
      } else if (type === 'event_invite') {
        subject = `Invitation à un événement`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Nouvel événement</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(projectUrl, 'Voir le projet') : ''}
        `;
      } else if (type === 'group_added') {
        subject = `Ajout à un groupe de discussion`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Nouveau groupe</h2>
          <p style="color: #57534e;">${message}</p>
          ${btn(`${FRONTEND_URL}/messages`, 'Voir les discussions')}
        `;
      } else if (type === 'ai_response') {
        subject = `L'IA a terminé son analyse`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Réponse de l'assistant IA</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(`${projectUrl}/ai`, 'Voir la réponse') : ''}
        `;
      } else if (type === 'task_completed') {
        subject = `Tâche terminée : ${title}`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Tâche clôturée</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(`${projectUrl}/tasks`, 'Voir le projet') : ''}
        `;
      } else if (type === 'chat_message') {
        subject = `Nouveau message dans le projet`;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">Nouvel échange</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(`${projectUrl}/chat`, 'Voir le chat') : ''}
        `;
      } else {
        subject = title;
        bodyContent = `
          <h2 style="margin: 0 0 8px; font-size: 20px;">${title}</h2>
          <p style="color: #57534e;">${message}</p>
          ${projectId ? btn(projectUrl, 'Voir le projet') : ''}
        `;
      }

      try {
        await sendMail({
          to: user.email,
          subject,
          html: baseTemplate(bodyContent)
        });
        console.log(`✅ [mailer] Email "${type}" envoyé à ${user.email}`);
      } catch (mailErr) {
        console.error(`❌ [mailer] Échec email "${type}" à ${user.email}:`, mailErr.message);
      }
      resolve();
    });
  });
}

/**
 * Email quand la propriété d'un projet est transférée
 */
async function sendOwnershipTransferred({ email, projectName, prevOwnerName, projectId }) {
  const projectUrl = `${FRONTEND_URL}/projects/${projectId}`;
  return sendMail({
    to: email,
    subject: `Transfert de propriété : ${projectName}`,
    html: baseTemplate(`
      <h2 style="margin: 0 0 8px; font-size: 20px;">Vous êtes le nouveau propriétaire</h2>
      <p style="color: #57534e;"><strong style="color: #1c1917;">${prevOwnerName}</strong> vous a transféré la propriété exclusive du projet <strong style="color: #1c1917;">${projectName}</strong>.</p>
      <p style="color: #57534e;">En tant que propriétaire, vous avez désormais tous les droits de gestion sur ce projet.</p>
      ${btn(projectUrl, 'Gérer le projet')}
      <p style="margin-top: 16px; font-size: 12px; color: #a8a29e;">Lien : ${projectUrl}</p>
    `)
  });
}

/**
 * Email de remerciement lors du passage au Premium
 */
async function sendPremiumWelcome({ email, name }) {
  return sendMail({
    to: email,
    subject: `Bienvenue chez Galineo Premium ! ✨`,
    html: baseTemplate(`
      <h2 style="margin: 0 0 8px; font-size: 20px;">Merci pour votre confiance, ${name} !</h2>
      <p style="color: #57534e; font-size: 15px; line-height: 1.6;">Nous sommes ravis de vous compter parmi nos membres <strong style="color: #f97316;">Premium</strong>.</p>
      <p style="color: #57534e; font-size: 15px; line-height: 1.6;">Votre compte a été mis à jour et vous avez désormais un accès illimité à toutes nos fonctionnalités :</p>
      <ul style="color: #57534e; font-size: 14px; line-height: 1.8; margin: 16px 0; padding-left: 20px;">
        <li>🚀 Projets et collaborateurs illimités</li>
        <li>🤖 Assistant IA disponible sans limite</li>
        <li>📂 Historique complet et stockage étendu</li>
        <li>⚡️ Support prioritaire</li>
      </ul>
      <p style="color: #57534e; font-size: 15px; line-height: 1.6;">Toute l'équipe de Galineo vous souhaite une excellente productivité !</p>
      ${btn(FRONTEND_URL, 'Accéder à mon espace')}
    `)
  });
}

const { ADMIN_EMAILS } = require('../config/admins');
const SUPPORT_ADMIN_EMAILS = ADMIN_EMAILS;

async function sendSupportNotification({ ticketId, subject, message, userName, userEmail, priority }) {
  const priorityBadge = priority === 'high'
    ? '<span style="background:#f97316;color:white;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;">⭐ Prioritaire</span>'
    : '<span style="background:#e7e5e4;color:#78716c;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;">Normal</span>';

  for (const adminEmail of SUPPORT_ADMIN_EMAILS) {
    await sendMail({
      to: adminEmail,
      subject: `[Support #${ticketId}] ${subject}`,
      html: baseTemplate(`
        <p style="font-size:15px;color:#1c1917;">Nouveau ticket de support ${priorityBadge}</p>
        <p style="color:#57534e;font-size:14px;margin:4px 0;">De : <strong>${userName}</strong> (${userEmail})</p>
        <div style="background:#f5f5f4;border-radius:10px;padding:16px;margin:16px 0;">
          <p style="font-weight:700;color:#1c1917;margin:0 0 8px;">${subject}</p>
          <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${message}</p>
        </div>
        ${btn(`${FRONTEND_URL}/admin?tab=support`, 'Répondre dans l\'admin')}
      `),
    }).catch(() => {});
  }
}

async function sendSupportReplyNotification({ userEmail, userName, subject, reply }) {
  await sendMail({
    to: userEmail,
    subject: `Réponse à votre ticket : ${subject}`,
    html: baseTemplate(`
      <p style="font-size:15px;color:#1c1917;">Bonjour ${userName},</p>
      <p style="color:#57534e;font-size:15px;line-height:1.6;">L'équipe Galineo a répondu à votre ticket de support :</p>
      <p style="font-weight:700;color:#1c1917;margin:16px 0 8px;">${subject}</p>
      <div style="background:#fff7ed;border-left:3px solid #f97316;border-radius:0 10px 10px 0;padding:16px;margin:0 0 16px;">
        <p style="color:#57534e;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${reply}</p>
      </div>
      ${btn(`${FRONTEND_URL}/settings?tab=support`, 'Voir mon ticket')}
    `),
  });
}

module.exports = {
  sendMemberAdded,
  sendProjectInvitation,
  sendNotificationEmail,
  sendOwnershipTransferred,
  sendPremiumWelcome,
  sendSupportNotification,
  sendSupportReplyNotification,
};
