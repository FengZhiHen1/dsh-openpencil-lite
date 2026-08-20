#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const fixture = process.argv[2]
if (!fixture) throw new Error('usage: node scripts/test-host.mjs <design.op> [expected-width expected-height]')
const expectedWidth = process.argv[3] === undefined ? undefined : Number(process.argv[3])
const expectedHeight = process.argv[4] === undefined ? undefined : Number(process.argv[4])

const root = await mkdtemp(join(tmpdir(), 'dsh-openpencil-host-'))
process.env.DSH_HOME = join(root, 'dsh-home')

const {
  RENDER_ROUTE_PREFIX,
  RenderAccessController,
  createDocumentSnapshot,
  findOpenPencilBinary,
  projectRenderGrant,
  runOpenPencilRender,
  verifyRenderOutput,
} = await import('../lib/renderer.js')
const {
  VIEWER_ASSET_ROUTE_PREFIX,
  prepareViewerAssets,
} = await import('../lib/viewer-assets.js')
const { OPENPENCIL_RENDER_TOOL_NAME } = await import('../lib/tool-names.js')

let server
try {
  const mutableSource = join(root, basename(fixture))
  await copyFile(fixture, mutableSource)
  const sourceBytes = await readFile(mutableSource)
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex')
  const sourceDocument = JSON.parse(sourceBytes.toString('utf8'))
  const pageIndex = sourceDocument.editorMeta?.activePageIndex ?? sourceDocument.editorMeta?.active_page_index ?? 0
  const pages = Array.isArray(sourceDocument.pages) ? sourceDocument.pages : undefined
  const expectedFrames = pages?.[Math.min(pageIndex, pages.length - 1)]?.children ?? sourceDocument.children ?? []
  const snapshot = await createDocumentSnapshot(mutableSource)
  assert.equal(snapshot.sha256, sourceHash)
  assert.equal(snapshot.filename, `${sourceHash}.op`)

  // The immutable browser/render artifact must not follow later source edits.
  await writeFile(mutableSource, '{"version":"mutated-after-snapshot"}\n')
  assert.deepEqual(await readFile(snapshot.path), sourceBytes)
  await writeFile(mutableSource, sourceBytes)

  const binary = findOpenPencilBinary()
  assert.ok(binary, 'OpenPencil exact renderer should be installed for this smoke test')
  const exact = await runOpenPencilRender({
    binary,
    input: snapshot.path,
    scale: 1,
    signal: new AbortController().signal,
  })
  assert.equal(exact.frames.length, expectedFrames.length)
  assert.deepEqual(exact.frames.map(frame => frame.id), expectedFrames.map(frame => frame.id))
  assert.deepEqual(exact.frames.map(frame => frame.name), expectedFrames.map(frame => frame.name))
  assert.deepEqual(exact.frames.map(frame => frame.index), expectedFrames.map((_, index) => index))
  const verifiedFrames = await Promise.all(exact.frames.map(async frame => ({
    path: frame.png,
    filename: basename(frame.png),
    mimeType: 'image/png',
    ...await verifyRenderOutput(frame.png),
    id: frame.id,
    name: frame.name,
    index: frame.index,
  })))
  const image = verifiedFrames[0]
  if (expectedWidth !== undefined) assert.equal(image.width, expectedWidth)
  if (expectedHeight !== undefined) assert.equal(image.height, expectedHeight)

  const access = new RenderAccessController(Buffer.alloc(32, 7))
  const viewerAssets = await prepareViewerAssets()
  assert.equal(viewerAssets.available, true)
  const detachRender = access.attachRoute()
  const detachViewer = viewerAssets.attachRoute()

  const value = {
    path: exact.png,
    filename: basename(exact.png),
    mimeType: 'image/png',
    kind: 'image',
    description: 'host smoke',
    sourceTool: OPENPENCIL_RENDER_TOOL_NAME,
    previewIntent: 'image',
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    sha256: image.sha256,
    sourcePath: mutableSource,
    renderer: 'openpencil',
    rendererBinary: binary,
    fidelity: 'exact',
    warnings: exact.warnings,
    frames: verifiedFrames,
    frameCount: verifiedFrames.length,
    document: snapshot,
  }
  const projected = projectRenderGrant(value, access, viewerAssets.viewerGrant)
  const envelope = projected.$dshOpenPencil
  assert.equal(envelope.schemaVersion, 2)
  assert.equal(envelope.image.width, image.width)
  assert.equal(envelope.frames.length, expectedFrames.length)
  assert.deepEqual(envelope.frames.map(frame => frame.id), expectedFrames.map(frame => frame.id))
  assert.deepEqual(envelope.frames.map(frame => frame.name), expectedFrames.map(frame => frame.name))
  assert.deepEqual(envelope.frames.map(frame => frame.index), expectedFrames.map((_, index) => index))
  assert.equal(envelope.document.path, mutableSource)
  assert.equal(envelope.document.sha256, sourceHash)
  assert.equal(envelope.rendererBinary, binary)
  assert.ok(envelope.viewer.sdkUrl.includes('/viewer-assets/'))
  assert.equal('editor' in envelope, false, 'no editor grant may be projected (AC-09)')

  const decodedToken = JSON.parse(Buffer.from(envelope.image.previewUrl.split('/').at(-1).split('.')[0], 'base64url').toString())
  assert.equal(decodedToken.v, 2)
  assert.equal('path' in decodedToken, false, 'capability must not expose an absolute local path')

  server = createServer((req, res) => {
    if ((req.url ?? '').startsWith(VIEWER_ASSET_ROUTE_PREFIX)) void viewerAssets.handle(req, res)
    else void access.handle(req, res)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`

  const imageResponse = await fetch(`${origin}${envelope.image.previewUrl}`)
  assert.equal(imageResponse.status, 200)
  assert.equal(imageResponse.headers.get('content-type'), 'image/png')
  assert.equal((await imageResponse.arrayBuffer()).byteLength, image.bytes)
  for (const [index, frame] of envelope.frames.entries()) {
    const response = await fetch(`${origin}${frame.previewUrl}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal((await response.arrayBuffer()).byteLength, verifiedFrames[index].bytes)
  }

  const documentResponse = await fetch(`${origin}${envelope.document.url}`)
  assert.equal(documentResponse.status, 200)
  assert.equal(documentResponse.headers.get('content-type'), 'application/json')
  assert.deepEqual(Buffer.from(await documentResponse.arrayBuffer()), sourceBytes)

  const sdkResponse = await fetch(`${origin}${envelope.viewer.sdkUrl}`, { method: 'HEAD' })
  assert.equal(sdkResponse.status, 200)
  assert.match(sdkResponse.headers.get('content-type') ?? '', /^text\/javascript/)
  const wasmResponse = await fetch(`${origin}${envelope.viewer.wasmUrl}`, { method: 'HEAD' })
  assert.equal(wasmResponse.headers.get('content-type'), 'application/wasm')

  // The editor routes must be unmounted (AC-09): any editor prefix is 404.
  const editorProbe = await fetch(`${origin}/_dsh/dsh-openpencil-lite/editor/not-found`)
  assert.equal(editorProbe.status, 404)

  detachViewer()
  detachRender()
  console.log(JSON.stringify({
    renderer: 'openpencil',
    fidelity: 'exact',
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    frameCount: verifiedFrames.length,
    frameIds: verifiedFrames.map(frame => frame.id),
    sourceSha256: sourceHash,
    imageSha256: image.sha256,
    viewerAssets: true,
    editorRoutesMounted: false,
  }, null, 2))
} finally {
  if (server !== undefined) await new Promise(resolve => server.close(resolve))
  await rm(root, { recursive: true, force: true })
}
