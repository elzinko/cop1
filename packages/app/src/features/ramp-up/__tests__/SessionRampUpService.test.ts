import { describe, expect, it, vi } from 'vitest';
import {
  type ModelLoader,
  type RamChecker,
  SessionRampUpService,
} from '../application/SessionRampUpService.js';

describe('SessionRampUpService', () => {
  it('should load models progressively when RAM is low', async () => {
    const loader: ModelLoader = {
      loadModel: vi.fn(async () => {}),
      unloadModel: vi.fn(async () => {}),
    };
    const ramChecker: RamChecker = { getCurrentRamPercent: () => 30 };
    const service = new SessionRampUpService(loader, ramChecker);

    const loaded = await service.rampUp(['model-a', 'model-b', 'model-c'], 20);

    expect(loaded).toEqual(['model-a', 'model-b', 'model-c']);
    expect(loader.loadModel).toHaveBeenCalledTimes(3);
  });

  it('should stop loading when RAM exceeds budget threshold', async () => {
    let callCount = 0;
    const loader: ModelLoader = {
      loadModel: vi.fn(async () => {
        callCount++;
      }),
      unloadModel: vi.fn(async () => {}),
    };
    const ramChecker: RamChecker = {
      getCurrentRamPercent: () => (callCount >= 2 ? 85 : 40),
    };
    const service = new SessionRampUpService(loader, ramChecker);

    const loaded = await service.rampUp(['m1', 'm2', 'm3', 'm4'], 20);

    expect(loaded).toHaveLength(2);
    expect(loader.loadModel).toHaveBeenCalledTimes(2);
  });

  it('should not load any model when RAM is already high', async () => {
    const loader: ModelLoader = {
      loadModel: vi.fn(async () => {}),
      unloadModel: vi.fn(async () => {}),
    };
    const ramChecker: RamChecker = { getCurrentRamPercent: () => 85 };
    const service = new SessionRampUpService(loader, ramChecker);

    const loaded = await service.rampUp(['m1', 'm2'], 20);

    expect(loaded).toHaveLength(0);
    expect(loader.loadModel).not.toHaveBeenCalled();
  });

  it('should unload all models on rampDown', async () => {
    const loader: ModelLoader = {
      loadModel: vi.fn(async () => {}),
      unloadModel: vi.fn(async () => {}),
    };
    const ramChecker: RamChecker = { getCurrentRamPercent: () => 30 };
    const service = new SessionRampUpService(loader, ramChecker);

    await service.rampUp(['m1', 'm2'], 20);
    await service.rampDown();

    expect(loader.unloadModel).toHaveBeenCalledTimes(2);
    expect(service.getLoadedModels()).toHaveLength(0);
  });
});
