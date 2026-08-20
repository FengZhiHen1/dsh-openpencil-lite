/** Per-session "most recent OpenPencil render" store feeding the sidebar preview tab. */
const renders = new Map();
const listeners = new Set();
function notify() {
    for (const listener of [...listeners])
        listener();
}
/** Record one settled render for a session (keyed by sessionId). */
export function publishRecentRender(sessionId, path, grants) {
    if (sessionId.length === 0)
        return;
    renders.set(sessionId, { path, grants, settledAt: Date.now() });
    notify();
}
/** Drop all renders owned by a disposed session. */
export function forgetSessionRenders(sessionId) {
    if (!renders.delete(sessionId))
        return;
    notify();
}
/** Snapshot the latest render of one session (undefined when none yet). */
export function getRecentRender(sessionId) {
    return renders.get(sessionId);
}
/** Subscribe to store changes; returns the disposer. */
export function subscribeRecentRender(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
