import express from 'express';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { authRoutes } from './routes/auth.routes';
import { projectRoutes } from './routes/project.routes';
import { taskRoutes } from './routes/task.routes';
import { syncRoutes } from './routes/sync.routes';
import { errorHandler } from './middleware/error.middleware';
import { SyncService } from './services/sync.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sync', syncRoutes);

// Error handling
app.use(errorHandler);

// Background sync every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running background sync...');
  const syncService = new SyncService();
  await syncService.syncAllUsers();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});