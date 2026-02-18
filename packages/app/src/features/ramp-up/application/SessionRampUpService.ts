export interface ModelLoader {
  loadModel(modelName: string): Promise<void>;
  unloadModel(modelName: string): Promise<void>;
}

export interface RamChecker {
  getCurrentRamPercent(): number;
}

export class SessionRampUpService {
  private loadedModels: string[] = [];

  constructor(
    private readonly modelLoader: ModelLoader,
    private readonly ramChecker: RamChecker,
  ) {}

  async rampUp(models: string[], budgetGB: number): Promise<string[]> {
    const budgetThreshold = budgetGB > 0 ? 0.7 : 1; // Load next only if below 70% of budget

    for (const model of models) {
      const ramPercent = this.ramChecker.getCurrentRamPercent();
      const budgetPercent = ramPercent / 100;

      if (budgetPercent >= budgetThreshold) {
        break;
      }

      await this.modelLoader.loadModel(model);
      this.loadedModels.push(model);
    }

    return [...this.loadedModels];
  }

  async rampDown(): Promise<void> {
    for (const model of this.loadedModels.reverse()) {
      await this.modelLoader.unloadModel(model);
    }
    this.loadedModels = [];
  }

  getLoadedModels(): string[] {
    return [...this.loadedModels];
  }
}
