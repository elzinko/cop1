# Story E1.S4: `cop1 init <project-path>`

Status: ready-for-dev

## Story

As a Developer,
I want to run `cop1 init <project-path>` to initialize a target project for cop1,
so that the quality tool configs and runtime directory are generated automatically from sensible templates without me having to set them up manually.

## Acceptance Criteria

1. `cop1 init ./mon-projet` génère `.cop1/quality/` avec `sonar-project.properties`, `.dependency-cruiser.js`, `.eslintrc.json` dérivés des templates de `packages/quality-intelligence/templates/`.
2. Si `.cop1/` existe déjà, la commande affiche un avertissement et demande confirmation avant d'écraser (pas d'écrasement silencieux).

## Tasks / Subtasks

- [ ] Créer les templates dans `packages/quality-intelligence/templates/` (AC: #1)
  - [ ] `sonar-project.properties.template` avec variables `{{projectKey}}`, `{{projectName}}`, `{{projectVersion}}`
  - [ ] `.dependency-cruiser.js.template` — règles de base : interdire imports cross-features, interdire dépendances circulaires
  - [ ] `.eslintrc.json.template` — règles ESLint de base (TypeScript + imports)
  - [ ] Exporter un manifest `templates/index.ts` listant les templates disponibles

- [ ] Créer `InitService` dans `packages/app/src/features/init/` (AC: #1, #2)
  - [ ] `InitService.checkExists(projectPath): boolean` — vérifie si `.cop1/` existe
  - [ ] `InitService.createStructure(projectPath)` — crée `.cop1/`, `.cop1/quality/`, `.cop1/stories/`, `.cop1/reports/`
  - [ ] `InitService.copyTemplates(projectPath, vars)` — lit chaque template, substitue `{{key}}` → valeur, écrit dans `.cop1/quality/`
  - [ ] Variables auto-détectées : `projectKey` depuis le nom du dossier, `projectName` depuis `package.json` si présent

- [ ] Créer la commande CLI `cop1 init` (AC: #1, #2)
  - [ ] `packages/app/src/cli/commands/init.ts`
  - [ ] Argument : `<project-path>` (obligatoire)
  - [ ] Si `.cop1/` existe : afficher avertissement + prompt `y/N` (utiliser `readline` natif) → abandon si non
  - [ ] Options : `--project-key <key>`, `--project-name <name>` pour surcharger l'auto-détection
  - [ ] Afficher le résumé des fichiers créés à la fin

- [ ] Créer `.cop1/config.yaml` initial (AC: #1)
  - [ ] Template `cop1-project-config.template.yaml` avec `projectKey`, `projectName`, `quality.sonarcloud.consent: false`
  - [ ] Généré dans `.cop1/config.yaml` du projet cible (distinct de `cop1.config.yaml` racine)

- [ ] Tests (AC: #1, #2)
  - [ ] Init sur répertoire vide → 4 fichiers créés, variables substituées correctement
  - [ ] Init sur répertoire avec `.cop1/` existant + réponse `n` → aucun fichier modifié
  - [ ] Init sur répertoire avec `.cop1/` existant + réponse `y` → fichiers écrasés
  - [ ] Variables : `{{projectKey}}` remplacé par le nom du dossier dans les 3 fichiers générés

## Dev Notes

- **Package** : `@cop1/quality-intelligence` pour les templates, `@cop1/app` pour `InitService` et la commande CLI.
- **Templates** : les fichiers `.template` ne sont pas exécutés — ils sont lus comme texte et les variables `{{key}}` sont substituées par simple `String.replace()`. Pas de moteur de template externe nécessaire.
- **`.dependency-cruiser.js.template`** : configuration de base qui interdit les imports entre features au sein d'un même package. Ce fichier sera amélioré par les agents qualité en sprint ultérieur via `QualityThresholdProposal`.
- **Idempotence** : après l'avertissement + confirmation, l'écrasement est total (pas de merge). Le Developer doit sauvegarder ses surcharges manuellement s'il veut les conserver.
- **Séparation `.cop1/config.yaml` vs `cop1.config.yaml`** : `cop1.config.yaml` est la config de l'outil cop1 lui-même (à la racine de l'installation cop1). `.cop1/config.yaml` est la config du projet cible (dans le répertoire du projet). Ne pas les confondre.

### Project Structure Notes

```
packages/
  quality-intelligence/
    templates/
      sonar-project.properties.template
      .dependency-cruiser.js.template
      .eslintrc.json.template
      cop1-project-config.template.yaml
      index.ts                  # manifest des templates

  app/
    src/
      features/
        init/
          application/
            InitService.ts      # checkExists, createStructure, copyTemplates
          infrastructure/
            TemplateReader.ts   # lit templates depuis quality-intelligence
      cli/
        commands/
          init.ts               # commande CLI cop1 init
```

### References

- [Source: architecture.md#Config Files Architecture] — templates + per-project `.cop1/quality/`
- [Source: architecture.md#SonarQube Integration Strategy] — `quality.sonarcloud.consent` dans `.cop1/config.yaml`
- [Source: epics.md#E1-S4] — ACs et points

## Dev Agent Record

### Agent Model Used

_À remplir par le Dev Agent_

### Debug Log References

### Completion Notes List

### File List
