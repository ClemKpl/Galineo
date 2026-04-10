const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./db'); // Initialise la DB et les tables

const authRoutes    = require('./routes/auth');
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
app.use(cors());
app.use((req, res, next) => {
  // On s'assure que le parser JSON ne s'exécute JAMAIS pour le webhook
  if (!req.path.startsWith('/billing/webhook')) {
    express.json()(req, res, next);
  } else {
    next();
  }
});

app.get('/health', (req, res) => res.json({ status: 'OK', version: 'v1' }));

app.use('/auth',     authRoutes);
app.use('/projects/:projectId/tasks', taskRoutes);
app.use('/tasks', globalTaskRoutes);
app.use('/projects/:projectId/messages', messageRoutes);
app.use('/projects/:projectId/events', eventRoutes);
app.use('/projects', projectRoutes);
app.use('/users',    userRoutes);
app.use('/roles',    roleRoutes);
app.use('/notifications', notificationRoutes);
app.use('/events', globalEventRoutes);
app.use('/ai',    aiRoutes);
app.use('/chat-groups', chatGroupRoutes);
app.use('/billing', billingRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Galineo API running on port ${PORT} (accessible on network)`);
});
