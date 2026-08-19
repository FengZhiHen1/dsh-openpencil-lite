/** Self-contained DSH layout push used by the fallback OpenPencil workbench. */
export declare const OPENPENCIL_WORKBENCH_DOCK_ATTRIBUTE = "openpencilWorkbenchDockOwner";
export interface EditorWorkbenchDockLease {
    update: (width: number) => void;
    release: () => void;
}
/**
 * Reserve real layout space for the fixed right-hand workbench.
 *
 * DSH's root is an auto-width block, so a right margin shrinks its AppFrame
 * grid instead of covering the conversation. Ownership and exact inline-style
 * restoration keep this compatible with HMR and fail closed around another
 * plugin that already owns the root margin.
 */
export declare function claimEditorWorkbenchDock(root: HTMLElement, owner: string, initialWidth: number, computedMarginRight?: number): EditorWorkbenchDockLease | undefined;
