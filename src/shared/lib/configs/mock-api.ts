/**
 * Tunables for the fake backend and realtime simulator.
 * Tests override these with `configureMockApi()` / simulator options.
 */
export interface MockApiConfig {
  /** Random latency range per request, in ms. */
  latency: { min: number; max: number }
  /** Probability (0–1) that a read request (lists, history) fails. */
  readFailureRate: number
  /** Probability (0–1) that a write request (send, edit, …) fails. */
  writeFailureRate: number
}

/**
 * Random failures are off by default. Error and retry paths are covered by
 * tests (which set these rates) and can be seen in the app via
 * Settings → Simulate offline.
 */
export const defaultMockApiConfig: MockApiConfig = {
  latency: { min: 200, max: 600 },
  readFailureRate: 0,
  writeFailureRate: 0,
}

export interface RealtimeSimulatorConfig {
  /** Delay before a sent message becomes `delivered`. */
  deliveredDelayMs: number
  /** Delay (after delivered) before it becomes `read`. */
  readDelayMs: number
  /** Delay (after read) before the other side starts typing. */
  typingDelayMs: number
  /** How long the typing indicator shows before the reply arrives. */
  typingDurationMs: number
  /** Probability (0–1) that a sent message gets an automatic reply. */
  replyProbability: number
  /** Range between unsolicited incoming messages, in ms. */
  incomingIntervalMs: { min: number; max: number }
  /** Interval between random presence changes, in ms. */
  presenceIntervalMs: number
}

export const defaultRealtimeConfig: RealtimeSimulatorConfig = {
  deliveredDelayMs: 600,
  readDelayMs: 1200,
  typingDelayMs: 700,
  typingDurationMs: 2200,
  replyProbability: 0.85,
  incomingIntervalMs: { min: 12_000, max: 25_000 },
  presenceIntervalMs: 15_000,
}
