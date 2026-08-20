/** Transient OpenPencil daemon runner for headless design batches. */

import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import {
  callOpenPencilMcp,
  getOpenPencilMcpVersion,
} from './mcp-client.js'
import { readManagedDaemonDocument } from './editor-recovery.js'

const START_TIMEOUT_MS = 20_000
const READY_TIMEOUT_MS = 15_000
const STOP_TIMEOUT_MS = 3_000
const MAX_HANDSHAKE_BYTES = 16 * 1024
const MAX_DIAGNOSTIC_BYTES = 64 * 1024
const EMPTY_DOCUMENT_JSON = '{\n  "version": "1.0.0",\n  "children": []\n}\n'

interface ManagedHandshake {
  port: number
  token: string
  version: string | number
}

export interface CreateDocumentBatchOptions {
  operations: string
  pageId?: string
  canvasWidth?: number
  postProcess?: boolean
  /**
   * Seed the transient daemon with an existing `.op` file instead of an empty
   * document. The caller owns the temp file lifetime (it must copy the source
   * to a private temp path first so the daemon can never overwrite the real
   * target). Version semantics are per-daemon: a batch still bumps the MCP
   * version from 0 to 1, so the post-batch increment guard below holds for
   * both empty and existing-document starts.
   */
  startFromPath?: string
  signal: AbortSignal
}

export interface CreateDocumentBatchResult {
  documentJson: string
  result: unknown
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function expandUserHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return path
}

/** Locate the GUI-free managed host used by op-vscode. */
export function findEditorHostBinary(): string | undefined {
  const override = process.env.DSH_OPENPENCIL_EDITOR_BINARY?.trim()
  const sourceOverride = process.env.DSH_OPENPENCIL_SOURCE_ROOT?.trim()
    || process.env.OPENPENCIL_SOURCE_ROOT?.trim()
  const roots = [
    ...(sourceOverride === undefined || sourceOverride.length === 0 ? [] : [expandUserHome(sourceOverride)]),
    join(homedir(), 'workspace', 'openpencil'),
  ]
  const candidates = [
    ...(override === undefined || override.length === 0 ? [] : [expandUserHome(override)]),
    ...roots.flatMap(root => [
      join(root, 'target', 'release', 'op-host-web-server'),
      join(root, 'target', 'debug', 'op-host-web-server'),
    ]),
  ]
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (dir.length > 0) candidates.push(join(dir, 'op-host-web-server'))
  }
  // The desktop binary shares the serve-web CLI. It is useful only when the
  // web bundle paths below can be resolved from an OpenPencil source root.
  candidates.push('/Applications/OpenPencil.app/Contents/MacOS/openpencil-desktop')
  return candidates.find(isRegularFile)
}

function sourceRootForBinary(binary: string): string | undefined {
  const configured = process.env.DSH_OPENPENCIL_SOURCE_ROOT?.trim()
    || process.env.OPENPENCIL_SOURCE_ROOT?.trim()
  const candidates = [
    ...(configured === undefined || configured.length === 0 ? [] : [expandUserHome(configured)]),
    resolve(dirname(binary), '..', '..'),
    join(homedir(), 'workspace', 'openpencil'),
  ]
  return candidates.find(root => (
    isRegularFile(join(root, 'crates', 'op-host-web', 'pkg', 'op_host_web.js'))
    && isRegularFile(join(root, 'crates', 'op-host-web', 'assets', 'canvaskit', 'canvaskit.wasm'))
  ))
}

function parseHandshake(line: string): ManagedHandshake {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    throw new Error('OpenPencil editor host returned an invalid handshake')
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('OpenPencil editor host returned an invalid handshake')
  }
  const record = value as Record<string, unknown>
  if (
    record.ok !== true
    || typeof record.port !== 'number' || !Number.isSafeInteger(record.port) || record.port < 1 || record.port > 65535
    || typeof record.token !== 'string' || record.token.length < 16
    || !(
      (typeof record.version === 'number' && Number.isSafeInteger(record.version) && record.version >= 0)
      || (typeof record.version === 'string' && record.version.length > 0 && record.version.length <= 64)
    )
  ) {
    throw new Error('OpenPencil editor host returned an incomplete handshake')
  }
  return { port: record.port, token: record.token, version: record.version }
}

function waitForHandshake(
  child: ChildProcessWithoutNullStreams,
  diagnostics: () => string,
  signal?: AbortSignal,
): Promise<ManagedHandshake> {
  signal?.throwIfAborted()
  return new Promise((resolveHandshake, rejectHandshake) => {
    let settled = false
    let stdout = ''
    const finish = (error?: Error, handshake?: ManagedHandshake): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.off('error', onError)
      child.off('close', onClose)
      signal?.removeEventListener('abort', onAbort)
      if (error !== undefined) rejectHandshake(error)
      else resolveHandshake(handshake!)
    }
    const onData = (chunk: Buffer): void => {
      stdout += chunk.toString('utf8')
      if (stdout.length > MAX_HANDSHAKE_BYTES) {
        finish(new Error('OpenPencil editor host handshake exceeded its size limit'))
        return
      }
      const newline = stdout.indexOf('\n')
      if (newline < 0) return
      try {
        finish(undefined, parseHandshake(stdout.slice(0, newline).trim()))
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    }
    const onError = (error: Error): void => { finish(error) }
    const onAbort = (): void => {
      const reason = signal?.reason
      finish(reason instanceof Error ? reason : new Error('OpenPencil editor startup was cancelled'))
    }
    const onClose = (code: number | null): void => {
      finish(new Error(`OpenPencil editor host exited before startup (${String(code)})${diagnostics() === '' ? '' : `: ${diagnostics()}`}`))
    }
    const timer = setTimeout(() => {
      finish(new Error(`OpenPencil editor host did not start within ${START_TIMEOUT_MS} ms${diagnostics() === '' ? '' : `: ${diagnostics()}`}`))
    }, START_TIMEOUT_MS)
    child.stdout.on('data', onData)
    child.once('error', onError)
    child.once('close', onClose)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
  })
}

async function waitForEditorReady(baseUrl: string, signal?: AbortSignal): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  let last = ''
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    try {
      const requestSignal = signal === undefined
        ? AbortSignal.timeout(2_000)
        : AbortSignal.any([signal, AbortSignal.timeout(2_000)])
      const [root, glue] = await Promise.all([
        fetch(`${baseUrl}/`, { signal: requestSignal }),
        fetch(`${baseUrl}/pkg/op_host_web.js`, { signal: requestSignal }),
      ])
      await Promise.all([root.arrayBuffer().catch(() => undefined), glue.arrayBuffer().catch(() => undefined)])
      if (root.status === 200 && glue.status === 200) return
      last = `root=${root.status}, bundle=${glue.status}`
    } catch (error) {
      signal?.throwIfAborted()
      last = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 150))
  }
  throw new Error(`OpenPencil editor web bundle was not ready${last === '' ? '' : `: ${last}`}`)
}

const stoppingChildren = new WeakMap<ChildProcessWithoutNullStreams, Promise<void>>()

function waitForChildClose(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise<boolean>(resolveClosed => {
    let settled = false
    const finish = (value: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.off('close', onClose)
      resolveClosed(value)
    }
    const onClose = (): void => { finish(true) }
    const timer = setTimeout(() => { finish(false) }, timeoutMs)
    child.once('close', onClose)
  })
}

function stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  const current = stoppingChildren.get(child)
  if (current !== undefined) return current
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  const stopping = (async (): Promise<void> => {
    if (!child.stdin.writableEnded) child.stdin.end()
    const closed = await waitForChildClose(child, STOP_TIMEOUT_MS)
    if (!closed && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await waitForChildClose(child, STOP_TIMEOUT_MS)
    }
  })()
  stoppingChildren.set(child, stopping)
  void stopping.finally(() => {
    if (stoppingChildren.get(child) === stopping) stoppingChildren.delete(child)
  })
  return stopping
}

/**
 * Owns the one-shot OpenPencil daemon used by `openpencil_new` /
 * `openpencil_apply`. Every batch spawns a transient managed daemon, runs the
 * transactional `batch_design` program, reads the authoritative document, and
 * must stop its child before returning. The result is never written here —
 * callers publish it through the DSH filesystem capability.
 */
export class EditorHostController {
  readonly binary = findEditorHostBinary()
  #launchQueue: Promise<void> = Promise.resolve()
  #disposePromise: Promise<void> | undefined

  get available(): boolean { return this.binary !== undefined }

  dispose(): Promise<void> {
    if (this.#disposePromise !== undefined) return this.#disposePromise
    this.#disposePromise = (async () => {
      // A launch can already be queued; wait for the serialized tail so
      // disposal does not return while a child is still alive.
      await this.#launchQueue
    })()
    return this.#disposePromise
  }

  /**
   * Build one brand-new document without requiring a browser-owned editor.
   * The managed daemon is transient and never enters a visible-session map.
   * Callers publish the returned authoritative JSON through DSH's filesystem
   * capability only after the whole batch succeeds.
   */
  async createDocumentBatch(options: CreateDocumentBatchOptions): Promise<CreateDocumentBatchResult> {
    const binary = this.binary
    if (binary === undefined) throw new Error('OpenPencil editor host binary is unavailable')
    options.signal.throwIfAborted()
    if (this.#disposePromise !== undefined) throw new Error('OpenPencil editor host is shutting down')

    return this.#serializeLaunch(async () => {
      options.signal.throwIfAborted()
      if (this.#disposePromise !== undefined) throw new Error('OpenPencil editor host is shutting down')
      return this.#createDocumentBatch(binary, options)
    })
  }

  async #createDocumentBatch(
    binary: string,
    options: CreateDocumentBatchOptions,
  ): Promise<CreateDocumentBatchResult> {
    const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-openpencil-lite-batch-'))
    // When seeding from an existing document, the caller owns the temp file
    // (it must be a private copy so the daemon can never overwrite the real
    // target). Otherwise this method authors an empty starter document.
    const sourcePath = options.startFromPath ?? join(tempRoot, 'starter.op')
    let child: ChildProcessWithoutNullStreams | undefined
    try {
      if (options.startFromPath === undefined) {
        await writeFile(sourcePath, EMPTY_DOCUMENT_JSON, { flag: 'wx', mode: 0o600 })
      }
      options.signal.throwIfAborted()
      if (this.#disposePromise !== undefined) throw new Error('OpenPencil editor host is shutting down')

      const env: NodeJS.ProcessEnv = { ...process.env }
      const sourceRoot = sourceRootForBinary(binary)
      if (sourceRoot !== undefined) {
        env.OPENPENCIL_WEB_BUNDLE_DIR ??= join(sourceRoot, 'crates', 'op-host-web', 'pkg')
        env.OPENPENCIL_CANVASKIT_DIR ??= join(sourceRoot, 'crates', 'op-host-web', 'assets', 'canvaskit')
      }
      child = spawn(binary, [
        '--serve-web', '--managed', '--port', '0', '--file', sourcePath,
        '--allow-origin', 'http://127.0.0.1',
      ], { stdio: ['pipe', 'pipe', 'pipe'], env })
      let diagnostics = ''
      child.stderr.on('data', (chunk: Buffer) => {
        if (diagnostics.length < MAX_DIAGNOSTIC_BYTES) {
          diagnostics += chunk.toString('utf8').slice(0, MAX_DIAGNOSTIC_BYTES - diagnostics.length)
        }
      })
      const onAbort = (): void => { if (child !== undefined) void stopChild(child) }
      options.signal.addEventListener('abort', onAbort, { once: true })
      try {
        const handshake = await waitForHandshake(child, () => diagnostics.trim(), options.signal)
        options.signal.throwIfAborted()
        const baseUrl = `http://127.0.0.1:${handshake.port}`
        await waitForEditorReady(baseUrl, options.signal)
        const beforeVersion = await getOpenPencilMcpVersion({
          baseUrl,
          token: handshake.token,
          signal: options.signal,
        })
        const result = await callOpenPencilMcp({
          baseUrl,
          token: handshake.token,
          tool: 'batch_design',
          arguments: {
            operations: options.operations,
            ...(options.pageId === undefined || options.pageId.length === 0
              ? {}
              : { pageId: options.pageId }),
            ...(options.canvasWidth === undefined ? {} : { canvasWidth: options.canvasWidth }),
            ...(options.postProcess === undefined ? {} : { postProcess: options.postProcess }),
          },
          signal: options.signal,
        })
        const afterVersion = await getOpenPencilMcpVersion({
          baseUrl,
          token: handshake.token,
          signal: options.signal,
        })
        if (afterVersion <= beforeVersion) {
          throw new Error('OpenPencil MCP batch_design reported success but did not create a document change')
        }
        options.signal.throwIfAborted()
        const authoritative = await readManagedDaemonDocument(baseUrl, handshake.token, fetch, options.signal)
        options.signal.throwIfAborted()
        if (authoritative.version < afterVersion) {
          throw new Error('OpenPencil managed document snapshot is older than the applied design batch')
        }
        return { documentJson: authoritative.documentJson, result: result.value }
      } finally {
        options.signal.removeEventListener('abort', onAbort)
      }
    } finally {
      if (child !== undefined) await stopChild(child)
      await rm(tempRoot, { recursive: true, force: true }).catch(() => {})
    }
  }

  async #serializeLaunch<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#launchQueue.then(task, task)
    // A failed launch must not poison the lifecycle queue for later requests.
    this.#launchQueue = run.then(() => undefined, () => undefined)
    return await run
  }
}
