# Story E5.S12: Ollama Models in Sprint Status

Status: ready-for-dev

## Story

As a Developer,
I want `cop1 sprint status` to show which Ollama models are available and their sizes,
so that I can verify my LLM infrastructure is ready before starting a sprint.

## Acceptance Criteria

1. `cop1 sprint status` displays an "Ollama Models" section with available models (name, size in GB) via `OllamaManagementAdapter.listModels()`.
2. If Ollama is unavailable, the section displays `Ollama: unavailable` without crashing — the command always shows the rest of sprint status.

## Tasks / Subtasks

- [ ] Add Ollama model listing to sprint-status command
  - [ ] File: `packages/app/src/cli/commands/sprint-status.ts`
  - [ ] Import `OllamaManagementAdapter` from `@cop1/llm-intelligence`
  - [ ] After story statuses section, add:
    ```typescript
    const ollama = new OllamaManagementAdapter();
    try {
      const models = await ollama.listModels();
      console.log('\nOllama Models:');
      for (const m of models) {
        const sizeGB = (m.size / 1e9).toFixed(1);
        console.log(`  ${m.name} (${sizeGB}GB)`);
      }
    } catch {
      console.log('\nOllama: unavailable');
    }
    ```

- [ ] Make `sprintStatusCommand` async
  - [ ] Change signature from `function sprintStatusCommand(): void` to `async function sprintStatusCommand(): Promise<void>`
  - [ ] Update caller in CLI index to await the result

- [ ] Tests
  - [ ] Test with mock OllamaManagementAdapter returning 2 models → output contains model names and sizes
  - [ ] Test with OllamaManagementAdapter throwing → output contains "unavailable", no crash

## Dev Notes

- **OllamaManagementAdapter** is already implemented in `packages/llm-intelligence/src/features/ollama-management/application/OllamaManagementAdapter.ts` with `listModels()` returning `Promise<OllamaModel[]>` where `OllamaModel = { name, size, modifiedAt }`.
- **Async conversion**: The current `sprintStatusCommand()` is synchronous. Adding the Ollama call requires making it async. The CLI framework (Commander) supports async action handlers.
- **Graceful degradation**: The try/catch ensures the command never crashes if Ollama Docker container is not running. This is important because `cop1 sprint status` should always work regardless of LLM infrastructure state.
