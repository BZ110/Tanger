declare module 'gltf-validator' {
  export interface ValidationReport {
    issues: {
      numErrors: number;
      numWarnings: number;
      messages: {
        code: string;
        message: string;
        severity: number;
        pointer?: string;
      }[];
    };
    info?: Record<string, unknown>;
  }
  export function validateBytes(
    bytes: Uint8Array,
    options?: {
      uri?: string;
      format?: string;
      writeTimestamp?: boolean;
      maxIssues?: number;
      externalResourceFunction?: (uri: string) => Promise<Uint8Array>;
    },
  ): Promise<ValidationReport>;
}
