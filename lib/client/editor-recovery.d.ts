/** Same-origin client controls for durable managed-editor recovery. */
import { type EditorLocale } from './editor-bridge.js';
export interface EditorRecoverySummary {
    id: string;
    capturedAt: number;
    bytes: number;
    sourceName: string;
    sourceChangedSinceCapture: boolean;
    cacheLabel: string;
}
export interface EditorRecoveryLaunch {
    sessionId: string;
    recoveryUrl?: string;
    recovery?: EditorRecoverySummary;
}
export declare function editorRecoverySummaryOf(value: unknown): EditorRecoverySummary | undefined;
export declare function editorRecoveryItemUrl(launch: EditorRecoveryLaunch, recoveryId: string): string;
/** Capture the authoritative daemon document; never serializes the iframe from React. */
export declare function captureManagedEditorRecovery(launch: EditorRecoveryLaunch, fetcher?: typeof fetch): Promise<EditorRecoverySummary | undefined>;
/** Explicitly restore into the live daemon. The user must still press Save to update `.op`. */
export declare function restoreManagedEditorRecovery(launch: EditorRecoveryLaunch, recovery: EditorRecoverySummary, fetcher?: typeof fetch): Promise<string>;
export declare function discardManagedEditorRecovery(launch: EditorRecoveryLaunch, recovery: EditorRecoverySummary, fetcher?: typeof fetch): Promise<void>;
export interface EditorRecoveryCopy {
    available: (sourceName: string) => string;
    conflict: (sourceName: string) => string;
}
export declare function editorRecoveryCopy(locale: EditorLocale): EditorRecoveryCopy;
