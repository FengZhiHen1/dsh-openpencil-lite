/** Apply one transactional design batch to an existing `.op` and write it back atomically. */
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, isAbsolute, join } from 'node:path';
import { FsError } from '@deepseek-ai/dsh-fs';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { OPENPENCIL_APPLY_TOOL_NAME } from './tool-names.js';
const MAX_OPERATIONS_LENGTH = 256 * 1024;
const MAX_DOCUMENT_BYTES = 64 * 1024 * 1024;
const ROOT_OPERATION_EXAMPLE = 'root=I(null,{"type":"frame","name":"Home","width":390,"height":844,"layout":"vertical","gap":24,"padding":24,"fill":"#F7F1E7","children":[{"type":"text","name":"Title","content":"Forage","fontSize":32,"fontWeight":700,"fill":"#173C2B"}]})';
function renderJson(_args, value) {
    return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Atomic batch write-back onto an existing `.op` — the Agent is the saver. */
export function createDesignApplyTool(editorHost, services) {
    return defineTool({
        name: OPENPENCIL_APPLY_TOOL_NAME,
        description: 'Apply one transactional batch_design program to an EXISTING OpenPencil .op file and write the result back to disk atomically (saved: true). '
            + 'Works with no editor open. Use it for every structural batch change to an existing design; use openpencil_new to create a design from scratch. '
            + 'Merge all of this round\'s changes into a single compact batch program — every apply cold-starts a one-shot OpenPencil daemon, so splitting a round into many small applies is wasteful. '
            + 'Use concise newline-separated operations: '
            + 'I(parentId, nodeJson) inserts, U(nodeId, patchJson) updates (the single-node change path), D(nodeId) deletes, '
            + 'M(nodeId,parentId,index) moves, C(nodeId,parentId,overrides) clones, and R(nodeId,nodeJson) replaces. '
            + 'All operations apply together or none apply; a concurrent external edit to the source file rejects the whole apply instead of overwriting. '
            + `Start with a valid root: ${ROOT_OPERATION_EXAMPLE.replace('"name":"Home"', '"name":"Home"').slice(0, 80)}… `,
        parameters: {
            path: {
                type: 'string', required: true,
                description: 'The .op path to rewrite. Must already exist, be a regular file, and resolve to a local DSH workspace path. All batch operations are computed first; only then is the file replaced atomically.',
            },
            operations: {
                type: 'string', required: true,
                description: 'Newline-separated batch_design operations (I/U/D/M/C/R). Prefer one merged batch per round: each apply cold-starts a fresh daemon, so fragmented single-operation applies multiply latency. Use U(nodeId, patchJson) for a single-node change.',
            },
            pageId: { type: 'string', description: 'Optional page id. Defaults to the document active page.' },
            canvasWidth: { type: 'number', description: 'Optional canvas-width hint for post-processing.' },
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
                    applied: { type: 'boolean', const: true, required: true },
                    saved: { type: 'boolean', const: true, required: true },
                    nodeCount: { type: 'integer' },
                    result: { type: 'object', additionalProperties: true },
                    note: { type: 'string', required: true },
                },
            },
            render: renderJson,
        },
        async execute(args, exec) {
            const requestedPath = args.path.trim();
            if (requestedPath.length === 0)
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: path is required`);
            if (extname(requestedPath).toLowerCase() !== '.op') {
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: path must end in .op`);
            }
            if (args.operations.trim().length === 0)
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: operations must not be empty`);
            if (args.operations.length > MAX_OPERATIONS_LENGTH)
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: operations are too large`);
            if (args.canvasWidth !== undefined && (!Number.isFinite(args.canvasWidth) || args.canvasWidth <= 0 || args.canvasWidth > 16_384)) {
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: canvasWidth must be greater than 0 and at most 16384`);
            }
            const sandboxPolicy = services.sandboxPolicy.resolve({ session: exec.agent?.session });
            if (services.fs.sandboxMode !== undefined && sandboxPolicy.mode === 'read-only') {
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: applying a design requires Workspace Write access; switch this session from Read Only to Workspace Write and retry`);
            }
            const resolveOptions = { cwd: sandboxPolicy.workspaceRoot, signal: exec.signal };
            const pathInfo = await services.fs.lstat(requestedPath, { cwd: sandboxPolicy.workspaceRoot }, exec.signal);
            if (pathInfo === undefined || pathInfo.type !== 'file') {
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: target does not exist or is not a regular file: ${requestedPath}`);
            }
            const target = await services.fs.resolve(requestedPath, resolveOptions);
            const processPath = services.fs.processPath(target);
            if (extname(processPath).toLowerCase() !== '.op') {
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: resolved target must end in .op`);
            }
            if (!isAbsolute(processPath))
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: the DSH filesystem did not provide an absolute host path`);
            const resolvedInfo = await services.fs.stat(target, exec.signal);
            if (resolvedInfo === undefined)
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: target does not exist: ${requestedPath}`);
            if (resolvedInfo.type !== 'file')
                throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: target is not a regular file: ${requestedPath}`);
            const baselineVersion = resolvedInfo.version;
            // Record the observed source version; the guarded write below refuses a
            // stale version if anything changes the file while this batch runs.
            services.observe(target, { kind: 'present', version: baselineVersion }, exec);
            const sourceBytes = await services.fs.readBytes(target, exec.signal, MAX_DOCUMENT_BYTES);
            const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
            const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-openpencil-lite-apply-'));
            const seedPath = join(tempRoot, `apply-${sourceSha256.slice(0, 12)}.op`);
            let batch;
            try {
                await writeFile(seedPath, Buffer.from(sourceBytes), { flag: 'wx', mode: 0o600 });
                exec.signal.throwIfAborted();
                batch = await editorHost.createDocumentBatch({
                    operations: args.operations,
                    ...(args.pageId === undefined ? {} : { pageId: args.pageId }),
                    ...(args.canvasWidth === undefined ? {} : { canvasWidth: args.canvasWidth }),
                    ...(args.postProcess === undefined ? {} : { postProcess: args.postProcess }),
                    startFromPath: seedPath,
                    signal: exec.signal,
                });
            }
            finally {
                await rm(tempRoot, { recursive: true, force: true }).catch(() => { });
            }
            let outcome;
            try {
                outcome = await services.fs.writeText(target, batch.documentJson, { kind: 'replaceIfVersion', version: baselineVersion }, exec.signal, sandboxPolicy);
            }
            catch (error) {
                if (error instanceof FsError && error.code === 'FS_STALE_VERSION') {
                    throw new Error(`${OPENPENCIL_APPLY_TOOL_NAME}: source file changed during the batch (FS_STALE_VERSION); re-read ${requestedPath} and decide, then retry — nothing was overwritten`);
                }
                throw error;
            }
            services.observe(target, { kind: 'present', version: outcome.version }, exec);
            const bytes = Buffer.byteLength(outcome.after);
            const sha256 = createHash('sha256').update(outcome.after).digest('hex');
            const resultValue = batch.result;
            let nodeCount;
            if (isRecord(resultValue) && typeof resultValue.nodeCount === 'number') {
                nodeCount = resultValue.nodeCount;
            }
            return {
                path: processPath,
                filename: basename(processPath),
                bytes,
                sha256,
                applied: true,
                saved: true,
                ...(nodeCount === undefined ? {} : { nodeCount }),
                ...(isRecord(resultValue) ? { result: resultValue } : {}),
                note: `Applied and saved ${processPath}. Run openpencil_render on this path to check the result; for the next round keep merging changes into a single batch before applying again.`,
            };
        },
        presentCall: (args) => ({
            card: 'generic',
            title: `Apply design batch to ${args.path}`,
            kind: 'execute',
            locations: [{ path: args.path }],
        }),
    });
}
