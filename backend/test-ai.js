const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY manquante dans .env");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    console.log("--- Liste des modèles disponibles ---");
    // Utilisation de fetch car listModels peut bugger sur certaines versions du SDK
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    
    if (data.models) {
      data.models.forEach(m => {
        console.log(`- ${m.name} (Supporte: ${m.supportedGenerationMethods.join(', ')})`);
      });
    } else {
      console.log("Aucun modèle trouvé ou erreur:", data);
    }
  } catch (err) {
    console.error("❌ Erreur lors du listing:", err.message);
  }
}

listModels();
