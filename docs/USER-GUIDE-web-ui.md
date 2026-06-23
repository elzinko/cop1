# Web UI — Guide utilisateur

La web UI de cop1 (`@cop1/web`) est servie en local et parle au **daemon** cop1.
Pour l'instant elle expose le **panneau Connexion** (Story A) ; le **lanceur de run**
(Story B) arrive ensuite.

## Démarrer la stack en local

Deux process : le **daemon** (API) et le **serveur web** (Vite, qui proxy `/api` et
`/events` vers le daemon).

```bash
cd /Users/elzinko/git/bacasable/cop1
pnpm build

# 1) le daemon (API sur :4242)
node packages/app/dist/cli/index.js start

# 2) le serveur web (dans un autre terminal) → http://localhost:5173
pnpm --filter @cop1/web dev
```

Ouvre **http://localhost:5173**.

## Onglet « Connexion » (Story A)

- Clique **« Tester la connexion »**.
- 🟢 **Connecté — modèle : `<nom>`** → cop1 peut parler à Claude (et te dit sur quel modèle).
- 🔴 **Non connecté — `<erreur>`** → pas de credentials Claude valides.

Le bouton fait un appel Claude **minuscule** (1 tour, sans outil) côté daemon ; la clé /
le token reste **côté serveur**, jamais exposé au navigateur.

### Si c'est 🔴 (401)

cop1 hérite de l'auth de ton terminal. Rétablis-la (au choix) :

```bash
claude setup-token            # via ton abonnement Claude Max (OAuth, token longue durée)
#   ── ou ──
export ANTHROPIC_API_KEY="sk-ant-…"   # depuis console.anthropic.com
```

Re-teste : le feu doit passer 🟢.

## Faire tourner cop1 sur un vrai projet

Le panneau ne fait que **vérifier** la connexion. Pour faire **développer une feature**
par cop1 et voir le rendu, utilise le banc d'essai jetable :

→ `/Users/elzinko/git/bacasable/cop1-cobaye/README.md` (run + reset à chaque fois).

## À venir (Story B)

Un **lanceur de run** dans la web UI : formulaire d'options → lance l'orchestrateur
**dans le daemon** → **mission-control live** (story/commande en cours, jauge tokens/\$,
escalades, bouton STOP) via le flux SSE `/events`.
