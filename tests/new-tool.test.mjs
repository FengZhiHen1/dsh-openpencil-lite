import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const { createDesignNewTool } = await import('../lib/new-tool.js')

function createHarness(options = {}) {
  const workspaceRoot = '/workspace/project'
  const requestedPath = options.requestedPath ?? 'designs/forage.op'
  // The tool runs a REAL lstat on the parent directory of the resolved
  // process path, so the default must be a directory that exists on every
  // platform (`/private/tmp` is macOS-only and breaks Linux CI).
  const processPath = options.processPath ?? join(tmpdir(), 'forage.op')
  const target = { targetKey: `local:${processPath}`, displayPath: requestedPath }
  const policy = { mode: 'workspace-write', workspaceRoot }
  const documentJson = options.documentJson ?? '{"version":"1.0.0","children":[{"id":"home"}]}\n'
  const calls = {
    policy: [],
    lstat: [],
    resolve: [],
    processPath: [],
    batch: [],
    write: [],
    observe: [],
  }
  const session = { id: 'session-new-tool', header: { cwd: workspaceRoot } }
  const signal = new AbortController().signal
  const exec = { agent: { id: 'agent-new-tool', session }, signal }
  const writeVersion = 'version-after-create'

  const fs = {
    sandboxMode: options.sandboxMode,
    async lstat(path, resolveOptions, receivedSignal) {
      calls.lstat.push({ path, options: resolveOptions, signal: receivedSignal })
      return options.pathInfo
    },
    async resolve(path, resolveOptions) {
      calls.resolve.push({ path, options: resolveOptions })
      return target
    },
    async stat() {
      return options.resolvedInfo
    },
    processPath(receivedTarget) {
      calls.processPath.push(receivedTarget)
      return processPath
    },
    async writeText(receivedTarget, content, intent, receivedSignal, sandboxPolicy) {
      calls.write.push({ target: receivedTarget, content, intent, signal: receivedSignal, sandboxPolicy })
      if (options.writeError !== undefined) throw options.writeError
      return {
        operation: 'create',
        version: writeVersion,
        before: null,
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
      return {
        documentJson,
        result: options.batchResult ?? { applied: true, inserted: 1 },
      }
    },
  }
  const tool = createDesignNewTool(editorHost, {
    fs,
    sandboxPolicy,
    observe(receivedTarget, observation, actor) {
      calls.observe.push({ target: receivedTarget, observation, actor })
    },
  })
  return { calls, documentJson, exec, policy, processPath, requestedPath, signal, target, tool, writeVersion }
}

test('openpencil_new publishes one completed batch through guarded DSH filesystem services', async () => {
  const harness = createHarness()
  const operations = 'root=I(null,{"type":"frame","name":"Forage","width":390,"height":844})'

  const result = await harness.tool.execute({
    path: harness.requestedPath,
    operations,
    canvasWidth: 390,
    postProcess: true,
  }, harness.exec)

  assert.deepEqual(harness.calls.policy, [{ session: harness.exec.agent.session }])
  assert.deepEqual(harness.calls.lstat, [{
    path: harness.requestedPath,
    options: { cwd: harness.policy.workspaceRoot },
    signal: harness.signal,
  }])
  assert.equal(harness.calls.resolve.length, 1)
  assert.equal(harness.calls.resolve[0].path, harness.requestedPath)
  assert.deepEqual(harness.calls.resolve[0].options, {
    cwd: harness.policy.workspaceRoot,
    signal: harness.signal,
  })
  assert.deepEqual(harness.calls.processPath, [harness.target])
  assert.deepEqual(harness.calls.batch, [{
    operations,
    canvasWidth: 390,
    postProcess: true,
    signal: harness.signal,
  }])
  assert.deepEqual(harness.calls.write, [{
    target: harness.target,
    content: harness.documentJson,
    intent: { kind: 'createIfAbsent' },
    signal: harness.signal,
    sandboxPolicy: harness.policy,
  }])
  assert.deepEqual(harness.calls.observe, [
    { target: harness.target, observation: { kind: 'absent' }, actor: harness.exec },
    { target: harness.target, observation: { kind: 'present', version: harness.writeVersion }, actor: harness.exec },
  ])

  const expectedText = harness.documentJson
  assert.deepEqual(result, {
    path: harness.processPath,
    filename: 'forage.op',
    bytes: Buffer.byteLength(expectedText),
    sha256: createHash('sha256').update(expectedText).digest('hex'),
    created: true,
    applied: true,
    saved: true,
    result: { applied: true, inserted: 1 },
    note: `Created and saved ${harness.processPath}. Call openpencil_render with this path now to show the design and verify it.`,
  })
})

test('openpencil_new hashes the filesystem-authoritative written text', async () => {
  const normalized = '{"version":"1.0.0","children":[]}\n'
  const harness = createHarness({ writtenText: normalized })

  const result = await harness.tool.execute({
    path: harness.requestedPath,
    operations: 'root=I(null,{"type":"frame","width":390,"height":844})',
  }, harness.exec)

  assert.equal(result.bytes, Buffer.byteLength(normalized))
  assert.equal(result.sha256, createHash('sha256').update(normalized).digest('hex'))
})

test('openpencil_new rejects an existing target before starting a design daemon', async () => {
  const harness = createHarness({
    pathInfo: { type: 'file', version: 'existing-version', size: 12 },
  })

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: 'root=I(null,{"type":"frame"})',
    }, harness.exec),
    /target already exists: designs\/forage\.op/,
  )
  assert.equal(harness.calls.resolve.length, 0)
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
  assert.deepEqual(harness.calls.observe, [])
})

test('openpencil_new rejects a resolved target that appeared after the no-follow probe', async () => {
  const harness = createHarness({
    resolvedInfo: { type: 'file', version: 'raced-version', size: 24 },
  })

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: 'root=I(null,{"type":"frame"})',
    }, harness.exec),
    /target already exists: designs\/forage\.op/,
  )
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
  assert.deepEqual(harness.calls.observe, [
    { target: harness.target, observation: { kind: 'present', version: 'raced-version' }, actor: harness.exec },
  ])
})

test('openpencil_new fails before daemon startup in a read-only sandbox', async () => {
  const harness = createHarness({ sandboxMode: 'read-only' })
  harness.policy.mode = 'read-only'

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: 'root=I(null,{"type":"frame"})',
    }, harness.exec),
    /requires Workspace Write access/,
  )
  assert.equal(harness.calls.lstat.length, 0)
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
})

test('openpencil_new preserves create-if-absent publication failures', async () => {
  const race = new Error('competitor created the target')
  const harness = createHarness({ writeError: race })

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: 'root=I(null,{"type":"frame"})',
    }, harness.exec),
    error => error === race,
  )
  assert.equal(harness.calls.batch.length, 1)
  assert.equal(harness.calls.write.length, 1)
  assert.deepEqual(harness.calls.write[0].intent, { kind: 'createIfAbsent' })
  assert.deepEqual(harness.calls.observe, [
    { target: harness.target, observation: { kind: 'absent' }, actor: harness.exec },
  ])
})

test('openpencil_new never publishes a target when the transactional design batch fails', async () => {
  const batchFailure = new Error('batch_design rejected line 4')
  const harness = createHarness({ batchError: batchFailure })

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: 'root=I(null,{"type":"frame"})',
    }, harness.exec),
    error => error === batchFailure,
  )
  assert.equal(harness.calls.batch.length, 1)
  assert.equal(harness.calls.write.length, 0)
  assert.deepEqual(harness.calls.observe, [
    { target: harness.target, observation: { kind: 'absent' }, actor: harness.exec },
  ])
})

test('openpencil_new validates paths and programs before acquiring filesystem or daemon capabilities', async () => {
  const harness = createHarness()
  const tooLarge = 'x'.repeat(256 * 1024 + 1)
  for (const [args, pattern] of [
    [{ path: '   ', operations: 'root=I(null,{"type":"frame"})' }, /path is required/],
    [{ path: 'design.json', operations: 'root=I(null,{"type":"frame"})' }, /path must end in \.op/],
    [{ path: 'design.op', operations: '   ' }, /operations must not be empty/],
    [{ path: 'design.op', operations: tooLarge }, /operations are too large/],
    [{ path: 'design.op', operations: 'root=I(null,{"type":"frame"})', canvasWidth: 0 }, /canvasWidth must be greater than 0/],
    [{ path: 'design.op', operations: 'root=I(null,{"type":"frame"})', canvasWidth: 16385 }, /canvasWidth must be greater than 0/],
  ]) {
    await assert.rejects(harness.tool.execute(args, harness.exec), pattern)
  }
  assert.equal(harness.calls.policy.length, 0)
  assert.equal(harness.calls.lstat.length, 0)
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
})

test('openpencil_new refuses a provider-resolved non-op process path', async () => {
  const harness = createHarness({ processPath: '/workspace/project/designs/forage.json' })

  await assert.rejects(
    harness.tool.execute({
      path: harness.requestedPath,
      operations: 'root=I(null,{"type":"frame"})',
    }, harness.exec),
    /resolved target must end in \.op/,
  )
  assert.equal(harness.calls.batch.length, 0)
  assert.equal(harness.calls.write.length, 0)
  assert.deepEqual(harness.calls.observe, [])
})

test('openpencil_new exposes a strict creation schema and output contract', () => {
  const harness = createHarness()
  assert.equal(harness.tool.name, 'openpencil_new')
  assert.deepEqual([...harness.tool.parameters.required].sort(), ['operations', 'path'])
  assert.equal(harness.tool.output.schema.additionalProperties, false)
  assert.equal(harness.tool.output.schema.properties.created.const, true)
  assert.equal(harness.tool.output.schema.properties.applied.const, true)
  assert.equal(harness.tool.output.schema.properties.saved.const, true)
  assert.deepEqual(harness.tool.presentCall({
    path: harness.requestedPath,
    operations: 'root=I(null,{"type":"frame"})',
  }), {
    card: 'generic',
    title: `Create ${harness.requestedPath}`,
    kind: 'execute',
    locations: [{ path: harness.requestedPath }],
  })

  const decisionContract = `${harness.tool.description}\n${harness.tool.parameters.properties.operations.description}`
  assert.doesNotMatch(decisionContract, /\{\.\.\.\}/, 'model-facing examples must be executable rather than schematic')
  assert.match(decisionContract, /no \.op file exists/i)
  assert.match(decisionContract, /do not ask the user to open a sidebar/i)
  assert.match(decisionContract, /prefer(?:ably)? at most 25 top-level operations/i)
  assert.match(decisionContract, /root=I\(null,/)
  assert.match(decisionContract, /photo=G\(slot,"search","seasonal food photography"\)/)
  assert.match(decisionContract, /do not ask image-provider questions/i)
  assert.match(decisionContract, /openpencil_render with the returned path/i)
  assert.doesNotMatch(decisionContract, /editable=true/i, 'no editor guidance must remain in the new-tool contract')
  assert.doesNotMatch(decisionContract, /autoOpen/i, 'no editor auto-open guidance must remain')
})
