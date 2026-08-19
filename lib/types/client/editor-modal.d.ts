/** Plugin-owned OpenPencil workbench for DSH builds without Tool details. */
import type { PresentationGrant } from './index.js';
import { type EditorColorScheme, type EditorLocale } from './editor-bridge.js';
import { type EditorLifecycleController, type EditorLifecycleState } from './editor-panel.js';
export declare const EDITOR_WORKBENCH_FULLSCREEN_BREAKPOINT = 1480;
export declare const EDITOR_WORKBENCH_MIN_WIDTH = 640;
export declare const EDITOR_WORKBENCH_MAX_WIDTH = 960;
export declare const EDITOR_WORKBENCH_LEFT_CLEARANCE = 840;
export declare const EDITOR_WORKBENCH_RESIZE_STEP = 32;
interface EditorWorkbenchCopy {
    title: string;
    close: string;
    fullscreen: string;
    restore: string;
    resize: string;
    discard: string;
}
export declare function editorModalCopy(locale: EditorLocale): EditorWorkbenchCopy;
export declare function editorWorkbenchUsesFullscreen(viewportWidth: number): boolean;
export interface EditorWorkbenchWidthBounds {
    min: number;
    max: number;
    initial: number;
}
/** Keep useful DSH conversation space while allowing a large desktop canvas. */
export declare function editorWorkbenchWidthBounds(viewportWidth: number): EditorWorkbenchWidthBounds;
export declare function clampEditorWorkbenchWidth(width: number, viewportWidth: number): number;
/** A left-edge drag grows the right-docked workbench as the pointer moves left. */
export declare function resizedEditorWorkbenchWidth(startWidth: number, startClientX: number, clientX: number, viewportWidth: number): number;
/** Key only the editor process; outer workbench geometry remains stable. */
export declare function editorWorkbenchEditorKey(grant: PresentationGrant, sessionId: string): string;
/**
 * Return the focus target used at a fullscreen Tab boundary.
 *
 * `activeIndex` is -1 when focus is outside the workbench. Returning -1 means
 * normal browser tab order should continue inside the workbench.
 */
export declare function editorWorkbenchFocusTargetIndex(focusableCount: number, activeIndex: number, backwards: boolean): number;
/** Side mode is non-modal, so Escape only belongs to it while focus is inside. */
export declare function editorWorkbenchShouldHandleEscape(fullscreen: boolean, targetInside: boolean): boolean;
/** Read the editor's durable dirty marker before allowing the workbench to close. */
export declare function confirmEditorModalClose(root: Pick<ParentNode, 'querySelector'> | null, message: string, confirm?: ((message?: string) => boolean) & typeof globalThis.confirm): boolean;
export declare function ManagedOpenPencilEditorModal({ grant, colorScheme, locale, sessionId, ownerId, onLifecycleState, onLifecycleController, onClose, allowEditorTakeover, }: {
    grant: PresentationGrant;
    colorScheme: EditorColorScheme;
    locale: EditorLocale;
    sessionId: string;
    ownerId?: string;
    onLifecycleState?: (state: EditorLifecycleState) => void;
    onLifecycleController?: (controller: EditorLifecycleController | undefined) => void;
    onClose: () => void;
    allowEditorTakeover?: boolean;
}): import("react").ReactPortal;
export {};
