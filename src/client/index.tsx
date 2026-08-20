/**
 * Browser-side presentation for `openpencil_render` and historical
 * `design_render` conversation cards.
 *
 * The inline conversation card is deliberately hidden: renders appear only in
 * the `openpencil:preview` sidebar tab (registered against `dsh-better-sidebar`
 * when present). A silent observer mounted on the tool-call slot recovers the
 * browser-only grant envelope and feeds the per-session preview store; the
 * tab then renders PNG frames and the optional read-only Web SDK canvas.
 * Without `dsh-better-sidebar` the plugin renders no inline card at all.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { FrameGallery, normalizeFrameIndex as normalizedFrameIndex } from './frame-gallery.js'
import type { GalleryFrame, GalleryLocale } from './frame-gallery.js'
import {
  presentationHydrationRequestOf,
  requestPresentationGrant,
} from './presentation-hydration.js'
import {
  getRecentRender,
  publishRecentRender,
  subscribeRecentRender,
  type RecentRender,
} from './preview-store.js'
import {
  LEGACY_DESIGN_RENDER_TOOL_NAME,
  OPENPENCIL_RENDER_TOOL_NAME,
} from '../tool-names.js'

export {
  LEGACY_DESIGN_RENDER_TOOL_NAME,
  OPENPENCIL_RENDER_TOOL_NAME,
} from '../tool-names.js'

export {
  calculateGalleryFitViewZoom,
  clampGalleryZoom,
  frameLabel,
  frameGalleryCopy,
  galleryZoomCommandTarget,
  galleryViewportMaxHeight,
  galleryZoomPercent,
  galleryZoomShortcut,
  GALLERY_COMPACT_MAX_HEIGHT,
  GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT,
  GALLERY_TOOLBAR_CONTROL_HEIGHT,
  GALLERY_TOOLBAR_CONTROL_LAYOUT,
  GALLERY_ZOOM_MAX,
  GALLERY_ZOOM_MIN,
  GALLERY_ZOOM_STEP,
  nextGalleryZoom,
  normalizeFrameIndex,
} from './frame-gallery.js'
export {
  requestPresentationGrant,
  PRESENTATION_HYDRATION_ENDPOINT,
  presentationHydrationRequestOf,
  documentSha256FromCanonicalResult,
} from './presentation-hydration.js'
export {
  forgetSessionRenders,
  getRecentRender,
  publishRecentRender,
  subscribeRecentRender,
  type RecentRender,
} from './preview-store.js'

/** Presentation metadata key the host half projects into `block.meta`. */
export const PRESENTATION_META_KEY = '$dshOpenPencil'

/** Sidebar tab type owned by this plugin (registered when better-sidebar is present). */
export const OPENPENCIL_PREVIEW_TAB_TYPE = 'openpencil:preview' as const

export type PresentationLocale = GalleryLocale

const DESIGN_RENDER_COPY = {
  en: {
    frames: 'frames',
    openInteractiveCanvas: 'Open interactive canvas',
    downloadPng: 'Download PNG',
    downloadSource: 'Download source .op',
    canvas: 'OpenPencil canvas',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    fit: 'Fit',
    close: 'Close',
    readonlyCanvas: 'Read-only OpenPencil design canvas',
    loadingCanvas: 'Loading interactive canvas…',
    pngRemains: 'PNG preview remains available underneath the dialog.',
    canvasUnavailable: 'Interactive canvas unavailable',
    openPngFallback: 'Open PNG fallback',
    panHint: 'Drag to pan · scroll to pan · Ctrl/⌘ + scroll to zoom',
    snapshot: 'snapshot',
    previewTab: 'OpenPencil preview',
    previewTabEmpty: 'No render yet for this session.',
    previewTabEmptyHint: 'Ask the agent to run openpencil_render to see the design preview here.',
    openSource: 'Open source .op',
  },
  zh: {
    frames: '页',
    openInteractiveCanvas: '打开交互画布',
    downloadPng: '下载 PNG',
    downloadSource: '下载源文件 .op',
    canvas: 'OpenPencil 画布',
    zoomOut: '缩小',
    zoomIn: '放大',
    fit: '适应窗口',
    close: '关闭',
    readonlyCanvas: '只读 OpenPencil 设计画布',
    loadingCanvas: '正在加载交互画布…',
    pngRemains: '对话框下方仍保留 PNG 预览。',
    canvasUnavailable: '交互画布不可用',
    openPngFallback: '打开 PNG 预览',
    panHint: '拖动平移 · 滚动平移 · Ctrl/⌘ + 滚动缩放',
    snapshot: '快照',
    previewTab: 'OpenPencil 预览',
    previewTabEmpty: '当前会话还没有渲染结果。',
    previewTabEmptyHint: '请让 Agent 执行 openpencil_render，设计预览会显示在这里。',
    openSource: '打开源文件 .op',
  },
} as const

export function designRenderCopy(locale: PresentationLocale) {
  return DESIGN_RENDER_COPY[locale]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface ImageGrant extends GalleryFrame {}

export interface DocumentGrant {
  path?: string
  url: string
  downloadUrl?: string
  bytes?: number
  sha256?: string
  mimeType?: string
}

export interface ViewerGrant {
  sdkUrl: string
  wasmUrl: string
  canvasKitBaseUrl: string
}

export interface PresentationGrant {
  schemaVersion: 1 | 2
  image?: ImageGrant
  frames?: ImageGrant[]
  document?: DocumentGrant
  viewer?: ViewerGrant
  renderer?: string
  rendererBinary?: string
  fidelity?: string
  warnings?: string[]
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function optionalFiniteNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalStrings(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key]
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  return strings.length === 0 ? undefined : strings
}

function imageGrantOf(value: unknown): ImageGrant | undefined {
  if (!isRecord(value)) return undefined
  const path = optionalString(value, 'path')
  const previewUrl = optionalString(value, 'previewUrl')
  const downloadUrl = optionalString(value, 'downloadUrl')
  if (path === undefined || previewUrl === undefined || downloadUrl === undefined) return undefined
  const id = optionalString(value, 'id')
  const name = optionalString(value, 'name')
  const index = optionalFiniteNumber(value, 'index')
  return {
    path,
    previewUrl,
    downloadUrl,
    width: optionalFiniteNumber(value, 'width'),
    height: optionalFiniteNumber(value, 'height'),
    ...(id === undefined ? {} : { id }),
    ...(name === undefined ? {} : { name }),
    ...(index === undefined || !Number.isSafeInteger(index) || index < 0 ? {} : { index }),
  }
}

function imageGrantsOf(value: unknown): ImageGrant[] | undefined {
  if (!Array.isArray(value)) return undefined
  const frames = value.map(imageGrantOf).filter((frame): frame is ImageGrant => frame !== undefined)
  return frames.length === 0 ? undefined : frames
}

function documentGrantOf(envelope: Record<string, unknown>, image: unknown): DocumentGrant | undefined {
  const raw = isRecord(envelope.document) ? envelope.document : undefined
  const legacyImage = isRecord(image) ? image : undefined
  const url = raw === undefined
    ? optionalString(envelope, 'documentUrl')
      ?? optionalString(envelope, 'sourceUrl')
      ?? (legacyImage === undefined ? undefined : optionalString(legacyImage, 'documentUrl')
        ?? optionalString(legacyImage, 'sourceUrl')
        ?? optionalString(legacyImage, 'opUrl'))
    : optionalString(raw, 'url') ?? optionalString(raw, 'documentUrl')
  if (url === undefined) return undefined
  return {
    url,
    path: raw === undefined ? optionalString(envelope, 'sourcePath') : optionalString(raw, 'path'),
    downloadUrl: raw === undefined
      ? optionalString(envelope, 'documentDownloadUrl')
      : optionalString(raw, 'downloadUrl'),
    bytes: raw === undefined ? undefined : optionalFiniteNumber(raw, 'bytes'),
    sha256: raw === undefined ? undefined : optionalString(raw, 'sha256'),
    mimeType: raw === undefined ? undefined : optionalString(raw, 'mimeType'),
  }
}

function viewerGrantOf(value: unknown): ViewerGrant | undefined {
  if (!isRecord(value)) return undefined
  const sdkUrl = optionalString(value, 'sdkUrl')
  const wasmUrl = optionalString(value, 'wasmUrl')
  const canvasKitBaseUrl = optionalString(value, 'canvasKitBaseUrl')
    ?? optionalString(value, 'assetBaseUrl')
  if (sdkUrl === undefined || wasmUrl === undefined || canvasKitBaseUrl === undefined) return undefined
  return { sdkUrl, wasmUrl, canvasKitBaseUrl }
}

/** Parse both the established v1 envelope and the additive v2 shape. */
export function presentationGrantOfMeta(metaValue: unknown): PresentationGrant | undefined {
  const meta = isRecord(metaValue) ? metaValue : undefined
  const envelope = meta?.[PRESENTATION_META_KEY]
  if (!isRecord(envelope) || (envelope.schemaVersion !== 1 && envelope.schemaVersion !== 2)) return undefined
  const frames = imageGrantsOf(envelope.frames)
  const image = imageGrantOf(envelope.image) ?? frames?.[0]
  const document = documentGrantOf(envelope, envelope.image)
  if (image === undefined && document === undefined) return undefined
  return {
    schemaVersion: envelope.schemaVersion,
    image,
    frames: frames ?? (image === undefined ? undefined : [image]),
    document,
    viewer: viewerGrantOf(envelope.viewer),
    renderer: optionalString(envelope, 'renderer'),
    rendererBinary: optionalString(envelope, 'rendererBinary'),
    fidelity: optionalString(envelope, 'fidelity'),
    warnings: optionalStrings(envelope, 'warnings'),
  }
}

export function grantOf(block: ToolCallViewProps['block']): PresentationGrant | undefined {
  if (!('kind' in block) || block.isError) return undefined
  return presentationGrantOfMeta(block.meta)
}

interface Viewport {
  panX: number
  panY: number
  zoom: number
}

interface OpViewer {
  readonly viewport: Viewport
  setZoom(zoom: number): void
  panTo(panX: number, panY: number): void
  zoomToFit(width: number, height: number): void
  on(event: 'viewportchange', callback: () => void): () => void
  destroy(): void
}

interface OpenPencilSdk {
  createViewer(options: {
    canvas: HTMLCanvasElement
    doc: string | Uint8Array
    wasmUrl?: string
    canvasKitBaseUrl?: string
  }): Promise<OpViewer>
}

const sdkLoads = new Map<string, Promise<OpenPencilSdk>>()

/** Load the host-served ESM core SDK without coupling the client bundle to React 19. */
export function loadOpenPencilSdk(url: string): Promise<OpenPencilSdk> {
  const absoluteUrl = new URL(url, window.location.href).href
  let pending = sdkLoads.get(absoluteUrl)
  if (pending === undefined) {
    pending = import(/* @vite-ignore */ absoluteUrl).then((module: unknown) => {
      if (!isRecord(module) || typeof module.createViewer !== 'function') {
        throw new Error('OpenPencil viewer SDK did not export createViewer')
      }
      return module as unknown as OpenPencilSdk
    })
    sdkLoads.set(absoluteUrl, pending)
    pending.catch(() => { sdkLoads.delete(absoluteUrl) })
  }
  return pending
}

interface ActiveCanvas {
  token: symbol
  close: () => void
}

let activeCanvas: ActiveCanvas | undefined

/** @internal Claim the page-wide SDK singleton; opening another canvas closes this one. */
export function claimCanvas(token: symbol, close: () => void): () => void {
  const previous = activeCanvas
  activeCanvas = { token, close }
  if (previous !== undefined && previous.token !== token) previous.close()
  return () => {
    if (activeCanvas?.token === token) activeCanvas = undefined
  }
}

const styles: Record<string, React.CSSProperties> = {
  imageViewport: {
    maxHeight: 560,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    borderRadius: 4,
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-bg-skeleton)',
  },
  img: {
    display: 'block', width: 'auto', maxWidth: '100%', height: 'auto', margin: '0 auto',
  },
  meta: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
    marginTop: 10, fontSize: 12, color: 'var(--ui-text-muted)',
  },
  link: { color: 'var(--dsw-alias-state-business-primary)', textDecoration: 'none' },
  button: {
    color: 'var(--dsw-alias-state-business-primary)', background: 'none', border: 'none',
    cursor: 'pointer', padding: 0, font: 'inherit', fontSize: 12,
  },
  primaryButton: {
    border: '1px solid var(--dsw-alias-state-business-primary)', borderRadius: 6,
    color: 'var(--dsw-alias-state-business-primary)', background: 'transparent',
    padding: '4px 9px', cursor: 'pointer', font: 'inherit', fontSize: 12,
  },
  muted: { fontSize: 12, color: 'var(--ui-text-muted)' },
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 2147483000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, background: 'var(--dsw-alias-bg-mask-3)',
  },
  dialog: {
    width: 'min(1120px, 94vw)', height: 'min(820px, 92vh)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    border: '1px solid var(--dsw-alias-border-l3)', borderRadius: 10,
    background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--ui-text)',
    boxShadow: '0 24px 80px var(--dsw-alias-bg-mask-3)',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    minHeight: 44, padding: '7px 10px',
    borderBottom: '1px solid var(--dsw-alias-border-l2)',
  },
  canvasWrap: { position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--dsw-alias-bg-layer-3)' },
  canvas: { display: 'block', width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' },
  overlay: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column', gap: 10,
    padding: 24, textAlign: 'center', background: 'var(--dsw-alias-bg-mask-3)',
  },
  tabBody: {
    display: 'flex', flexDirection: 'column', gap: 10, padding: 12, fontSize: 12,
  },
  tabEmpty: {
    padding: 16, textAlign: 'center', color: 'var(--ui-text-muted)', fontSize: 12,
  },
  tabHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, color: 'var(--ui-text-muted)',
  },
  tabActions: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
    color: 'var(--ui-text-muted)',
  },
}

function baseName(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || path
}

/** Size the canvas backing store to its CSS box before CanvasKit attaches. */
export function sizeCanvasForDisplay(
  canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight' | 'width' | 'height'>,
  devicePixelRatio = window.devicePixelRatio,
): { cssWidth: number; cssHeight: number; dpr: number } {
  const cssWidth = Math.max(1, Math.round(canvas.clientWidth))
  const cssHeight = Math.max(1, Math.round(canvas.clientHeight))
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  canvas.width = Math.max(1, Math.round(cssWidth * dpr))
  canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  return { cssWidth, cssHeight, dpr }
}

function CanvasModal({ grant, onClose, locale }: {
  grant: PresentationGrant
  onClose: () => void
  locale: PresentationLocale
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<OpViewer>()
  const dragRef = useRef<{ id: number; x: number; y: number; panX: number; panY: number }>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [failure, setFailure] = useState('')
  const [viewport, setViewport] = useState<Viewport>({ panX: 0, panY: 0, zoom: 1 })
  const documentGrant = grant.document
  const viewerGrant = grant.viewer
  const copy = designRenderCopy(locale)

  const fit = useCallback(() => {
    const viewer = viewerRef.current
    const canvas = canvasRef.current
    if (viewer === undefined || canvas === null) return
    viewer.zoomToFit(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight))
    setViewport(viewer.viewport)
  }, [])

  const zoomBy = useCallback((factor: number) => {
    const viewer = viewerRef.current
    if (viewer === undefined) return
    viewer.setZoom(Math.min(16, Math.max(0.05, viewer.viewport.zoom * factor)))
    setViewport(viewer.viewport)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null || documentGrant === undefined || viewerGrant === undefined) return
    sizeCanvasForDisplay(canvas)
    const abort = new AbortController()
    let cancelled = false
    let created: OpViewer | undefined
    setPhase('loading')
    setFailure('')

    const load = async (): Promise<void> => {
      try {
        const [sdk, response] = await Promise.all([
          loadOpenPencilSdk(viewerGrant.sdkUrl),
          fetch(documentGrant.url, { signal: abort.signal, credentials: 'same-origin' }),
        ])
        if (!response.ok) throw new Error(`OpenPencil document request failed (${response.status})`)
        const source = await response.text()
        if (cancelled) return
        created = await sdk.createViewer({
          canvas,
          doc: source,
          wasmUrl: viewerGrant.wasmUrl,
          canvasKitBaseUrl: viewerGrant.canvasKitBaseUrl,
        })
        if (cancelled) {
          created.destroy()
          return
        }
        viewerRef.current = created
        const syncViewport = (): void => { if (!cancelled && created !== undefined) setViewport(created.viewport) }
        created.on('viewportchange', syncViewport)
        setPhase('ready')
        requestAnimationFrame(() => { if (!cancelled) fit() })
      } catch (error) {
        if (cancelled || abort.signal.aborted) return
        setFailure(error instanceof Error ? error.message : String(error))
        setPhase('error')
      }
    }
    void load()
    return () => {
      cancelled = true
      abort.abort()
      viewerRef.current = undefined
      created?.destroy()
    }
  }, [documentGrant?.url, fit, viewerGrant?.canvasKitBaseUrl, viewerGrant?.sdkUrl, viewerGrant?.wasmUrl])

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const viewer = viewerRef.current
    if (viewer === undefined) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const current = viewer.viewport
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: current.panX, panY: current.panY }
  }
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current
    const viewer = viewerRef.current
    if (drag === undefined || drag.id !== event.pointerId || viewer === undefined) return
    viewer.panTo(drag.panX + event.clientX - drag.x, drag.panY + event.clientY - drag.y)
    setViewport(viewer.viewport)
  }
  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = undefined
  }

  const title = documentGrant?.path === undefined ? copy.canvas : baseName(documentGrant.path)
  return (
    <div
      style={styles.backdrop}
      role="presentation"
      data-openpencil-canvas-modal="true"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div style={styles.dialog} role="dialog" aria-modal="true" aria-label={`${copy.canvas}: ${title}`}>
        <div style={styles.toolbar}>
          <strong style={{ marginRight: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</strong>
          <button type="button" style={styles.primaryButton} disabled={phase !== 'ready'} onClick={() => { zoomBy(0.8) }} aria-label={copy.zoomOut}>−</button>
          <span style={styles.muted}>{Math.round(viewport.zoom * 100)}%</span>
          <button type="button" style={styles.primaryButton} disabled={phase !== 'ready'} onClick={() => { zoomBy(1.25) }} aria-label={copy.zoomIn}>+</button>
          <button type="button" style={styles.primaryButton} disabled={phase !== 'ready'} onClick={fit}>{copy.fit}</button>
          <button type="button" style={styles.primaryButton} onClick={onClose}>{copy.close}</button>
        </div>
        <div style={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            style={styles.canvas}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            aria-label={copy.readonlyCanvas}
          />
          {phase === 'loading' ? (
            <div style={styles.overlay} role="status"><strong>{copy.loadingCanvas}</strong><span style={styles.muted}>{copy.pngRemains}</span></div>
          ) : null}
          {phase === 'error' ? (
            <div style={styles.overlay} role="alert">
              <strong>{copy.canvasUnavailable}</strong>
              <span style={styles.muted}>{failure}</span>
              {grant.image !== undefined ? <a style={styles.link} href={grant.image.previewUrl} target="_blank" rel="noreferrer">{copy.openPngFallback}</a> : null}
            </div>
          ) : null}
        </div>
        <div style={{ ...styles.meta, margin: 0, padding: '7px 10px' }}>
          <span>{copy.panHint}</span>
          {documentGrant?.sha256 !== undefined ? <span title={documentGrant.sha256}>{copy.snapshot} {documentGrant.sha256.slice(0, 10)}</span> : null}
        </div>
      </div>
    </div>
  )
}

/** Open-tab seed the plugin pushes once its `openpencil:preview` tab registers. */
interface PreviewOpenTabSeed {
  type: typeof OPENPENCIL_PREVIEW_TAB_TYPE
  path?: string
  sessionId?: string
}

let previewOpenTab: ((seed: PreviewOpenTabSeed) => void) | undefined

/** Structural subset of dsh-better-sidebar's TabComponentProps. */
interface SidebarPreviewTabProps {
  ctx: unknown
  scope: { sessionId?: string }
  tab: unknown
  visible: boolean
  expanded?: string[]
  onToggleDir?: (path: string) => void
  onReferenceFile?: (path: string) => void
  onOpenFile?: (path: string) => void
  onOpenDiff?: (tab: unknown) => void
  onSubagentJump?: (childSessionId: string) => void
  locale?: PresentationLocale
}

function openModalCanvas(
  setModalToken: React.Dispatch<React.SetStateAction<symbol | undefined>>,
  releaseRef: React.MutableRefObject<(() => void) | undefined>,
): void {
  const token = Symbol('openpencil-preview-canvas')
  releaseRef.current?.()
  releaseRef.current = claimCanvas(token, () => {
    setModalToken(current => current === token ? undefined : current)
  })
  setModalToken(token)
}

function closeModalCanvas(
  setModalToken: React.Dispatch<React.SetStateAction<symbol | undefined>>,
  releaseRef: React.MutableRefObject<(() => void) | undefined>,
): void {
  releaseRef.current?.()
  releaseRef.current = undefined
  setModalToken(undefined)
}

/** The `openpencil:preview` sidebar tab: latest render of the session. */
export function OpenPencilPreviewTab(props: SidebarPreviewTabProps): React.JSX.Element {
  const { scope, onOpenFile, locale = 'en' } = props
  const copy = designRenderCopy(locale)
  const sessionId = typeof scope?.sessionId === 'string' ? scope.sessionId : undefined
  const recent: RecentRender | undefined = useSyncExternalStore(
    subscribeRecentRender,
    () => (sessionId === undefined ? undefined : getRecentRender(sessionId)),
    () => (sessionId === undefined ? undefined : getRecentRender(sessionId)),
  )
  const grant = isRecord(recent?.grants) ? (recent.grants as unknown as PresentationGrant) : undefined
  const frames = grant?.frames ?? []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const currentIndex = normalizedFrameIndex(selectedIndex, frames.length)
  const selectedFrame = frames[currentIndex] ?? grant?.image
  const [modalToken, setModalToken] = useState<symbol>()
  const releaseRef = useRef<() => void>()
  useEffect(() => () => { releaseRef.current?.() }, [])
  useEffect(() => { setSelectedIndex(0) }, [frames.map(frame => frame.previewUrl).join('\n')])

  if (recent === undefined || grant === undefined) {
    return (
      <div style={styles.tabEmpty} data-openpencil-preview-tab="empty">
        <strong>{copy.previewTabEmpty}</strong>
        <div style={{ marginTop: 6 }}>{copy.previewTabEmptyHint}</div>
      </div>
    )
  }

  return (
    <div style={styles.tabBody} data-openpencil-preview-tab="ready">
      <div style={styles.tabHeader}>
        <span>{baseName(recent.path)}</span>
        {frames.length > 1 ? <span>{frames.length} {copy.frames}</span> : null}
      </div>
      {frames.length > 0 ? (
        <FrameGallery frames={frames} selectedIndex={currentIndex} onSelect={setSelectedIndex} locale={locale} />
      ) : selectedFrame !== undefined ? (
        <div style={styles.imageViewport}><img style={styles.img} src={selectedFrame.previewUrl} alt={selectedFrame.name ?? baseName(selectedFrame.path)} /></div>
      ) : null}
      <div style={styles.tabActions}>
        {grant.renderer !== undefined ? (
          <span title={grant.rendererBinary}>{grant.renderer}{grant.fidelity === undefined ? '' : ` · ${grant.fidelity}`}</span>
        ) : null}
        {grant.document?.sha256 !== undefined ? <span title={grant.document.sha256}>sha256 {grant.document.sha256.slice(0, 10)}</span> : null}
      </div>
      <div style={styles.tabActions}>
        {grant.document !== undefined && grant.viewer !== undefined ? (
          <button type="button" style={styles.primaryButton} onClick={() => { openModalCanvas(setModalToken, releaseRef) }}>{copy.openInteractiveCanvas}</button>
        ) : null}
        {selectedFrame !== undefined ? <a style={styles.link} href={selectedFrame.downloadUrl} download>{copy.downloadPng}</a> : null}
        {grant.document?.downloadUrl !== undefined ? <a style={styles.link} href={grant.document.downloadUrl} download>{copy.downloadSource}</a> : null}
        {grant.document?.path !== undefined && typeof onOpenFile === 'function' ? (
          <button type="button" style={styles.button} onClick={() => { onOpenFile(grant.document?.path ?? '') }}>{copy.openSource}</button>
        ) : null}
      </div>
      {modalToken !== undefined && grant.document !== undefined && grant.viewer !== undefined
        ? <CanvasModal grant={grant} onClose={() => { closeModalCanvas(setModalToken, releaseRef) }} locale={locale} />
        : null}
    </div>
  )
}

/**
 * Silent observer mounted on `openpencil_render` / `design_render` tool calls.
 *
 * Renders NOTHING inline (the conversation card is hidden by design). It
 * recovers the browser-only presentation grant (embedded or hydrated) and, on
 * settle, feeds the session's preview store and focuses the sidebar tab.
 */
export function SilentRenderObserver({
  block,
  callId,
  toolName,
  sessionId,
}: ToolCallViewProps & {
  sessionId: unknown
}): React.JSX.Element | null {
  const settled = 'kind' in block
  const error = settled && block.isError
  const running = !settled
  const embeddedGrant = grantOf(block)
  const hydrationRequest = !running && !error
    ? presentationHydrationRequestOf({
      block,
      toolName,
      sessionId: String(sessionId),
      callId,
      embeddedGrant,
    })
    : undefined
  const hydrationKey = hydrationRequest === undefined
    ? undefined
    : `${hydrationRequest.sessionId}\n${hydrationRequest.callId}\n${hydrationRequest.documentSha256}`
  const [hydrated, setHydrated] = useState<{ key: string; grant: PresentationGrant }>()
  const grant = embeddedGrant
    ?? (hydrated !== undefined && hydrated.key === hydrationKey ? hydrated.grant : undefined)

  useEffect(() => {
    if (hydrationKey === undefined || hydrationRequest === undefined) return
    const controller = new AbortController()
    void requestPresentationGrant(hydrationRequest, presentationGrantOfMeta, { signal: controller.signal }).then(nextGrant => {
      if (nextGrant !== undefined && !controller.signal.aborted) {
        setHydrated({ key: hydrationKey, grant: nextGrant })
      }
    })
    return () => { controller.abort() }
    // The semantic key contains every request field. Depending on `block`
    // itself would restart a local exchange whenever DSH reprojects a snapshot.
  }, [hydrationKey])

  // Settle: publish the session's most recent render and focus the preview tab.
  const settleGrant = !running && !error ? grant : undefined
  useEffect(() => {
    if (settleGrant === undefined) return
    const sourcePath = settleGrant.document?.path ?? settleGrant.image?.path
    if (sourcePath === undefined) return
    const sid = String(sessionId)
    publishRecentRender(sid, sourcePath, settleGrant)
    previewOpenTab?.({ type: OPENPENCIL_PREVIEW_TAB_TYPE, path: sourcePath, sessionId: sid })
  }, [settleGrant])

  return null
}

/** Required client services. */
export const inject = ['slots', 'locale']

/** Register the silent render observer plus the optional sidebar preview tab. */
export function apply(ctx: ClientContext): void {
  const subscribeLocale = (notify: () => void): (() => boolean) => ctx.on('locale/change', notify)
  const getLocale = (): PresentationLocale => ctx.locale.getLocale().active

  // The inline card is hidden: the observer renders nothing and only feeds the
  // preview store + opens the sidebar tab.
  for (const toolName of [OPENPENCIL_RENDER_TOOL_NAME, LEGACY_DESIGN_RENDER_TOOL_NAME]) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key: toolName },
      SilentRenderObserver,
    ))
  }

  // Optional better-sidebar preview tab. This fiber only runs when the
  // service is provided; without it the plugin degrades to inline cards.
  ctx.inject(['betterSidebar'], (injectedCtx) => {
    const sidebar = (injectedCtx as unknown as { betterSidebar?: unknown }).betterSidebar
    if (sidebar === null || typeof sidebar !== 'object') return () => {}
    const service = sidebar as {
      registerTab?: (descriptor: unknown) => () => void
      openTab?: (seed: unknown, scope?: unknown) => void
    }
    if (typeof service.registerTab !== 'function' || typeof service.openTab !== 'function') return () => {}
    const { registerTab, openTab: sideOpenTab } = service
    const openTab = (seed: PreviewOpenTabSeed): void => {
      sideOpenTab(
        { type: OPENPENCIL_PREVIEW_TAB_TYPE, ...(seed.path === undefined ? {} : { path: seed.path }) },
        seed.sessionId === undefined ? undefined : { sessionId: seed.sessionId },
      )
    }
    previewOpenTab = openTab
    const dispose = registerTab({
      id: OPENPENCIL_PREVIEW_TAB_TYPE,
      title: () => designRenderCopy(getLocale()).previewTab,
      single: true,
      component: (props: SidebarPreviewTabProps) => {
        // Component-level locale subscription so tab copy follows DSH locale.
        const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)
        return <OpenPencilPreviewTab {...props} locale={locale} />
      },
    })
    return () => {
      dispose()
      if (previewOpenTab === openTab) previewOpenTab = undefined
    }
  })
}
