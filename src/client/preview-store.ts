/** Per-session "most recent OpenPencil render" store feeding the sidebar preview tab. */

export interface RecentRender {
  path: string
  /** The parsed browser-side presentation grant (`PresentationGrant` shape). */
  grants: unknown
  settledAt: number
}

type Listener = () => void

const renders = new Map<string, RecentRender>()
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of [...listeners]) listener()
}

/** Record one settled render for a session (keyed by sessionId). */
export function publishRecentRender(sessionId: string, path: string, grants: unknown): void {
  if (sessionId.length === 0) return
  renders.set(sessionId, { path, grants, settledAt: Date.now() })
  notify()
}

/** Drop all renders owned by a disposed session. */
export function forgetSessionRenders(sessionId: string): void {
  if (!renders.delete(sessionId)) return
  notify()
}

/** Snapshot the latest render of one session (undefined when none yet). */
export function getRecentRender(sessionId: string): RecentRender | undefined {
  return renders.get(sessionId)
}

/** Subscribe to store changes; returns the disposer. */
export function subscribeRecentRender(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
