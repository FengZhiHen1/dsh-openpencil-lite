window.__ModuleLoader__.load({ id: "dsh-openpencil-lite", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
//#region src/client/frame-gallery.tsx
const FRAME_GALLERY_COPY = {
	en: {
		frame: "Frame",
		carousel: "carousel",
		gallery: "OpenPencil frames",
		toolbar: "Preview zoom and card size controls",
		zoomOut: "Zoom out preview",
		zoomOutTitle: "Zoom out by 25% (Ctrl/Cmd −)",
		zoomIn: "Zoom in preview",
		zoomInTitle: "Zoom in by 25% (Ctrl/Cmd +)",
		previewZoom: "Preview zoom",
		reset: "Reset",
		resetAria: "Reset preview zoom to 100%",
		resetTitle: "Reset zoom to 100% (Ctrl/Cmd 0)",
		fitFrame: "Fit frame",
		fitFrameAria: "Fit entire frame inside the current card",
		fitFrameTitle: "Fit the entire frame without changing the card size",
		fitContent: "Fit content",
		fitContentAria: "Fit card height to the entire frame",
		fitContentTitle: "Expand the card to show the entire frame",
		restoreCard: "Restore card",
		restoreCardAria: "Restore compact card height",
		previous: "Previous frame",
		next: "Next frame",
		failed: "This frame preview could not be loaded. Choose another frame or use the download action.",
		rendered: "Rendered OpenPencil frame",
		thumbnails: "Frame thumbnails",
		showFrame: "Show frame"
	},
	zh: {
		frame: "页面",
		carousel: "轮播",
		gallery: "OpenPencil 页面",
		toolbar: "预览缩放与卡片尺寸控制",
		zoomOut: "缩小预览",
		zoomOutTitle: "缩小 25%（Ctrl/Cmd −）",
		zoomIn: "放大预览",
		zoomInTitle: "放大 25%（Ctrl/Cmd +）",
		previewZoom: "预览缩放",
		reset: "重置",
		resetAria: "将预览缩放重置为 100%",
		resetTitle: "重置为 100%（Ctrl/Cmd 0）",
		fitFrame: "适应画面",
		fitFrameAria: "将整个页面缩放到当前卡片内",
		fitFrameTitle: "不改变卡片大小，完整显示当前页面",
		fitContent: "适应内容",
		fitContentAria: "让卡片高度适应完整页面",
		fitContentTitle: "展开卡片以显示完整页面",
		restoreCard: "还原卡片",
		restoreCardAria: "还原紧凑卡片高度",
		previous: "上一页",
		next: "下一页",
		failed: "当前页面预览加载失败，请选择其他页面或使用下载操作。",
		rendered: "OpenPencil 页面渲染图",
		thumbnails: "页面缩略图",
		showFrame: "显示页面"
	}
};
function frameGalleryCopy(locale) {
	return FRAME_GALLERY_COPY[locale];
}
function normalizeFrameIndex(index, length) {
	if (length <= 0) return 0;
	return Math.min(length - 1, Math.max(0, Math.trunc(index)));
}
function frameLabel(frame, index, locale = "en") {
	return frame.name ?? frame.id ?? `${frameGalleryCopy(locale).frame} ${index + 1}`;
}
/** Preview zoom limits are intentionally broad enough for detail inspection. */
const GALLERY_ZOOM_MIN = .25;
const GALLERY_ZOOM_MAX = 4;
const GALLERY_ZOOM_STEP = .25;
function clampGalleryZoom(zoom) {
	if (!Number.isFinite(zoom)) return 1;
	return Math.min(4, Math.max(GALLERY_ZOOM_MIN, zoom));
}
/** Move one predictable 25% stop in either direction. */
function nextGalleryZoom(zoom, direction) {
	if (Number.isFinite(zoom) && zoom < .25) return GALLERY_ZOOM_MIN;
	if (Number.isFinite(zoom) && zoom > 4) return 4;
	const stops = clampGalleryZoom(zoom) / GALLERY_ZOOM_STEP;
	return clampGalleryZoom((direction > 0 ? Math.floor(stops + 1e-8) + 1 : Math.ceil(stops - 1e-8) - 1) * GALLERY_ZOOM_STEP);
}
function galleryZoomPercent(zoom) {
	const percent = (Number.isFinite(zoom) && zoom > 0 ? zoom : 1) * 100;
	return `${percent < 1 ? Math.max(.1, Math.round(percent * 10) / 10) : Math.round(percent)}%`;
}
/** Contain the entire frame inside the current viewport without resizing the card. */
function calculateGalleryFitViewZoom(viewportWidth, viewportHeight, contentWidth, contentHeight) {
	if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(viewportHeight) || viewportHeight <= 0 || !Number.isFinite(contentWidth) || contentWidth <= 0 || !Number.isFinite(contentHeight) || contentHeight <= 0) return 1;
	return Math.min(4, viewportWidth / contentWidth, viewportHeight / contentHeight);
}
/** Resolve a keyboard zoom command without reversing direction at either limit. */
function galleryZoomCommandTarget(zoom, command) {
	if (command === "reset") return 1;
	if (command === "in") {
		if (zoom >= 3.99999999) return void 0;
		return nextGalleryZoom(zoom, 1);
	}
	if (zoom <= .25000001) return void 0;
	return nextGalleryZoom(zoom, -1);
}
function galleryZoomShortcut(key, modifier) {
	if (!modifier) return void 0;
	if (key === "+" || key === "=") return "in";
	if (key === "-" || key === "_") return "out";
	if (key === "0") return "reset";
}
const GALLERY_COMPACT_MAX_HEIGHT = 560;
/** Shared geometry keeps labels and glyphs on one visual center line. */
const GALLERY_TOOLBAR_CONTROL_HEIGHT = 28;
const GALLERY_TOOLBAR_CONTROL_LAYOUT = Object.freeze({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	boxSizing: "border-box",
	height: 28,
	lineHeight: 1,
	verticalAlign: "middle"
});
/** Optical correction for CJK labels and +/- glyphs inside the centered control box. */
const GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT = Object.freeze({
	display: "inline-block",
	lineHeight: 1,
	transform: "translateY(-1px)",
	pointerEvents: "none"
});
function galleryViewportMaxHeight(fitContent) {
	return fitContent ? void 0 : 560;
}
const styles$1 = {
	gallery: {
		display: "flex",
		flexDirection: "column",
		gap: 8
	},
	mainShell: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		minWidth: 0
	},
	previewShell: {
		position: "relative",
		minWidth: 0
	},
	mainViewport: {
		maxHeight: 560,
		overflow: "auto",
		overscrollBehavior: "contain",
		borderRadius: 6,
		border: "1px solid rgba(128,128,128,0.25)",
		background: "rgba(128,128,128,0.06)"
	},
	mainImage: {
		display: "block",
		maxWidth: "none",
		height: "auto",
		margin: "0 auto"
	},
	zoomToolbar: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 4,
		marginLeft: "auto",
		minWidth: 0
	},
	zoomButton: {
		...GALLERY_TOOLBAR_CONTROL_LAYOUT,
		minWidth: 28,
		padding: "0 8px",
		borderRadius: 5,
		border: "1px solid var(--dsw-alias-border-l2)",
		color: "var(--ui-text)",
		background: "var(--dsw-alias-bg-layer-2)",
		cursor: "pointer",
		fontFamily: "inherit",
		fontWeight: "inherit",
		fontStyle: "inherit",
		fontSize: 12,
		lineHeight: 1,
		whiteSpace: "nowrap"
	},
	controlContent: GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT,
	zoomPercent: {
		...GALLERY_TOOLBAR_CONTROL_LAYOUT,
		minWidth: 42,
		padding: "0 3px",
		textAlign: "center",
		fontSize: 11,
		fontVariantNumeric: "tabular-nums",
		lineHeight: 1
	},
	counter: {
		position: "absolute",
		right: 9,
		top: 9,
		padding: "3px 7px",
		borderRadius: 99,
		color: "var(--dsw-static-neutral-bluish-00)",
		background: "var(--dsw-alias-bg-mask-3)",
		fontSize: 11,
		lineHeight: 1.3,
		pointerEvents: "none",
		backdropFilter: "blur(4px)"
	},
	controls: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		minWidth: 0,
		gap: 7,
		fontSize: 12,
		color: "var(--ui-text-muted)"
	},
	currentName: {
		flex: "1 1 120px",
		minWidth: 0,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	},
	arrow: {
		...GALLERY_TOOLBAR_CONTROL_LAYOUT,
		width: 28,
		minWidth: 28,
		padding: 0,
		borderRadius: 99,
		border: "1px solid var(--dsw-alias-border-l2)",
		color: "var(--ui-text)",
		background: "var(--dsw-alias-bg-layer-2)",
		cursor: "pointer",
		fontFamily: "inherit",
		fontWeight: "inherit",
		fontStyle: "inherit",
		fontSize: 20,
		lineHeight: 1
	},
	strip: {
		display: "flex",
		gap: 8,
		minWidth: 0,
		overflowX: "auto",
		overflowY: "hidden",
		padding: "1px 1px 7px",
		scrollSnapType: "x proximity",
		scrollbarWidth: "thin",
		overscrollBehaviorX: "contain"
	},
	thumbnail: {
		flex: "0 0 112px",
		width: 112,
		height: 84,
		padding: 3,
		overflow: "hidden",
		scrollSnapAlign: "start",
		borderRadius: 7,
		border: "1px solid var(--dsw-alias-border-l2)",
		background: "var(--dsw-alias-bg-skeleton)",
		cursor: "pointer"
	},
	thumbnailSelected: {
		border: "2px solid var(--dsw-alias-state-business-primary)",
		padding: 2,
		boxShadow: "0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent)"
	},
	thumbnailImage: {
		display: "block",
		width: "100%",
		height: "100%",
		objectFit: "contain",
		borderRadius: 4
	},
	failure: {
		minHeight: 128,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: 18,
		color: "var(--ui-text-muted)",
		fontSize: 12,
		textAlign: "center"
	}
};
/** Large selected preview plus a horizontally-scrollable thumbnail rail. */
function FrameGallery({ frames, selectedIndex, onSelect, locale }) {
	const stripRef = (0, react.useRef)(null);
	const viewportRef = (0, react.useRef)(null);
	const thumbnailRefs = (0, react.useRef)([]);
	const [failedUrls, setFailedUrls] = (0, react.useState)(() => /* @__PURE__ */ new Set());
	const [manualZoom, setManualZoom] = (0, react.useState)(1);
	const [zoomMode, setZoomMode] = (0, react.useState)("manual");
	const [fitContent, setFitContent] = (0, react.useState)(false);
	const [viewportSize, setViewportSize] = (0, react.useState)({
		width: 0,
		height: 0
	});
	const [loadedDimensions, setLoadedDimensions] = (0, react.useState)({});
	const currentIndex = normalizeFrameIndex(selectedIndex, frames.length);
	const current = frames[currentIndex];
	(0, react.useEffect)(() => {
		setFailedUrls(/* @__PURE__ */ new Set());
	}, [frames.map((frame) => frame.previewUrl).join("\n")]);
	(0, react.useEffect)(() => {
		const viewport = viewportRef.current;
		if (viewport === null) return;
		const measure = () => {
			const next = {
				width: viewport.clientWidth,
				height: viewport.clientHeight
			};
			setViewportSize((previous) => previous.width === next.width && previous.height === next.height ? previous : next);
		};
		measure();
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", measure);
			return () => {
				window.removeEventListener("resize", measure);
			};
		}
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		return () => {
			observer.disconnect();
		};
	}, []);
	const select = (0, react.useCallback)((index) => {
		const next = normalizeFrameIndex(index, frames.length);
		onSelect(next);
		requestAnimationFrame(() => {
			const strip = stripRef.current;
			const item = thumbnailRefs.current[next];
			if (strip === null || item === null || item === void 0) return;
			const left = item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2;
			strip.scrollTo({
				left: Math.max(0, left),
				behavior: "smooth"
			});
		});
	}, [frames.length, onSelect]);
	(0, react.useEffect)(() => {
		viewportRef.current?.scrollTo({
			left: 0,
			top: 0
		});
	}, [current?.previewUrl]);
	if (current === void 0) return null;
	const copy = frameGalleryCopy(locale);
	const failed = failedUrls.has(current.previewUrl);
	const name = frameLabel(current, currentIndex, locale);
	const loaded = loadedDimensions[current.previewUrl];
	const contentWidth = current.width ?? loaded?.width ?? 0;
	const contentHeight = current.height ?? loaded?.height ?? 0;
	const fitViewZoom = calculateGalleryFitViewZoom(viewportSize.width, zoomMode === "fit-view" ? 560 : viewportSize.height, contentWidth, contentHeight);
	const zoom = zoomMode === "fit-view" ? fitViewZoom : manualZoom;
	const zoomLabel = galleryZoomPercent(zoom);
	const canZoomOut = zoom > .25000001;
	const canZoomIn = zoom < 3.99999999;
	const setZoom = (nextZoom) => {
		setManualZoom(clampGalleryZoom(nextZoom));
		setZoomMode("manual");
	};
	const resetZoom = () => {
		setZoom(1);
		viewportRef.current?.scrollTo({
			left: 0,
			top: 0
		});
	};
	const onKeyDown = (event) => {
		const command = galleryZoomShortcut(event.key, event.metaKey || event.ctrlKey);
		if (command !== void 0) {
			event.preventDefault();
			if (command === "reset") resetZoom();
			else {
				const target = galleryZoomCommandTarget(zoom, command);
				if (target !== void 0) setZoom(target);
			}
			return;
		}
		if (event.key === "ArrowLeft" && currentIndex > 0) {
			event.preventDefault();
			select(currentIndex - 1);
		} else if (event.key === "ArrowRight" && currentIndex < frames.length - 1) {
			event.preventDefault();
			select(currentIndex + 1);
		}
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: styles$1.gallery,
		role: "region",
		"aria-roledescription": copy.carousel,
		"aria-label": `${copy.gallery}: ${frames.length}`,
		"data-openpencil-frame-gallery": "true",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: styles$1.mainShell,
			tabIndex: 0,
			onKeyDown,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles$1.controls,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: styles$1.currentName,
						title: name,
						children: [frames.length > 1 ? `${currentIndex + 1} / ${frames.length} · ` : "", name]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles$1.zoomToolbar,
						role: "toolbar",
						"aria-label": copy.toolbar,
						"data-openpencil-zoom-toolbar": "true",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$1.zoomButton,
									opacity: canZoomOut ? 1 : .42
								},
								disabled: !canZoomOut,
								"aria-label": copy.zoomOut,
								title: copy.zoomOutTitle,
								onClick: () => {
									setZoom(nextGalleryZoom(zoom, -1));
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$1.controlContent,
									children: "−"
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("output", {
								style: styles$1.zoomPercent,
								"aria-label": `${copy.previewZoom} ${zoomLabel}`,
								"aria-live": "polite",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$1.controlContent,
									children: zoomLabel
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$1.zoomButton,
									opacity: canZoomIn ? 1 : .42
								},
								disabled: !canZoomIn,
								"aria-label": copy.zoomIn,
								title: copy.zoomInTitle,
								onClick: () => {
									setZoom(nextGalleryZoom(zoom, 1));
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$1.controlContent,
									children: "+"
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$1.zoomButton,
									opacity: zoomMode === "manual" && manualZoom === 1 ? .42 : 1
								},
								disabled: zoomMode === "manual" && manualZoom === 1,
								"aria-label": copy.resetAria,
								title: copy.resetTitle,
								onClick: resetZoom,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$1.controlContent,
									children: copy.reset
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$1.zoomButton,
									background: zoomMode === "fit-view" ? "color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)" : styles$1.zoomButton.background
								},
								"aria-label": copy.fitFrameAria,
								"aria-pressed": zoomMode === "fit-view",
								title: copy.fitFrameTitle,
								onClick: () => {
									const viewport = viewportRef.current;
									if (viewport !== null) setViewportSize({
										width: viewport.clientWidth,
										height: 560
									});
									setFitContent(false);
									setZoomMode("fit-view");
									viewport?.scrollTo({
										left: 0,
										top: 0
									});
								},
								"data-openpencil-fit-view": "true",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$1.controlContent,
									children: copy.fitFrame
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$1.zoomButton,
									background: fitContent ? "color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)" : styles$1.zoomButton.background
								},
								"aria-label": fitContent ? copy.restoreCardAria : copy.fitContentAria,
								"aria-pressed": fitContent,
								title: fitContent ? locale === "zh" ? `${copy.restoreCardAria}（560px）` : `${copy.restoreCardAria} (560px)` : copy.fitContentTitle,
								onClick: () => {
									setZoomMode("manual");
									setFitContent((previous) => !previous);
									viewportRef.current?.scrollTo({
										left: 0,
										top: 0
									});
								},
								"data-openpencil-card-height-toggle": "true",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$1.controlContent,
									children: fitContent ? copy.restoreCard : copy.fitContent
								})
							})
						]
					}),
					frames.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: {
							...styles$1.arrow,
							opacity: currentIndex === 0 ? .42 : 1
						},
						disabled: currentIndex === 0,
						"aria-label": copy.previous,
						title: copy.previous,
						onClick: () => {
							select(currentIndex - 1);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles$1.controlContent,
							children: "‹"
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: {
							...styles$1.arrow,
							opacity: currentIndex === frames.length - 1 ? .42 : 1
						},
						disabled: currentIndex === frames.length - 1,
						"aria-label": copy.next,
						title: copy.next,
						onClick: () => {
							select(currentIndex + 1);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles$1.controlContent,
							children: "›"
						})
					})] }) : null
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles$1.previewShell,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: viewportRef,
					style: {
						...styles$1.mainViewport,
						display: zoomMode === "fit-view" ? "flex" : void 0,
						alignItems: zoomMode === "fit-view" ? "center" : void 0,
						justifyContent: zoomMode === "fit-view" ? "center" : void 0,
						height: zoomMode === "fit-view" ? 560 : void 0,
						maxHeight: galleryViewportMaxHeight(fitContent),
						overflow: zoomMode === "fit-view" ? "hidden" : styles$1.mainViewport.overflow
					},
					"data-openpencil-image-viewport": "true",
					"data-card-height-mode": fitContent ? "content" : "compact",
					"data-preview-zoom-mode": zoomMode,
					children: failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styles$1.failure,
						role: "status",
						children: copy.failed
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						style: {
							...styles$1.mainImage,
							width: contentWidth > 0 ? contentWidth * zoom : "auto"
						},
						src: current.previewUrl,
						alt: `${copy.rendered}: ${name}`,
						loading: "lazy",
						"data-openpencil-preview-zoom": zoomLabel,
						onLoad: (event) => {
							if (current.width !== void 0 && current.height !== void 0) return;
							const image = event.currentTarget;
							if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
							setLoadedDimensions((previous) => ({
								...previous,
								[current.previewUrl]: {
									width: image.naturalWidth,
									height: image.naturalHeight
								}
							}));
						},
						onError: () => {
							setFailedUrls((previous) => /* @__PURE__ */ new Set([...previous, current.previewUrl]));
						}
					})
				}), frames.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: styles$1.counter,
					children: [
						currentIndex + 1,
						" / ",
						frames.length
					]
				}) : null]
			})]
		}), frames.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			ref: stripRef,
			style: styles$1.strip,
			"aria-label": copy.thumbnails,
			"data-openpencil-frame-strip": "true",
			children: frames.map((frame, index) => {
				const selected = index === currentIndex;
				const label = frameLabel(frame, index, locale);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					ref: (element) => {
						thumbnailRefs.current[index] = element;
					},
					type: "button",
					style: {
						...styles$1.thumbnail,
						...selected ? styles$1.thumbnailSelected : {}
					},
					"aria-label": `${copy.showFrame} ${index + 1}: ${label}`,
					"aria-current": selected ? "true" : void 0,
					title: label,
					onClick: () => {
						select(index);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						style: styles$1.thumbnailImage,
						src: frame.previewUrl,
						alt: "",
						loading: "lazy"
					})
				}, `${frame.previewUrl}:${index}`);
			})
		}) : null]
	});
}
//#endregion
//#region src/tool-names.ts
/** Canonical model-facing OpenPencil tool names. */
const OPENPENCIL_RENDER_TOOL_NAME = "openpencil_render";
/**
* Historical render name retained only by the browser presentation layer so
* existing conversation cards and details panels remain replayable. The host
* deliberately does not register this alias as a model-facing tool.
*/
const LEGACY_DESIGN_RENDER_TOOL_NAME = "design_render";
//#endregion
//#region src/client/presentation-hydration.ts
/** Recover browser-only presentation metadata omitted from nested Tool results. */
const PRESENTATION_HYDRATION_ENDPOINT = "/_dsh/dsh-openpencil-lite/presentation";
const PRESENTATION_HYDRATION_META_KEY = "$dshOpenPencil";
const MAX_CANONICAL_RESULT_CHARS = 1048576;
const MAX_SESSION_ID_CHARS = 256;
const MAX_CALL_ID_CHARS = 512;
const pendingByFetcher = /* @__PURE__ */ new WeakMap();
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isRequest(value) {
	return value.sessionId.length > 0 && value.sessionId.length <= MAX_SESSION_ID_CHARS && value.callId.length > 0 && value.callId.length <= MAX_CALL_ID_CHARS && /^[a-f0-9]{64}$/iu.test(value.documentSha256);
}
function requestKey(value) {
	return `${value.sessionId}\n${value.callId}\n${value.documentSha256.toLowerCase()}`;
}
function pendingEnvelope(request, fetcher) {
	let pending = pendingByFetcher.get(fetcher);
	if (pending === void 0) {
		pending = /* @__PURE__ */ new Map();
		pendingByFetcher.set(fetcher, pending);
	}
	const key = requestKey(request);
	const existing = pending.get(key);
	if (existing !== void 0) return existing;
	const controller = new AbortController();
	const entry = {
		subscribers: 0,
		settled: false,
		cancelIfUnused: () => {},
		promise: Promise.resolve(void 0)
	};
	entry.cancelIfUnused = () => {
		if (entry.subscribers !== 0 || entry.settled) return;
		if (pending?.get(key) === entry) pending.delete(key);
		controller.abort();
	};
	entry.promise = (async () => {
		const response = await fetcher(PRESENTATION_HYDRATION_ENDPOINT, {
			method: "POST",
			credentials: "same-origin",
			headers: {
				accept: "application/json",
				"content-type": "application/json"
			},
			body: JSON.stringify(request),
			signal: controller.signal
		});
		if (!response.ok) return void 0;
		try {
			return await response.json();
		} catch {
			return;
		}
	})().catch(() => void 0).finally(() => {
		entry.settled = true;
		if (pending?.get(key) === entry) pending.delete(key);
	});
	pending.set(key, entry);
	return entry;
}
/**
* Read only the immutable document fingerprint from one canonical text result.
* Paths, image data, and every other model-visible result field are ignored.
*/
function documentSha256FromCanonicalResult(block) {
	if (!isRecord$1(block) || block.isError !== false || !Array.isArray(block.content) || block.content.length !== 1) return;
	const content = block.content[0];
	if (!isRecord$1(content) || content.type !== "text" || typeof content.text !== "string") return void 0;
	if (content.text.length > MAX_CANONICAL_RESULT_CHARS) return void 0;
	let result;
	try {
		result = JSON.parse(content.text);
	} catch {
		return;
	}
	if (!isRecord$1(result) || !isRecord$1(result.document)) return void 0;
	const fingerprint = result.document.sha256;
	return typeof fingerprint === "string" && /^[a-f0-9]{64}$/iu.test(fingerprint) ? fingerprint.toLowerCase() : void 0;
}
/** Select only canonical nested render results that actually need hydration. */
function presentationHydrationRequestOf(candidate) {
	if (candidate.embeddedGrant !== void 0 || candidate.toolName !== "openpencil_render") return;
	const documentSha256 = documentSha256FromCanonicalResult(candidate.block);
	if (documentSha256 === void 0 || candidate.sessionId.length === 0 || candidate.sessionId.length > MAX_SESSION_ID_CHARS || candidate.callId.length === 0 || candidate.callId.length > MAX_CALL_ID_CHARS) return;
	return {
		sessionId: candidate.sessionId,
		callId: candidate.callId,
		documentSha256
	};
}
/**
* Exchange a non-secret result fingerprint for a same-origin presentation
* grant. Concurrent subscribers share one request; an unmounted subscriber
* can abort independently, and the network request is cancelled once nobody
* is waiting for it.
*/
function requestPresentationGrant(request, parseMeta, options = {}) {
	if (!isRequest(request) || options.signal?.aborted === true) return Promise.resolve(void 0);
	const fetcher = options.fetcher ?? globalThis.fetch;
	if (typeof fetcher !== "function") return Promise.resolve(void 0);
	const entry = pendingEnvelope(request, fetcher);
	entry.subscribers += 1;
	return new Promise((resolve) => {
		let finished = false;
		const release = () => {
			entry.subscribers = Math.max(0, entry.subscribers - 1);
			entry.cancelIfUnused();
		};
		const finish = (value) => {
			if (finished) return;
			finished = true;
			options.signal?.removeEventListener("abort", abort);
			release();
			resolve(value);
		};
		const abort = () => {
			finish(void 0);
		};
		options.signal?.addEventListener("abort", abort, { once: true });
		entry.promise.then((value) => {
			if (finished || options.signal?.aborted === true) {
				finish(void 0);
				return;
			}
			if (!isRecord$1(value) || !Object.hasOwn(value, "$dshOpenPencil")) {
				finish(void 0);
				return;
			}
			try {
				finish(parseMeta({ [PRESENTATION_HYDRATION_META_KEY]: value[PRESENTATION_HYDRATION_META_KEY] }));
			} catch {
				finish(void 0);
			}
		}, () => {
			finish(void 0);
		});
	});
}
//#endregion
//#region src/client/preview-store.ts
const renders = /* @__PURE__ */ new Map();
const listeners = /* @__PURE__ */ new Set();
function notify() {
	for (const listener of [...listeners]) listener();
}
/** Record one settled render for a session (keyed by sessionId). */
function publishRecentRender(sessionId, path, grants) {
	if (sessionId.length === 0) return;
	renders.set(sessionId, {
		path,
		grants,
		settledAt: Date.now()
	});
	notify();
}
/** Drop all renders owned by a disposed session. */
function forgetSessionRenders(sessionId) {
	if (!renders.delete(sessionId)) return;
	notify();
}
/** Snapshot the latest render of one session (undefined when none yet). */
function getRecentRender(sessionId) {
	return renders.get(sessionId);
}
/** Subscribe to store changes; returns the disposer. */
function subscribeRecentRender(listener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
//#endregion
//#region src/client/index.tsx
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
/** Presentation metadata key the host half projects into `block.meta`. */
const PRESENTATION_META_KEY = "$dshOpenPencil";
/** Sidebar tab type owned by this plugin (registered when better-sidebar is present). */
const OPENPENCIL_PREVIEW_TAB_TYPE = "openpencil:preview";
const DESIGN_RENDER_COPY = {
	en: {
		frames: "frames",
		openInteractiveCanvas: "Open interactive canvas",
		downloadPng: "Download PNG",
		downloadSource: "Download source .op",
		canvas: "OpenPencil canvas",
		zoomOut: "Zoom out",
		zoomIn: "Zoom in",
		fit: "Fit",
		close: "Close",
		readonlyCanvas: "Read-only OpenPencil design canvas",
		loadingCanvas: "Loading interactive canvas…",
		pngRemains: "PNG preview remains available underneath the dialog.",
		canvasUnavailable: "Interactive canvas unavailable",
		openPngFallback: "Open PNG fallback",
		panHint: "Drag to pan · scroll to pan · Ctrl/⌘ + scroll to zoom",
		snapshot: "snapshot",
		previewTab: "OpenPencil preview",
		previewTabEmpty: "No render yet for this session.",
		previewTabEmptyHint: "Ask the agent to run openpencil_render to see the design preview here.",
		openSource: "Open source .op"
	},
	zh: {
		frames: "页",
		openInteractiveCanvas: "打开交互画布",
		downloadPng: "下载 PNG",
		downloadSource: "下载源文件 .op",
		canvas: "OpenPencil 画布",
		zoomOut: "缩小",
		zoomIn: "放大",
		fit: "适应窗口",
		close: "关闭",
		readonlyCanvas: "只读 OpenPencil 设计画布",
		loadingCanvas: "正在加载交互画布…",
		pngRemains: "对话框下方仍保留 PNG 预览。",
		canvasUnavailable: "交互画布不可用",
		openPngFallback: "打开 PNG 预览",
		panHint: "拖动平移 · 滚动平移 · Ctrl/⌘ + 滚动缩放",
		snapshot: "快照",
		previewTab: "OpenPencil 预览",
		previewTabEmpty: "当前会话还没有渲染结果。",
		previewTabEmptyHint: "请让 Agent 执行 openpencil_render，设计预览会显示在这里。",
		openSource: "打开源文件 .op"
	}
};
function designRenderCopy(locale) {
	return DESIGN_RENDER_COPY[locale];
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalString(record, key) {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function optionalFiniteNumber(record, key) {
	const value = record[key];
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function optionalStrings(record, key) {
	const value = record[key];
	if (!Array.isArray(value)) return void 0;
	const strings = value.filter((item) => typeof item === "string" && item.length > 0);
	return strings.length === 0 ? void 0 : strings;
}
function imageGrantOf(value) {
	if (!isRecord(value)) return void 0;
	const path = optionalString(value, "path");
	const previewUrl = optionalString(value, "previewUrl");
	const downloadUrl = optionalString(value, "downloadUrl");
	if (path === void 0 || previewUrl === void 0 || downloadUrl === void 0) return void 0;
	const id = optionalString(value, "id");
	const name = optionalString(value, "name");
	const index = optionalFiniteNumber(value, "index");
	return {
		path,
		previewUrl,
		downloadUrl,
		width: optionalFiniteNumber(value, "width"),
		height: optionalFiniteNumber(value, "height"),
		...id === void 0 ? {} : { id },
		...name === void 0 ? {} : { name },
		...index === void 0 || !Number.isSafeInteger(index) || index < 0 ? {} : { index }
	};
}
function imageGrantsOf(value) {
	if (!Array.isArray(value)) return void 0;
	const frames = value.map(imageGrantOf).filter((frame) => frame !== void 0);
	return frames.length === 0 ? void 0 : frames;
}
function documentGrantOf(envelope, image) {
	const raw = isRecord(envelope.document) ? envelope.document : void 0;
	const legacyImage = isRecord(image) ? image : void 0;
	const url = raw === void 0 ? optionalString(envelope, "documentUrl") ?? optionalString(envelope, "sourceUrl") ?? (legacyImage === void 0 ? void 0 : optionalString(legacyImage, "documentUrl") ?? optionalString(legacyImage, "sourceUrl") ?? optionalString(legacyImage, "opUrl")) : optionalString(raw, "url") ?? optionalString(raw, "documentUrl");
	if (url === void 0) return void 0;
	return {
		url,
		path: raw === void 0 ? optionalString(envelope, "sourcePath") : optionalString(raw, "path"),
		downloadUrl: raw === void 0 ? optionalString(envelope, "documentDownloadUrl") : optionalString(raw, "downloadUrl"),
		bytes: raw === void 0 ? void 0 : optionalFiniteNumber(raw, "bytes"),
		sha256: raw === void 0 ? void 0 : optionalString(raw, "sha256"),
		mimeType: raw === void 0 ? void 0 : optionalString(raw, "mimeType")
	};
}
function viewerGrantOf(value) {
	if (!isRecord(value)) return void 0;
	const sdkUrl = optionalString(value, "sdkUrl");
	const wasmUrl = optionalString(value, "wasmUrl");
	const canvasKitBaseUrl = optionalString(value, "canvasKitBaseUrl") ?? optionalString(value, "assetBaseUrl");
	if (sdkUrl === void 0 || wasmUrl === void 0 || canvasKitBaseUrl === void 0) return void 0;
	return {
		sdkUrl,
		wasmUrl,
		canvasKitBaseUrl
	};
}
/** Parse both the established v1 envelope and the additive v2 shape. */
function presentationGrantOfMeta(metaValue) {
	const envelope = (isRecord(metaValue) ? metaValue : void 0)?.[PRESENTATION_META_KEY];
	if (!isRecord(envelope) || envelope.schemaVersion !== 1 && envelope.schemaVersion !== 2) return void 0;
	const frames = imageGrantsOf(envelope.frames);
	const image = imageGrantOf(envelope.image) ?? frames?.[0];
	const document = documentGrantOf(envelope, envelope.image);
	if (image === void 0 && document === void 0) return void 0;
	return {
		schemaVersion: envelope.schemaVersion,
		image,
		frames: frames ?? (image === void 0 ? void 0 : [image]),
		document,
		viewer: viewerGrantOf(envelope.viewer),
		renderer: optionalString(envelope, "renderer"),
		rendererBinary: optionalString(envelope, "rendererBinary"),
		fidelity: optionalString(envelope, "fidelity"),
		warnings: optionalStrings(envelope, "warnings")
	};
}
function grantOf(block) {
	if (!("kind" in block) || block.isError) return void 0;
	return presentationGrantOfMeta(block.meta);
}
const sdkLoads = /* @__PURE__ */ new Map();
/** Load the host-served ESM core SDK without coupling the client bundle to React 19. */
function loadOpenPencilSdk(url) {
	const absoluteUrl = new URL(url, window.location.href).href;
	let pending = sdkLoads.get(absoluteUrl);
	if (pending === void 0) {
		pending = import(
			/* @vite-ignore */
			absoluteUrl
).then((module) => {
			if (!isRecord(module) || typeof module.createViewer !== "function") throw new Error("OpenPencil viewer SDK did not export createViewer");
			return module;
		});
		sdkLoads.set(absoluteUrl, pending);
		pending.catch(() => {
			sdkLoads.delete(absoluteUrl);
		});
	}
	return pending;
}
let activeCanvas;
/** @internal Claim the page-wide SDK singleton; opening another canvas closes this one. */
function claimCanvas(token, close) {
	const previous = activeCanvas;
	activeCanvas = {
		token,
		close
	};
	if (previous !== void 0 && previous.token !== token) previous.close();
	return () => {
		if (activeCanvas?.token === token) activeCanvas = void 0;
	};
}
const styles = {
	imageViewport: {
		maxHeight: 560,
		overflow: "auto",
		overscrollBehavior: "contain",
		borderRadius: 4,
		border: "1px solid var(--dsw-alias-border-l1)",
		background: "var(--dsw-alias-bg-skeleton)"
	},
	img: {
		display: "block",
		width: "auto",
		maxWidth: "100%",
		height: "auto",
		margin: "0 auto"
	},
	meta: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 10,
		marginTop: 10,
		fontSize: 12,
		color: "var(--ui-text-muted)"
	},
	link: {
		color: "var(--dsw-alias-state-business-primary)",
		textDecoration: "none"
	},
	button: {
		color: "var(--dsw-alias-state-business-primary)",
		background: "none",
		border: "none",
		cursor: "pointer",
		padding: 0,
		font: "inherit",
		fontSize: 12
	},
	primaryButton: {
		border: "1px solid var(--dsw-alias-state-business-primary)",
		borderRadius: 6,
		color: "var(--dsw-alias-state-business-primary)",
		background: "transparent",
		padding: "4px 9px",
		cursor: "pointer",
		font: "inherit",
		fontSize: 12
	},
	muted: {
		fontSize: 12,
		color: "var(--ui-text-muted)"
	},
	backdrop: {
		position: "fixed",
		inset: 0,
		zIndex: 2147483e3,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: 20,
		background: "var(--dsw-alias-bg-mask-3)"
	},
	dialog: {
		width: "min(1120px, 94vw)",
		height: "min(820px, 92vh)",
		display: "flex",
		flexDirection: "column",
		overflow: "hidden",
		border: "1px solid var(--dsw-alias-border-l3)",
		borderRadius: 10,
		background: "var(--dsw-alias-bg-layer-2)",
		color: "var(--ui-text)",
		boxShadow: "0 24px 80px var(--dsw-alias-bg-mask-3)"
	},
	toolbar: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 8,
		minHeight: 44,
		padding: "7px 10px",
		borderBottom: "1px solid var(--dsw-alias-border-l2)"
	},
	canvasWrap: {
		position: "relative",
		flex: 1,
		minHeight: 0,
		overflow: "hidden",
		background: "var(--dsw-alias-bg-layer-3)"
	},
	canvas: {
		display: "block",
		width: "100%",
		height: "100%",
		cursor: "grab",
		touchAction: "none"
	},
	overlay: {
		position: "absolute",
		inset: 0,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "column",
		gap: 10,
		padding: 24,
		textAlign: "center",
		background: "var(--dsw-alias-bg-mask-3)"
	},
	tabBody: {
		display: "flex",
		flexDirection: "column",
		gap: 10,
		padding: 12,
		fontSize: 12
	},
	tabEmpty: {
		padding: 16,
		textAlign: "center",
		color: "var(--ui-text-muted)",
		fontSize: 12
	},
	tabHeader: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
		color: "var(--ui-text-muted)"
	},
	tabActions: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 10,
		color: "var(--ui-text-muted)"
	}
};
function baseName(path) {
	const normalized = path.replaceAll("\\", "/");
	return normalized.slice(normalized.lastIndexOf("/") + 1) || path;
}
/** Size the canvas backing store to its CSS box before CanvasKit attaches. */
function sizeCanvasForDisplay(canvas, devicePixelRatio = window.devicePixelRatio) {
	const cssWidth = Math.max(1, Math.round(canvas.clientWidth));
	const cssHeight = Math.max(1, Math.round(canvas.clientHeight));
	const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
	canvas.width = Math.max(1, Math.round(cssWidth * dpr));
	canvas.height = Math.max(1, Math.round(cssHeight * dpr));
	return {
		cssWidth,
		cssHeight,
		dpr
	};
}
function CanvasModal({ grant, onClose, locale }) {
	const canvasRef = (0, react.useRef)(null);
	const viewerRef = (0, react.useRef)();
	const dragRef = (0, react.useRef)();
	const [phase, setPhase] = (0, react.useState)("loading");
	const [failure, setFailure] = (0, react.useState)("");
	const [viewport, setViewport] = (0, react.useState)({
		panX: 0,
		panY: 0,
		zoom: 1
	});
	const documentGrant = grant.document;
	const viewerGrant = grant.viewer;
	const copy = designRenderCopy(locale);
	const fit = (0, react.useCallback)(() => {
		const viewer = viewerRef.current;
		const canvas = canvasRef.current;
		if (viewer === void 0 || canvas === null) return;
		viewer.zoomToFit(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
		setViewport(viewer.viewport);
	}, []);
	const zoomBy = (0, react.useCallback)((factor) => {
		const viewer = viewerRef.current;
		if (viewer === void 0) return;
		viewer.setZoom(Math.min(16, Math.max(.05, viewer.viewport.zoom * factor)));
		setViewport(viewer.viewport);
	}, []);
	(0, react.useEffect)(() => {
		const onKeyDown = (event) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);
	(0, react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (canvas === null || documentGrant === void 0 || viewerGrant === void 0) return;
		sizeCanvasForDisplay(canvas);
		const abort = new AbortController();
		let cancelled = false;
		let created;
		setPhase("loading");
		setFailure("");
		const load = async () => {
			try {
				const [sdk, response] = await Promise.all([loadOpenPencilSdk(viewerGrant.sdkUrl), fetch(documentGrant.url, {
					signal: abort.signal,
					credentials: "same-origin"
				})]);
				if (!response.ok) throw new Error(`OpenPencil document request failed (${response.status})`);
				const source = await response.text();
				if (cancelled) return;
				created = await sdk.createViewer({
					canvas,
					doc: source,
					wasmUrl: viewerGrant.wasmUrl,
					canvasKitBaseUrl: viewerGrant.canvasKitBaseUrl
				});
				if (cancelled) {
					created.destroy();
					return;
				}
				viewerRef.current = created;
				const syncViewport = () => {
					if (!cancelled && created !== void 0) setViewport(created.viewport);
				};
				created.on("viewportchange", syncViewport);
				setPhase("ready");
				requestAnimationFrame(() => {
					if (!cancelled) fit();
				});
			} catch (error) {
				if (cancelled || abort.signal.aborted) return;
				setFailure(error instanceof Error ? error.message : String(error));
				setPhase("error");
			}
		};
		load();
		return () => {
			cancelled = true;
			abort.abort();
			viewerRef.current = void 0;
			created?.destroy();
		};
	}, [
		documentGrant?.url,
		fit,
		viewerGrant?.canvasKitBaseUrl,
		viewerGrant?.sdkUrl,
		viewerGrant?.wasmUrl
	]);
	const pointerDown = (event) => {
		const viewer = viewerRef.current;
		if (viewer === void 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		const current = viewer.viewport;
		dragRef.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			panX: current.panX,
			panY: current.panY
		};
	};
	const pointerMove = (event) => {
		const drag = dragRef.current;
		const viewer = viewerRef.current;
		if (drag === void 0 || drag.id !== event.pointerId || viewer === void 0) return;
		viewer.panTo(drag.panX + event.clientX - drag.x, drag.panY + event.clientY - drag.y);
		setViewport(viewer.viewport);
	};
	const pointerUp = (event) => {
		if (dragRef.current?.id === event.pointerId) dragRef.current = void 0;
	};
	const title = documentGrant?.path === void 0 ? copy.canvas : baseName(documentGrant.path);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: styles.backdrop,
		role: "presentation",
		"data-openpencil-canvas-modal": "true",
		onMouseDown: (event) => {
			if (event.target === event.currentTarget) onClose();
		},
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: styles.dialog,
			role: "dialog",
			"aria-modal": "true",
			"aria-label": `${copy.canvas}: ${title}`,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: styles.toolbar,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
							style: {
								marginRight: "auto",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap"
							},
							children: title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.primaryButton,
							disabled: phase !== "ready",
							onClick: () => {
								zoomBy(.8);
							},
							"aria-label": copy.zoomOut,
							children: "−"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: styles.muted,
							children: [Math.round(viewport.zoom * 100), "%"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.primaryButton,
							disabled: phase !== "ready",
							onClick: () => {
								zoomBy(1.25);
							},
							"aria-label": copy.zoomIn,
							children: "+"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.primaryButton,
							disabled: phase !== "ready",
							onClick: fit,
							children: copy.fit
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.primaryButton,
							onClick: onClose,
							children: copy.close
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: styles.canvasWrap,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("canvas", {
							ref: canvasRef,
							style: styles.canvas,
							onPointerDown: pointerDown,
							onPointerMove: pointerMove,
							onPointerUp: pointerUp,
							onPointerCancel: pointerUp,
							"aria-label": copy.readonlyCanvas
						}),
						phase === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.overlay,
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: copy.loadingCanvas }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.muted,
								children: copy.pngRemains
							})]
						}) : null,
						phase === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.overlay,
							role: "alert",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: copy.canvasUnavailable }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles.muted,
									children: failure
								}),
								grant.image !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									style: styles.link,
									href: grant.image.previewUrl,
									target: "_blank",
									rel: "noreferrer",
									children: copy.openPngFallback
								}) : null
							]
						}) : null
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						...styles.meta,
						margin: 0,
						padding: "7px 10px"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: copy.panHint }), documentGrant?.sha256 !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						title: documentGrant.sha256,
						children: [
							copy.snapshot,
							" ",
							documentGrant.sha256.slice(0, 10)
						]
					}) : null]
				})
			]
		})
	});
}
let previewOpenTab;
function openModalCanvas(setModalToken, releaseRef) {
	const token = Symbol("openpencil-preview-canvas");
	releaseRef.current?.();
	releaseRef.current = claimCanvas(token, () => {
		setModalToken((current) => current === token ? void 0 : current);
	});
	setModalToken(token);
}
function closeModalCanvas(setModalToken, releaseRef) {
	releaseRef.current?.();
	releaseRef.current = void 0;
	setModalToken(void 0);
}
/** The `openpencil:preview` sidebar tab: latest render of the session. */
function OpenPencilPreviewTab(props) {
	const { scope, onOpenFile, locale = "en" } = props;
	const copy = designRenderCopy(locale);
	const sessionId = typeof scope?.sessionId === "string" ? scope.sessionId : void 0;
	const recent = (0, react.useSyncExternalStore)(subscribeRecentRender, () => sessionId === void 0 ? void 0 : getRecentRender(sessionId), () => sessionId === void 0 ? void 0 : getRecentRender(sessionId));
	const grant = isRecord(recent?.grants) ? recent.grants : void 0;
	const frames = grant?.frames ?? [];
	const [selectedIndex, setSelectedIndex] = (0, react.useState)(0);
	const currentIndex = normalizeFrameIndex(selectedIndex, frames.length);
	const selectedFrame = frames[currentIndex] ?? grant?.image;
	const [modalToken, setModalToken] = (0, react.useState)();
	const releaseRef = (0, react.useRef)();
	(0, react.useEffect)(() => () => {
		releaseRef.current?.();
	}, []);
	(0, react.useEffect)(() => {
		setSelectedIndex(0);
	}, [frames.map((frame) => frame.previewUrl).join("\n")]);
	if (recent === void 0 || grant === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: styles.tabEmpty,
		"data-openpencil-preview-tab": "empty",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: copy.previewTabEmpty }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: { marginTop: 6 },
			children: copy.previewTabEmptyHint
		})]
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: styles.tabBody,
		"data-openpencil-preview-tab": "ready",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.tabHeader,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: baseName(recent.path) }), frames.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
					frames.length,
					" ",
					copy.frames
				] }) : null]
			}),
			frames.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FrameGallery, {
				frames,
				selectedIndex: currentIndex,
				onSelect: setSelectedIndex,
				locale
			}) : selectedFrame !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: styles.imageViewport,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					style: styles.img,
					src: selectedFrame.previewUrl,
					alt: selectedFrame.name ?? baseName(selectedFrame.path)
				})
			}) : null,
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.tabActions,
				children: [grant.renderer !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					title: grant.rendererBinary,
					children: [grant.renderer, grant.fidelity === void 0 ? "" : ` · ${grant.fidelity}`]
				}) : null, grant.document?.sha256 !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					title: grant.document.sha256,
					children: ["sha256 ", grant.document.sha256.slice(0, 10)]
				}) : null]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.tabActions,
				children: [
					grant.document !== void 0 && grant.viewer !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: styles.primaryButton,
						onClick: () => {
							openModalCanvas(setModalToken, releaseRef);
						},
						children: copy.openInteractiveCanvas
					}) : null,
					selectedFrame !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						style: styles.link,
						href: selectedFrame.downloadUrl,
						download: true,
						children: copy.downloadPng
					}) : null,
					grant.document?.downloadUrl !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						style: styles.link,
						href: grant.document.downloadUrl,
						download: true,
						children: copy.downloadSource
					}) : null,
					grant.document?.path !== void 0 && typeof onOpenFile === "function" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: styles.button,
						onClick: () => {
							onOpenFile(grant.document?.path ?? "");
						},
						children: copy.openSource
					}) : null
				]
			}),
			modalToken !== void 0 && grant.document !== void 0 && grant.viewer !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasModal, {
				grant,
				onClose: () => {
					closeModalCanvas(setModalToken, releaseRef);
				},
				locale
			}) : null
		]
	});
}
/**
* Silent observer mounted on `openpencil_render` / `design_render` tool calls.
*
* Renders NOTHING inline (the conversation card is hidden by design). It
* recovers the browser-only presentation grant (embedded or hydrated) and, on
* settle, feeds the session's preview store and focuses the sidebar tab.
*/
function SilentRenderObserver({ block, callId, toolName, sessionId }) {
	const settled = "kind" in block;
	const error = settled && block.isError;
	const running = !settled;
	const embeddedGrant = grantOf(block);
	const hydrationRequest = !running && !error ? presentationHydrationRequestOf({
		block,
		toolName,
		sessionId: String(sessionId),
		callId,
		embeddedGrant
	}) : void 0;
	const hydrationKey = hydrationRequest === void 0 ? void 0 : `${hydrationRequest.sessionId}\n${hydrationRequest.callId}\n${hydrationRequest.documentSha256}`;
	const [hydrated, setHydrated] = (0, react.useState)();
	const grant = embeddedGrant ?? (hydrated !== void 0 && hydrated.key === hydrationKey ? hydrated.grant : void 0);
	(0, react.useEffect)(() => {
		if (hydrationKey === void 0 || hydrationRequest === void 0) return;
		const controller = new AbortController();
		requestPresentationGrant(hydrationRequest, presentationGrantOfMeta, { signal: controller.signal }).then((nextGrant) => {
			if (nextGrant !== void 0 && !controller.signal.aborted) setHydrated({
				key: hydrationKey,
				grant: nextGrant
			});
		});
		return () => {
			controller.abort();
		};
	}, [hydrationKey]);
	const settleGrant = !running && !error ? grant : void 0;
	(0, react.useEffect)(() => {
		if (settleGrant === void 0) return;
		const sourcePath = settleGrant.document?.path ?? settleGrant.image?.path;
		if (sourcePath === void 0) return;
		const sid = String(sessionId);
		publishRecentRender(sid, sourcePath, settleGrant);
		previewOpenTab?.({
			type: OPENPENCIL_PREVIEW_TAB_TYPE,
			path: sourcePath,
			sessionId: sid
		});
	}, [settleGrant]);
	return null;
}
/** Required client services. */
const inject = ["slots", "locale"];
/** Register the silent render observer plus the optional sidebar preview tab. */
function apply(ctx) {
	const subscribeLocale = (notify) => ctx.on("locale/change", notify);
	const getLocale = () => ctx.locale.getLocale().active;
	for (const toolName of [OPENPENCIL_RENDER_TOOL_NAME, LEGACY_DESIGN_RENDER_TOOL_NAME]) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
		name: "tool.call.toolview",
		key: toolName
	}, SilentRenderObserver));
	ctx.inject(["betterSidebar"], (injectedCtx) => {
		const sidebar = injectedCtx.betterSidebar;
		if (sidebar === null || typeof sidebar !== "object") return () => {};
		const service = sidebar;
		if (typeof service.registerTab !== "function" || typeof service.openTab !== "function") return () => {};
		const { registerTab, openTab: sideOpenTab } = service;
		const openTab = (seed) => {
			sideOpenTab({
				type: OPENPENCIL_PREVIEW_TAB_TYPE,
				...seed.path === void 0 ? {} : { path: seed.path }
			}, seed.sessionId === void 0 ? void 0 : { sessionId: seed.sessionId });
		};
		previewOpenTab = openTab;
		const dispose = registerTab({
			id: OPENPENCIL_PREVIEW_TAB_TYPE,
			title: () => designRenderCopy(getLocale()).previewTab,
			single: true,
			component: (props) => {
				const locale = (0, react.useSyncExternalStore)(subscribeLocale, getLocale, getLocale);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpenPencilPreviewTab, {
					...props,
					locale
				});
			}
		});
		return () => {
			dispose();
			if (previewOpenTab === openTab) previewOpenTab = void 0;
		};
	});
}
//#endregion
exports.GALLERY_COMPACT_MAX_HEIGHT = GALLERY_COMPACT_MAX_HEIGHT;
exports.GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT = GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT;
exports.GALLERY_TOOLBAR_CONTROL_HEIGHT = GALLERY_TOOLBAR_CONTROL_HEIGHT;
exports.GALLERY_TOOLBAR_CONTROL_LAYOUT = GALLERY_TOOLBAR_CONTROL_LAYOUT;
exports.GALLERY_ZOOM_MAX = GALLERY_ZOOM_MAX;
exports.GALLERY_ZOOM_MIN = GALLERY_ZOOM_MIN;
exports.GALLERY_ZOOM_STEP = GALLERY_ZOOM_STEP;
exports.LEGACY_DESIGN_RENDER_TOOL_NAME = LEGACY_DESIGN_RENDER_TOOL_NAME;
exports.OPENPENCIL_PREVIEW_TAB_TYPE = OPENPENCIL_PREVIEW_TAB_TYPE;
exports.OPENPENCIL_RENDER_TOOL_NAME = OPENPENCIL_RENDER_TOOL_NAME;
exports.OpenPencilPreviewTab = OpenPencilPreviewTab;
exports.PRESENTATION_HYDRATION_ENDPOINT = PRESENTATION_HYDRATION_ENDPOINT;
exports.PRESENTATION_META_KEY = PRESENTATION_META_KEY;
exports.SilentRenderObserver = SilentRenderObserver;
exports.apply = apply;
exports.calculateGalleryFitViewZoom = calculateGalleryFitViewZoom;
exports.claimCanvas = claimCanvas;
exports.clampGalleryZoom = clampGalleryZoom;
exports.designRenderCopy = designRenderCopy;
exports.documentSha256FromCanonicalResult = documentSha256FromCanonicalResult;
exports.forgetSessionRenders = forgetSessionRenders;
exports.frameGalleryCopy = frameGalleryCopy;
exports.frameLabel = frameLabel;
exports.galleryViewportMaxHeight = galleryViewportMaxHeight;
exports.galleryZoomCommandTarget = galleryZoomCommandTarget;
exports.galleryZoomPercent = galleryZoomPercent;
exports.galleryZoomShortcut = galleryZoomShortcut;
exports.getRecentRender = getRecentRender;
exports.grantOf = grantOf;
exports.inject = inject;
exports.loadOpenPencilSdk = loadOpenPencilSdk;
exports.nextGalleryZoom = nextGalleryZoom;
exports.normalizeFrameIndex = normalizeFrameIndex;
exports.presentationGrantOfMeta = presentationGrantOfMeta;
exports.presentationHydrationRequestOf = presentationHydrationRequestOf;
exports.publishRecentRender = publishRecentRender;
exports.requestPresentationGrant = requestPresentationGrant;
exports.sizeCanvasForDisplay = sizeCanvasForDisplay;
exports.subscribeRecentRender = subscribeRecentRender;

return module.exports; } });
