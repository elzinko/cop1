import type { Database } from 'better-sqlite3';
import {
  Project,
  ProjectStatus,
  type ProjectRepository as IProjectRepository,
} from '@cop1/domain';

/**
 * SQLite implementation of ProjectRepository
 */

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: string;
}

export class SQLiteProjectRepository implements IProjectRepository {
  constructor(private db: Database) {}

  private rowToEntity(row: ProjectRow): Project {
    return new Project(
      row.id,
      row.name,
      row.description,
      row.status as ProjectStatus,
      new Date(row.created_at),
      new Date(row.updated_at),
      JSON.parse(row.metadata),
    );
  }

  async save(project: Project): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, description, status, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        updated_at = excluded.updated_at,
        metadata = excluded.metadata
    `);

    stmt.run(
      project.id,
      project.name,
      project.description,
      project.status,
      project.createdAt.toISOString(),
      project.updatedAt.toISOString(),
      JSON.stringify(project.metadata),
    );
  }

  async findById(id: string): Promise<Project | null> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as ProjectRow | undefined;
    return row ? this.rowToEntity(row) : null;
  }

  async findAll(): Promise<Project[]> {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    const rows = stmt.all() as ProjectRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findByStatus(status: ProjectStatus): Promise<Project[]> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE status = ?');
    const rows = stmt.all(status) as ProjectRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findActiveProjects(): Promise<Project[]> {
    return this.findByStatus(ProjectStatus.ACTIVE);
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }
}
