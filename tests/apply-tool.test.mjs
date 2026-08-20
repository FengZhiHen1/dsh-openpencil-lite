import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { FsError } from '@deepseek-ai/dsh-fs'

const { createDesignApplyTool } = await import('../lib/apply-tool.js')

function createHarness(options = {}) {
  const workspaceRoot = '/workspace/project'
  const requestedPath = options.requestedPath ?? 'designs/forage.op'
  const processPath = options.processPath ?? join(tmpdir(), 'forage-apply.op')
  const target = { targetKey: `local:${processPath}`, displayPath: requestedPath }
  const policy = { mode: 'workspace-write', workspaceRoot }
  const sourceText = options.sourceText ?? '{"version":"1.0.0","children":[{"id":"home"}],"bg":"before"}\n'
  const sourceBytes = Buffer.from(sourceText, 'utf8')
  const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex')
  const documentJson = options.documentJson ?? '{"version":"1.0.0","children":[{"id":"home"},{"id":"added"}],"bg":"before","patch":"applied"}\n'
  const calls = {
    policy: [],
    lstat: [],
    resolve: [],
    processPath: [],
    stat: [],
    readBytes: [],
    batch: [],
    write: [],
    observe: [],
  }
  const session = { id: 'session-apply-tool', header: { cwd: workspaceRoot } }
  const signal = new AbortController().signal
  const exec = { agent: { id: 'agent-apply-tool', session }, signal }
  const baselineVersion = options.baselineVersion ?? 'version-before-apply'
  const writeVersion = 'version-after-apply'

  const fs = {
    sandboxMode: options.sandboxMode,
    async lstat(path, resolveOptions, receivedSignal) {
      calls.lstat.push({ path, options: resolveOptions, signal: receivedSignal })
      // `undefined` must remain distinguishable: pass a sentinel to mean "absent".
      if ('pathInfo' in options) return options.pathInfo
      return { type: 'file', version: baselineVersion, size: sourceBytes.length }
    },
    async resolve(path, resolveOptions) {
      calls.resolve.push({ path, options: resolveOptions })
      return target
    },
    async stat() {
      calls.stat.push({ target })
      return options.resolvedInfo ?? { type: 'file', version: baselineVersion, size: sourceBytes.length }
    },
    processPath(receivedTarget) {
      calls.processPath.push(receivedTarget)
      return processPath
    },
    async readBytes(receivedTarget, receivedSignal, maxBytes) {
      calls.readBytes.push({ target: receivedTarget, signal: receivedSignal, maxBytes })
      return sourceBytes
    },
    async writeText(receivedTarget, content, intent, receivedSignal, sandboxPolicy) {
      calls.write.push({ target: receivedTarget, content, intent, signal: receivedSignal, sandboxPolicy })
      if (options.writeError !== undefined) throw options.writeError
      return {
        operation: 'update',
        version: writeVersion,
        before: sourceText,
        after: options.writtenText ?? content,
      }
    },
  }
  const sandboxPolicy = {
    resolve(request) {
      calls.policy.push(request)
      return policy
    },
  }
  const editorHost = {
    async createDocumentBatch(batchOptions) {
      calls.batch.push(batchOptions)
      if (options.batchError !== undefined) throw options.batchError
      if (batchOptions.startFromPath !== undefined) {
        // Prove the daemon was seeded with a private copy of the source.
        const seeded = await readFile(batchOptions.startFromPath, 'utf8')
        assert.equal(seeded, sourceText)
        calls.batch.push({ seededFromContainsSource: true })
      }
      return {
        documentJson,
        result: options.batchResult ?? { applied: true, nodeCount: 2, results: [{ ok: true }] },
      }
    },
  }
  const tool = createDesignApplyTool(editorHost, {
    fs,
    sandboxPolicy,
    observe(receivedTarget, observation, actor) {
      calls.observe.push({ target: receivedTarget, observation, actor })
    },
  })
  return {
    baselineVersion,
    calls,
    documentJson,
    exec,
    policy,
    processPath,
    requestedPath,
    signal,
    sourceSha256,
    sourceText,
    target,
    tool,
  }
}

const GOOD_OPS = 'I("home",{"type":"text","name":"Added","content":"x","fontSize":20,"fill":"#000000"})'

test('openpencil_apply seeds a private daemon copy and publishes through a guarded replaceIfVersion write', async () => {
  const harness = createHarness()
  const result = await harness.tool.execute({
    path: harness.requestedPath,
    operations: GOOD_OPS,
    canvasWidth: 390,
    postProcess: true,
    pageId: 'page-1',
  }, harness.exec)

  assert.deepEqual(harness.calls.policy, [{ session: harness.exec.agent.session }])
  assert.equal(harness.calls.lstat.length, 1)
  assert.equal(harness.calls.resolve.length, 1)
  assert.equal(harness.calls.stat.length, 1)
  assert.equal(harness.calls.readBytes.length, 1)
  // observation: V0 at start, post-write version after publication
  assert.deepEqual(harness.calls.observe, [
    { target: harness.target, observation: { kind: 'present', version: harness.baselineVersion }, actor: harness.exec },
    { target: harness.target, observation: { kind: 'present', version: 'version-after-apply' }, actor: harness.exec },
  ])
  // The daemon batch received the private copy + full arguments
  assert.equal(harness.calls.batch.length, 2)
  const batchCall = harness.calls.batch[0]
  assert.equal(batchCall.operations, GOOD_OPS)
  assert.equal(batchCall.pageId, 'page-1')
  assert.equal(batchCall.canvasWidth, 390)
  assert.equal(batchCall.postProcess, true)
  assert.equal(batchCall.signal, harness.signal)
  assert.ok(typeof batchCall.startFromPath === 'string')
  assert.ok(harness.calls.batch[1].seededFromContainsSource)
  // The write used replaceIfVersion guarded by the observed V0
  assert.deepEqual(harness.calls.write, [{
    target: harness.target,
    content: harness.documentJson,
    intent: { kind: 'replaceIfVersion', version: harness.baselineVersion },
    signal: harness.signal,
    sandboxPolicy: harness.policy,
  }])

  const expectedText = harness.documentJson
  assert.deepEqual(result, {
    path: harness.processPath,
    filename: 'forage-apply.op',
    bytes: Buffer.byteLength(expectedText),
    sha256: createHash('sha256').update(expectedText).digest('hex'),
    applied: true,
    saved: true,
    nodeCount: 2,
    result: { applied: true, nodeCount: 2, results: [{ ok: true }] },
    note: `Applied and saved ${harness.processPath}. Run openpencil_render on this path to check the result; for the next round keep merging changes into a single batch before applying again.`,
  })
})

test('openpencil_apply hashes the filesystem-authoritative written text', async () => {
  const normalized = '{"version":"1.0.0","children":[]}\n'
  const harness = createHarness({ writtenText: normalized })

  const result = await harness.tool.execute({
    path: harness.requestedPath,
    operations: GOOD_OPS,
  }, harness.exec)

  assert.equal(result.bytes, Buffer.byteLength(normalized))
  assert.equal(result.sha256, createHash('sha256').update(normalized).digest('hex'))
})

test('openpencil_apply rejects a stale concurrent write and never overwrites (AC-03)', async () => {
  const stale = new FsError('version mismatch', 'FS_STALE_VERSION')
  const harness = createHarness({ writeError: stale })

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: GOOD_OPS,
    }, harness.exec),
    /source file changed during the batch .*FS_STALE_VERSION.* nothing was overwritten/i,
  )
  assert.equal(harness.calls.batch.length, 2) // daemon still ran on the private copy
  assert.equal(harness.calls.write.length, 1)
  assert.deepEqual(harness.calls.write[0].intent, { kind: 'replaceIfVersion', version: harness.baselineVersion })
  // only the start observation is recorded — the failed write must not mark the target present
  assert.deepEqual(harness.calls.observe, [
    { target: harness.target, observation: { kind: 'present', version: harness.baselineVersion }, actor: harness.exec },
  ])
})

test('openpencil_apply fails before daemon startup in a read-only sandbox', async () => {
  const harness = createHarness({ sandboxMode: 'read-only' })
  harness.policy.mode = 'read-only'

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: GOOD_OPS,
    }, harness.exec),
    /requires Workspace Write access/,
  )
  assert.equal(harness.calls.lstat.length, 0)
  assert.equal(harness.calls.readBytes.length, 0)
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
})

test('openpencil_apply requires an existing regular .op target', async () => {
  const harness = createHarness({ pathInfo: undefined })
  await assert.rejects(
    harness.tool.execute({ path: harness.requestedPath, operations: GOOD_OPS }, harness.exec),
    /target does not exist or is not a regular file/,
  )
  assert.equal(harness.calls.resolve.length, 0)
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
})

test('openpencil_apply never writes when the transactional design batch fails', async () => {
  const batchFailure = new Error('batch_design rejected line 4')
  const harness = createHarness({ batchError: batchFailure })

  await assert.rejects(
    harness.tool.execute({ path: harness.requestedPath, operations: GOOD_OPS }, harness.exec),
    error => error === batchFailure,
  )
  assert.equal(harness.calls.batch.length, 1)
  assert.equal(harness.calls.write.length, 0)
})

test('openpencil_apply validates arguments before acquiring capabilities', async () => {
  const harness = createHarness()
  const tooLarge = 'x'.repeat(256 * 1024 + 1)
  for (const [args, pattern] of [
    [{ path: '   ', operations: GOOD_OPS }, /path is required/],
    [{ path: 'design.json', operations: GOOD_OPS }, /path must end in \.op/],
    [{ path: 'design.op', operations: '   ' }, /operations must not be empty/],
    [{ path: 'design.op', operations: tooLarge }, /operations are too large/],
    [{ path: 'design.op', operations: GOOD_OPS, canvasWidth: 0 }, /canvasWidth must be greater than 0/],
  ]) {
    await assert.rejects(harness.tool.execute(args, harness.exec), pattern)
  }
  assert.equal(harness.calls.policy.length, 0)
  assert.equal(harness.calls.readBytes.length, 0)
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
})

test('openpencil_apply exposes a strict schema and the headless saver output contract', () => {
  const harness = createHarness()
  assert.equal(harness.tool.name, 'openpencil_apply')
  assert.deepEqual([...harness.tool.parameters.required].sort(), ['operations', 'path'])
  assert.equal(harness.tool.output.schema.additionalProperties, false)
  assert.equal(harness.tool.output.schema.properties.applied.const, true)
  assert.equal(harness.tool.output.schema.properties.saved.const, true)

  const contract = `${harness.tool.description}\n${harness.tool.parameters.properties.operations.description}`
  assert.match(contract, /I\(parentId, nodeJson\) inserts/)
  assert.match(contract, /U\(nodeId, patchJson\) updates/)
  assert.match(contract, /D\(nodeId\) deletes/)
  assert.match(contract, /M\(nodeId,parentId,index\) moves/)
  assert.match(contract, /C\(nodeId,parentId,overrides\) clones/)
  assert.match(contract, /R\(nodeId,nodeJson\) replaces/)
  // guidance: merge this round into a single batch (cold daemon per apply)
  assert.match(contract, /single compact batch/i)
  assert.match(contract, /every apply cold-starts/i)
  // saver semantics
  assert.match(contract, /saved: true/)
  assert.match(contract, /concurrent external edit .* rejects/)
  // render-verification guidance is asserted in the full-result deepEqual above
  // (the returned note carries "Run openpencil_render on this path").
})
