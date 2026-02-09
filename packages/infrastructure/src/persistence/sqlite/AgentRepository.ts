import type { Database } from 'better-sqlite3';
import {
  Agent,
  AgentStatus,
  AgentType,
  type AgentRepository as IAgentRepository,
} from '@cop1/domain';

/**
 * SQLite implementation of AgentRepository
 */

interface AgentRow {
  id: string;
  name: string;
  type: string;
  status: string;
  capabilities: string;
  llm_config: string;
  rules_modules: string;
  current_task_id: string | null;
  created_at: string;
  last_active_at: string;
}

export class SQLiteAgentRepository implements IAgentRepository {
  constructor(private db: Database) {}

  private rowToEntity(row: AgentRow): Agent {
    return new Agent(
      row.id,
      row.name,
      row.type as AgentType,
      row.status as AgentStatus,
      JSON.parse(row.capabilities),
      JSON.parse(row.llm_config),
      JSON.parse(row.rules_modules),
      row.current_task_id,
      new Date(row.created_at),
      new Date(row.last_active_at),
    );
  }

  async save(agent: Agent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO agents (
        id, name, type, status, capabilities, llm_config,
        rules_modules, current_task_id, created_at, last_active_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        status = excluded.status,
        capabilities = excluded.capabilities,
        llm_config = excluded.llm_config,
        rules_modules = excluded.rules_modules,
        current_task_id = excluded.current_task_id,
        last_active_at = excluded.last_active_at
    `);

    stmt.run(
      agent.id,
      agent.name,
      agent.type,
      agent.status,
      JSON.stringify(agent.capabilities),
      JSON.stringify(agent.llmConfig),
      JSON.stringify(agent.rulesModules),
      agent.currentTaskId,
      agent.createdAt.toISOString(),
      agent.lastActiveAt.toISOString(),
    );
  }

  async findById(id: string): Promise<Agent | null> {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(id) as AgentRow | undefined;
    return row ? this.rowToEntity(row) : null;
  }

  async findAll(): Promise<Agent[]> {
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY created_at ASC');
    const rows = stmt.all() as AgentRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findByStatus(status: AgentStatus): Promise<Agent[]> {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE status = ?');
    const rows = stmt.all(status) as AgentRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findByType(type: AgentType): Promise<Agent[]> {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE type = ?');
    const rows = stmt.all(type) as AgentRow[];
    return rows.map((row) => this.rowToEntity(row));
  }

  async findIdleAgents(): Promise<Agent[]> {
    return this.findByStatus(AgentStatus.IDLE);
  }

  async findLocalLLMAgents(): Promise<Agent[]> {
    const allAgents = await this.findAll();
    return allAgents.filter((agent) => agent.isUsingLocalLLM());
  }

  async findCloudLLMAgents(): Promise<Agent[]> {
    const allAgents = await this.findAll();
    return allAgents.filter((agent) => agent.isUsingCloudLLM());
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM agents WHERE id = ?');
    stmt.run(id);
  }
}
