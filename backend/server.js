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

const app = express();

// 1. Webhook Stripe : traitement RAW prioritaire (avant CORS et JSON)
app.use((req, res, next) => {
  if (req.originalUrl === '/billing/webhook') {
    express.raw({ type: '*/*' })(req, res, next);
  } else {
    next();
  }
});

// 2. Middlewares globaux
app.use(cors());
app.use((req, res, next) => {
  if (req.originalUrl !== '/billing/webhook') {
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Galineo API running on port ${PORT} (accessible on network)`);
});
