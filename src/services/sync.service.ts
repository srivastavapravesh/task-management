import { prisma } from '../config/database';
import { TodoistService } from './todoist.service';

export class SyncService {
  async syncAllUsers(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { todoistToken: { not: null } }
    });

    for (const user of users) {
      try {
        await this.syncUserData(user.id);
      } catch (error) {
        console.error(`Sync failed for user ${user.id}:`, error);
      }
    }
  }

  async syncUserData(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user?.todoistToken) {
      throw new Error('User not connected to Todoist');
    }

    const todoist = new TodoistService(user.todoistToken);

    await this.syncProjects(userId, todoist);
    await this.syncTasks(userId, todoist);
  }

  private async syncProjects(userId: string, todoist: TodoistService): Promise<void> {
    // Push local projects to Todoist
    const localProjects = await prisma.project.findMany({
      where: { 
        userId,
        OR: [
          { syncStatus: 'PENDING' },
          { externalId: null }
        ]
      }
    });

    for (const project of localProjects) {
      try {
        if (!project.externalId) {
          const external = await todoist.createProject(project.name, project.description || undefined);
          await prisma.project.update({
            where: { id: project.id },
            data: {
              externalId: external.id,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date()
            }
          });
          await this.logSync(userId, 'project', project.id, 'create', 'success');
        }
      } catch (error: any) {
        await prisma.project.update({
          where: { id: project.id },
          data: { syncStatus: 'FAILED' }
        });
        await this.logSync(userId, 'project', project.id, 'create', 'failed', error.message);
      }
    }

    // Pull projects from Todoist
    try {
      const externalProjects = await todoist.getProjects();
      
      for (const extProject of externalProjects) {
        const existing = await prisma.project.findUnique({
          where: { externalId: extProject.id }
        });

        if (!existing) {
          await prisma.project.create({
            data: {
              name: extProject.name,
              userId,
              externalId: extProject.id,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date()
            }
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to pull projects:', error.message);
    }
  }

  private async syncTasks(userId: string, todoist: TodoistService): Promise<void> {
    // Push local tasks to Todoist
    const localTasks = await prisma.task.findMany({
      where: { 
        userId,
        OR: [
          { syncStatus: 'PENDING' },
          { externalId: null }
        ]
      },
      include: { project: true }
    });

    for (const task of localTasks) {
      try {
        if (!task.externalId) {
          const external = await todoist.createTask(
            task.title,
            task.description || '',
            task.project?.externalId || undefined
          );
          await prisma.task.update({
            where: { id: task.id },
            data: {
              externalId: external.id,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date()
            }
          });
          await this.logSync(userId, 'task', task.id, 'create', 'success');
        } else {
          // Update if modified locally
          if (task.updatedAt > (task.lastSyncedAt || new Date(0))) {
            await todoist.updateTask(task.externalId, task.title, task.description || '');
            
            if (task.completed) {
              await todoist.completeTask(task.externalId);
            }
            
            await prisma.task.update({
              where: { id: task.id },
              data: {
                syncStatus: 'SYNCED',
                lastSyncedAt: new Date()
              }
            });
            await this.logSync(userId, 'task', task.id, 'update', 'success');
          }
        }
      } catch (error: any) {
        await prisma.task.update({
          where: { id: task.id },
          data: { syncStatus: 'FAILED' }
        });
        await this.logSync(userId, 'task', task.id, 'sync', 'failed', error.message);
      }
    }

    // Pull tasks from Todoist
    try {
      const externalTasks = await todoist.getTasks();
      
      for (const extTask of externalTasks) {
        const existing = await prisma.task.findUnique({
          where: { externalId: extTask.id }
        });

        const project = await prisma.project.findUnique({
          where: { externalId: extTask.project_id }
        });

        if (!existing) {
          await prisma.task.create({
            data: {
              title: extTask.content,
              description: extTask.description,
              completed: extTask.is_completed,
              userId,
              projectId: project?.id,
              externalId: extTask.id,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date()
            }
          });
        } else {
          // Conflict resolution: external takes precedence if both updated
          const extUpdated = new Date(extTask.updated_at || extTask.created_at);
          if (extUpdated > (existing.lastSyncedAt || new Date(0))) {
            await prisma.task.update({
              where: { id: existing.id },
              data: {
                title: extTask.content,
                description: extTask.description,
                completed: extTask.is_completed,
                projectId: project?.id,
                syncStatus: 'SYNCED',
                lastSyncedAt: new Date()
              }
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to pull tasks:', error.message);
    }
  }

  private async logSync(userId: string, entityType: string, entityId: string, action: string, status: string, error?: string): Promise<void> {
    await prisma.syncLog.create({
      data: {
        userId,
        entityType,
        entityId,
        action,
        status,
        error
      }
    });
  }

  async retryFailedSyncs(userId: string): Promise<void> {
    await prisma.project.updateMany({
      where: { userId, syncStatus: 'FAILED' },
      data: { syncStatus: 'PENDING' }
    });

    await prisma.task.updateMany({
      where: { userId, syncStatus: 'FAILED' },
      data: { syncStatus: 'PENDING' }
    });

    await this.syncUserData(userId);
  }
}