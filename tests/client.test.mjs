import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const manifest = require('../package.json')
let client
let loadedPluginId
globalThis.window = {
  location: { href: 'http://127.0.0.1:3080/' },
  __ModuleLoader__: {
    load(definition) {
      loadedPluginId = definition.id
      client = definition.factory(require)
    },
  },
}
await import(`../lib/client.js?test=${Date.now()}`)

test('registers the client bundle under the published package name', () => {
  assert.equal(loadedPluginId, manifest.name)
})

test('client injects only slots + locale and no longer requires the editor surface', () => {
  assert.deepEqual(client.inject, ['slots', 'locale'])
})

function settledBlock(meta) {
  return {
    kind: 'result',
    isError: false,
    content: [],
    meta,
  }
}

const DOCUMENT_SHA256 = 'a'.repeat(64)

function v2Envelope() {
  return {
    $dshOpenPencil: {
      schemaVersion: 2,
      image: {
        path: '/renders/render-1.png',
        previewUrl: '/_dsh/dsh-openpencil-lite/render/token-a',
        downloadUrl: '/_dsh/dsh-openpencil-lite/render/token-a?download=1',
        width: 390,
        height: 844,
        id: 'n1',
        name: 'Home',
        index: 0,
      },
      frames: [{
        path: '/renders/render-1.png',
        previewUrl: '/_dsh/dsh-openpencil-lite/render/token-a',
        downloadUrl: '/_dsh/dsh-openpencil-lite/render/token-a?download=1',
        width: 390,
        height: 844,
        index: 0,
      }],
      document: {
        path: '/private/design.op',
        url: '/_dsh/dsh-openpencil-lite/render/token-d',
        downloadUrl: '/_dsh/dsh-openpencil-lite/render/token-d?download=1',
        bytes: 123,
        sha256: DOCUMENT_SHA256,
        mimeType: 'application/json',
      },
      viewer: {
        sdkUrl: '/_dsh/dsh-openpencil-lite/viewer-assets/rev/sdk.js',
        wasmUrl: '/_dsh/dsh-openpencil-lite/viewer-assets/rev/op_web_sdk_bg.wasm',
        canvasKitBaseUrl: '/_dsh/dsh-openpencil-lite/viewer-assets/rev/canvaskit/',
      },
      renderer: 'openpencil',
      rendererBinary: '/usr/local/bin/openpencil-desktop',
      fidelity: 'exact',
      warnings: [],
      // Legacy editors present an editor grant; the lite client must drop it.
      editor: { enabled: true, launchUrl: '/_dsh/dsh-openpencil-lite/editor/token/launch', refreshUrl: '/_dsh/dsh-openpencil-lite/editor/token/refresh' },
      autoOpenEditor: true,
    },
  }
}

test('grantOf parses the v2 envelope but never surfaces editor grants (AC-09)', () => {
  const grant = client.presentationGrantOfMeta(v2Envelope())
  assert.equal(grant.schemaVersion, 2)
  assert.equal(grant.frames.length, 1)
  assert.equal(grant.document.sha256, DOCUMENT_SHA256)
  assert.equal(grant.viewer.sdkUrl, '/_dsh/dsh-openpencil-lite/viewer-assets/rev/sdk.js')
  assert.equal(grant.renderer, 'openpencil')
  assert.equal(grant.fidelity, 'exact')
  assert.equal('editor' in grant, false, 'editor grant must never parse into the client state (AC-09)')
  assert.equal('autoOpenEditor' in grant, false)
})

test('grantOf ignores errors and malformed envelopes', () => {
  const errorBlock = settledBlock({ $dshOpenPencil: v2Envelope() })
  errorBlock.isError = true
  assert.equal(client.grantOf(errorBlock), undefined)
  assert.equal(client.presentationGrantOfMeta({}), undefined)
  assert.equal(client.presentationGrantOfMeta({ $dshOpenPencil: undefined }), undefined)
})

test('preview store is per-session and notifies subscribers (AC-04 data channel)', () => {
  const a = client.publishRecentRender('session-a', '/private/a.op', { schemaVersion: 2, image: { path: '/x.png' } })
  assert.equal(typeof a, 'undefined', 'publish returns nothing')
  let notified = 0
  const dispose = client.subscribeRecentRender(() => { notified += 1 })
  assert.equal(client.getRecentRender('session-a').path, '/private/a.op')
  assert.equal(client.getRecentRender('session-b'), undefined)
  client.publishRecentRender('session-a', '/private/a2.op', { schemaVersion: 2 })
  assert.equal(notified, 1)
  assert.equal(client.getRecentRender('session-a').path, '/private/a2.op')
  client.forgetSessionRenders('session-a')
  assert.equal(client.getRecentRender('session-a'), undefined)
  assert.equal(notified, 2)
  dispose()
})

test('preview tab identity and copy are exposed', () => {
  assert.equal(client.OPENPENCIL_PREVIEW_TAB_TYPE, 'openpencil:preview')
  assert.equal(client.designRenderCopy('en').previewTab, 'OpenPencil preview')
  assert.equal(client.designRenderCopy('zh').previewTabEmpty, '当前会话还没有渲染结果。')
  assert.equal(client.PRESENTATION_META_KEY, '$dshOpenPencil')
  assert.equal('designRender' in client.designRenderCopy('en'), false, 'inline-card copy must be gone')
  assert.equal('renderingDocument' in client.designRenderCopy('zh'), false, 'inline-card copy must be gone')
})

test('frame-gallery helpers and the silent render observer survive', () => {
  assert.equal(typeof client.SilentRenderObserver, 'function')
  assert.equal(typeof client.OpenPencilPreviewTab, 'function')
  assert.equal(typeof client.DesignRenderView, 'undefined', 'the inline card component must be gone')
  assert.equal(client.normalizeFrameIndex(9, 3), 2)
  assert.equal(client.frameLabel({ id: 'n1' }, 0), 'n1')
  assert.equal(client.frameLabel({ name: 'Home' }, 1), 'Home')
})

test('documentSha256FromCanonicalResult reads the durable snapshot hash', () => {
  assert.equal(client.documentSha256FromCanonicalResult(canonicalResult()), DOCUMENT_SHA256)
  assert.equal(client.documentSha256FromCanonicalResult({ kind: 'tool-result', isError: true }), undefined)
})

function canonicalResult() {
  return {
    kind: 'tool-result',
    isError: false,
    content: [{
      type: 'text',
      text: JSON.stringify({
        path: '/renders/render-1.png',
        sourcePath: '/private/design.op',
        document: { path: '/snapshots/x.op', sha256: DOCUMENT_SHA256 },
      }),
    }],
  }
}
