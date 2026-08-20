/** Read the OpenPencil managed daemon's authoritative in-memory document. */
export interface ManagedDaemonDocument {
    documentJson: string;
    version: number;
}
export interface EditorRecoveryDocument {
    documentJson: string;
}
/** Read the daemon's authoritative in-memory document without exposing its token. */
export declare function readManagedDaemonDocument(baseUrl: string, token: string, fetcher?: typeof fetch, signal?: AbortSignal): Promise<ManagedDaemonDocument>;
