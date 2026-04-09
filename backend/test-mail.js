const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.fr',
  port: 587,
  secure: false, // true pour 465, false pour les autres ports (STARTTLS)
  auth: {
    user: 'contact@flavien-gherardi.fr',
    pass: 'Ionos74380!'
  },
  debug: true,
  logger: true
});

async function testMail() {
  const mailOptions = {
    from: '"Galineo Test" <contact@flavien-gherardi.fr>',
    to: 'capelleclem@gmail.com',
    subject: 'Test Galineo SMTP',
    text: 'Ceci est un test d\'envoi d\'email depuis Galineo.'
  };

  try {
    console.log('Tentative d\'envoi de mail à capelleclem@gmail.com...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé avec succès ! ID:', info.messageId);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du mail:', error);
  }
}

testMail();
