/** Rendering stays behind a port; there is currently no gameplay to simulate. */
export interface ViewportPort {
  render(): void;
  dispose(): void;
}

/** An area source supplies text; parsing remains a platform-independent concern. */
export interface AreaSourcePort {
  read(path: string, signal?: AbortSignal): Promise<string>;
}
