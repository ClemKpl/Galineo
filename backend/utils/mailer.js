const { Resend } = require('resend');
const db = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
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
    db.get('SELECT email, notif_project_updates, notif_added_to_project, notif_deadlines FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err || !user) return resolve();

      // Respect des préférences utilisateur
      if (type === 'project_invite' && user.notif_added_to_project === 0) return resolve();
      if (type === 'task_assigned' && user.notif_project_updates === 0) return resolve();
      if (type === 'mention' && user.notif_project_updates === 0) return resolve();
      if (type === 'event_invite' && user.notif_project_updates === 0) return resolve();
      if (type === 'group_added' && user.notif_project_updates === 0) return resolve();
      if (type === 'ai_response' && user.notif_project_updates === 0) return resolve();

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

module.exports = {
  sendMemberAdded,
  sendProjectInvitation,
  sendNotificationEmail
};
