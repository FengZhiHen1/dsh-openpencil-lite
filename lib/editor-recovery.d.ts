/** Durable, explicit recovery snapshots for managed OpenPencil editors. */
export type EditorRecoveryReason = 'client-dispose' | 'plugin-dispose';
export interface EditorRecoverySummary {
    id: string;
    capturedAt: number;
    bytes: number;
    sourceName: string;
    sourceChangedSinceCapture: boolean;
    cacheLabel: string;
}
export interface ManagedDaemonDocument {
    documentJson: string;
    version: number;
}
export interface EditorRecoveryDocument {
    documentJson: string;
}
/** Read the daemon's authoritative in-memory document without exposing its token. */
export declare function readManagedDaemonDocument(baseUrl: string, token: string, fetcher?: typeof fetch, signal?: AbortSignal): Promise<ManagedDaemonDocument>;
/** Replace only the live daemon document; persisting to `.op` remains a separate Save. */
export declare function restoreManagedDaemonDocument(baseUrl: string, token: string, recovery: ManagedDaemonDocument, fetcher?: typeof fetch): Promise<number>;
/** Filesystem-backed store keyed by an HMAC of the source path. */
export declare class EditorRecoveryStore {
    #private;
    constructor(key: Buffer, root?: string, now?: () => number);
    capture(options: {
        sourcePath: string;
        sourceSha256: string;
        sourceDocumentJson: string;
        daemonDocument: ManagedDaemonDocument;
        reason: EditorRecoveryReason;
    }): Promise<EditorRecoverySummary | undefined>;
    find(sourcePathValue: string, currentSourceSha256: string, currentSourceDocumentJson?: string): Promise<EditorRecoverySummary | undefined>;
    read(sourcePathValue: string, id: string): Promise<EditorRecoveryDocument | undefined>;
    discard(sourcePathValue: string, id: string): Promise<boolean>;
    discardFor(sourcePathValue: string): Promise<boolean>;
    prune(): Promise<void>;
}
