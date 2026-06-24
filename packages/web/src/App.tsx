import { useEffect, useState } from 'react';
import { AuthPanel } from './AuthPanel.js';
import { OrchestratorRunView } from './OrchestratorRunView.js';
import { RuleProposalsView } from './RuleProposalsView.js';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  currentTaskId: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedAgentId: string | null;
  createdAt: string;
}

type Tab = 'projects' | 'agents' | 'tasks' | 'rules' | 'connexion' | 'run';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (activeTab === 'rules' || activeTab === 'connexion' || activeTab === 'run') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint =
        activeTab === 'projects'
          ? '/api/projects'
          : activeTab === 'agents'
            ? '/api/agents'
            : '/api/tasks';

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${activeTab}`);
      }

      const data = await response.json();

      if (activeTab === 'projects') {
        setProjects(data);
      } else if (activeTab === 'agents') {
        setAgents(data);
      } else {
        setTasks(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const renderProjects = () => (
    <div className="grid">
      {projects.map((project) => (
        <div key={project.id} className="card">
          <div className="card-header">
            <h3 className="card-title">{project.name}</h3>
            <span className={`badge ${project.status}`}>{project.status}</span>
          </div>
          <div className="card-content">
            <p>{project.description}</p>
          </div>
          <div className="card-footer">
            <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
      {projects.length === 0 && <p className="loading">No projects yet</p>}
    </div>
  );

  const renderAgents = () => (
    <div className="grid">
      {agents.map((agent) => (
        <div key={agent.id} className="card">
          <div className="card-header">
            <h3 className="card-title">{agent.name}</h3>
            <span className={`badge ${agent.status}`}>{agent.status}</span>
          </div>
          <div className="card-content">
            <p>Type: {agent.type}</p>
            {agent.currentTaskId && <p>Working on task: {agent.currentTaskId}</p>}
          </div>
        </div>
      ))}
      {agents.length === 0 && <p className="loading">No agents yet</p>}
    </div>
  );

  const renderTasks = () => (
    <div className="grid">
      {tasks.map((task) => (
        <div key={task.id} className="card">
          <div className="card-header">
            <h3 className="card-title">{task.title}</h3>
            <span className={`badge ${task.status}`}>{task.status}</span>
          </div>
          <div className="card-content">
            <p>{task.description}</p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Priority:</strong> {task.priority}
            </p>
          </div>
          <div className="card-footer">
            <span>{task.assignedAgentId ? 'Assigned' : 'Unassigned'}</span>
            <span>{new Date(task.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
      {tasks.length === 0 && <p className="loading">No tasks yet</p>}
    </div>
  );

  return (
    <div className="app">
      <header className="header">
        <h1>👮‍♂️ cop1</h1>
        <p>AI Agents Team - Autonomous Task Execution</p>
      </header>

      <div className="container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
          <button
            className={`tab ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            Agents
          </button>
          <button
            className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button
            className={`tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            Rules
          </button>
          <button
            className={`tab ${activeTab === 'connexion' ? 'active' : ''}`}
            onClick={() => setActiveTab('connexion')}
          >
            Connexion
          </button>
          <button
            className={`tab ${activeTab === 'run' ? 'active' : ''}`}
            onClick={() => setActiveTab('run')}
          >
            Run
          </button>
        </div>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {activeTab === 'projects' && renderProjects()}
            {activeTab === 'agents' && renderAgents()}
            {activeTab === 'tasks' && renderTasks()}
            {activeTab === 'rules' && <RuleProposalsView />}
            {activeTab === 'connexion' && <AuthPanel />}
            {activeTab === 'run' && <OrchestratorRunView />}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
