/** Create a brand-new OpenPencil document from one transactional design batch. */
import type FileSystem from '@deepseek-ai/dsh-fs';
import type { FsObservation, FsTarget } from '@deepseek-ai/dsh-fs';
import type SandboxPolicyService from '@deepseek-ai/dsh-sandbox-policy';
import { type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { EditorHostController } from './editor-host.js';
export interface DesignNewArgs {
    path: string;
    operations: string;
    canvasWidth?: number;
    postProcess?: boolean;
}
export interface DesignNewServices {
    fs: FileSystem;
    sandboxPolicy: SandboxPolicyService;
    observe(target: FsTarget, observation: FsObservation, exec: ToolRunContext): void;
}
/**
 * Build and atomically publish a new `.op` document. The first batch runs in
 * a private managed daemon, so no existing file or browser-owned sidebar is
 * required and a failed design never leaves an empty target behind.
 */
export declare function createDesignNewTool(editorHost: EditorHostController, services: DesignNewServices): import("@deepseek-ai/dsh-tools").ToolDefinition;
