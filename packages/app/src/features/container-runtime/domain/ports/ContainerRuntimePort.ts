export interface ContainerStatus {
  id: string;
  name: string;
  state: 'running' | 'stopped' | 'paused' | 'unknown';
  image: string;
}

export interface ContainerRuntimePort {
  startContainer(id: string): Promise<void>;
  stopContainer(id: string): Promise<void>;
  getStatus(id: string): Promise<ContainerStatus>;
}
