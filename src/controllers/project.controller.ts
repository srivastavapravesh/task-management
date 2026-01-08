import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { SyncService } from '../services/sync.service';

export class ProjectController {
  private syncService = new SyncService();

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Project name required' });
        return;
      }

      const project = await prisma.project.create({
        data: {
          name,
          description,
          userId: req.userId!
        }
      });

      // Trigger sync
      this.syncService.syncUserData(req.userId!).catch(console.error);

      res.status(201).json({
        message: 'Project created successfully',
        project
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projects = await prisma.project.findMany({
        where: { userId: req.userId },
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              completed: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ projects });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const project = await prisma.project.findFirst({
        where: {
          id,
          userId: req.userId
        },
        include: {
          tasks: true
        }
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({ project });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const existing = await prisma.project.findFirst({
        where: { id, userId: req.userId }
      });

      if (!existing) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const project = await prisma.project.update({
        where: { id },
        data: {
          name,
          description,
          syncStatus: 'PENDING'
        }
      });

      // Trigger sync
      this.syncService.syncUserData(req.userId!).catch(console.error);

      res.json({
        message: 'Project updated successfully',
        project
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const project = await prisma.project.findFirst({
        where: { id, userId: req.userId }
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Delete from Todoist if synced
      if (project.externalId) {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (user?.todoistToken) {
          const { TodoistService } = await import('../services/todoist.service');
          const todoist = new TodoistService(user.todoistToken);
          try {
            await todoist.deleteProject(project.externalId);
          } catch (error) {
            console.error('Failed to delete from Todoist:', error);
          }
        }
      }

      await prisma.project.delete({ where: { id } });

      res.json({ message: 'Project deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}