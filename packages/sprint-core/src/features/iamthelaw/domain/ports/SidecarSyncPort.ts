/** Port for writing governance rules to the BMAD sidecar memory location. */
export interface SidecarSyncPort {
  /** Write sidecar content, ensuring target directory exists and using atomic write. */
  write(content: string): void;
}
