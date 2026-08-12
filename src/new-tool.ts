/** Create a brand-new OpenPencil document from one transactional design batch. */

import { createHash } from 'node:crypto'
import { lstat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute } from 'node:path'
import type FileSystem from '@deepseek-ai/dsh-fs'
import type { FsObservation, FsTarget } from '@deepseek-ai/dsh-fs'
import type SandboxPolicyService from '@deepseek-ai/dsh-sandbox-policy'
import { defineTool, type JsonValue, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { EditorHostController } from './editor-host.js'
import { OPENPENCIL_NEW_TOOL_NAME } from './tool-names.js'

const MAX_OPERATIONS_LENGTH = 256 * 1024
const ROOT_OPERATION_EXAMPLE = 'root=I(null,{"type":"frame","name":"Home","width":390,"height":844,"layout":"vertical","gap":24,"padding":24,"fill":"#F7F1E7","children":[{"type":"text","name":"Title","content":"Forage","fontSize":32,"fontWeight":700,"fill":"#173C2B"}]})'
const IMAGE_OPERATION_EXAMPLE = 'slot=I(root,{"type":"frame","name":"Hero photo","width":"fill_container","height":240,"cornerRadius":20,"clipContent":true,"children":[]})\nphoto=G(slot,"search","seasonal food photography")'

export interface DesignNewArgs {
  path: string
  operations: string
  canvasWidth?: number
  postProcess?: boolean
}

export interface DesignNewServices {
  fs: FileSystem
  sandboxPolicy: SandboxPolicyService
  observe(target: FsTarget, observation: FsObservation, exec: ToolRunContext): void
}

function renderJson(_args: unknown, value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Build and atomically publish a new `.op` document. The first batch runs in
 * a private managed daemon, so no existing file or browser-owned sidebar is
 * required and a failed design never leaves an empty target behind.
 */
export function createDesignNewTool(editorHost: EditorHostController, services: DesignNewServices) {
  return defineTool({
    name: OPENPENCIL_NEW_TOOL_NAME,
    description: 'Create and save a brand-new OpenPencil .op design from one transactional batch_design program. '
      + 'Use this for natural-language requests to make a new design when no .op file or live editor exists. '
      + 'Do not inspect or hand-write .op JSON and do not ask the user to open a sidebar. '
      + 'Choose a concise workspace-relative .op filename when the user did not specify one. '
      + 'This is a local OpenPencil-host operation and requires the session Workspace Write permission. '
      + 'The target must not already exist and its parent directory must exist. '
      + `Start with this valid pattern: ${ROOT_OPERATION_EXAMPLE}. `
      + 'A complete new design must create at least one renderable root frame. Prefer nested children for a cohesive initial screen and prefer at most 25 top-level operations. '
      + `For requested photography, add these valid lines in the same batch: ${IMAGE_OPERATION_EXAMPLE}. `
      + 'Use OpenPencil image search or an editable placeholder without pausing for external image-service setup; do not ask image-provider questions unless the user explicitly requested external generation. '
      + 'All operations apply together and the resulting document is saved atomically. '
      + 'After success, immediately call openpencil_render with the returned path and editable=true to show and edit the result.',
    parameters: {
      path: {
        type: 'string', required: true,
        description: 'New workspace-relative or absolute .op path. Choose a useful filename without asking when the user omitted one. Existing targets are never overwritten.',
      },
      operations: {
        type: 'string', required: true,
        description: `A complete batch_design program, preferably at most 25 top-level newline-separated operations. Begin with ${ROOT_OPERATION_EXAMPLE}. Use returned bindings for later I/U/G operations. For photography use ${IMAGE_OPERATION_EXAMPLE}.`,
      },
      canvasWidth: { type: 'number', description: 'Optional canvas-width hint for OpenPencil post-processing.' },
      postProcess: { type: 'boolean', description: 'Run OpenPencil post-processing after the batch. Default false.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          filename: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          sha256: { type: 'string', required: true },
          created: { type: 'boolean', const: true, required: true },
          applied: { type: 'boolean', const: true, required: true },
          saved: { type: 'boolean', const: true, required: true },
          result: { type: 'object', additionalProperties: true },
          note: { type: 'string', required: true },
        },
      },
      render: renderJson,
    },
    async execute(args: DesignNewArgs, exec) {
      const requestedPath = args.path.trim()
      if (requestedPath.length === 0) throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: path is required`)
      if (extname(requestedPath).toLowerCase() !== '.op') {
        throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: path must end in .op`)
      }
      if (args.operations.trim().length === 0) throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: operations must not be empty`)
      if (args.operations.length > MAX_OPERATIONS_LENGTH) throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: operations are too large`)
      if (args.canvasWidth !== undefined && (!Number.isFinite(args.canvasWidth) || args.canvasWidth <= 0 || args.canvasWidth > 16_384)) {
        throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: canvasWidth must be greater than 0 and at most 16384`)
      }

      const sandboxPolicy = services.sandboxPolicy.resolve({ session: exec.agent?.session })
      if (services.fs.sandboxMode !== undefined && sandboxPolicy.mode === 'read-only') {
        throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: creating a design requires Workspace Write access; switch this session from Read Only to Workspace Write and retry`)
      }
      const resolveOptions = { cwd: sandboxPolicy.workspaceRoot, signal: exec.signal }
      const pathInfo = await services.fs.lstat(requestedPath, { cwd: sandboxPolicy.workspaceRoot }, exec.signal)
      if (pathInfo !== undefined) throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: target already exists: ${requestedPath}`)
      const target = await services.fs.resolve(requestedPath, resolveOptions)
      const processPath = services.fs.processPath(target)
      if (extname(processPath).toLowerCase() !== '.op') {
        throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: resolved target must end in .op`)
      }
      if (!isAbsolute(processPath)) throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: the DSH filesystem did not provide an absolute host path`)
      let parentInfo
      try {
        parentInfo = await lstat(dirname(processPath))
      } catch {
        throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: the target parent is not available to the local OpenPencil host; use an existing directory in a local DSH workspace`)
      }
      if (!parentInfo.isDirectory()) {
        throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: target parent must be a local directory`)
      }
      const resolvedInfo = await services.fs.stat(target, exec.signal)
      if (resolvedInfo !== undefined) {
        services.observe(target, { kind: 'present', version: resolvedInfo.version }, exec)
        throw new Error(`${OPENPENCIL_NEW_TOOL_NAME}: target already exists: ${requestedPath}`)
      }
      services.observe(target, { kind: 'absent' }, exec)

      const batch = await editorHost.createDocumentBatch({
        operations: args.operations,
        ...(args.canvasWidth === undefined ? {} : { canvasWidth: args.canvasWidth }),
        ...(args.postProcess === undefined ? {} : { postProcess: args.postProcess }),
        signal: exec.signal,
      })
      const outcome = await services.fs.writeText(
        target,
        batch.documentJson,
        { kind: 'createIfAbsent' },
        exec.signal,
        sandboxPolicy,
      )
      services.observe(target, { kind: 'present', version: outcome.version }, exec)
      const bytes = Buffer.byteLength(outcome.after)
      const sha256 = createHash('sha256').update(outcome.after).digest('hex')
      return {
        path: processPath,
        filename: basename(processPath),
        bytes,
        sha256,
        created: true as const,
        applied: true as const,
        saved: true as const,
        ...(isRecord(batch.result) ? { result: batch.result } : {}),
        note: `Created and saved ${processPath}. Call openpencil_render with this path and editable=true now.`,
      }
    },
    presentCall: (args: DesignNewArgs) => ({
      card: 'generic', title: `Create ${args.path}`, kind: 'execute', locations: [{ path: args.path }],
    }),
  })
}
