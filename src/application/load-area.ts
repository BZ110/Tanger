import type { AreaSourcePort } from './ports';
import { parseAreaJson } from '../world/parse-area';
import type { AreaParseResult } from '../world/parse-area';

/** Callers own activation; loading and validation never build a scene. */
export async function loadArea(
  source: AreaSourcePort,
  path: string,
  signal?: AbortSignal,
): Promise<AreaParseResult> {
  if (signal?.aborted)
    return {
      ok: false,
      issues: [{ path: '$', message: 'Area loading cancelled' }],
    };
  try {
    const text = await source.read(path, signal);
    if (signal?.aborted)
      return {
        ok: false,
        issues: [{ path: '$', message: 'Area loading cancelled' }],
      };
    return parseAreaJson(text);
  } catch {
    return {
      ok: false,
      issues: [
        {
          path: '$',
          message: signal?.aborted
            ? 'Area loading cancelled'
            : 'Unable to read the area document',
        },
      ],
    };
  }
}
