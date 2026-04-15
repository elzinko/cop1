# cop1 - Next Sprint Planning

## 🎯 Sprint Goal
**Rendre cop1 utilisable au quotidien avec une vraie UI de backlog et un mode autonome prototype**

## 📋 Sprint Backlog (Priorié)

### 🔴 P0 - Critical (À faire en premier)

#### 1. Backlog Management UI
**Estimation:** 1-2 jours | **Agent:** Frontend Developer + UI/UX

**Tasks:**
- [ ] Créer composant `TaskBoard.tsx`
  - Vue liste avec filtres (status, priority)
  - Boutons CRUD (Create, Edit, Delete)
  - Indicateurs visuels (priority colors, status badges)

- [ ] Créer composant `TaskForm.tsx`
  - Modal pour créer/éditer une tâche
  - Champs: title, description, priority, metadata
  - Validation

- [ ] Créer composant `ProjectSelector.tsx`
  - Dropdown pour choisir le projet actif
  - Afficher stats du projet (tasks count)

- [ ] API hooks pour React
  - `useProjects()`, `useTasks()`, `useAgents()`
  - `useCreateTask()`, `useUpdateTask()`, `useDeleteTask()`

**Acceptance Criteria:**
- ✅ Je peux créer une tâche depuis l'UI
- ✅ Je peux éditer une tâche existante
- ✅ Je peux supprimer une tâche
- ✅ Les changements sont instantanés (optimistic updates)

---

#### 2. Autonomous Mode - Prototype
**Estimation:** 2-3 jours | **Agent:** Backend Developer + Architect

**Tasks:**
- [ ] Créer composant `AutonomousMode.tsx`
  - Toggle ON/OFF du mode autonome
  - Sélection des tâches à traiter
  - Configuration des safety checks
  - Affichage du statut (agents actifs, tâches en cours)

- [ ] Backend: Autonomous worker
  - Queue processor (simple loop pour commencer)
  - Prend les tâches pending par priorité
  - Assigne automatiquement aux agents idle
  - Exécute et gère les erreurs

- [ ] Safety checks basiques
  - Vérifier que le projet a des tests
  - Limiter le nombre de tentatives (max 3)
  - Ne pas toucher aux fichiers critiques (sans liste)

- [ ] Use case `StartAutonomousMode`
  - Activer le mode
  - Configurer les règles
  - Démarrer le worker

**Acceptance Criteria:**
- ✅ Je peux activer le mode autonome depuis l'UI
- ✅ Les agents prennent automatiquement les tâches pending
- ✅ Je reçois des notifications quand une tâche est complétée
- ✅ Les erreurs sont logguées et ne crashent pas le système

---

### 🟡 P1 - High (Si temps restant)

#### 3. Create Agent from UI
**Estimation:** 1 jour | **Agent:** Frontend Developer

**Tasks:**
- [ ] Composant `AgentForm.tsx`
  - Formulaire pour créer un agent
  - Choix du type, capabilities
  - Configuration LLM (local vs cloud)
  - Sélection des rules modules

- [ ] Templates d'agents prédéfinis
  - Code Reviewer preset
  - Developer preset
  - QA Tester preset

**Acceptance Criteria:**
- ✅ Je peux créer un agent en quelques clics
- ✅ Les templates facilitent la création
- ✅ La validation empêche les erreurs

---

#### 4. Task Dependencies (Blockers)
**Estimation:** 1 jour | **Agent:** Backend + Frontend

**Tasks:**
- [ ] Backend: Ajouter `blockedBy` field à Task
- [ ] API endpoint pour gérer les blockers
- [ ] UI pour ajouter/retirer des blockers
- [ ] Logique: ne pas assigner si blocked

**Acceptance Criteria:**
- ✅ Une tâche peut être bloquée par une autre
- ✅ Les tâches bloquées ne sont pas assignées
- ✅ Quand le blocker est résolu, la tâche devient available

---

## 🛠️ Technical Decisions

### Architecture
- Utiliser React Query pour state management (au lieu de Redux)
- WebSockets pour live updates (Phase 2)
- Garder SQLite pour l'instant (PostgreSQL plus tard)

### UI Components
- Utiliser Headless UI pour les modals
- Tailwind CSS pour le styling (déjà en place)
- Lucide React pour les icônes

### Autonomous Mode Implementation
**Option A: Simple Loop (Choisie pour prototype)**
```typescript
async function autonomousWorker() {
  while (autonomousModeEnabled) {
    const pendingTasks = await findPendingTasks();
    const idleAgents = await findIdleAgents();

    for (const task of pendingTasks) {
      const agent = findBestAgent(task, idleAgents);
      if (agent) {
        await assignAndExecute(task, agent);
      }
    }

    await sleep(5000); // Check every 5 seconds
  }
}
```

**Option B: Queue System (Phase 2)**
- BullMQ avec Redis
- Job retries, priorités
- Meilleure scalabilité

---

## 📊 Success Metrics

### Sprint Success
- ✅ Backlog UI complète et fonctionnelle
- ✅ Mode autonome prototype qui fonctionne
- ✅ Au moins 2 agents créés et testés
- ✅ 3 tâches complétées en mode autonome

### User Experience
- Temps pour créer une tâche: < 30 secondes
- Temps pour activer le mode autonome: < 10 secondes
- Feedback visuel instantané (< 100ms)

---

## 🧪 Testing Plan

### Manual Testing
1. Créer un projet
2. Créer 5 tâches avec différentes priorités
3. Créer 2 agents (1 local, 1 cloud si API key dispo)
4. Activer le mode autonome
5. Observer pendant 10 minutes
6. Vérifier les résultats

### Automated Testing (Phase 2)
- Unit tests pour use-cases
- Integration tests pour API
- E2E tests avec Playwright

---

## 🚀 Déploiement

### Localhost (MVP actuel)
```bash
pnpm dev
```

### Docker (Phase 2)
```bash
docker-compose up
```

### Cloud (Phase 3)
- Fly.io ou Render pour l'API
- Vercel pour le web
- Neon ou Supabase pour PostgreSQL

---

## 🐛 Known Issues à Fixer

1. ~~better-sqlite3 build issues~~ ✅ Fixed
2. ~~Type mismatches entre rules-engine et domain~~ ✅ Fixed
3. Web interface read-only (fixing now)
4. No real-time updates (WebSockets needed)
5. No error handling in UI

---

## 📝 Notes pour le développement

### Avec BMAD
Si tu installes BMAD manuellement, voici comment l'utiliser :

1. **Cloner BMAD**
```bash
git clone https://github.com/bmad-code-org/BMAD-METHOD.git .bmad
```

2. **Utiliser les agents BMAD dans ton LLM**
- Copie les prompts des agents BMAD
- Adapte-les pour cop1
- Utilise-les pour planifier les features

3. **Workflow suggéré**
```
User: "Je veux développer la feature Backlog UI"
↓
Product Manager agent (BMAD): Crée les user stories
↓
Architect agent (BMAD): Design l'architecture
↓
cop1 agents: Implémentent le code
```

### Ordre de développement recommandé
1. **Backlog UI** (Frontend + API hooks) → Permet d'interagir visuellement
2. **Autonomous Mode** (Backend worker) → Le cœur de cop1
3. **Agent creation UI** → Facilite l'ajout d'agents
4. **Dependencies** → Gère les workflows complexes

---

## 💬 Questions pour l'équipe

1. Quelle est la priorité #1 pour toi ?
2. As-tu une clé API Claude/OpenAI pour tester ?
3. Veux-tu qu'on développe la Backlog UI ensemble maintenant ?
4. Comment veux-tu que le mode autonome te notifie (logs, UI, email) ?

---

**Prêt à démarrer le Sprint ? 🚀**

Choisis la task #1 et on lance !
