const nodemailer = require('nodemailer');

const credentials = {
  user: 'contact@flavien-gherardi.fr',
  pass: 'Ionos74380!'
};

const configs = [
  { name: 'IONOS COM - Port 465 (SSL)', host: 'smtp.ionos.com', port: 465, secure: true },
  { name: 'IONOS COM - Port 587 (STARTTLS)', host: 'smtp.ionos.com', port: 587, secure: false },
  { name: 'IONOS FR  - Port 465 (SSL)', host: 'smtp.ionos.fr', port: 465, secure: true },
  { name: 'IONOS FR  - Port 587 (STARTTLS)', host: 'smtp.ionos.fr', port: 587, secure: false },
];

async function runDiag() {
  console.log('🚀 Démarrage du diagnostic SMTP...\n');
  
  for (const config of configs) {
    console.log(`--- Test de : ${config.name} ---`);
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: credentials,
      connectionTimeout: 5000 // 5 secondes pour pas attendre trop longtemps
    });

    try {
      await transporter.verify();
      console.log(`✅ SUCCÈS : La configuration ${config.name} est valide !\n`);
    } catch (err) {
      console.log(`❌ ÉCHEC : ${err.message}\n`);
    }
  }
  
  console.log('🏁 Diagnostic terminé.');
}

runDiag();
