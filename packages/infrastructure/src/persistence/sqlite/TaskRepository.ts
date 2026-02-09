import type { Database } from 'better-sqlite3';
import {
  Task,
  TaskStatus,
  TaskPriority,
  type TaskRepository as ITaskRepository,
} from '@cop1/domain';

/**
 * SQLite implementation of TaskRepository
 * Adapter that implements the domain port
 */

interface TaskRow {
  id: string;
  title: string;
  description: string;
  project_id: string;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  result: string | null;
  error: string | null;
  metadata: string;
}

export class SQLiteTaskRepository implements ITaskRepository {
  constructor(private db: Database) {}

  private rowToEntity(row: TaskRow): Task {
    return new Task(
      row.id,
      row.title,
      row.description,
      row.project_id,
      row.status as TaskStatus,
      row.priority as TaskPriority,
      row.assigned_agent_id,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.completed_at ? new Date(row.completed_at) : null,
      row.result,
      row.error,
      JSON.parse(row.metadata),
    );
  }

  async save(task: Task): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, description, project_id, status, priority,
        assigned_agent_id, created_at, updated_at, completed_at,
        result, error, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        priority = excluded.priority,
        assigned_agent_id = excluded.assigned_agent_id,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        result = excluded.result,
        error = excluded.error,
        metadata = excluded.metadata
    `);

    stmt.run(
      task.id,
      task.title,
      task.description,
      task.projectId,
      task.status,
      task.priority,
      task.assignedAgentId,
      task.createdAt.toISOString(),
      task.updatedAt.toISOString(),
      task.completedAt?.toISOString() ?? null,
      task.result,
      task.error,
      JSON.stringify(task.metadata),
    );
  }

  async findById(id: string): Promise<Task | null> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as TaskRow | undefined;
    return row ? this.rowToEntity(row) : null;
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(projectId) as TaskRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, created_at ASC');
    const rows = stmt.all(status) as TaskRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findByAgentId(agentId: string): Promise<Task[]> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE assigned_agent_id = ?');
    const rows = stmt.all(agentId) as TaskRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findPendingTasks(projectId?: string): Promise<Task[]> {
    let query = 'SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, created_at ASC';
    const params: unknown[] = [TaskStatus.PENDING];

    if (projectId) {
      query = 'SELECT * FROM tasks WHERE status = ? AND project_id = ? ORDER BY priority DESC, created_at ASC';
      params.push(projectId);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as TaskRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findByPriority(priority: TaskPriority, projectId?: string): Promise<Task[]> {
    let query = 'SELECT * FROM tasks WHERE priority = ? ORDER BY created_at ASC';
    const params: unknown[] = [priority];

    if (projectId) {
      query = 'SELECT * FROM tasks WHERE priority = ? AND project_id = ? ORDER BY created_at ASC';
      params.push(projectId);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as TaskRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
  }

  async countByStatus(projectId: string, status: TaskStatus): Promise<number> {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = ?',
    );
    const row = stmt.get(projectId, status) as { count: number };
    return row.count;
  }
}
