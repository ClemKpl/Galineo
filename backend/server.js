const express = require('express');
const cors = require('cors');

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

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Galineo API running on port ${PORT} (accessible on network)`);
});
