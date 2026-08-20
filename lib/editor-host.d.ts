/** Lazy managed OpenPencil editor sessions for the DSH details panel. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type OpenPencilMcpResult, type OpenPencilSelectionSnapshot } from './mcp-client.js';
export declare const EDITOR_ROUTE_PREFIX = "/_dsh/dsh-openpencil-lite/editor";
export interface EditorGrant {
    enabled: true;
    launchUrl: string;
    refreshUrl: string;
}
export type OpenPencilLiveTool = 'get_selection' | 'update_node' | 'batch_design';
export interface ActiveMcpCallOptions {
    /** Refuse to drive a different transcript card's live editor. */
    sourcePath?: string;
    ownerSessionId?: string;
    signal?: AbortSignal;
}
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
 * Trust the transport peer, never forwarded or caller-controlled host data.
 * Node may expose an IPv4 peer either directly or as an IPv4-mapped IPv6
 * address, including the compact hexadecimal form used by some platforms.
 */
export declare function isLoopbackRemoteAddress(address: string | undefined): boolean;
/** Owns opaque launch capabilities and all live managed editor children. */
export declare class EditorHostController {
    #private;
    readonly binary: string | undefined;
    constructor(masterKey: Buffer);
    get available(): boolean;
    get routeAvailable(): boolean;
    attachRoute(): () => void;
    /** Mint an opaque, runtime-only launch URL; no source path enters metadata. */
    grantFor(sourcePath: string | undefined, sourceSha256: string | undefined): EditorGrant | undefined;
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
    dispose(): Promise<void>;
    /**
     * Build one brand-new document without requiring a browser-owned editor.
     * The managed daemon is transient and never enters the visible-session map,
     * so this operation neither depends on nor retires an existing workbench.
     * Callers publish the returned authoritative JSON through DSH's filesystem
     * capability only after the whole batch succeeds.
     */
    createDocumentBatch(options: CreateDocumentBatchOptions): Promise<CreateDocumentBatchResult>;
    /** Current live editor selection, suitable for Agent context and UI chips. */
    getActiveSelection(options?: ActiveMcpCallOptions): Promise<OpenPencilSelectionSnapshot>;
    /**
     * Drive one allowlisted first-party MCP tool on the currently visible
     * editor. The managed daemon token never crosses this controller boundary.
     */
    callActiveMcp(tool: OpenPencilLiveTool, args: Record<string, unknown>, options?: ActiveMcpCallOptions): Promise<OpenPencilMcpResult>;
}
