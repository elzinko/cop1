# E2E manuel reproductible — Panneau auth (🟢 + modèle)

Fiche backlog **0003** (partie auth). Validé le 2026-06-25 via Playwright contre le vrai
daemon (appel Claude réel) : 🟢 *Connecté* + modèle `claude-sonnet-4-6`.

> La partie **dark-mode cobaye** est suivie séparément dans la fiche **0017** (le banc
> `cop1-cobaye` est vierge — FEAT-S1 n'y est pas encore construite).

## Pré-requis
- Build à jour : `pnpm build`.
- Token Claude dans le `.env` du repo principal (`/Users/elzinko/git/bacasable/cop1/.env`,
  une seule ligne `CLAUDE_CODE_OAUTH_TOKEN=…`).

## Étapes

1. **Charger le token + démarrer le daemon** (port par défaut 4242) :
   ```sh
   export $(grep '^CLAUDE_CODE_OAUTH_TOKEN=' /Users/elzinko/git/bacasable/cop1/.env | xargs)
   COP1_PROJECT_PATH="$PWD" node packages/app/dist/cli/daemon-entry.js --port 4242 &
   ```
   Sanity : `curl -s localhost:4242/api/auth/check` doit renvoyer
   `{"ok":true,"model":"…","availability":"ok"}` (c'est l'appel Claude réel, 1 tour, sans outil).

2. **Démarrer le web UI** : `cd packages/web && pnpm dev` (→ http://localhost:5173 ;
   le proxy Vite cible 4242 par défaut depuis la fiche 0008).

3. **Naviguer + tester** (navigateur ou Playwright) :
   - Ouvrir http://localhost:5173
   - Cliquer l'onglet **Connexion** — sélecteur : `getByRole('button', { name: 'Connexion' })`
   - Cliquer **Tester la connexion** — `getByRole('button', { name: 'Tester la connexion' })`

## Résultat attendu (AC)
- Le panneau affiche **🟢 Connecté — modèle : <nom>** (ex. `claude-sonnet-4-6`).
  Assertion : `getByText('Connecté')` présent ; le nom du modèle est rendu.
- Cas dégradé/erreur : 🟡 *temporairement indisponible* (transitoire) ou 🔴 *Non connecté*
  (auth invalide) — voir `RENDER` dans `packages/web/src/AuthPanel.tsx`. Le champ `error`
  est tronqué/redacté côté daemon (fiche 0004).

## Teardown
Tuer le daemon (4242) et Vite (5173) : `for p in 4242 5173; do kill $(lsof -ti tcp:$p) 2>/dev/null; done`.

## Pourquoi pas en CI
Ce parcours exige un daemon vivant + des credentials Claude réels (appel facturé, 1 token) ;
il reste un **E2E manuel reproductible** plutôt qu'un job CI headless. Couverture unitaire du
panneau : `packages/web/src/AuthPanel.test.tsx`.
