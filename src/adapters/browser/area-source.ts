import type { AreaSourcePort } from '../../application/ports';

export class HttpAreaSource implements AreaSourcePort {
  constructor(private readonly base: URL) {}
  async read(path: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(new URL(path, this.base), { signal });
    if (!response.ok)
      throw new Error(`Area request failed (${response.status})`);
    return response.text();
  }
}
