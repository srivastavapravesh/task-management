import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { SyncService } from '../services/sync.service';

export class TaskController {
  private syncService = new SyncService();

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, description, projectId } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Task title required' });
        return;
      }

      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId: req.userId }
        });
        if (!project) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }
      }

      const task = await prisma.task.create({
        data: {
          title,
          description,
          projectId,
          userId: req.userId!
        }
      });

      // Trigger sync
      this.syncService.syncUserData(req.userId!).catch(console.error);

      res.status(201).json({
        message: 'Task created successfully',
        task
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId, completed } = req.query;

      const where: any = { userId: req.userId };
      
      if (projectId) {
        where.projectId = projectId;
      }
      
      if (completed !== undefined) {
        where.completed = completed === 'true';
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ tasks });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const task = await prisma.task.findFirst({
        where: {
          id,
          userId: req.userId
        },
        include: {
          project: true
        }
      });

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({ task });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description, completed, projectId } = req.body;

      const existing = await prisma.task.findFirst({
        where: { id, userId: req.userId }
      });

      if (!existing) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId: req.userId }
        });
        if (!project) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }
      }

      const task = await prisma.task.update({
        where: { id },
        data: {
          title,
          description,
          completed,
          projectId,
          syncStatus: 'PENDING'
        }
      });

      // Trigger sync
      this.syncService.syncUserData(req.userId!).catch(console.error);

      res.json({
        message: 'Task updated successfully',
        task
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const task = await prisma.task.findFirst({
        where: { id, userId: req.userId }
      });

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      // Delete from Todoist if synced
      if (task.externalId) {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (user?.todoistToken) {
          const { TodoistService } = await import('../services/todoist.service');
          const todoist = new TodoistService(user.todoistToken);
          try {
            await todoist.deleteTask(task.externalId);
          } catch (error) {
            console.error('Failed to delete from Todoist:', error);
          }
        }
      }

      await prisma.task.delete({ where: { id } });

      res.json({ message: 'Task deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}