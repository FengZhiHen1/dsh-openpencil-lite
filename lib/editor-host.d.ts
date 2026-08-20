/** Transient OpenPencil daemon runner for headless design batches. */
export interface CreateDocumentBatchOptions {
    operations: string;
    pageId?: string;
    canvasWidth?: number;
    postProcess?: boolean;
    /**
     * Seed the transient daemon with an existing `.op` file instead of an empty
     * document. The caller owns the temp file lifetime (it must copy the source
     * to a private temp path first so the daemon can never overwrite the real
     * target). Version semantics are per-daemon: a batch still bumps the MCP
     * version from 0 to 1, so the post-batch increment guard below holds for
     * both empty and existing-document starts.
     */
    startFromPath?: string;
    signal: AbortSignal;
}
export interface CreateDocumentBatchResult {
    documentJson: string;
    result: unknown;
}
/** Locate the GUI-free managed host used by op-vscode. */
export declare function findEditorHostBinary(): string | undefined;
/**
 * Owns the one-shot OpenPencil daemon used by `openpencil_new` /
 * `openpencil_apply`. Every batch spawns a transient managed daemon, runs the
 * transactional `batch_design` program, reads the authoritative document, and
 * must stop its child before returning. The result is never written here —
 * callers publish it through the DSH filesystem capability.
 */
export declare class EditorHostController {
    #private;
    readonly binary: string | undefined;
    get available(): boolean;
    dispose(): Promise<void>;
    /**
     * Build one brand-new document without requiring a browser-owned editor.
     * The managed daemon is transient and never enters a visible-session map.
     * Callers publish the returned authoritative JSON through DSH's filesystem
     * capability only after the whole batch succeeds.
     */
    createDocumentBatch(options: CreateDocumentBatchOptions): Promise<CreateDocumentBatchResult>;
}
