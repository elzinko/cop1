export interface SupervisorProjectMetadata {
  name: string;
  version: string;
  packageManager: string;
  rootPath: string;
}

export interface SupervisorContext {
  prd: string;
  architecture: string;
  projectMetadata: SupervisorProjectMetadata;
  /**
   * Reserved for EA7 iamthelaw integration. Empty in V1-light.
   */
  iamthelaw: string;
  loadedAt: string;
}
