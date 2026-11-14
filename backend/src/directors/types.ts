// Types for directors that can explain their decisions (used by the service's debug output).

import type { EventDirector } from '../engine/EventEngine';

/** Details a director can expose about its last decision. */
export interface DirectorInfo {
  /** Probability per candidate id, if the director computed one. */
  probabilities?: Record<string, number>;
  /** True if the director could not do its job and a fallback picked instead. */
  fallback?: boolean;
  note?: string;
  latencyMs?: number;
  /** Full record of a model call: what was sent, what came back, how the pick was made. */
  trace?: {
    request: unknown; // the exact JSON body sent to the model
    response?: unknown; // the raw JSON that came back (absent if the call failed)
    roll?: number; // the seeded random number (0..1) used to sample from the probabilities
    pickedId?: string;
    error?: string;
  };
}

/** A director that can explain itself. Any EventDirector still works without this. */
export interface InspectableDirector extends EventDirector {
  readonly name: string;
  lastInfo?: DirectorInfo;
}

/** Clear and read a director's notes through functions, so callers see the real type. */
export function resetInfo(d: EventDirector): void {
  (d as InspectableDirector).lastInfo = undefined;
}
export function readInfo(d: EventDirector): DirectorInfo | undefined {
  return (d as InspectableDirector).lastInfo;
}
