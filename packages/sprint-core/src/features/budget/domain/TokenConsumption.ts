/** A single token consumption event recorded from an LLM call. */
export interface TokenConsumption {
  /** LLM model identifier (e.g., 'claude-cli', 'ollama'). Will carry actual command type when event payload is enriched. */
  commandType: string;
  agentType: string;
  tokens: number;
  timestamp: string;
}
