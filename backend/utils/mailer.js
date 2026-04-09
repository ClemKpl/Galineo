const nodemailer = require('nodemailer');

// Configuration SMTP Ionos (Port 465 SSL) avec debug actif pour Render
const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 465,
  secure: true, // true pour 465 (SSL)
  auth: {
    user: 'contact@flavien-gherardi.fr',
    pass: 'Ionos74380!'
  },
  connectionTimeout: 20000, 
  greetingTimeout: 20000,
  socketTimeout: 20000,
  debug: true, // Affiche les logs de protocole détaillés
  logger: true, // Loggue l'activité dans la console
  tls: {
    rejectUnauthorized: false
  }
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send an email when a user is directly added to a project (existing user)
 */
async function sendMemberAdded({ email, projectName, inviterName, projectId }) {
  const projectUrl = `${FRONTEND_URL}/projects/${projectId}`;
  
  const mailOptions = {
    from: '"Galineo" <contact@flavien-gherardi.fr>',
    to: email,
    subject: `Vous avez été ajouté au projet : ${projectName}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
        <h2>Bonjour,</h2>
        <p><strong>${inviterName}</strong> vous a ajouté au projet <strong>${projectName}</strong> sur Galineo.</p>
        <p>Vous pouvez maintenant accéder au projet et collaborer avec l'équipe.</p>
        <div style="margin-top: 20px;">
          <a href="${projectUrl}" style="background-color: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accéder au projet</a>
        </div>
        <p style="margin-top: 30px; font-size: 0.8em; color: #666;">Si le bouton ne fonctionne pas, copiez ce lien : ${projectUrl}</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Send an email invitation to a new user (doesn't have an account yet)
 */
async function sendProjectInvitation({ email, projectName, inviterName, token }) {
  const joinUrl = `${FRONTEND_URL}/register?invite=${token}`;
  
  const mailOptions = {
    from: '"Galineo" <contact@flavien-gherardi.fr>',
    to: email,
    subject: `Invitation à rejoindre le projet : ${projectName}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
        <h2>Bonjour,</h2>
        <p><strong>${inviterName}</strong> vous invite à collaborer sur le projet <strong>${projectName}</strong> via Galineo.</p>
        <p>Comme vous n'avez pas encore de compte, veuillez vous inscrire en utilisant le lien ci-dessous pour accéder au projet :</p>
        <div style="margin-top: 20px;">
          <a href="${joinUrl}" style="background-color: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">Créer mon compte et rejoindre</a>
        </div>
        <p style="margin-top: 30px; font-size: 0.8em; color: #666;">Ce lien d'invitation est personnel. Si le bouton ne fonctionne pas, copiez ce lien : ${joinUrl}</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendMemberAdded,
  sendProjectInvitation
};
