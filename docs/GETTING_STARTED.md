# Getting Started with cop1

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- (Optional) LMStudio or Ollama for local LLMs

## Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Running the MVP

### 1. Start the API

```bash
# In terminal 1
cd packages/api
pnpm dev
```

The API will start on http://localhost:3000

### 2. Start the Web Interface

```bash
# In terminal 2
cd packages/web
pnpm dev
```

The web interface will be available at http://localhost:5173

### 3. Test the API

```bash
# Health check
curl http://localhost:3000/health

# List projects (should be empty initially)
curl http://localhost:3000/api/projects
```

## Creating Your First Agent

### Using Cloud LLM (Claude)

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Reviewer Bot",
    "type": "code_reviewer",
    "capabilities": {
      "canReviewCode": true,
      "canWriteCode": false,
      "canRunTests": false,
      "canManageTasks": false,
      "canAnalyzeArchitecture": true
    },
    "llmConfig": {
      "provider": "cloud",
      "modelName": "claude-sonnet-4.5",
      "apiKey": "YOUR_CLAUDE_API_KEY",
      "temperature": 0.7,
      "maxTokens": 4096
    },
    "rulesModules": ["agent-general", "code-reviewer"]
  }'
```

### Using Local LLM (LMStudio)

1. Start LMStudio and load a model
2. Enable the local server (usually on http://localhost:1234)
3. Create an agent:

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Developer Bot",
    "type": "developer",
    "capabilities": {
      "canReviewCode": true,
      "canWriteCode": true,
      "canRunTests": true,
      "canManageTasks": false,
      "canAnalyzeArchitecture": false
    },
    "llmConfig": {
      "provider": "local",
      "modelName": "llama-3-8b",
      "endpoint": "http://localhost:1234/v1",
      "temperature": 0.7,
      "maxTokens": 2048
    },
    "rulesModules": ["agent-general", "developer"]
  }'
```

## Creating a Project

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Awesome Project",
    "description": "Building something cool with AI agents",
    "metadata": {
      "repository": "https://github.com/user/repo",
      "technologies": ["typescript", "react", "nodejs"]
    }
  }'
```

## Creating and Executing a Task

```bash
# 1. Create a task
TASK_ID=$(curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review authentication module",
    "description": "Review the authentication code for security issues and best practices",
    "projectId": "PROJECT_ID_HERE",
    "priority": "high"
  }' | jq -r '.id')

# 2. Assign to an agent
curl -X POST http://localhost:3000/api/tasks/$TASK_ID/assign \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "AGENT_ID_HERE"
  }'

# 3. Execute the task
curl -X POST http://localhost:3000/api/tasks/$TASK_ID/execute
```

## Architecture Overview

cop1 uses hexagonal architecture:

```
Domain (Business Logic)
  ├── Entities (Task, Agent, Project)
  ├── Use Cases (CreateTask, ExecuteTask, etc.)
  └── Ports (Interfaces)

Infrastructure (Technical Adapters)
  ├── SQLite Repositories
  ├── Rules Provider
  └── LLM Provider

Application (API & Web)
  ├── REST API (Fastify)
  └── Web Interface (React)
```

## LLM Gateway

The LLM Gateway supports:

1. **Local LLMs**: LMStudio, Ollama (OpenAI-compatible)
2. **Cloud LLMs**: Claude (Anthropic API), OpenAI (coming soon)
3. **Hybrid**: Mix local and cloud agents

Example hybrid setup:
- Project Manager: Claude Sonnet 4.5 (cloud)
- Code Reviewer: Claude Sonnet 4.5 (cloud)
- Developer: Llama 3 (local)
- QA Tester: Llama 3 (local)

## Rules Engine

Agents follow behavior rules defined in YAML:

- `agent-general`: Basic rules for all agents
- `code-reviewer`: Specific rules for code review
- `developer`: Rules for writing code

Create custom rules in `.cop1/rulesets/` (coming soon).

## Next Steps

1. Explore the web interface
2. Create agents with different LLM providers
3. Set up tasks and watch agents work
4. Customize agent rules
5. Build your own workflows

## Troubleshooting

### API doesn't start
- Check if port 3000 is available
- Verify database path permissions

### Local LLM not working
- Ensure LMStudio/Ollama is running
- Check endpoint URL (default: http://localhost:1234/v1)
- Verify model is loaded

### Agent execution fails
- Check LLM provider is available
- Verify API keys for cloud providers
- Check agent rules modules exist

## Documentation

- [Architecture](./architecture.md)
- [LLM Gateway](./llm-gateway.md)
- [Rules Engine](./rules-engine.md)
