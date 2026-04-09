const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 465,
  secure: true,
  auth: {
    user: 'contact@flavien-gherardi.fr',
    pass: 'Ionos74380!'
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
  debug: true,
  logger: true,
  tls: { rejectUnauthorized: false }
});

async function testMail() {
  console.log('🔍 Vérification connexion SMTP...');
  try {
    await transporter.verify();
    console.log('✅ Connexion SMTP OK');
  } catch (err) {
    console.error('❌ Échec connexion SMTP:', err.message);
    process.exit(1);
  }

  console.log('📧 Envoi email de test...');
  try {
    const info = await transporter.sendMail({
      from: '"Galineo" <contact@flavien-gherardi.fr>',
      to: 'contact@flavien-gherardi.fr',
      subject: '[TEST] Email Galineo — SMTP IONOS port 465',
      html: `
        <div style="font-family: sans-serif; padding: 24px;">
          <h2 style="color: #f97316;">Test email Galineo ✅</h2>
          <p>Si vous recevez cet email, la configuration SMTP IONOS fonctionne correctement.</p>
          <p style="color: #666; font-size: 12px;">Serveur: smtp.ionos.fr | Port: 465 | SSL</p>
        </div>
      `
    });
    console.log('✅ Email envoyé ! Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ Échec envoi email:', err.message);
    console.error(err);
    process.exit(1);
  }
}

testMail();
