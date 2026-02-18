import type {
  ContainerRuntimePort,
  ContainerStatus,
} from '../domain/ports/ContainerRuntimePort.js';

export class DockerDesktopAdapter implements ContainerRuntimePort {
  async startContainer(id: string): Promise<void> {
    const response = await fetch(`http://localhost/containers/${id}/start`, {
      method: 'POST',
      headers: { Host: 'docker' },
    });
    if (!response.ok && response.status !== 304) {
      throw new Error(`Docker start error: ${response.status}`);
    }
  }

  async stopContainer(id: string): Promise<void> {
    const response = await fetch(`http://localhost/containers/${id}/stop`, {
      method: 'POST',
      headers: { Host: 'docker' },
    });
    if (!response.ok && response.status !== 304) {
      throw new Error(`Docker stop error: ${response.status}`);
    }
  }

  async getStatus(id: string): Promise<ContainerStatus> {
    const response = await fetch(`http://localhost/containers/${id}/json`, {
      headers: { Host: 'docker' },
    });
    if (!response.ok) {
      throw new Error(`Docker inspect error: ${response.status}`);
    }
    const data = (await response.json()) as {
      Id: string;
      Name: string;
      State: { Status: string };
      Config: { Image: string };
    };
    return {
      id: data.Id,
      name: data.Name,
      state: this.mapState(data.State.Status),
      image: data.Config.Image,
    };
  }

  private mapState(status: string): ContainerStatus['state'] {
    switch (status) {
      case 'running':
        return 'running';
      case 'exited':
        return 'stopped';
      case 'paused':
        return 'paused';
      default:
        return 'unknown';
    }
  }
}
