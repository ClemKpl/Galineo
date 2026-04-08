const express = require('express');
const cors = require('cors');

require('./db'); // Initialise la DB et les tables

const authRoutes    = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const userRoutes    = require('./routes/users');
const roleRoutes    = require('./routes/roles');
const taskRoutes    = require('./routes/tasks');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'OK', version: 'v1' }));

app.use('/auth',     authRoutes);
app.use('/projects/:projectId/tasks', taskRoutes);
app.use('/projects/:projectId/messages', messageRoutes);
app.use('/projects', projectRoutes);
app.use('/users',    userRoutes);
app.use('/roles',    roleRoutes);
app.use('/notifications', notificationRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Galineo API running on port ${PORT}`);
});