/** Per-session "most recent OpenPencil render" store feeding the sidebar preview tab. */
export interface RecentRender {
    path: string;
    /** The parsed browser-side presentation grant (`PresentationGrant` shape). */
    grants: unknown;
    settledAt: number;
}
type Listener = () => void;
/** Record one settled render for a session (keyed by sessionId). */
export declare function publishRecentRender(sessionId: string, path: string, grants: unknown): void;
/** Drop all renders owned by a disposed session. */
export declare function forgetSessionRenders(sessionId: string): void;
/** Snapshot the latest render of one session (undefined when none yet). */
export declare function getRecentRender(sessionId: string): RecentRender | undefined;
/** Subscribe to store changes; returns the disposer. */
export declare function subscribeRecentRender(listener: Listener): () => void;
export {};
