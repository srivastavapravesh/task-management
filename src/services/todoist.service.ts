import axios, { AxiosInstance } from 'axios';

export interface TodoistProject {
  id: string;
  name: string;
  comment_count?: number;
  order?: number;
  color?: string;
  is_shared?: boolean;
  is_favorite?: boolean;
  parent_id?: string;
  is_inbox_project?: boolean;
  is_team_inbox?: boolean;
  view_style?: string;
  url?: string;
}

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  project_id: string;
  is_completed: boolean;
  created_at: string;
  updated_at?: string;
}

export class TodoistService {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.todoist.com/rest/v2',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getProjects(): Promise<TodoistProject[]> {
    const response = await this.client.get('/projects');
    return response.data;
  }

  async createProject(name: string, description?: string): Promise<TodoistProject> {
    const response = await this.client.post('/projects', {
      name,
      ...(description && { comment_count: 0 })
    });
    return response.data;
  }

  async updateProject(id: string, name: string): Promise<TodoistProject> {
    const response = await this.client.post(`/projects/${id}`, { name });
    return response.data;
  }

  async deleteProject(id: string): Promise<void> {
    await this.client.delete(`/projects/${id}`);
  }

  async getTasks(projectId?: string): Promise<TodoistTask[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await this.client.get('/tasks', { params });
    return response.data;
  }

  async createTask(content: string, description: string, projectId?: string): Promise<TodoistTask> {
    const response = await this.client.post('/tasks', {
      content,
      description,
      ...(projectId && { project_id: projectId })
    });
    return response.data;
  }

  async updateTask(id: string, content: string, description: string): Promise<TodoistTask> {
    const response = await this.client.post(`/tasks/${id}`, {
      content,
      description
    });
    return response.data;
  }

  async completeTask(id: string): Promise<void> {
    await this.client.post(`/tasks/${id}/close`);
  }

  async reopenTask(id: string): Promise<void> {
    await this.client.post(`/tasks/${id}/reopen`);
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/tasks/${id}`);
  }
}