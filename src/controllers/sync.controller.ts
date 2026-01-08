import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { SyncService } from '../services/sync.service';
import { prisma } from '../config/database';

export class SyncController {
  private syncService = new SyncService();

  async triggerSync(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.syncService.syncUserData(req.userId!);
      res.json({ message: 'Sync completed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async retryFailed(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.syncService.retryFailedSyncs(req.userId!);
      res.json({ message: 'Retry initiated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSyncStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const [projects, tasks, logs] = await Promise.all([
        prisma.project.findMany({
          where: { userId: req.userId },
          select: {
            id: true,
            name: true,
            syncStatus: true,
            lastSyncedAt: true
          }
        }),
        prisma.task.findMany({
          where: { userId: req.userId },
          select: {
            id: true,
            title: true,
            syncStatus: true,
            lastSyncedAt: true
          }
        }),
        prisma.syncLog.findMany({
          where: { userId: req.userId },
          orderBy: { createdAt: 'desc' },
          take: 20
        })
      ]);

      const summary = {
        projects: {
          total: projects.length,
          synced: projects.filter((p: any) => p.syncStatus === 'SYNCED').length,
          pending: projects.filter((p: any) => p.syncStatus === 'PENDING').length,
          failed: projects.filter((p: any) => p.syncStatus === 'FAILED').length
        },
        tasks: {
          total: tasks.length,
          synced: tasks.filter((t: any) => t.syncStatus === 'SYNCED').length,
          pending: tasks.filter((t: any) => t.syncStatus === 'PENDING').length,
          failed: tasks.filter((t: any) => t.syncStatus === 'FAILED').length
        }
      };

      res.json({
        summary,
        projects,
        tasks,
        recentLogs: logs
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}