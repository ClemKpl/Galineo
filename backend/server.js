const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// --- VALIDATION DES VARIABLES D'ENVIRONNEMENT CRITIQUES ---
const REQUIRED_ENV = ['JWT_SECRET', 'GEMINI_API_KEY'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(', ')}`);
  process.exit(1);
}

require('./db'); // Initialise la DB et les tables

const { authMiddleware } = require('./middleware/auth');
const { projectMemberMiddleware } = require('./middleware/projectMember');

const { router: authRoutes, passport } = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const userRoutes    = require('./routes/users');
const roleRoutes    = require('./routes/roles');
const taskRoutes    = require('./routes/tasks');
const globalTaskRoutes = require('./routes/tasks_global');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const eventRoutes = require('./routes/events');
const globalEventRoutes = require('./routes/events_global');
const aiRoutes          = require('./routes/ai');
const chatGroupRoutes   = require('./routes/chat_groups');
const billingRoutes     = require('./routes/billing');
const adminRoutes       = require('./routes/admin');
const supportRoutes     = require('./routes/support');

const app = express();

// --- LOGGING DE RÉCEPTION (DEBUG PRODUCTION) ---
app.use((req, res, next) => {
  console.log(`📡 [INBOUND] ${req.method} ${req.originalUrl}`);
  next();
});

// 1. Webhook Stripe : ISOLEMENT TOTAL (avant tout autre parseur)
// On utilise startsWith pour capturer /billing/webhook et /billing/webhook/
app.use((req, res, next) => {
  if (req.path.startsWith('/billing/webhook')) {
    console.log(`🎯 [STREAMS] Webhook détecté sur ${req.path}. Activation du parseur RAW.`);
    express.raw({ type: '*/*' })(req, res, next);
  } else {
    next();
  }
});

// 2. Middlewares globaux

// CORS restreint à l'origine frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Trop de requêtes. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use(globalLimiter);

app.use((req, res, next) => {
  // On s'assure que le parser JSON ne s'exécute JAMAIS pour le webhook
  if (!req.path.startsWith('/billing/webhook')) {
    express.json()(req, res, next);
  } else {
    next();
  }
});

app.use(passport.initialize());

app.get('/health', (req, res) => res.json({ status: 'OK', version: 'v1' }));

app.use('/auth',     authRoutes);
app.use('/projects/:projectId/tasks',    authMiddleware, projectMemberMiddleware, taskRoutes);
app.use('/tasks', globalTaskRoutes);
app.use('/projects/:projectId/messages', authMiddleware, projectMemberMiddleware, messageRoutes);
app.use('/projects/:projectId/events',   authMiddleware, projectMemberMiddleware, eventRoutes);
app.use('/projects', projectRoutes);
app.use('/users',    userRoutes);
app.use('/roles',    roleRoutes);
app.use('/notifications', notificationRoutes);
app.use('/events', globalEventRoutes);
app.use('/ai',    aiRoutes);
app.use('/chat-groups', chatGroupRoutes);
app.use('/billing', billingRoutes);
app.use('/admin', adminRoutes);
app.use('/support', supportRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Galineo API running on port ${PORT} (accessible on network)`);
});
