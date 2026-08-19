/** Full OpenPencil editor shared by native Tool details and plugin-owned surfaces. */
import type { PresentationGrant } from './index.js';
import { type EditorColorScheme, type EditorLocale } from './editor-bridge.js';
import { type EditorRecoverySummary } from './editor-recovery.js';
export type { EditorRecoverySummary } from './editor-recovery.js';
export interface LaunchResponse {
    sessionId: string;
    iframeUrl: string;
    token: string;
    saveUrl: string;
    selectionUrl?: string;
    recoveryUrl?: string;
    recovery?: EditorRecoverySummary;
    closeUrl: string;
    docJson?: string;
    /** Client-only marker: the persisted launch capability was renewed. */
    renewed?: true;
}
export interface EditorBootResult {
    launch: LaunchResponse;
    documentJson: string;
}
export interface EditorPanelCopy {
    save: string;
    saving: string;
    unsaved: string;
    saved: string;
    unavailable: string;
    loading: string;
    errorTitle: string;
    pngFallback: string;
    editorTitle: (title: string) => string;
    editorTimeout: string;
    editorBusy: string;
    discard: string;
    saveConflict: (serverVersion: number) => string;
    syncConflict: (serverVersion: number) => string;
}
/** Chrome copy for the locale already resolved by the DSH host. */
export declare function editorPanelCopy(locale: EditorLocale): EditorPanelCopy;
interface EditorBootOptions {
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    sessionId?: string;
}
interface EditorCloseOptions {
    fetcher?: typeof fetch;
    dirty?: boolean;
    keepalive?: boolean;
}
/**
 * Launch one editor, renewing exactly once when a replayed launch capability
 * has expired. A refreshed capability is never persisted back into the Tool
 * block, and only same-origin control routes can receive document metadata.
 */
export declare function launchManagedEditor(editor: NonNullable<PresentationGrant['editor']>, document: NonNullable<PresentationGrant['document']>, options?: EditorBootOptions): Promise<LaunchResponse>;
/** Prefer the daemon's current source; fetch the immutable snapshot only for old hosts. */
export declare function prepareManagedEditor(editor: NonNullable<PresentationGrant['editor']>, document: NonNullable<PresentationGrant['document']>, options?: EditorBootOptions): Promise<EditorBootResult>;
/** Close exactly the managed session returned by one launch response. */
export declare function closeManagedEditorLaunch(launch: LaunchResponse, options?: EditorCloseOptions): Promise<void>;
/**
 * Mount-aware boot boundary. React may cancel an effect after its launch POST
 * has committed; release that precise returned session before ignoring it.
 */
export declare function prepareManagedEditorForMount(editor: NonNullable<PresentationGrant['editor']>, document: NonNullable<PresentationGrant['document']>, accept: () => boolean, options?: EditorBootOptions): Promise<EditorBootResult | undefined>;
export type EditorLifecyclePhase = 'launching' | 'loading' | 'ready' | 'saving' | 'error';
export interface EditorLifecycleState {
    dirty: boolean;
    phase: EditorLifecyclePhase;
}
export interface EditorLifecycleController {
    /** Close through the guarded server capability while the React owner remains mounted. */
    requestClose: () => Promise<boolean>;
    /** Ask the host to persist an opaque, source-scoped daemon recovery snapshot. */
    captureRecovery: () => Promise<boolean>;
    /** Join a save the user already started; never starts a new source write. */
    awaitExistingSave: () => Promise<boolean>;
    /** HMR-only escape hatch: leave the daemon for the server lifecycle when capture failed. */
    retainServerSessionOnUnmount: () => void;
}
export declare const INITIAL_EDITOR_LIFECYCLE_STATE: EditorLifecycleState;
export type EditorUnmountDisposition = 'closed' | 'retained';
export interface EditorUnmountState {
    /** Explicit retention armed after a failed workbench recovery capture. */
    retainServerSession: boolean;
    /** Latest client dirty signal. */
    dirty: boolean;
    /** False after a successful explicit close cleared the exact launch. */
    hasLiveLaunch: boolean;
}
export interface EditorInitRetryTimer<T> {
    schedule: (callback: () => void, delayMs: number) => T;
    cancel: (handle: T) => void;
}
/**
 * Start the managed-editor init handshake immediately, then retry on a bounded
 * interval until the caller stops it after `op-bridge/ready`.
 *
 * This deliberately starts before the iframe `load` event. OpenPencil waits
 * briefly for this token before starting daemon-backed services (including the
 * account-status request), while a browser may delay `load` until module/Wasm
 * startup is already complete. Waiting for `load` can therefore make the first
 * account request run unauthenticated and hide the login button until the
 * editor's later health refresh.
 */
export declare function beginEditorInitRetry<T>(send: () => void, onExhausted: () => void, timer: EditorInitRetryTimer<T>, options?: {
    intervalMs?: number;
    maxAttempts?: number;
}): () => void;
/**
 * Apply the unmount policy without letting React cleanup accidentally issue
 * DELETE. Dirty live launches are retained by default even when their native
 * Tool-details owner has no lifecycle controller.
 */
export declare function applyManagedEditorUnmountPolicy(state: EditorUnmountState, closeDaemon: () => void): EditorUnmountDisposition;
/** Editable panel. The daemon is created lazily only while this component is mounted. */
export declare function ManagedOpenPencilEditor({ grant, colorScheme, locale, sessionId, onTakeoverRequest, onLifecycleState, onLifecycleController, workbenchActions, allowTakeover, }: {
    grant: PresentationGrant;
    colorScheme: EditorColorScheme;
    locale: EditorLocale;
    sessionId: string;
    onTakeoverRequest?: (state: EditorLifecycleState) => boolean;
    onLifecycleState?: (state: EditorLifecycleState) => void;
    onLifecycleController?: (controller: EditorLifecycleController | undefined) => void;
    workbenchActions?: React.ReactNode;
    allowTakeover?: boolean;
}): import("react").JSX.Element;
