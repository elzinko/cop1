# cop1 👮‍♂️

**Autonomous AI agents team working on your backlog while you sleep (or work on something else)**

## 🎯 Vision

cop1 is your AI copilot team that:
- Works autonomously on your backlog
- Can run locally (LLM on your machine) or hybrid (mix local + cloud)
- Uses intelligent resource management (no RAM flooding)
- Each agent has configurable behavior rules
- Separates business decisions from technical implementation

## 🏗️ Architecture

**Hexagonal + Monorepo**

```
cop1/
├── packages/
│   ├── domain/          # 🧠 Pure business logic (decisions, workflows)
│   ├── rules-engine/    # 📜 Rules management (YAML-based, shared)
│   ├── llm-gateway/     # 🤖 LLM abstraction (local/cloud/hybrid)
│   ├── infrastructure/  # ⚙️ Technical adapters (DB, HTTP, Docker)
│   ├── api/             # 🌐 REST API
│   └── web/             # 🖥️ React interface
└── apps/
    └── cli/             # 💻 CLI tool
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start API + Web
pnpm dev:all

# Or separately
pnpm dev        # API only
pnpm dev:web    # Web only
```

## 🤖 LLM Modes

cop1 supports 3 modes:
1. **Local**: LLMs run on your machine (LMStudio/Ollama)
2. **Cloud**: Use Claude/GPT APIs
3. **Hybrid**: Mix both (e.g., PM agent on Claude Sonnet 4.5, others local)

## 📜 Rules Engine

Each agent can have custom behavior rules (inspired by [iamthelaw](https://github.com/elzinko/iamthelaw)):

```yaml
# agents/code-reviewer/rules.yaml
name: code-reviewer
rules:
  - id: security-first
    level: MUST
    content: Always check for security vulnerabilities
  - id: performance
    level: SHOULD
    content: Suggest performance improvements when obvious
```

## 🧩 Packages

| Package | Description |
|---------|-------------|
| `@cop1/domain` | Business logic, entities, use-cases |
| `@cop1/rules-engine` | YAML-based rules management |
| `@cop1/llm-gateway` | LLM provider abstraction |
| `@cop1/infrastructure` | DB, HTTP, Docker adapters |
| `@cop1/api` | REST API |
| `@cop1/web` | React web interface |

## 📖 Documentation

- [Architecture](./docs/architecture.md) - Hexagonal architecture details
- [LLM Gateway](./docs/llm-gateway.md) - Local/cloud/hybrid setup
- [Rules Engine](./docs/rules-engine.md) - How to define agent rules

## 🛠️ Development

```bash
# Type checking
pnpm typecheck

# Build all packages
pnpm build

# Clean
pnpm clean
```

## 📝 License

MIT © elzinko
