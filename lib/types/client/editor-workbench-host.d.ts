/** Page-stable owner for the plugin fallback editor workbench. */
import type { PresentationGrant, PresentationLocale } from './index.js';
import { type EditorColorScheme } from './editor-bridge.js';
import { type EditorLifecycleController, type EditorLifecycleState } from './editor-panel.js';
export interface EditorWorkbenchRequest {
    grant: PresentationGrant;
    sessionId: string;
    automatic?: boolean;
}
type Listener = () => void;
export interface EditorWorkbenchStore {
    getSnapshot: () => EditorWorkbenchRequest | undefined;
    subscribe: (listener: Listener) => () => void;
    open: (request: EditorWorkbenchRequest) => boolean;
    close: () => void;
}
/**
 * Small external store that is deliberately not owned by a Tool card. The
 * replacement gate lets the mounted host retain a dirty editor when another
 * historical card asks to open a different document.
 */
export declare function createEditorWorkbenchStore(canReplace?: (current: EditorWorkbenchRequest) => boolean, onRepeat?: () => void): EditorWorkbenchStore;
interface EditorWorkbenchHostOptions {
    subscribeTheme: (listener: Listener) => () => unknown;
    getColorScheme: () => EditorColorScheme;
    subscribeLocale: (listener: Listener) => () => unknown;
    getLocale: () => PresentationLocale;
    document?: Document;
}
export interface EditorWorkbenchHost {
    open: (request: EditorWorkbenchRequest) => Promise<boolean>;
    openIfIdle: (request: EditorWorkbenchRequest) => Promise<boolean>;
    dispose: () => Promise<void>;
}
export type EditorDisposePreservation = 'clean' | 'saved' | 'recovered' | 'unrecovered';
/**
 * Preserve dirty state without inventing a save the user did not request.
 * An already-running save may finish; an idle dirty editor is recovery-only.
 */
export declare function preserveEditorBeforeWorkbenchDispose(state: EditorLifecycleState, controller: EditorLifecycleController): Promise<EditorDisposePreservation>;
/** Mount one imperative React root for the whole plugin fiber. */
export declare function mountEditorWorkbenchHost(options: EditorWorkbenchHostOptions): EditorWorkbenchHost;
export {};
