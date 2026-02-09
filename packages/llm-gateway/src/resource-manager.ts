import type { LLMConfig } from './types.js';

/**
 * Resource Manager - Manages LLM resources to avoid overloading the system
 *
 * Features:
 * - Track memory usage
 * - Limit concurrent local LLMs
 * - Suggest which agents should use cloud vs local based on available resources
 */

export interface ResourceLimits {
  maxMemoryMB: number; // Max RAM to use for local LLMs
  maxConcurrentLocalLLMs: number; // Max number of local LLMs running at once
}

export interface ResourceAllocation {
  canAllocate: boolean;
  reason?: string;
  suggestCloud?: boolean; // Suggest using cloud LLM instead
}

export class ResourceManager {
  private currentMemoryUsageMB = 0;
  private activeLocalLLMs = 0;

  constructor(private limits: ResourceLimits) {}

  /**
   * Check if we can allocate resources for a new local LLM
   */
  canAllocate(estimatedMemoryMB: number): ResourceAllocation {
    // Check memory limit
    if (this.currentMemoryUsageMB + estimatedMemoryMB > this.limits.maxMemoryMB) {
      return {
        canAllocate: false,
        reason: `Would exceed memory limit (${this.limits.maxMemoryMB}MB)`,
        suggestCloud: true,
      };
    }

    // Check concurrent LLM limit
    if (this.activeLocalLLMs >= this.limits.maxConcurrentLocalLLMs) {
      return {
        canAllocate: false,
        reason: `Max concurrent local LLMs reached (${this.limits.maxConcurrentLocalLLMs})`,
        suggestCloud: true,
      };
    }

    return {
      canAllocate: true,
    };
  }

  /**
   * Allocate resources for a local LLM
   */
  allocate(memoryMB: number): void {
    this.currentMemoryUsageMB += memoryMB;
    this.activeLocalLLMs++;
  }

  /**
   * Release resources for a local LLM
   */
  release(memoryMB: number): void {
    this.currentMemoryUsageMB = Math.max(0, this.currentMemoryUsageMB - memoryMB);
    this.activeLocalLLMs = Math.max(0, this.activeLocalLLMs - 1);
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage() {
    return {
      memoryUsageMB: this.currentMemoryUsageMB,
      memoryLimitMB: this.limits.maxMemoryMB,
      memoryUsagePercent: (this.currentMemoryUsageMB / this.limits.maxMemoryMB) * 100,
      activeLocalLLMs: this.activeLocalLLMs,
      maxConcurrentLocalLLMs: this.limits.maxConcurrentLocalLLMs,
    };
  }

  /**
   * Suggest provider based on available resources
   */
  suggestProvider(config: LLMConfig, estimatedMemoryMB: number): LLMConfig {
    if (config.provider === 'local') {
      const allocation = this.canAllocate(estimatedMemoryMB);

      if (!allocation.canAllocate && allocation.suggestCloud) {
        console.warn(
          `Cannot allocate local LLM (${allocation.reason}). Consider using cloud provider.`,
        );
        // Don't auto-switch, just warn
        // User can configure agents explicitly
      }
    }

    return config;
  }
}
