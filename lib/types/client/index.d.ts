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
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { GalleryFrame, GalleryLocale } from './frame-gallery.js';
export { LEGACY_DESIGN_RENDER_TOOL_NAME, OPENPENCIL_RENDER_TOOL_NAME, } from '../tool-names.js';
export { calculateGalleryFitViewZoom, clampGalleryZoom, frameLabel, frameGalleryCopy, galleryZoomCommandTarget, galleryViewportMaxHeight, galleryZoomPercent, galleryZoomShortcut, GALLERY_COMPACT_MAX_HEIGHT, GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT, GALLERY_TOOLBAR_CONTROL_HEIGHT, GALLERY_TOOLBAR_CONTROL_LAYOUT, GALLERY_ZOOM_MAX, GALLERY_ZOOM_MIN, GALLERY_ZOOM_STEP, nextGalleryZoom, normalizeFrameIndex, } from './frame-gallery.js';
export { requestPresentationGrant, PRESENTATION_HYDRATION_ENDPOINT, presentationHydrationRequestOf, documentSha256FromCanonicalResult, } from './presentation-hydration.js';
export { forgetSessionRenders, getRecentRender, publishRecentRender, subscribeRecentRender, type RecentRender, } from './preview-store.js';
/** Presentation metadata key the host half projects into `block.meta`. */
export declare const PRESENTATION_META_KEY = "$dshOpenPencil";
/** Sidebar tab type owned by this plugin (registered when better-sidebar is present). */
export declare const OPENPENCIL_PREVIEW_TAB_TYPE: "openpencil:preview";
export type PresentationLocale = GalleryLocale;
export declare function designRenderCopy(locale: PresentationLocale): {
    readonly frames: "frames";
    readonly openInteractiveCanvas: "Open interactive canvas";
    readonly downloadPng: "Download PNG";
    readonly downloadSource: "Download source .op";
    readonly canvas: "OpenPencil canvas";
    readonly zoomOut: "Zoom out";
    readonly zoomIn: "Zoom in";
    readonly fit: "Fit";
    readonly close: "Close";
    readonly readonlyCanvas: "Read-only OpenPencil design canvas";
    readonly loadingCanvas: "Loading interactive canvas…";
    readonly pngRemains: "PNG preview remains available underneath the dialog.";
    readonly canvasUnavailable: "Interactive canvas unavailable";
    readonly openPngFallback: "Open PNG fallback";
    readonly panHint: "Drag to pan · scroll to pan · Ctrl/⌘ + scroll to zoom";
    readonly snapshot: "snapshot";
    readonly previewTab: "OpenPencil preview";
    readonly previewTabEmpty: "No render yet for this session.";
    readonly previewTabEmptyHint: "Ask the agent to run openpencil_render to see the design preview here.";
    readonly openSource: "Open source .op";
} | {
    readonly frames: "页";
    readonly openInteractiveCanvas: "打开交互画布";
    readonly downloadPng: "下载 PNG";
    readonly downloadSource: "下载源文件 .op";
    readonly canvas: "OpenPencil 画布";
    readonly zoomOut: "缩小";
    readonly zoomIn: "放大";
    readonly fit: "适应窗口";
    readonly close: "关闭";
    readonly readonlyCanvas: "只读 OpenPencil 设计画布";
    readonly loadingCanvas: "正在加载交互画布…";
    readonly pngRemains: "对话框下方仍保留 PNG 预览。";
    readonly canvasUnavailable: "交互画布不可用";
    readonly openPngFallback: "打开 PNG 预览";
    readonly panHint: "拖动平移 · 滚动平移 · Ctrl/⌘ + 滚动缩放";
    readonly snapshot: "快照";
    readonly previewTab: "OpenPencil 预览";
    readonly previewTabEmpty: "当前会话还没有渲染结果。";
    readonly previewTabEmptyHint: "请让 Agent 执行 openpencil_render，设计预览会显示在这里。";
    readonly openSource: "打开源文件 .op";
};
export interface ImageGrant extends GalleryFrame {
}
export interface DocumentGrant {
    path?: string;
    url: string;
    downloadUrl?: string;
    bytes?: number;
    sha256?: string;
    mimeType?: string;
}
export interface ViewerGrant {
    sdkUrl: string;
    wasmUrl: string;
    canvasKitBaseUrl: string;
}
export interface PresentationGrant {
    schemaVersion: 1 | 2;
    image?: ImageGrant;
    frames?: ImageGrant[];
    document?: DocumentGrant;
    viewer?: ViewerGrant;
    renderer?: string;
    rendererBinary?: string;
    fidelity?: string;
    warnings?: string[];
}
/** Parse both the established v1 envelope and the additive v2 shape. */
export declare function presentationGrantOfMeta(metaValue: unknown): PresentationGrant | undefined;
export declare function grantOf(block: ToolCallViewProps['block']): PresentationGrant | undefined;
interface Viewport {
    panX: number;
    panY: number;
    zoom: number;
}
interface OpViewer {
    readonly viewport: Viewport;
    setZoom(zoom: number): void;
    panTo(panX: number, panY: number): void;
    zoomToFit(width: number, height: number): void;
    on(event: 'viewportchange', callback: () => void): () => void;
    destroy(): void;
}
interface OpenPencilSdk {
    createViewer(options: {
        canvas: HTMLCanvasElement;
        doc: string | Uint8Array;
        wasmUrl?: string;
        canvasKitBaseUrl?: string;
    }): Promise<OpViewer>;
}
/** Load the host-served ESM core SDK without coupling the client bundle to React 19. */
export declare function loadOpenPencilSdk(url: string): Promise<OpenPencilSdk>;
/** @internal Claim the page-wide SDK singleton; opening another canvas closes this one. */
export declare function claimCanvas(token: symbol, close: () => void): () => void;
/** Size the canvas backing store to its CSS box before CanvasKit attaches. */
export declare function sizeCanvasForDisplay(canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight' | 'width' | 'height'>, devicePixelRatio?: number): {
    cssWidth: number;
    cssHeight: number;
    dpr: number;
};
/** Structural subset of dsh-better-sidebar's TabComponentProps. */
interface SidebarPreviewTabProps {
    ctx: unknown;
    scope: {
        sessionId?: string;
    };
    tab: unknown;
    visible: boolean;
    expanded?: string[];
    onToggleDir?: (path: string) => void;
    onReferenceFile?: (path: string) => void;
    onOpenFile?: (path: string) => void;
    onOpenDiff?: (tab: unknown) => void;
    onSubagentJump?: (childSessionId: string) => void;
    locale?: PresentationLocale;
}
/** The `openpencil:preview` sidebar tab: latest render of the session. */
export declare function OpenPencilPreviewTab(props: SidebarPreviewTabProps): React.JSX.Element;
/**
 * Silent observer mounted on `openpencil_render` / `design_render` tool calls.
 *
 * Renders NOTHING inline (the conversation card is hidden by design). It
 * recovers the browser-only presentation grant (embedded or hydrated) and, on
 * settle, feeds the session's preview store and focuses the sidebar tab.
 */
export declare function SilentRenderObserver({ block, callId, toolName, sessionId, }: ToolCallViewProps & {
    sessionId: unknown;
}): React.JSX.Element | null;
/** Required client services. */
export declare const inject: string[];
/** Register the silent render observer plus the optional sidebar preview tab. */
export declare function apply(ctx: ClientContext): void;
