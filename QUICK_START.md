# cop1 - Quick Start 🚀

## Installation rapide

```bash
cd /Users/elzinko/git/bacasable/cop1

# 1. Installer les dépendances
pnpm install

# 2. Builder tous les packages
pnpm build

# 3. Compiler better-sqlite3 (module natif)
cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3
npx node-gyp rebuild
cd -
```

## Démarrage

### Option 1: Tout démarrer ensemble (recommandé)

```bash
pnpm dev
```

Cela démarre en parallèle :
- **API** sur http://localhost:3000
- **Web** sur http://localhost:5173

### Option 2: Démarrer séparément

```bash
# Terminal 1 - API
pnpm dev:api

# Terminal 2 - Web
pnpm dev:web
```

## Test rapide de l'API

```bash
# Health check
curl http://localhost:3000/health

# Créer un projet
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Premier Projet",
    "description": "Test de cop1"
  }'

# Lister les projets
curl http://localhost:3000/api/projects

# Créer un agent (exemple cloud avec Claude)
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent Test",
    "type": "developer",
    "capabilities": {
      "canReviewCode": true,
      "canWriteCode": true,
      "canRunTests": false,
      "canManageTasks": false,
      "canAnalyzeArchitecture": false
    },
    "llmConfig": {
      "provider": "cloud",
      "modelName": "claude-sonnet-4.5",
      "apiKey": "YOUR_API_KEY_HERE",
      "temperature": 0.7,
      "maxTokens": 4096
    },
    "rulesModules": ["agent-general", "developer"]
  }'
```

## Accès à l'interface web

Ouvre http://localhost:5173 dans ton navigateur pour voir :
- Les projets
- Les agents
- Les tâches

## Scripts disponibles

```bash
pnpm dev          # Démarre API + Web en parallèle
pnpm dev:api      # API seule
pnpm dev:web      # Web seul
pnpm build        # Build tous les packages
pnpm typecheck    # Vérification TypeScript
pnpm clean        # Nettoie tout
```

## Structure

```
cop1/
├── packages/
│   ├── domain/          # 🧠 Business logic
│   ├── rules-engine/    # 📜 Règles YAML
│   ├── llm-gateway/     # 🤖 LLM (local/cloud)
│   ├── infrastructure/  # ⚙️ DB + Adapters
│   ├── api/             # 🌐 REST API
│   └── web/             # 🖥️ Interface React
```

## Configuration LLM

### Local (LMStudio/Ollama)

1. Démarre LMStudio ou Ollama
2. Charge un modèle
3. Active le serveur local (généralement http://localhost:1234)
4. Crée un agent avec `"provider": "local"` et `"endpoint": "http://localhost:1234/v1"`

### Cloud (Claude)

1. Obtiens une clé API Anthropic
2. Crée un agent avec `"provider": "cloud"` et ton API key

### Hybrid

Tu peux mixer ! Par exemple :
- PM Agent → Claude (cloud)
- Dev Agent → Llama 3 (local)

## Base de données

La base de données SQLite est créée automatiquement dans `cop1.db` (racine du projet).

Pour la réinitialiser : `rm cop1.db`

## Documentation complète

- [README.md](./README.md) - Vue d'ensemble
- [GETTING_STARTED.md](./docs/GETTING_STARTED.md) - Guide détaillé
- [MVP_STATUS.md](./MVP_STATUS.md) - État du MVP

## Besoin d'aide ?

Consulte la doc complète ou ouvre une issue sur GitHub.
