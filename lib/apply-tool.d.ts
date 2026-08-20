/** Apply one transactional design batch to an existing `.op` and write it back atomically. */
import { type FileSystem, type FsObservation, type FsTarget } from '@deepseek-ai/dsh-fs';
import type SandboxPolicyService from '@deepseek-ai/dsh-sandbox-policy';
import { type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { EditorHostController } from './editor-host.js';
export interface DesignApplyArgs {
    path: string;
    operations: string;
    pageId?: string;
    canvasWidth?: number;
    postProcess?: boolean;
}
export interface DesignApplyServices {
    fs: FileSystem;
    sandboxPolicy: SandboxPolicyService;
    observe(target: FsTarget, observation: FsObservation, exec: ToolRunContext): void;
}
/** Atomic batch write-back onto an existing `.op` — the Agent is the saver. */
export declare function createDesignApplyTool(editorHost: EditorHostController, services: DesignApplyServices): import("@deepseek-ai/dsh-tools").ToolDefinition;
