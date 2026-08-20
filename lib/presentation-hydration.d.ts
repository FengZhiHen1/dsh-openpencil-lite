/**
 * Safe recovery of browser-only presentation metadata for nested Code Mode
 * tool calls.
 *
 * DSH persists a nested `openpencil_render` outcome as a
 * `tool/code-dispatch` event, but published DSH through 0.1.0-rc.6 omits the native
 * `tool/result` presentation metadata from that event. The browser can ask
 * this same-origin endpoint to re-project that metadata without submitting
 * any path or tool result of its own. Live results are remembered briefly so
 * the preview envelope can be restored; replayed durable events are
 * preview-only.
 *
 * @module dsh-openpencil-lite/presentation-hydration
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type SessionStore } from '@deepseek-ai/dsh-session';
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import { RenderAccessController, type RenderResult } from './renderer.js';
import type { ViewerAssetController } from './viewer-assets.js';
/** Exact same-origin endpoint used by the client to recover nested metadata. */
export declare const PRESENTATION_HYDRATION_ROUTE = "/_dsh/dsh-openpencil-lite/presentation";
interface PresentationHydrationOptions {
    ttlMs?: number;
    maxEntries?: number;
    maxRecordBytes?: number;
    maxBytes?: number;
    now?: () => number;
}
interface PresentationHydrationDependencies {
    sessions: Pick<SessionStore, 'get'>;
    render: RenderAccessController;
    viewer?: Pick<ViewerAssetController, 'viewerGrant'>;
    /** DSH Web authorities derived from `webRuntime.trustedHosts`. */
    trustedHosts?: readonly string[] | (() => readonly string[]);
}
/**
 * Accept only the canonical, content-addressed result shape emitted by this
 * plugin. Hydration never signs a legacy absolute-path-only render.
 */
export declare function parseHydratableRenderResult(value: unknown): RenderResult | undefined;
/** TTL/LRU cache plus fail-closed hydration endpoint. */
export declare class PresentationHydrationController {
    #private;
    private readonly dependencies;
    constructor(dependencies: PresentationHydrationDependencies, options?: PresentationHydrationOptions);
    /** Observe one trusted in-process result before Code Mode drops its meta. */
    observeToolResult(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): void;
    /** Drop all live editor-capable records owned by a disposed session. */
    forgetSession(sessionId: string): void;
    /** Handle the exact same-origin POST hydration route. */
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
}
export {};
