window.__ModuleLoader__.load({ id: "dsh-openpencil-lite", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
let react_dom_client = require("react-dom/client");
let react_dom = require("react-dom");
//#region src/client/editor-bridge.ts
function isRecord$6(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function safeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function string(value) {
	return typeof value === "string";
}
/** Parse only the editor/host messages DSH implements. Unknown traffic is ignored. */
function parseEditorInbound(raw) {
	if (typeof raw !== "string") return void 0;
	let value;
	try {
		value = JSON.parse(raw);
	} catch {
		return;
	}
	if (!isRecord$6(value) || typeof value.type !== "string") return void 0;
	switch (value.type) {
		case "op-bridge/ready": return safeInteger(value.generation) && safeInteger(value.revision) ? {
			type: value.type,
			generation: value.generation,
			revision: value.revision
		} : void 0;
		case "op-bridge/opened": return safeInteger(value.generation) ? {
			type: value.type,
			generation: value.generation
		} : void 0;
		case "op-bridge/dirty-changed": return safeInteger(value.generation) && safeInteger(value.revision) && typeof value.dirty === "boolean" ? {
			type: value.type,
			generation: value.generation,
			revision: value.revision,
			dirty: value.dirty
		} : void 0;
		case "op-bridge/snapshot-result": return string(value.requestId) && string(value.docJson) && safeInteger(value.generation) && safeInteger(value.revision) ? {
			type: value.type,
			requestId: value.requestId,
			docJson: value.docJson,
			generation: value.generation,
			revision: value.revision
		} : void 0;
		case "op-bridge/snapshot-conflict": return string(value.requestId) && safeInteger(value.serverVersion) ? {
			type: value.type,
			requestId: value.requestId,
			serverVersion: value.serverVersion
		} : void 0;
		case "op-bridge/sync-conflict": return safeInteger(value.generation) && safeInteger(value.revision) && safeInteger(value.serverVersion) ? {
			type: value.type,
			generation: value.generation,
			revision: value.revision,
			serverVersion: value.serverVersion
		} : void 0;
		case "op-bridge/conflict-resolved": return string(value.requestId) ? {
			type: value.type,
			requestId: value.requestId
		} : void 0;
		case "op-shell/save": return { type: value.type };
		case "op-shell/copy": return string(value.text) ? {
			type: value.type,
			text: value.text
		} : void 0;
		default: return;
	}
}
function encodeEditorOutbound(message) {
	return JSON.stringify(message);
}
/** Require an absolute loopback editor URL and derive its exact target origin. */
function editorOrigin(iframeUrl) {
	const url = new URL(iframeUrl);
	if (!(url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1") || url.protocol !== "http:" && url.protocol !== "https:") throw new Error("OpenPencil editor URL must use an HTTP loopback origin");
	return url.origin;
}
/** Pin the host's resolved theme into the editor's first navigation. */
function editorIframeUrlWithTheme(iframeUrl, colorScheme) {
	const url = new URL(iframeUrl);
	url.searchParams.set("theme", colorScheme);
	return url.href;
}
/** Pin the host's resolved locale into the editor's first navigation. */
function editorIframeUrlWithLocale(iframeUrl, locale) {
	const url = new URL(iframeUrl);
	url.searchParams.set("locale", locale);
	return url.href;
}
/** Translate DSH's compact locale id to the editor's BCP 47 contract. */
function editorLocaleFromDsh(locale) {
	return locale === "zh" ? "zh-CN" : "en-US";
}
/** Resolve a launch/save/close capability and reject cross-origin control routes. */
function editorControlUrl(raw, base = window.location.href) {
	const page = new URL(base);
	const url = new URL(raw, page);
	if (url.origin !== page.origin) throw new Error("OpenPencil editor control URL must be same-origin");
	return url.href;
}
/** Validate source and exact origin before parsing any iframe message. */
function editorMessageFrom(event, frameWindow, origin) {
	if (frameWindow === null || event.source !== frameWindow || event.origin !== origin) return void 0;
	return parseEditorInbound(event.data);
}
let activeEditor;
/** Read-only gate for background auto-open flows; never asks an owner to close. */
function hasActiveEditor() {
	return activeEditor !== void 0;
}
/** Page-wide single-editor coordinator. An existing dirty editor may veto takeover. */
function claimEditor(token, close, options = {}) {
	const previous = activeEditor;
	if (previous !== void 0 && previous.token !== token) {
		if (options.replace === false || previous.close() === false) return void 0;
	}
	activeEditor = {
		token,
		close
	};
	return () => {
		if (activeEditor?.token === token) activeEditor = void 0;
	};
}
/** Confirm before a user-driven panel close would discard unsaved canvas edits. */
function confirmEditorClose(dirty, confirm = window.confirm) {
	return !dirty || confirm("OpenPencil has unsaved changes. Close the editor and discard them?");
}
//#endregion
//#region src/client/editor-successor.ts
/** Session-scoped successor capabilities for reopening a saved editor card. */
const STORAGE_PREFIX = "dsh-openpencil:editor-successor:v1:";
function isRecord$5(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function browserStorage() {
	try {
		return window.sessionStorage;
	} catch {
		return;
	}
}
function storageOf(options) {
	return options.storage === void 0 ? browserStorage() : options.storage ?? void 0;
}
function baseUrlOf(options) {
	return options.baseUrl ?? window.location.href;
}
/** The original Tool grant scopes one successor chain for the life of this tab. */
function editorSuccessorStorageKey(originalLaunchUrl, baseUrl = window.location.href) {
	return `${STORAGE_PREFIX}${editorControlUrl(originalLaunchUrl, baseUrl)}`;
}
function persistedSuccessorOf(value, baseUrl) {
	if (!isRecord$5(value)) return void 0;
	const launchUrl = value.launchUrl;
	const refreshUrl = value.refreshUrl;
	if (typeof launchUrl !== "string" || launchUrl.length === 0 || typeof refreshUrl !== "string" || refreshUrl.length === 0) return void 0;
	try {
		return {
			launchUrl: editorControlUrl(launchUrl, baseUrl),
			refreshUrl: editorControlUrl(refreshUrl, baseUrl)
		};
	} catch {
		return;
	}
}
/** Parse only the successor grant from a successful save response. */
function editorSuccessorFromSave(value, baseUrl = window.location.href) {
	if (!isRecord$5(value) || !isRecord$5(value.editor) || value.editor.enabled !== true) return void 0;
	const persisted = persistedSuccessorOf(value.editor, baseUrl);
	return persisted === void 0 ? void 0 : {
		enabled: true,
		...persisted
	};
}
/**
* Persist the newest save successor under the immutable Tool grant. Invalid or
* absent successors clear an older value so a later reopen cannot use a stale
* source capability. Storage denial is intentionally non-fatal to saving.
*/
function rememberEditorSuccessor(originalLaunchUrl, saveResponse, options = {}) {
	const baseUrl = baseUrlOf(options);
	const successor = editorSuccessorFromSave(saveResponse, baseUrl);
	const storage = storageOf(options);
	if (storage === void 0) return successor;
	try {
		const key = editorSuccessorStorageKey(originalLaunchUrl, baseUrl);
		if (successor === void 0 || successor.refreshUrl === void 0) {
			storage.removeItem(key);
			return;
		}
		storage.setItem(key, JSON.stringify({
			launchUrl: successor.launchUrl,
			refreshUrl: successor.refreshUrl
		}));
	} catch {}
	return successor;
}
/** Resolve a saved successor, falling back to the original Tool grant safely. */
function editorGrantForBoot(original, options = {}) {
	const storage = storageOf(options);
	if (storage === void 0) return original;
	const baseUrl = baseUrlOf(options);
	let key;
	try {
		key = editorSuccessorStorageKey(original.launchUrl, baseUrl);
	} catch {
		return original;
	}
	try {
		const raw = storage.getItem(key);
		if (raw === null) return original;
		const successor = persistedSuccessorOf(JSON.parse(raw), baseUrl);
		if (successor !== void 0) return {
			enabled: true,
			...successor
		};
	} catch {}
	try {
		storage.removeItem(key);
	} catch {}
	return original;
}
//#endregion
//#region src/client/selection-store.ts
const stores = /* @__PURE__ */ new Map();
const listeners = /* @__PURE__ */ new Map();
const EMPTY_SELECTION_STORE_SNAPSHOT = Object.freeze({ revision: 0 });
function isRecord$4(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function nodeOf(value) {
	if (!isRecord$4(value) || typeof value.id !== "string" || value.id.length === 0) return void 0;
	return {
		id: value.id,
		...typeof value.type === "string" && value.type.length > 0 ? { type: value.type } : {},
		...typeof value.name === "string" && value.name.length > 0 ? { name: value.name } : {},
		...finite(value.x) === void 0 ? {} : { x: finite(value.x) },
		...finite(value.y) === void 0 ? {} : { y: finite(value.y) },
		...finite(value.width) === void 0 ? {} : { width: finite(value.width) },
		...finite(value.height) === void 0 ? {} : { height: finite(value.height) }
	};
}
function liveSelectionOf(value) {
	if (!isRecord$4(value) || typeof value.sourcePath !== "string" || value.sourcePath.length === 0) return void 0;
	return {
		sourcePath: value.sourcePath,
		activePageId: typeof value.activePageId === "string" ? value.activePageId : "",
		selectedIds: Array.isArray(value.selectedIds) ? value.selectedIds.filter((id) => typeof id === "string" && id.length > 0) : [],
		nodes: Array.isArray(value.nodes) ? value.nodes.map(nodeOf).filter((node) => node !== void 0) : [],
		updatedAt: finite(value.updatedAt) ?? Date.now()
	};
}
function sameSelection(a, b) {
	if (a === void 0 || b === void 0) return a === b;
	return a.sourcePath === b.sourcePath && a.activePageId === b.activePageId && JSON.stringify(a.selectedIds) === JSON.stringify(b.selectedIds) && JSON.stringify(a.nodes) === JSON.stringify(b.nodes);
}
function publishOpenPencilSelection(sessionId, selection) {
	const current = stores.get(sessionId) ?? { revision: 0 };
	if (sameSelection(current.selection, selection)) return;
	stores.set(sessionId, {
		revision: current.revision + 1,
		selection
	});
	for (const listener of listeners.get(sessionId) ?? []) listener();
}
function clearOpenPencilSelection(sessionId, sourcePath) {
	const current = stores.get(sessionId);
	if (current === void 0) return;
	if (current.selection === void 0) return;
	if (sourcePath !== void 0 && current.selection.sourcePath !== sourcePath) return;
	stores.set(sessionId, { revision: current.revision + 1 });
	for (const listener of listeners.get(sessionId) ?? []) listener();
}
function subscribeOpenPencilSelection(sessionId, listener) {
	let scoped = listeners.get(sessionId);
	if (scoped === void 0) {
		scoped = /* @__PURE__ */ new Set();
		listeners.set(sessionId, scoped);
	}
	scoped.add(listener);
	return () => {
		scoped?.delete(listener);
		if (scoped?.size === 0) listeners.delete(sessionId);
	};
}
function getOpenPencilSelectionSnapshot(sessionId) {
	return stores.get(sessionId) ?? EMPTY_SELECTION_STORE_SNAPSHOT;
}
//#endregion
//#region src/client/selection-polling.ts
const DEFAULT_INTERVAL_MS = 400;
const DEFAULT_TIMER = {
	schedule: (callback, delayMs) => setTimeout(callback, delayMs),
	cancel: (handle) => {
		clearTimeout(handle);
	}
};
/** Client failures other than retry-oriented HTTP statuses cannot recover by polling. */
function isTerminalEditorSelectionStatus(status) {
	return status >= 400 && status < 500 && status !== 408 && status !== 425 && status !== 429;
}
/**
* Start one immediate poll followed by non-overlapping delayed polls.
*
* The returned cleanup is idempotent, aborts an in-flight request, cancels the
* pending timer, and invokes `onStop` exactly once. Terminal HTTP responses
* use the same cleanup path; network errors and retryable statuses schedule a
* later attempt without disrupting the editor itself.
*/
function startEditorSelectionPolling(options) {
	const fetcher = options.fetcher ?? fetch;
	const timer = options.timer ?? DEFAULT_TIMER;
	const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
	let stopped = false;
	let timerHandle;
	let requestAbort;
	const stop = () => {
		if (stopped) return;
		stopped = true;
		if (timerHandle !== void 0) {
			timer.cancel(timerHandle);
			timerHandle = void 0;
		}
		requestAbort?.abort();
		requestAbort = void 0;
		options.onStop();
	};
	const schedule = () => {
		if (stopped) return;
		timerHandle = timer.schedule(() => {
			timerHandle = void 0;
			poll();
		}, intervalMs);
	};
	const poll = async () => {
		if (stopped) return;
		const abort = new AbortController();
		requestAbort = abort;
		try {
			const response = await fetcher(options.url, {
				credentials: "same-origin",
				signal: abort.signal
			});
			if (stopped) return;
			if (isTerminalEditorSelectionStatus(response.status)) {
				stop();
				return;
			}
			if (response.ok) {
				const value = await response.json();
				if (!stopped) options.onValue(value);
			}
		} catch {} finally {
			if (requestAbort === abort) requestAbort = void 0;
			schedule();
		}
	};
	poll();
	return stop;
}
//#endregion
//#region src/client/editor-recovery.ts
/** Same-origin client controls for durable managed-editor recovery. */
function isRecord$3(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function editorRecoverySummaryOf(value) {
	if (!isRecord$3(value)) return void 0;
	if (typeof value.id !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.id) || typeof value.capturedAt !== "number" || !Number.isSafeInteger(value.capturedAt) || value.capturedAt <= 0 || typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes <= 0 || typeof value.sourceName !== "string" || value.sourceName.length <= 0 || value.sourceName.length > 512 || typeof value.sourceChangedSinceCapture !== "boolean" || typeof value.cacheLabel !== "string" || !value.cacheLabel.startsWith("dsh-openpencil/recovery/")) return void 0;
	return value;
}
function editorRecoveryItemUrl(launch, recoveryId) {
	if (launch.recoveryUrl === void 0) throw new Error("OpenPencil recovery control is unavailable");
	if (!/^[A-Za-z0-9_-]{43}$/.test(recoveryId)) throw new Error("OpenPencil recovery id is invalid");
	return `${editorControlUrl(launch.recoveryUrl)}/${recoveryId}`;
}
async function checkedJson(response, action) {
	if (!response.ok) throw new Error(`${action} failed (${response.status})`);
	return response.json();
}
/** Capture the authoritative daemon document; never serializes the iframe from React. */
async function captureManagedEditorRecovery(launch, fetcher = fetch) {
	if (launch.recoveryUrl === void 0) return void 0;
	const value = await checkedJson(await fetcher(editorControlUrl(launch.recoveryUrl), {
		method: "POST",
		credentials: "same-origin",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ sessionId: launch.sessionId }),
		keepalive: true
	}), "OpenPencil recovery capture");
	if (!isRecord$3(value) || value.ok !== true) throw new Error("OpenPencil recovery capture returned an invalid result");
	if (value.recovery === null) return void 0;
	const recovery = editorRecoverySummaryOf(value.recovery);
	if (recovery === void 0) throw new Error("OpenPencil recovery capture omitted recovery metadata");
	return recovery;
}
/** Explicitly restore into the live daemon. The user must still press Save to update `.op`. */
async function restoreManagedEditorRecovery(launch, recovery, fetcher = fetch) {
	const value = await checkedJson(await fetcher(editorRecoveryItemUrl(launch, recovery.id), {
		method: "POST",
		credentials: "same-origin",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ sessionId: launch.sessionId })
	}), "OpenPencil recovery restore");
	if (!isRecord$3(value) || value.ok !== true || typeof value.docJson !== "string") throw new Error("OpenPencil recovery restore returned an invalid result");
	return value.docJson;
}
async function discardManagedEditorRecovery(launch, recovery, fetcher = fetch) {
	const value = await checkedJson(await fetcher(editorRecoveryItemUrl(launch, recovery.id), {
		method: "DELETE",
		credentials: "same-origin",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ sessionId: launch.sessionId })
	}), "OpenPencil recovery discard");
	if (!isRecord$3(value) || value.ok !== true) throw new Error("OpenPencil recovery discard returned an invalid result");
}
const COPY = {
	"zh-CN": {
		available: (sourceName) => `发现 ${sourceName} 的未保存恢复稿。是否恢复？恢复后仍需点击“保存”才会写入源文件。`,
		conflict: (sourceName) => `发现 ${sourceName} 的未保存恢复稿，但源文件之后已被修改。仍要将恢复稿载入画布吗？恢复不会自动覆盖源文件。`
	},
	"en-US": {
		available: (sourceName) => `An unsaved recovery draft for ${sourceName} is available. Restore it? You must still select Save to write the source file.`,
		conflict: (sourceName) => `An unsaved recovery draft for ${sourceName} is available, but the source changed later. Load the draft into the canvas anyway? Recovery will not overwrite the source automatically.`
	}
};
function editorRecoveryCopy(locale) {
	return COPY[locale];
}
//#endregion
//#region src/client/editor-panel.tsx
/** Full OpenPencil editor shared by native Tool details and plugin-owned surfaces. */
const DEFAULT_REFRESH_URL = "/_dsh/dsh-openpencil-lite/editor/refresh";
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function launchResponseOf(value) {
	if (!isRecord$2(value)) throw new Error("OpenPencil editor launch returned an invalid response");
	for (const field of [
		"sessionId",
		"iframeUrl",
		"token",
		"saveUrl",
		"closeUrl"
	]) if (typeof value[field] !== "string" || value[field].length === 0) throw new Error(`OpenPencil editor launch omitted ${field}`);
	return {
		sessionId: value.sessionId,
		iframeUrl: value.iframeUrl,
		token: value.token,
		saveUrl: editorControlUrl(value.saveUrl),
		...typeof value.selectionUrl === "string" && value.selectionUrl.length > 0 ? { selectionUrl: editorControlUrl(value.selectionUrl) } : {},
		...typeof value.recoveryUrl === "string" && value.recoveryUrl.length > 0 ? { recoveryUrl: editorControlUrl(value.recoveryUrl) } : {},
		closeUrl: editorControlUrl(value.closeUrl),
		...editorRecoverySummaryOf(value.recovery) === void 0 ? {} : { recovery: editorRecoverySummaryOf(value.recovery) },
		...typeof value.docJson === "string" ? { docJson: value.docJson } : {}
	};
}
async function responseJson(response, action) {
	if (!response.ok) throw new Error(`${action} failed (${response.status})`);
	return response.json();
}
function refreshedLaunchUrlOf(value) {
	if (!isRecord$2(value) || typeof value.launchUrl !== "string" || value.launchUrl.length === 0) throw new Error("OpenPencil editor refresh omitted launchUrl");
	return editorControlUrl(value.launchUrl);
}
const EDITOR_PANEL_COPY = {
	"zh-CN": {
		save: "保存",
		saving: "保存中…",
		unsaved: "未保存",
		saved: "已保存",
		unavailable: "当前结果无法使用可编辑的 OpenPencil 画布。",
		loading: "正在加载可编辑的 OpenPencil 画布…",
		errorTitle: "OpenPencil 编辑器不可用",
		pngFallback: "打开 PNG 预览",
		editorTitle: (title) => `OpenPencil 编辑器：${title}`,
		editorTimeout: "OpenPencil 编辑器未能及时就绪",
		editorBusy: "另一个 OpenPencil 编辑器仍有未保存的更改。",
		discard: "OpenPencil 中有未保存的更改，确定关闭并放弃吗？",
		saveConflict: (serverVersion) => `OpenPencil 保存冲突（服务器版本 ${serverVersion}）`,
		syncConflict: (serverVersion) => `源文件已在编辑器外部更改（服务器版本 ${serverVersion}），已停止保存。`
	},
	"en-US": {
		save: "Save",
		saving: "Saving…",
		unsaved: "Unsaved",
		saved: "Saved",
		unavailable: "Editable OpenPencil canvas is not available for this result.",
		loading: "Loading editable OpenPencil canvas…",
		errorTitle: "OpenPencil editor unavailable",
		pngFallback: "Open PNG fallback",
		editorTitle: (title) => `OpenPencil editor: ${title}`,
		editorTimeout: "OpenPencil editor did not become ready",
		editorBusy: "Another OpenPencil editor still has unsaved changes.",
		discard: "OpenPencil has unsaved changes. Close and discard them?",
		saveConflict: (serverVersion) => `OpenPencil save conflict (server v${serverVersion})`,
		syncConflict: (serverVersion) => `The source changed outside this editor (server v${serverVersion}). Save was stopped.`
	}
};
/** Chrome copy for the locale already resolved by the DSH host. */
function editorPanelCopy(locale) {
	return EDITOR_PANEL_COPY[locale];
}
function launchRequest(fetcher, url, signal, sessionId) {
	return fetcher(editorControlUrl(url), {
		method: "POST",
		credentials: "same-origin",
		...sessionId === void 0 ? {} : {
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ sessionId })
		},
		...signal === void 0 ? {} : { signal }
	});
}
/**
* Launch one editor, renewing exactly once when a replayed launch capability
* has expired. A refreshed capability is never persisted back into the Tool
* block, and only same-origin control routes can receive document metadata.
*/
async function launchManagedEditor(editor, document, options = {}) {
	const fetcher = options.fetcher ?? fetch;
	let launchUrl = editor.launchUrl;
	let renewed = false;
	let response = await launchRequest(fetcher, launchUrl, options.signal, options.sessionId);
	if (response.status === 410) {
		if (document.path === void 0) throw new Error("OpenPencil editor launch expired and cannot be refreshed without a source path");
		launchUrl = refreshedLaunchUrlOf(await responseJson(await fetcher(editorControlUrl(editor.refreshUrl ?? DEFAULT_REFRESH_URL), {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				launchUrl: editor.launchUrl,
				sourcePath: document.path,
				documentUrl: document.url
			}),
			...options.signal === void 0 ? {} : { signal: options.signal }
		}), "OpenPencil editor refresh"));
		renewed = true;
		response = await launchRequest(fetcher, launchUrl, options.signal, options.sessionId);
	}
	const launch = launchResponseOf(await responseJson(response, "OpenPencil editor launch"));
	return renewed ? {
		...launch,
		renewed: true
	} : launch;
}
/** Prefer the daemon's current source; fetch the immutable snapshot only for old hosts. */
async function prepareManagedEditor(editor, document, options = {}) {
	const fetcher = options.fetcher ?? fetch;
	const launch = await launchManagedEditor(editor, document, {
		...options,
		fetcher
	});
	try {
		if (launch.docJson !== void 0) return {
			launch,
			documentJson: launch.docJson
		};
		if (editor.refreshUrl !== void 0 || launch.renewed === true) throw new Error("OpenPencil editor launch omitted current docJson");
		const documentResponse = await fetcher(editorControlUrl(document.url), {
			credentials: "same-origin",
			...options.signal === void 0 ? {} : { signal: options.signal }
		});
		if (!documentResponse.ok) throw new Error(`OpenPencil document request failed (${documentResponse.status})`);
		return {
			launch,
			documentJson: await documentResponse.text()
		};
	} catch (error) {
		await closeManagedEditorLaunch(launch, {
			fetcher,
			keepalive: true
		}).catch(() => {});
		throw error;
	}
}
/** Close exactly the managed session returned by one launch response. */
async function closeManagedEditorLaunch(launch, options = {}) {
	const response = await (options.fetcher ?? fetch)(launch.closeUrl, {
		method: "DELETE",
		credentials: "same-origin",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			sessionId: launch.sessionId,
			dirty: options.dirty ?? false
		}),
		...options.keepalive === void 0 ? {} : { keepalive: options.keepalive }
	});
	if (!response.ok) throw new Error(`OpenPencil editor close failed (${response.status})`);
}
/**
* Mount-aware boot boundary. React may cancel an effect after its launch POST
* has committed; release that precise returned session before ignoring it.
*/
async function prepareManagedEditorForMount(editor, document, accept, options = {}) {
	const prepared = await prepareManagedEditor(editor, document, options);
	if (accept()) return prepared;
	await closeManagedEditorLaunch(prepared.launch, {
		...options.fetcher === void 0 ? {} : { fetcher: options.fetcher },
		keepalive: true
	});
}
const panelStyles = {
	root: {
		height: "100%",
		minHeight: 0,
		display: "flex",
		flexDirection: "column",
		color: "var(--dsw-alias-label-primary)",
		background: "var(--dsw-alias-bg-base)"
	},
	toolbar: {
		minHeight: 48,
		display: "flex",
		alignItems: "center",
		gap: 8,
		padding: "8px 10px 8px 12px",
		borderBottom: "1px solid var(--dsw-alias-border-l2)"
	},
	title: {
		minWidth: 0,
		marginRight: "auto",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		fontSize: 14,
		lineHeight: "20px",
		fontWeight: 500
	},
	status: {
		fontSize: 11,
		color: "var(--dsw-alias-label-secondary)",
		whiteSpace: "nowrap"
	},
	button: {
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 6,
		color: "var(--dsw-alias-label-primary)",
		background: "var(--dsw-alias-bg-layer-1)",
		minHeight: 28,
		padding: "4px 8px",
		cursor: "pointer",
		fontFamily: "inherit",
		fontSize: 12,
		fontWeight: "inherit",
		lineHeight: 1
	},
	stage: {
		position: "relative",
		flex: 1,
		minHeight: 0,
		overflow: "hidden",
		background: "var(--dsw-alias-bg-base)"
	},
	iframe: {
		display: "block",
		width: "100%",
		height: "100%",
		border: 0,
		background: "var(--dsw-alias-bg-base)"
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
		color: "var(--dsw-alias-label-primary)",
		background: "var(--dsw-alias-bg-base)",
		fontSize: 12
	},
	error: {
		color: "var(--dsw-alias-state-error-primary)",
		maxWidth: 420,
		overflowWrap: "anywhere"
	}
};
const INITIAL_EDITOR_LIFECYCLE_STATE = {
	dirty: false,
	phase: "launching"
};
/**
* Start the managed-editor init handshake immediately, then retry on a bounded
* interval until the caller stops it after `op-bridge/ready`.
*
* This deliberately starts before the iframe `load` event. OpenPencil waits
* briefly for this token before starting daemon-backed services (including the
* account-status request), while a browser may delay `load` until module/Wasm
* startup is already complete. Waiting for `load` can therefore make the first
* account request run unauthenticated and hide the login button until the
* editor's later health refresh.
*/
function beginEditorInitRetry(send, onExhausted, timer, options = {}) {
	const intervalMs = options.intervalMs ?? 500;
	const maxAttempts = options.maxAttempts ?? 20;
	let attempts = 0;
	let handle;
	let stopped = false;
	const stop = () => {
		if (stopped) return;
		stopped = true;
		if (handle !== void 0) timer.cancel(handle);
	};
	const attempt = () => {
		if (stopped) return;
		attempts += 1;
		send();
		if (attempts >= maxAttempts) {
			stop();
			onExhausted();
		}
	};
	attempt();
	if (!stopped) handle = timer.schedule(attempt, intervalMs);
	return stop;
}
/**
* Apply the unmount policy without letting React cleanup accidentally issue
* DELETE. Dirty live launches are retained by default even when their native
* Tool-details owner has no lifecycle controller.
*/
function applyManagedEditorUnmountPolicy(state, closeDaemon) {
	if (state.retainServerSession || state.dirty && state.hasLiveLaunch) return "retained";
	closeDaemon();
	return "closed";
}
/** Editable panel. The daemon is created lazily only while this component is mounted. */
function ManagedOpenPencilEditor({ grant, colorScheme, locale, sessionId, onTakeoverRequest, onLifecycleState, onLifecycleController, workbenchActions, allowTakeover = true }) {
	const iframeRef = (0, react.useRef)(null);
	const launchRef = (0, react.useRef)();
	const iframeSrcRef = (0, react.useRef)("");
	const originRef = (0, react.useRef)("");
	const docJsonRef = (0, react.useRef)("");
	const colorSchemeRef = (0, react.useRef)(colorScheme);
	colorSchemeRef.current = colorScheme;
	const localeRef = (0, react.useRef)(locale);
	localeRef.current = locale;
	const takeoverRequestRef = (0, react.useRef)(onTakeoverRequest);
	takeoverRequestRef.current = onTakeoverRequest;
	const lifecycleStateRef = (0, react.useRef)(onLifecycleState);
	lifecycleStateRef.current = onLifecycleState;
	const lifecycleControllerRef = (0, react.useRef)(onLifecycleController);
	lifecycleControllerRef.current = onLifecycleController;
	const stopInitLoopRef = (0, react.useRef)();
	const selectionPollStopRef = (0, react.useRef)();
	const requestCounterRef = (0, react.useRef)(0);
	const saveWaitersRef = (0, react.useRef)(/* @__PURE__ */ new Map());
	const [phase, setPhase] = (0, react.useState)("launching");
	const phaseRef = (0, react.useRef)("launching");
	const [failure, setFailure] = (0, react.useState)("");
	const [dirty, setDirty] = (0, react.useState)(false);
	const dirtyRef = (0, react.useRef)(false);
	const saveInFlightRef = (0, react.useRef)();
	const closeDaemonRef = (0, react.useRef)();
	const retainServerSessionOnUnmountRef = (0, react.useRef)(false);
	const restoredRecoveryRef = (0, react.useRef)(false);
	const documentGrant = grant.document;
	const editorGrant = grant.editor;
	const publishLifecycle = (0, react.useCallback)(() => {
		lifecycleStateRef.current?.({
			dirty: dirtyRef.current,
			phase: phaseRef.current
		});
	}, []);
	const updatePhase = (0, react.useCallback)((next) => {
		phaseRef.current = next;
		setPhase(next);
		publishLifecycle();
	}, [publishLifecycle]);
	const updateDirty = (0, react.useCallback)((next) => {
		dirtyRef.current = next;
		setDirty(next);
		publishLifecycle();
	}, [publishLifecycle]);
	const post = (0, react.useCallback)((message) => {
		const frame = iframeRef.current?.contentWindow;
		if (frame === null || frame === void 0 || originRef.current === "") return;
		frame.postMessage(encodeEditorOutbound(message), originRef.current);
	}, []);
	const save = (0, react.useCallback)(async () => {
		if (saveInFlightRef.current !== void 0) return saveInFlightRef.current;
		const launch = launchRef.current;
		if (launch === void 0 || phaseRef.current === "launching" || phaseRef.current === "loading") return false;
		if (!dirtyRef.current) return true;
		const operation = (async () => {
			updatePhase("saving");
			setFailure("");
			const requestId = `dsh-save-${++requestCounterRef.current}`;
			let snapshotTimer;
			try {
				const snapshot = await Promise.race([new Promise((resolve, reject) => {
					saveWaitersRef.current.set(requestId, {
						resolve,
						reject
					});
					post({
						type: "op-bridge/snapshot",
						purpose: "save",
						requestId
					});
				}), new Promise((_, reject) => {
					snapshotTimer = setTimeout(() => {
						reject(/* @__PURE__ */ new Error("OpenPencil snapshot timed out"));
					}, 8e3);
				})]);
				const saveResponse = await responseJson(await fetch(launch.saveUrl, {
					method: "POST",
					credentials: "same-origin",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						sessionId: launch.sessionId,
						docJson: snapshot.docJson,
						generation: snapshot.generation,
						revision: snapshot.revision
					})
				}), "OpenPencil save");
				rememberEditorSuccessor(editorGrant.launchUrl, saveResponse);
				post({
					type: "op-bridge/save-committed",
					generation: snapshot.generation,
					revision: snapshot.revision
				});
				restoredRecoveryRef.current = false;
				updateDirty(false);
				updatePhase("ready");
				return true;
			} catch (error) {
				setFailure(error instanceof Error ? error.message : String(error));
				updatePhase("error");
				return false;
			} finally {
				if (snapshotTimer !== void 0) clearTimeout(snapshotTimer);
				saveWaitersRef.current.delete(requestId);
			}
		})();
		saveInFlightRef.current = operation;
		try {
			return await operation;
		} finally {
			if (saveInFlightRef.current === operation) saveInFlightRef.current = void 0;
		}
	}, [
		editorGrant.launchUrl,
		post,
		updateDirty,
		updatePhase
	]);
	(0, react.useEffect)(() => {
		publishLifecycle();
		lifecycleControllerRef.current?.({
			requestClose: async () => {
				if (phaseRef.current === "saving") return false;
				const closeDaemon = closeDaemonRef.current;
				if (closeDaemon === void 0) return false;
				try {
					await closeDaemon(dirtyRef.current);
					return true;
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
					updatePhase("error");
					return false;
				}
			},
			captureRecovery: async () => {
				const launch = launchRef.current;
				if (launch?.recoveryUrl === void 0) return false;
				try {
					await captureManagedEditorRecovery(launch);
					return true;
				} catch {
					return false;
				}
			},
			awaitExistingSave: async () => {
				const pending = saveInFlightRef.current;
				return pending === void 0 ? true : pending;
			},
			retainServerSessionOnUnmount: () => {
				retainServerSessionOnUnmountRef.current = true;
			}
		});
		return () => {
			lifecycleControllerRef.current?.(void 0);
		};
	}, [publishLifecycle, updatePhase]);
	(0, react.useEffect)(() => {
		let cancelled = false;
		const abort = new AbortController();
		const coordinatorToken = Symbol("openpencil-editor");
		const closeDaemon = async (dirtyAtClose = dirtyRef.current) => {
			selectionPollStopRef.current?.();
			selectionPollStopRef.current = void 0;
			clearOpenPencilSelection(sessionId, documentGrant.path);
			const launch = launchRef.current;
			if (launch === void 0) return;
			await closeManagedEditorLaunch(launch, {
				dirty: dirtyAtClose,
				keepalive: true
			});
			if (launchRef.current === launch) launchRef.current = void 0;
		};
		closeDaemonRef.current = closeDaemon;
		const releaseEditor = claimEditor(coordinatorToken, () => {
			const takeoverRequest = takeoverRequestRef.current;
			const lifecycle = {
				dirty: dirtyRef.current,
				phase: phaseRef.current
			};
			if (takeoverRequest !== void 0 && !takeoverRequest(lifecycle)) return false;
			if (phaseRef.current === "saving") return false;
			if (takeoverRequest === void 0 && !confirmEditorClose(dirtyRef.current, () => window.confirm(editorPanelCopy(localeRef.current).discard))) return false;
			abort.abort();
			closeDaemon(dirtyRef.current);
			return true;
		}, { replace: allowTakeover });
		if (releaseEditor === void 0) {
			setFailure(editorPanelCopy(localeRef.current).editorBusy);
			updatePhase("error");
			return () => {
				abort.abort();
			};
		}
		const boot = async () => {
			try {
				const prepared = await prepareManagedEditorForMount(editorGrantForBoot(editorGrant), documentGrant, () => !cancelled && !abort.signal.aborted, { sessionId });
				if (prepared === void 0) return;
				const { launch } = prepared;
				launchRef.current = launch;
				let { documentJson } = prepared;
				if (launch.recovery !== void 0) {
					const recoveryCopy = editorRecoveryCopy(localeRef.current);
					const message = launch.recovery.sourceChangedSinceCapture ? recoveryCopy.conflict(launch.recovery.sourceName) : recoveryCopy.available(launch.recovery.sourceName);
					if (window.confirm(message)) {
						documentJson = await restoreManagedEditorRecovery(launch, launch.recovery);
						restoredRecoveryRef.current = true;
					}
				}
				const origin = editorOrigin(launch.iframeUrl);
				iframeSrcRef.current = editorIframeUrlWithLocale(editorIframeUrlWithTheme(launch.iframeUrl, colorSchemeRef.current), localeRef.current);
				docJsonRef.current = documentJson;
				originRef.current = origin;
				updatePhase("loading");
			} catch (error) {
				await closeDaemon(dirtyRef.current).catch(() => {});
				if (cancelled || abort.signal.aborted) return;
				setFailure(error instanceof Error ? error.message : String(error));
				updatePhase("error");
			}
		};
		boot();
		return () => {
			cancelled = true;
			abort.abort();
			releaseEditor();
			stopInitLoopRef.current?.();
			stopInitLoopRef.current = void 0;
			const disposed = /* @__PURE__ */ new Error("OpenPencil editor closed");
			for (const waiter of saveWaitersRef.current.values()) waiter.reject(disposed);
			saveWaitersRef.current.clear();
			if (closeDaemonRef.current === closeDaemon) closeDaemonRef.current = void 0;
			if (applyManagedEditorUnmountPolicy({
				retainServerSession: retainServerSessionOnUnmountRef.current,
				dirty: dirtyRef.current,
				hasLiveLaunch: launchRef.current !== void 0
			}, () => {
				closeDaemon().catch(() => {});
			}) === "retained") {
				selectionPollStopRef.current?.();
				selectionPollStopRef.current = void 0;
				clearOpenPencilSelection(sessionId, documentGrant.path);
			}
		};
	}, [
		allowTakeover,
		documentGrant.path,
		documentGrant.url,
		editorGrant.launchUrl,
		editorGrant.refreshUrl,
		updatePhase
	]);
	const startInitLoop = (0, react.useCallback)(() => {
		const launch = launchRef.current;
		if (launch === void 0) return;
		stopInitLoopRef.current?.();
		stopInitLoopRef.current = beginEditorInitRetry(() => {
			post({
				type: "op-bridge/init",
				token: launch.token
			});
			post({
				type: "op-bridge/theme",
				colorScheme: colorSchemeRef.current
			});
			post({
				type: "op-bridge/locale",
				locale: localeRef.current
			});
		}, () => {
			stopInitLoopRef.current = void 0;
			setFailure(editorPanelCopy(localeRef.current).editorTimeout);
			updatePhase("error");
		}, {
			schedule: (callback, delayMs) => window.setInterval(callback, delayMs),
			cancel: (handle) => {
				window.clearInterval(handle);
			}
		});
	}, [post, updatePhase]);
	(0, react.useEffect)(() => {
		if (phase !== "loading" || launchRef.current === void 0 || iframeRef.current === null) return;
		startInitLoop();
		return () => {
			stopInitLoopRef.current?.();
			stopInitLoopRef.current = void 0;
		};
	}, [phase, startInitLoop]);
	(0, react.useEffect)(() => {
		if (phase !== "ready" && phase !== "saving") return;
		const selectionUrl = launchRef.current?.selectionUrl;
		if (selectionUrl === void 0) return;
		const stop = startEditorSelectionPolling({
			url: selectionUrl,
			onValue: (value) => {
				if (!isRecord$2(value)) return;
				const selection = liveSelectionOf(value.selection);
				if (selection !== void 0) publishOpenPencilSelection(sessionId, selection);
			},
			onStop: () => {
				clearOpenPencilSelection(sessionId, documentGrant.path);
			}
		});
		selectionPollStopRef.current = stop;
		return () => {
			if (selectionPollStopRef.current === stop) selectionPollStopRef.current = void 0;
			stop();
		};
	}, [
		documentGrant.path,
		phase,
		sessionId
	]);
	(0, react.useEffect)(() => {
		const listener = (event) => {
			const message = editorMessageFrom(event, iframeRef.current?.contentWindow ?? null, originRef.current);
			if (message === void 0) return;
			switch (message.type) {
				case "op-bridge/ready":
					stopInitLoopRef.current?.();
					stopInitLoopRef.current = void 0;
					post({
						type: "op-bridge/theme",
						colorScheme: colorSchemeRef.current
					});
					post({
						type: "op-bridge/locale",
						locale: localeRef.current
					});
					post({
						type: "op-bridge/open-document",
						json: docJsonRef.current
					});
					break;
				case "op-bridge/opened":
					updatePhase("ready");
					if (restoredRecoveryRef.current) updateDirty(true);
					break;
				case "op-bridge/dirty-changed":
					updateDirty(restoredRecoveryRef.current || message.dirty);
					break;
				case "op-bridge/snapshot-result":
					saveWaitersRef.current.get(message.requestId)?.resolve(message);
					break;
				case "op-bridge/snapshot-conflict":
					saveWaitersRef.current.get(message.requestId)?.reject(new Error(editorPanelCopy(localeRef.current).saveConflict(message.serverVersion)));
					break;
				case "op-bridge/sync-conflict":
					setFailure(editorPanelCopy(localeRef.current).syncConflict(message.serverVersion));
					updatePhase("error");
					break;
				case "op-shell/save":
					save();
					break;
				case "op-shell/copy": navigator.clipboard?.writeText(message.text).catch(() => {});
			}
		};
		window.addEventListener("message", listener);
		return () => {
			window.removeEventListener("message", listener);
		};
	}, [
		post,
		save,
		updateDirty,
		updatePhase
	]);
	(0, react.useEffect)(() => {
		post({
			type: "op-bridge/theme",
			colorScheme
		});
	}, [colorScheme, post]);
	(0, react.useEffect)(() => {
		post({
			type: "op-bridge/locale",
			locale
		});
	}, [locale, post]);
	(0, react.useEffect)(() => {
		const beforeUnload = (event) => {
			if (!dirtyRef.current) return;
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", beforeUnload);
		return () => {
			window.removeEventListener("beforeunload", beforeUnload);
		};
	}, []);
	const title = documentGrant.path?.replaceAll("\\", "/").split("/").at(-1) ?? "OpenPencil";
	const copy = editorPanelCopy(locale);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		style: panelStyles.root,
		"data-tool-details-fill": "true",
		"data-tool-details-dirty": dirty || void 0,
		"data-openpencil-editor-panel": "true",
		"aria-busy": phase === "launching" || phase === "loading" || phase === "saving" || void 0,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: panelStyles.toolbar,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
					style: panelStyles.title,
					title: documentGrant.path,
					children: title
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: panelStyles.status,
					children: phase === "saving" ? copy.saving : dirty ? copy.unsaved : phase === "ready" ? copy.saved : ""
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: panelStyles.button,
					disabled: !dirty || phase === "saving",
					onClick: () => {
						save();
					},
					children: copy.save
				}),
				workbenchActions
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: panelStyles.stage,
			children: [
				launchRef.current !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
					ref: iframeRef,
					style: panelStyles.iframe,
					src: iframeSrcRef.current,
					title: copy.editorTitle(title),
					allow: "clipboard-read; clipboard-write",
					tabIndex: phase === "ready" || phase === "saving" ? 0 : -1
				}) : null,
				phase === "launching" || phase === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: panelStyles.overlay,
					role: "status",
					children: copy.loading
				}) : null,
				phase === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: panelStyles.overlay,
					role: "alert",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: copy.errorTitle }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: panelStyles.error,
							children: failure
						}),
						grant.image !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							href: grant.image.previewUrl,
							target: "_blank",
							rel: "noreferrer",
							children: copy.pngFallback
						}) : null
					]
				}) : null
			]
		})]
	});
}
//#endregion
//#region src/client/details-compat.ts
/** Prefer the native resident details panel and otherwise open our own modal. */
function requestOpenPencilEditor(openDetails, openModal) {
	if (openDetails !== void 0) {
		openDetails();
		return "details";
	}
	openModal();
	return "modal";
}
//#endregion
//#region src/client/editor-dock-layout.ts
/** Self-contained DSH layout push used by the fallback OpenPencil workbench. */
const OPENPENCIL_WORKBENCH_DOCK_ATTRIBUTE = "openpencilWorkbenchDockOwner";
function dockWidth(width) {
	return `${Math.max(0, Math.round(width))}px`;
}
/**
* Reserve real layout space for the fixed right-hand workbench.
*
* DSH's root is an auto-width block, so a right margin shrinks its AppFrame
* grid instead of covering the conversation. Ownership and exact inline-style
* restoration keep this compatible with HMR and fail closed around another
* plugin that already owns the root margin.
*/
function claimEditorWorkbenchDock(root, owner, initialWidth, computedMarginRight = 0) {
	const existingOwner = root.dataset[OPENPENCIL_WORKBENCH_DOCK_ATTRIBUTE];
	if (existingOwner !== void 0 && existingOwner !== owner) return void 0;
	if (existingOwner === void 0 && (root.style.marginRight.trim() !== "" || Number.isFinite(computedMarginRight) && computedMarginRight > .5)) return void 0;
	const previousMarginRight = root.style.marginRight;
	const previousMinWidth = root.style.minWidth;
	root.dataset[OPENPENCIL_WORKBENCH_DOCK_ATTRIBUTE] = owner;
	root.style.minWidth = "0";
	let released = false;
	const update = (width) => {
		if (released || root.dataset["openpencilWorkbenchDockOwner"] !== owner) return;
		root.style.marginRight = dockWidth(width);
	};
	const release = () => {
		if (released) return;
		released = true;
		if (root.dataset["openpencilWorkbenchDockOwner"] !== owner) return;
		root.style.marginRight = previousMarginRight;
		root.style.minWidth = previousMinWidth;
		delete root.dataset[OPENPENCIL_WORKBENCH_DOCK_ATTRIBUTE];
	};
	update(initialWidth);
	return {
		update,
		release
	};
}
//#endregion
//#region src/client/editor-modal.tsx
/** Plugin-owned OpenPencil workbench for DSH builds without Tool details. */
const EDITOR_WORKBENCH_FULLSCREEN_BREAKPOINT = 1480;
const EDITOR_WORKBENCH_MIN_WIDTH = 640;
const EDITOR_WORKBENCH_MAX_WIDTH = 960;
const EDITOR_WORKBENCH_LEFT_CLEARANCE = 840;
const EDITOR_WORKBENCH_RESIZE_STEP = 32;
let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = "";
function lockBodyScroll() {
	if (bodyScrollLockCount === 0) {
		bodyOverflowBeforeLock = document.body.style.overflow;
		document.body.style.overflow = "hidden";
	}
	bodyScrollLockCount += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
		if (bodyScrollLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
	};
}
const EDITOR_WORKBENCH_COPY = {
	"zh-CN": {
		title: "OpenPencil 编辑器",
		close: "关闭",
		fullscreen: "全屏",
		restore: "退出全屏",
		resize: "拖动调整编辑区宽度",
		discard: "OpenPencil 中有未保存的更改，确定关闭并放弃吗？"
	},
	"en-US": {
		title: "OpenPencil editor",
		close: "Close",
		fullscreen: "Full screen",
		restore: "Exit full screen",
		resize: "Drag to resize the editor",
		discard: "OpenPencil has unsaved changes. Close and discard them?"
	}
};
function editorModalCopy(locale) {
	return EDITOR_WORKBENCH_COPY[locale];
}
function editorWorkbenchUsesFullscreen(viewportWidth) {
	return !Number.isFinite(viewportWidth) || viewportWidth < 1480;
}
/** Keep useful DSH conversation space while allowing a large desktop canvas. */
function editorWorkbenchWidthBounds(viewportWidth) {
	const available = Math.max(0, (Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0) - 840);
	const max = Math.min(960, Math.max(640, available));
	const min = Math.min(640, max);
	return {
		min,
		max,
		initial: Math.min(max, Math.max(min, 720))
	};
}
function clampEditorWorkbenchWidth(width, viewportWidth) {
	const bounds = editorWorkbenchWidthBounds(viewportWidth);
	const safeWidth = Number.isFinite(width) ? width : bounds.initial;
	return Math.min(bounds.max, Math.max(bounds.min, safeWidth));
}
/** A left-edge drag grows the right-docked workbench as the pointer moves left. */
function resizedEditorWorkbenchWidth(startWidth, startClientX, clientX, viewportWidth) {
	return clampEditorWorkbenchWidth(startWidth + startClientX - clientX, viewportWidth);
}
/** Key only the editor process; outer workbench geometry remains stable. */
function editorWorkbenchEditorKey(grant, sessionId) {
	return `${sessionId}\n${grant.editor?.launchUrl ?? ""}`;
}
/**
* Return the focus target used at a fullscreen Tab boundary.
*
* `activeIndex` is -1 when focus is outside the workbench. Returning -1 means
* normal browser tab order should continue inside the workbench.
*/
function editorWorkbenchFocusTargetIndex(focusableCount, activeIndex, backwards) {
	if (!Number.isInteger(focusableCount) || focusableCount <= 0) return -1;
	if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= focusableCount) return backwards ? focusableCount - 1 : 0;
	if (backwards && activeIndex === 0) return focusableCount - 1;
	if (!backwards && activeIndex === focusableCount - 1) return 0;
	return -1;
}
/** Side mode is non-modal, so Escape only belongs to it while focus is inside. */
function editorWorkbenchShouldHandleEscape(fullscreen, targetInside) {
	return fullscreen || targetInside;
}
/** Read the editor's durable dirty marker before allowing the workbench to close. */
function confirmEditorModalClose(root, message, confirm = window.confirm) {
	return confirmEditorClose((root?.querySelector("[data-tool-details-dirty=\"true\"]") ?? null) !== null, () => confirm(message));
}
const styles$3 = {
	surface: {
		position: "fixed",
		top: 0,
		right: 0,
		bottom: 0,
		zIndex: 1100,
		boxSizing: "border-box",
		minWidth: 0,
		minHeight: 0,
		display: "flex",
		flexDirection: "column",
		overflow: "hidden",
		borderLeft: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.5))",
		color: "var(--dsw-alias-label-primary, #202124)",
		background: "var(--dsw-alias-bg-base, #fff)"
	},
	fullscreen: {
		left: 0,
		width: "auto",
		borderLeft: 0
	},
	resizeHandle: {
		position: "absolute",
		zIndex: 3,
		top: 0,
		bottom: 0,
		left: -6,
		width: 12,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		cursor: "ew-resize",
		touchAction: "none",
		background: "transparent"
	},
	resizeGrip: {
		width: 3,
		height: 32,
		flex: "none",
		borderRadius: 999,
		border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.45))",
		background: "var(--dsw-alias-button-floating-fill, var(--dsw-alias-bg-layer-2, #fff))",
		boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
		pointerEvents: "none"
	},
	button: {
		boxSizing: "border-box",
		width: 28,
		height: 28,
		flex: "none",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		border: 0,
		borderRadius: 6,
		color: "var(--dsw-alias-label-secondary, inherit)",
		background: "transparent",
		padding: 0,
		cursor: "pointer",
		fontFamily: "inherit",
		fontSize: 12,
		fontWeight: "inherit",
		lineHeight: 1
	},
	body: {
		flex: 1,
		minHeight: 0,
		overflow: "hidden"
	},
	focusGuard: {
		position: "fixed",
		width: 1,
		height: 1,
		padding: 0,
		margin: 0,
		overflow: "hidden",
		opacity: 0,
		pointerEvents: "none"
	}
};
const EDITOR_WORKBENCH_FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"iframe:not([tabindex=\"-1\"])",
	"[tabindex]:not([tabindex=\"-1\"])"
].join(",");
function editorWorkbenchFocusableElements(surface) {
	return Array.from(surface.querySelectorAll(EDITOR_WORKBENCH_FOCUSABLE_SELECTOR)).filter((element) => {
		if (element.dataset.openpencilFocusGuard === "true") return false;
		if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
		if (element.closest("[hidden], [inert], [aria-hidden=\"true\"]")) return false;
		const style = window.getComputedStyle(element);
		return style.display !== "none" && style.visibility !== "hidden";
	});
}
function focusEditorWorkbenchBoundary(surface, backwards) {
	const focusable = editorWorkbenchFocusableElements(surface);
	((backwards ? focusable.at(-1) : focusable[0]) ?? surface).focus();
}
function FullscreenIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		"aria-hidden": "true",
		width: "14",
		height: "14",
		viewBox: "0 0 16 16",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.5",
		strokeLinecap: "round",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" })
	});
}
function RestoreIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		"aria-hidden": "true",
		width: "14",
		height: "14",
		viewBox: "0 0 16 16",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.5",
		strokeLinecap: "round",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" })
	});
}
function CloseIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		"aria-hidden": "true",
		width: "14",
		height: "14",
		viewBox: "0 0 16 16",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.5",
		strokeLinecap: "round",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" })
	});
}
function ManagedOpenPencilEditorModal({ grant, colorScheme, locale, sessionId, ownerId, onLifecycleState, onLifecycleController, onClose, allowEditorTakeover = true }) {
	const bodyRef = (0, react.useRef)(null);
	const surfaceRef = (0, react.useRef)(null);
	const closeRef = (0, react.useRef)(null);
	const openerRef = (0, react.useRef)(null);
	const resizeCleanupRef = (0, react.useRef)();
	const dockLeaseRef = (0, react.useRef)();
	const dockOwnerId = (0, react.useId)();
	const copy = editorModalCopy(locale);
	const [viewportWidth, setViewportWidth] = (0, react.useState)(() => window.innerWidth);
	const [requestedFullscreen, setRequestedFullscreen] = (0, react.useState)(false);
	const [dockUnavailable, setDockUnavailable] = (0, react.useState)(false);
	const [preferredWidth, setPreferredWidth] = (0, react.useState)(() => editorWorkbenchWidthBounds(window.innerWidth).initial);
	const [lifecycle, setLifecycle] = (0, react.useState)(INITIAL_EDITOR_LIFECYCLE_STATE);
	const lifecycleRef = (0, react.useRef)(INITIAL_EDITOR_LIFECYCLE_STATE);
	const lifecycleControllerRef = (0, react.useRef)();
	const automaticFullscreen = editorWorkbenchUsesFullscreen(viewportWidth);
	const fullscreen = automaticFullscreen || requestedFullscreen || dockUnavailable;
	const width = clampEditorWorkbenchWidth(preferredWidth, viewportWidth);
	(0, react.useLayoutEffect)(() => {
		if (fullscreen) return;
		const root = document.getElementById("root");
		if (root === null) {
			setDockUnavailable(true);
			return;
		}
		const computedMarginRight = Number.parseFloat(window.getComputedStyle(root).marginRight);
		const lease = claimEditorWorkbenchDock(root, dockOwnerId, width, computedMarginRight);
		if (lease === void 0) {
			setDockUnavailable(true);
			return;
		}
		dockLeaseRef.current = lease;
		return () => {
			if (dockLeaseRef.current === lease) dockLeaseRef.current = void 0;
			lease.release();
		};
	}, [dockOwnerId, fullscreen]);
	(0, react.useLayoutEffect)(() => {
		if (!fullscreen) dockLeaseRef.current?.update(width);
	}, [fullscreen, width]);
	const closeWithoutPrompt = (0, react.useCallback)(() => {
		onClose();
	}, [onClose]);
	const requestClose = (0, react.useCallback)(async () => {
		if (lifecycleRef.current.phase === "saving") return;
		if (!confirmEditorClose(lifecycleRef.current.dirty, () => window.confirm(copy.discard))) return;
		if (lifecycleControllerRef.current !== void 0) {
			if (!await lifecycleControllerRef.current.requestClose()) return;
		}
		closeWithoutPrompt();
	}, [closeWithoutPrompt, copy.discard]);
	const requestTakeover = (0, react.useCallback)((_state) => {
		return false;
	}, []);
	const updateLifecycle = (0, react.useCallback)((next) => {
		lifecycleRef.current = next;
		setLifecycle(next);
		onLifecycleState?.(next);
	}, [onLifecycleState]);
	const updateLifecycleController = (0, react.useCallback)((next) => {
		lifecycleControllerRef.current = next;
		onLifecycleController?.(next);
	}, [onLifecycleController]);
	(0, react.useEffect)(() => {
		openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const mountedSurface = surfaceRef.current;
		closeRef.current?.focus();
		return () => {
			const opener = openerRef.current;
			const activeElement = document.activeElement;
			if ((activeElement === document.body || activeElement !== null && mountedSurface?.contains(activeElement)) && opener?.isConnected === true) opener.focus();
		};
	}, []);
	(0, react.useEffect)(() => {
		const onResize = () => {
			setViewportWidth(window.innerWidth);
		};
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
		};
	}, []);
	(0, react.useEffect)(() => {
		const onKeyDown = (event) => {
			if (event.key !== "Escape") return;
			const surface = surfaceRef.current;
			const targetInside = event.target instanceof Node && surface?.contains(event.target) === true;
			if (!editorWorkbenchShouldHandleEscape(fullscreen, targetInside)) return;
			event.preventDefault();
			requestClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [fullscreen, requestClose]);
	(0, react.useEffect)(() => {
		if (!fullscreen) return;
		const surface = surfaceRef.current;
		if (!surface) return;
		const containFocus = (event) => {
			if (event.target instanceof Node && surface.contains(event.target)) return;
			focusEditorWorkbenchBoundary(surface, false);
		};
		const wrapTab = (event) => {
			if (event.key !== "Tab") return;
			const focusable = editorWorkbenchFocusableElements(surface);
			const activeIndex = focusable.indexOf(document.activeElement);
			const targetIndex = editorWorkbenchFocusTargetIndex(focusable.length, activeIndex, event.shiftKey);
			if (targetIndex < 0) return;
			event.preventDefault();
			event.stopPropagation();
			focusable[targetIndex]?.focus();
		};
		document.addEventListener("focusin", containFocus, true);
		document.addEventListener("keydown", wrapTab, true);
		if (!surface.contains(document.activeElement)) focusEditorWorkbenchBoundary(surface, false);
		return () => {
			document.removeEventListener("focusin", containFocus, true);
			document.removeEventListener("keydown", wrapTab, true);
		};
	}, [fullscreen]);
	(0, react.useEffect)(() => {
		if (!fullscreen) return;
		return lockBodyScroll();
	}, [fullscreen]);
	(0, react.useEffect)(() => () => {
		resizeCleanupRef.current?.();
	}, []);
	(0, react.useEffect)(() => {
		if (fullscreen) resizeCleanupRef.current?.();
	}, [fullscreen]);
	const startResize = (0, react.useCallback)((event) => {
		if (fullscreen) return;
		event.preventDefault();
		resizeCleanupRef.current?.();
		const handle = event.currentTarget;
		const pointerId = event.pointerId;
		const surface = surfaceRef.current;
		const editorFrame = surface?.querySelector("iframe") ?? null;
		const inlineSurfaceWidth = surface === null ? NaN : Number.parseFloat(surface.style.width);
		let liveWidth = Number.isFinite(inlineSurfaceWidth) ? inlineSurfaceWidth : width;
		let appliedClientX = event.clientX;
		const previousCursor = document.body.style.cursor;
		const previousUserSelect = document.body.style.userSelect;
		const previousFrameStyle = editorFrame === null ? void 0 : {
			position: editorFrame.style.position,
			top: editorFrame.style.top,
			right: editorFrame.style.right,
			bottom: editorFrame.style.bottom,
			left: editorFrame.style.left,
			width: editorFrame.style.width,
			height: editorFrame.style.height,
			maxWidth: editorFrame.style.maxWidth,
			pointerEvents: editorFrame.style.pointerEvents
		};
		document.body.style.cursor = "ew-resize";
		document.body.style.userSelect = "none";
		if (editorFrame !== null) {
			const frameWidth = editorFrame.getBoundingClientRect().width;
			Object.assign(editorFrame.style, {
				position: "absolute",
				top: "0",
				right: "0",
				bottom: "0",
				left: "auto",
				width: `${frameWidth}px`,
				height: "100%",
				maxWidth: "none",
				pointerEvents: "none"
			});
		}
		try {
			handle.setPointerCapture(pointerId);
		} catch {}
		let animationFrame;
		let nextClientX = event.clientX;
		let stopped = false;
		const applyWidth = (clientX) => {
			liveWidth = resizedEditorWorkbenchWidth(liveWidth, appliedClientX, clientX, window.innerWidth);
			appliedClientX = clientX;
			if (surface !== null) surface.style.width = `${liveWidth}px`;
			dockLeaseRef.current?.update(liveWidth);
			handle.setAttribute("aria-valuenow", String(Math.round(liveWidth)));
			return liveWidth;
		};
		const flushWidth = () => {
			if (animationFrame !== void 0) {
				window.cancelAnimationFrame(animationFrame);
				animationFrame = void 0;
			}
			return applyWidth(nextClientX);
		};
		const onMove = (moveEvent) => {
			if (moveEvent.pointerId !== pointerId) return;
			nextClientX = (moveEvent.getCoalescedEvents?.())?.at(-1)?.clientX ?? moveEvent.clientX;
			if (animationFrame !== void 0) return;
			animationFrame = window.requestAnimationFrame(() => {
				animationFrame = void 0;
				applyWidth(nextClientX);
			});
		};
		const cleanup = () => {
			if (stopped) return;
			stopped = true;
			if (animationFrame !== void 0) window.cancelAnimationFrame(animationFrame);
			window.removeEventListener("pointermove", onMove, true);
			window.removeEventListener("pointerup", onPointerEnd, true);
			window.removeEventListener("pointercancel", onPointerCancel, true);
			window.removeEventListener("blur", onBlur);
			handle.removeEventListener("lostpointercapture", onLostPointerCapture);
			try {
				if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
			} catch {}
			document.body.style.cursor = previousCursor;
			document.body.style.userSelect = previousUserSelect;
			if (editorFrame !== null && previousFrameStyle !== void 0) Object.assign(editorFrame.style, previousFrameStyle);
			resizeCleanupRef.current = void 0;
		};
		const finish = () => {
			if (stopped) return;
			const finalWidth = flushWidth();
			cleanup();
			setPreferredWidth(finalWidth);
		};
		function onPointerEnd(endEvent) {
			if (endEvent.pointerId !== pointerId) return;
			nextClientX = Number.isFinite(endEvent.clientX) ? endEvent.clientX : nextClientX;
			finish();
		}
		function onPointerCancel(cancelEvent) {
			if (cancelEvent.pointerId === pointerId) finish();
		}
		function onBlur() {
			finish();
		}
		function onLostPointerCapture(lostEvent) {
			if (lostEvent.pointerId === pointerId) finish();
		}
		resizeCleanupRef.current = cleanup;
		window.addEventListener("pointermove", onMove, true);
		window.addEventListener("pointerup", onPointerEnd, true);
		window.addEventListener("pointercancel", onPointerCancel, true);
		window.addEventListener("blur", onBlur);
		handle.addEventListener("lostpointercapture", onLostPointerCapture);
	}, [fullscreen, width]);
	const resizeWithKeyboard = (0, react.useCallback)((event) => {
		if (fullscreen) return;
		const bounds = editorWorkbenchWidthBounds(window.innerWidth);
		let next;
		if (event.key === "ArrowLeft") next = width + 32;
		if (event.key === "ArrowRight") next = width - 32;
		if (event.key === "Home") next = bounds.min;
		if (event.key === "End") next = bounds.max;
		if (next === void 0) return;
		event.preventDefault();
		setPreferredWidth(clampEditorWorkbenchWidth(next, window.innerWidth));
	}, [fullscreen, width]);
	const surface = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		ref: surfaceRef,
		style: {
			...styles$3.surface,
			...fullscreen ? styles$3.fullscreen : { width },
			...colorScheme === "dark" ? {
				color: "var(--dsw-alias-label-primary, #eee)",
				background: "var(--dsw-alias-bg-base, #17171a)"
			} : {}
		},
		role: fullscreen ? "dialog" : "complementary",
		"aria-modal": fullscreen ? true : void 0,
		"aria-label": copy.title,
		"data-openpencil-editor-workbench": "true",
		"data-openpencil-editor-workbench-owner": ownerId,
		"data-openpencil-editor-modal": "true",
		"data-openpencil-editor-mode": fullscreen ? "fullscreen" : "side",
		tabIndex: -1,
		children: [
			fullscreen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"data-openpencil-focus-guard": "true",
				style: styles$3.focusGuard,
				tabIndex: 0,
				onFocus: () => {
					if (surfaceRef.current) focusEditorWorkbenchBoundary(surfaceRef.current, true);
				}
			}) : null,
			!fullscreen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: styles$3.resizeHandle,
				role: "separator",
				"aria-orientation": "vertical",
				"aria-label": copy.resize,
				"aria-valuemin": editorWorkbenchWidthBounds(viewportWidth).min,
				"aria-valuemax": editorWorkbenchWidthBounds(viewportWidth).max,
				"aria-valuenow": Math.round(width),
				tabIndex: 0,
				title: copy.resize,
				onPointerDown: startResize,
				onKeyDown: resizeWithKeyboard,
				onDoubleClick: () => {
					setPreferredWidth(editorWorkbenchWidthBounds(window.innerWidth).initial);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: styles$3.resizeGrip,
					"aria-hidden": "true"
				})
			}) : null,
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: bodyRef,
				style: styles$3.body,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedOpenPencilEditor, {
					grant,
					colorScheme,
					locale,
					sessionId,
					onTakeoverRequest: requestTakeover,
					onLifecycleState: updateLifecycle,
					onLifecycleController: updateLifecycleController,
					allowTakeover: allowEditorTakeover,
					workbenchActions: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [!automaticFullscreen && !dockUnavailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: styles$3.button,
						"aria-label": fullscreen ? copy.restore : copy.fullscreen,
						title: fullscreen ? copy.restore : copy.fullscreen,
						onClick: () => {
							setRequestedFullscreen((current) => !current);
						},
						children: fullscreen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RestoreIcon, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FullscreenIcon, {})
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						ref: closeRef,
						type: "button",
						style: {
							...styles$3.button,
							...lifecycle.phase === "saving" ? {
								cursor: "not-allowed",
								opacity: .55
							} : {}
						},
						"aria-label": copy.close,
						title: copy.close,
						disabled: lifecycle.phase === "saving",
						onClick: () => {
							requestClose();
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CloseIcon, {})
					})] })
				}, editorWorkbenchEditorKey(grant, sessionId))
			}),
			fullscreen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"data-openpencil-focus-guard": "true",
				style: styles$3.focusGuard,
				tabIndex: 0,
				onFocus: () => {
					if (surfaceRef.current) focusEditorWorkbenchBoundary(surfaceRef.current, false);
				}
			}) : null
		]
	});
	return (0, react_dom.createPortal)(surface, document.body);
}
//#endregion
//#region src/client/editor-workbench-host.tsx
/** Page-stable owner for the plugin fallback editor workbench. */
function requestIdentity(request) {
	return editorWorkbenchEditorKey(request.grant, request.sessionId);
}
/**
* Small external store that is deliberately not owned by a Tool card. The
* replacement gate lets the mounted host retain a dirty editor when another
* historical card asks to open a different document.
*/
function createEditorWorkbenchStore(canReplace = () => true, onRepeat = () => {}) {
	let current;
	const listeners = /* @__PURE__ */ new Set();
	const emit = () => {
		for (const listener of listeners) listener();
	};
	return {
		getSnapshot: () => current,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		open(request) {
			if (current !== void 0 && requestIdentity(current) === requestIdentity(request)) {
				onRepeat();
				return true;
			}
			if (current !== void 0 && !canReplace(current)) return false;
			current = request;
			emit();
			return true;
		},
		close() {
			if (current === void 0) return;
			current = void 0;
			emit();
		}
	};
}
/**
* Preserve dirty state without inventing a save the user did not request.
* An already-running save may finish; an idle dirty editor is recovery-only.
*/
async function preserveEditorBeforeWorkbenchDispose(state, controller) {
	const unrecovered = () => {
		controller.retainServerSessionOnUnmount();
		return "unrecovered";
	};
	if (state.phase === "saving") {
		if (await controller.awaitExistingSave().catch(() => false)) return "saved";
		return await controller.captureRecovery().catch(() => false) ? "recovered" : unrecovered();
	}
	if (!state.dirty) return "clean";
	return await controller.captureRecovery().catch(() => false) ? "recovered" : unrecovered();
}
function EditorWorkbenchHostView({ store, subscribeTheme, getColorScheme, subscribeLocale, getLocale, ownerId, onLifecycleState, onLifecycleController, close }) {
	const request = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
	const colorScheme = (0, react.useSyncExternalStore)(subscribeTheme, getColorScheme, getColorScheme);
	const locale = (0, react.useSyncExternalStore)(subscribeLocale, getLocale, getLocale);
	if (request === void 0) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedOpenPencilEditorModal, {
		grant: request.grant,
		colorScheme,
		locale: editorLocaleFromDsh(locale),
		sessionId: request.sessionId,
		ownerId,
		onLifecycleState,
		onLifecycleController,
		onClose: close,
		allowEditorTakeover: request.automatic !== true
	});
}
let nextHostId = 0;
/** Mount one imperative React root for the whole plugin fiber. */
function mountEditorWorkbenchHost(options) {
	const ownerDocument = options.document ?? document;
	const hostId = `dsh-openpencil-workbench-${++nextHostId}`;
	const container = ownerDocument.createElement("div");
	container.dataset.openpencilWorkbenchHost = hostId;
	ownerDocument.body.append(container);
	let root = (0, react_dom_client.createRoot)(container);
	let destroyed = false;
	let disposing = false;
	let disposePromise;
	let openQueue = Promise.resolve();
	let lifecycle = INITIAL_EDITOR_LIFECYCLE_STATE;
	let lifecycleController;
	const focusSurface = () => {
		ownerDocument.querySelector(`[data-openpencil-editor-workbench-owner="${hostId}"] button, [data-openpencil-editor-workbench-owner="${hostId}"] [tabindex="0"]`)?.focus();
	};
	const canDiscard = () => {
		if (lifecycle.phase === "saving") return false;
		return !lifecycle.dirty || window.confirm(editorModalCopy(editorLocaleFromDsh(options.getLocale())).discard);
	};
	const store = createEditorWorkbenchStore(() => true, focusSurface);
	const close = () => {
		lifecycle = INITIAL_EDITOR_LIFECYCLE_STATE;
		lifecycleController = void 0;
		store.close();
	};
	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		root?.unmount();
		root = void 0;
		container.remove();
	};
	root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(EditorWorkbenchHostView, {
		store,
		subscribeTheme: options.subscribeTheme,
		getColorScheme: options.getColorScheme,
		subscribeLocale: options.subscribeLocale,
		getLocale: options.getLocale,
		ownerId: hostId,
		onLifecycleState: (next) => {
			lifecycle = next;
		},
		onLifecycleController: (next) => {
			lifecycleController = next;
		},
		close
	}));
	return {
		open(request) {
			if (destroyed || disposing) return Promise.resolve(false);
			const operation = openQueue.then(async () => {
				if (destroyed || disposing) return false;
				const previous = store.getSnapshot();
				if (previous !== void 0 && requestIdentity(previous) === requestIdentity(request)) {
					store.open(request);
					queueMicrotask(focusSurface);
					return true;
				}
				if (previous !== void 0 && !canDiscard()) return false;
				if (previous !== void 0 && lifecycleController !== void 0) {
					if (!await lifecycleController.requestClose() || destroyed || disposing) return false;
				}
				const accepted = store.open(request);
				if (accepted) {
					lifecycle = INITIAL_EDITOR_LIFECYCLE_STATE;
					lifecycleController = void 0;
					queueMicrotask(focusSurface);
				}
				return accepted;
			});
			openQueue = operation.then(() => {}, () => {});
			return operation;
		},
		openIfIdle(request) {
			if (destroyed || disposing) return Promise.resolve(false);
			const operation = openQueue.then(() => {
				if (destroyed || disposing || store.getSnapshot() !== void 0 || hasActiveEditor()) return false;
				if (editorWorkbenchUsesFullscreen(ownerDocument.defaultView?.innerWidth ?? window.innerWidth)) return false;
				const dshRoot = ownerDocument.getElementById("root");
				if (dshRoot === null) return false;
				if (dshRoot.dataset["openpencilWorkbenchDockOwner"] !== void 0) return false;
				const computedMarginRight = Number.parseFloat(ownerDocument.defaultView?.getComputedStyle(dshRoot).marginRight ?? "0");
				if (dshRoot.style.marginRight.trim() !== "" || Number.isFinite(computedMarginRight) && computedMarginRight > .5) return false;
				const accepted = store.open({
					...request,
					automatic: true
				});
				if (accepted) {
					lifecycle = INITIAL_EDITOR_LIFECYCLE_STATE;
					lifecycleController = void 0;
				}
				return accepted;
			});
			openQueue = operation.then(() => {}, () => {});
			return operation;
		},
		async dispose() {
			if (destroyed) return;
			if (disposePromise !== void 0) return disposePromise;
			disposing = true;
			disposePromise = (async () => {
				await openQueue;
				if ((lifecycle.dirty || lifecycle.phase === "saving") && lifecycleController !== void 0) await preserveEditorBeforeWorkbenchDispose(lifecycle, lifecycleController);
				close();
				destroy();
			})();
			return disposePromise;
		}
	};
}
//#endregion
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
const styles$2 = {
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
		border: "1px solid var(--ui-border, rgba(128,128,128,0.35))",
		color: "var(--ui-text, inherit)",
		background: "var(--ui-card-bg, rgba(128,128,128,0.08))",
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
		color: "#fff",
		background: "rgba(15,15,18,0.72)",
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
		color: "var(--ui-text-muted, #888)"
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
		border: "1px solid var(--ui-border, rgba(128,128,128,0.35))",
		color: "var(--ui-text, inherit)",
		background: "var(--ui-card-bg, rgba(128,128,128,0.08))",
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
		border: "1px solid rgba(128,128,128,0.3)",
		background: "rgba(128,128,128,0.06)",
		cursor: "pointer"
	},
	thumbnailSelected: {
		border: "2px solid var(--ui-accent, #0ea5e9)",
		padding: 2,
		boxShadow: "0 0 0 1px color-mix(in srgb, var(--ui-accent, #0ea5e9) 28%, transparent)"
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
		color: "var(--ui-text-muted, #888)",
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
		style: styles$2.gallery,
		role: "region",
		"aria-roledescription": copy.carousel,
		"aria-label": `${copy.gallery}: ${frames.length}`,
		"data-openpencil-frame-gallery": "true",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: styles$2.mainShell,
			tabIndex: 0,
			onKeyDown,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles$2.controls,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: styles$2.currentName,
						title: name,
						children: [frames.length > 1 ? `${currentIndex + 1} / ${frames.length} · ` : "", name]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles$2.zoomToolbar,
						role: "toolbar",
						"aria-label": copy.toolbar,
						"data-openpencil-zoom-toolbar": "true",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$2.zoomButton,
									opacity: canZoomOut ? 1 : .42
								},
								disabled: !canZoomOut,
								"aria-label": copy.zoomOut,
								title: copy.zoomOutTitle,
								onClick: () => {
									setZoom(nextGalleryZoom(zoom, -1));
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$2.controlContent,
									children: "−"
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("output", {
								style: styles$2.zoomPercent,
								"aria-label": `${copy.previewZoom} ${zoomLabel}`,
								"aria-live": "polite",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$2.controlContent,
									children: zoomLabel
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$2.zoomButton,
									opacity: canZoomIn ? 1 : .42
								},
								disabled: !canZoomIn,
								"aria-label": copy.zoomIn,
								title: copy.zoomInTitle,
								onClick: () => {
									setZoom(nextGalleryZoom(zoom, 1));
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$2.controlContent,
									children: "+"
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$2.zoomButton,
									opacity: zoomMode === "manual" && manualZoom === 1 ? .42 : 1
								},
								disabled: zoomMode === "manual" && manualZoom === 1,
								"aria-label": copy.resetAria,
								title: copy.resetTitle,
								onClick: resetZoom,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles$2.controlContent,
									children: copy.reset
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$2.zoomButton,
									background: zoomMode === "fit-view" ? "color-mix(in srgb, var(--ui-accent, #0ea5e9) 18%, transparent)" : styles$2.zoomButton.background
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
									style: styles$2.controlContent,
									children: copy.fitFrame
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...styles$2.zoomButton,
									background: fitContent ? "color-mix(in srgb, var(--ui-accent, #0ea5e9) 18%, transparent)" : styles$2.zoomButton.background
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
									style: styles$2.controlContent,
									children: fitContent ? copy.restoreCard : copy.fitContent
								})
							})
						]
					}),
					frames.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: {
							...styles$2.arrow,
							opacity: currentIndex === 0 ? .42 : 1
						},
						disabled: currentIndex === 0,
						"aria-label": copy.previous,
						title: copy.previous,
						onClick: () => {
							select(currentIndex - 1);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles$2.controlContent,
							children: "‹"
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: {
							...styles$2.arrow,
							opacity: currentIndex === frames.length - 1 ? .42 : 1
						},
						disabled: currentIndex === frames.length - 1,
						"aria-label": copy.next,
						title: copy.next,
						onClick: () => {
							select(currentIndex + 1);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles$2.controlContent,
							children: "›"
						})
					})] }) : null
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles$2.previewShell,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: viewportRef,
					style: {
						...styles$2.mainViewport,
						display: zoomMode === "fit-view" ? "flex" : void 0,
						alignItems: zoomMode === "fit-view" ? "center" : void 0,
						justifyContent: zoomMode === "fit-view" ? "center" : void 0,
						height: zoomMode === "fit-view" ? 560 : void 0,
						maxHeight: galleryViewportMaxHeight(fitContent),
						overflow: zoomMode === "fit-view" ? "hidden" : styles$2.mainViewport.overflow
					},
					"data-openpencil-image-viewport": "true",
					"data-card-height-mode": fitContent ? "content" : "compact",
					"data-preview-zoom-mode": zoomMode,
					children: failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styles$2.failure,
						role: "status",
						children: copy.failed
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						style: {
							...styles$2.mainImage,
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
					style: styles$2.counter,
					children: [
						currentIndex + 1,
						" / ",
						frames.length
					]
				}) : null]
			})]
		}), frames.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			ref: stripRef,
			style: styles$2.strip,
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
						...styles$2.thumbnail,
						...selected ? styles$2.thumbnailSelected : {}
					},
					"aria-label": `${copy.showFrame} ${index + 1}: ${label}`,
					"aria-current": selected ? "true" : void 0,
					title: label,
					onClick: () => {
						select(index);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						style: styles$2.thumbnailImage,
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
//#region src/client/selection-dock.tsx
/** Live OpenPencil selection chip rendered above the DSH composer. */
const OPENPENCIL_SELECTION_DOCK_LAYOUT = {
	boxSizing: "border-box",
	flex: "none",
	width: "calc(100% - var(--dsh-composer-side-clearance, 16px) - var(--dsh-composer-side-clearance, 16px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px))",
	maxWidth: "calc(var(--dsh-composer-card-max-width, 780px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px))",
	margin: "0 auto"
};
function hasOpenPencilSelection(selection) {
	return (selection?.selectedIds.length ?? 0) > 0;
}
function selectionNodeLabel(selection, locale) {
	if (selection.selectedIds.length === 0) return locale === "zh" ? "未选择画布节点" : "No canvas node selected";
	if (selection.selectedIds.length > 1) return locale === "zh" ? `已选择 ${selection.selectedIds.length} 个节点` : `${selection.selectedIds.length} nodes selected`;
	const node = selection.nodes[0];
	return node?.name ?? node?.type ?? selection.selectedIds[0];
}
function selectionNodeDetail(selection, locale) {
	if (selection.selectedIds.length === 0) return locale === "zh" ? "在右侧 OpenPencil 画布中选择节点" : "Select a node on the OpenPencil canvas";
	const node = selection.nodes[0];
	if (selection.selectedIds.length > 1 || node === void 0) return selection.selectedIds.slice(0, 3).join(" · ");
	const dimensions = node.width === void 0 || node.height === void 0 ? void 0 : `${Math.round(node.width)} × ${Math.round(node.height)}`;
	return [
		node.type,
		dimensions,
		node.id
	].filter(Boolean).join(" · ");
}
const styles$1 = {
	root: {
		...OPENPENCIL_SELECTION_DOCK_LAYOUT,
		display: "flex",
		alignItems: "center",
		gap: 10,
		minHeight: 42,
		padding: "7px 10px",
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 9,
		background: "var(--dsw-alias-bg-layer-1)",
		color: "var(--dsw-alias-label-primary)"
	},
	icon: {
		width: 28,
		height: 28,
		flex: "0 0 28px",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 7,
		background: "var(--dsw-alias-brand-primary, #3b82f6)",
		color: "#fff",
		fontSize: 15
	},
	text: {
		minWidth: 0,
		display: "flex",
		flexDirection: "column",
		gap: 1
	},
	title: {
		fontSize: 12,
		fontWeight: 600,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	},
	detail: {
		fontSize: 11,
		color: "var(--dsw-alias-label-secondary)",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	},
	target: {
		marginLeft: "auto",
		fontSize: 11,
		color: "var(--dsw-alias-label-secondary)",
		whiteSpace: "nowrap"
	}
};
function OpenPencilSelectionDock({ sessionId, locale }) {
	const subscribe = (0, react.useCallback)((notify) => subscribeOpenPencilSelection(String(sessionId), notify), [sessionId]);
	const getSnapshot = (0, react.useCallback)(() => getOpenPencilSelectionSnapshot(String(sessionId)), [sessionId]);
	const selection = (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot).selection;
	if (!hasOpenPencilSelection(selection)) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: styles$1.root,
		"data-openpencil-selection-dock": "true",
		role: "status",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				style: styles$1.icon,
				"aria-hidden": "true",
				children: "◇"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: styles$1.text,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: styles$1.title,
					children: selectionNodeLabel(selection, locale)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: styles$1.detail,
					children: selectionNodeDetail(selection, locale)
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				style: styles$1.target,
				children: locale === "zh" ? "OpenPencil 修改目标" : "OpenPencil edit target"
			})
		]
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
//#region src/client/index.tsx
/**
* Browser presentation for `openpencil_render` and historical
* `design_render` conversation cards.
*
* PNG remains the replay-safe default. When the host also grants access to
* the source `.op`, the user can opt into one shared, read-only Web SDK
* canvas. The SDK and document are fetched only after that explicit action.
*/
/** Presentation metadata key the host half projects into `block.meta`. */
const PRESENTATION_META_KEY = "$dshOpenPencil";
const LIVE_AUTO_OPEN_TTL_MS = 9e5;
const LIVE_AUTO_OPEN_MAX = 256;
const liveAutoOpenActivatedAt = Date.now();
const liveAutoOpenCalls = /* @__PURE__ */ new Map();
function liveAutoOpenKey(sessionId, callId) {
	return `${sessionId.length}:${sessionId}${callId}`;
}
function pruneLiveAutoOpenCalls(now = Date.now()) {
	for (const [key, expiresAt] of liveAutoOpenCalls) if (expiresAt <= now) liveAutoOpenCalls.delete(key);
	while (liveAutoOpenCalls.size > LIVE_AUTO_OPEN_MAX) {
		const oldest = liveAutoOpenCalls.keys().next().value;
		if (oldest === void 0) break;
		liveAutoOpenCalls.delete(oldest);
	}
}
function rememberLiveAutoOpenCall(key) {
	liveAutoOpenCalls.delete(key);
	liveAutoOpenCalls.set(key, Date.now() + LIVE_AUTO_OPEN_TTL_MS);
	pruneLiveAutoOpenCalls();
}
function takeLiveAutoOpenCall(key) {
	pruneLiveAutoOpenCalls();
	if (!liveAutoOpenCalls.has(key)) return false;
	liveAutoOpenCalls.delete(key);
	return true;
}
function forgetLiveAutoOpenCall(key) {
	liveAutoOpenCalls.delete(key);
}
const DESIGN_RENDER_COPY = {
	en: {
		designRender: "OpenPencil render",
		error: "error",
		rendering: "rendering…",
		done: "done",
		renderingDocument: "Rendering the design document…",
		renderFailed: "The render failed.",
		frames: "frames",
		openInteractiveCanvas: "Open interactive canvas",
		editCanvas: "Edit canvas",
		editInSidebar: "Edit in sidebar",
		openRenderedPng: "Open rendered PNG",
		downloadPng: "Download PNG",
		editSource: "Edit source .op",
		downloadSource: "Download source .op",
		inspectToolCall: "Inspect tool call",
		recoveringPreview: "Recovering the OpenPencil preview…",
		noPreview: "No preview channel available in this host.",
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
		editorUnavailable: "Editable OpenPencil canvas is not available for this result."
	},
	zh: {
		designRender: "OpenPencil 渲染",
		error: "错误",
		rendering: "渲染中…",
		done: "完成",
		renderingDocument: "正在渲染设计文档…",
		renderFailed: "渲染失败。",
		frames: "页",
		openInteractiveCanvas: "打开交互画布",
		editCanvas: "编辑画布",
		editInSidebar: "在侧边栏编辑",
		openRenderedPng: "打开渲染 PNG",
		downloadPng: "下载 PNG",
		editSource: "编辑源文件 .op",
		downloadSource: "下载源文件 .op",
		inspectToolCall: "检查工具调用",
		recoveringPreview: "正在恢复 OpenPencil 预览…",
		noPreview: "当前宿主没有可用的预览通道。",
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
		editorUnavailable: "此渲染结果没有可用的 OpenPencil 编辑画布。"
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
function editorGrantOf(value) {
	if (!isRecord(value) || value.enabled !== true) return void 0;
	const launchUrl = optionalString(value, "launchUrl");
	if (launchUrl === void 0) return void 0;
	const refreshUrl = optionalString(value, "refreshUrl");
	return {
		enabled: true,
		launchUrl,
		...refreshUrl === void 0 ? {} : { refreshUrl }
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
		editor: editorGrantOf(envelope.editor),
		renderer: optionalString(envelope, "renderer"),
		rendererBinary: optionalString(envelope, "rendererBinary"),
		fidelity: optionalString(envelope, "fidelity"),
		warnings: optionalStrings(envelope, "warnings"),
		...envelope.autoOpenEditor === true ? { autoOpenEditor: true } : {}
	};
}
function grantOf(block) {
	if (!("kind" in block) || block.isError) return void 0;
	return presentationGrantOfMeta(block.meta);
}
/** Flatten the durable result text for the fallback disclosure. */
function resultText(block) {
	if (!("kind" in block)) return null;
	const parts = [];
	for (const item of block.content) parts.push(item.type === "text" ? item.text : JSON.stringify(item, null, 2));
	if (parts.length === 0 && block.error !== void 0) parts.push(`${block.error.name}: ${block.error.code}`);
	return parts.join("\n") || null;
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
	card: {
		border: "1px solid var(--ui-border, rgba(128,128,128,0.35))",
		borderRadius: 8,
		overflow: "hidden",
		background: "var(--ui-card-bg, transparent)",
		fontFamily: "inherit"
	},
	head: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		padding: "8px 12px",
		fontSize: 13,
		fontWeight: 600,
		borderBottom: "1px solid var(--ui-border, rgba(128,128,128,0.2))"
	},
	badge: {
		fontSize: 11,
		padding: "1px 8px",
		borderRadius: 99,
		textTransform: "uppercase",
		letterSpacing: .4
	},
	badgeOk: {
		background: "rgba(34,197,94,0.15)",
		color: "#16a34a"
	},
	badgeError: {
		background: "rgba(239,68,68,0.15)",
		color: "#dc2626"
	},
	badgeRunning: {
		background: "rgba(100,116,139,0.15)",
		color: "#64748b"
	},
	body: { padding: 12 },
	imageViewport: {
		maxHeight: 560,
		overflow: "auto",
		overscrollBehavior: "contain",
		borderRadius: 4,
		border: "1px solid rgba(128,128,128,0.25)",
		background: "rgba(128,128,128,0.06)"
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
		color: "var(--ui-text-muted, #888)"
	},
	link: {
		color: "var(--ui-accent, #0ea5e9)",
		textDecoration: "none"
	},
	button: {
		color: "var(--ui-accent, #0ea5e9)",
		background: "none",
		border: "none",
		cursor: "pointer",
		padding: 0,
		font: "inherit",
		fontSize: 12
	},
	primaryButton: {
		border: "1px solid var(--ui-accent, #0ea5e9)",
		borderRadius: 6,
		color: "var(--ui-accent, #0ea5e9)",
		background: "transparent",
		padding: "4px 9px",
		cursor: "pointer",
		font: "inherit",
		fontSize: 12
	},
	pre: {
		whiteSpace: "pre-wrap",
		wordBreak: "break-all",
		fontSize: 12,
		margin: 0,
		maxHeight: "24em",
		overflow: "auto"
	},
	muted: {
		fontSize: 12,
		color: "var(--ui-text-muted, #888)"
	},
	warning: {
		margin: "10px 0 0",
		padding: "7px 9px",
		borderRadius: 6,
		color: "#b45309",
		background: "rgba(245,158,11,0.13)",
		fontSize: 12
	},
	backdrop: {
		position: "fixed",
		inset: 0,
		zIndex: 2147483e3,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: 20,
		background: "rgba(0,0,0,0.72)"
	},
	dialog: {
		width: "min(1120px, 94vw)",
		height: "min(820px, 92vh)",
		display: "flex",
		flexDirection: "column",
		overflow: "hidden",
		border: "1px solid var(--ui-border, rgba(128,128,128,0.5))",
		borderRadius: 10,
		background: "var(--ui-card-bg, #17171a)",
		color: "var(--ui-text, #eee)",
		boxShadow: "0 24px 80px rgba(0,0,0,0.45)"
	},
	toolbar: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 8,
		minHeight: 44,
		padding: "7px 10px",
		borderBottom: "1px solid var(--ui-border, rgba(128,128,128,0.3))"
	},
	canvasWrap: {
		position: "relative",
		flex: 1,
		minHeight: 0,
		overflow: "hidden",
		background: "#202124"
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
		background: "rgba(25,25,28,0.92)"
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
/** Render one OpenPencil render tool call as a PNG-first card. */
function DesignRenderView({ block, callId, toolName, openDetails, openFile, inspect, locale = "en", sessionId, openEditorWorkbench, autoOpenEditorWorkbench }) {
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
	const [hydrationFailedKey, setHydrationFailedKey] = (0, react.useState)();
	const grant = embeddedGrant ?? (hydrated !== void 0 && hydrated.key === hydrationKey ? hydrated.grant : void 0);
	const hydrationPending = hydrationKey !== void 0 && hydrationFailedKey !== hydrationKey;
	const copy = designRenderCopy(locale);
	const text = resultText(block);
	const frames = grant?.frames ?? [];
	const [selectedFrameIndex, setSelectedFrameIndex] = (0, react.useState)(0);
	const currentFrameIndex = normalizeFrameIndex(selectedFrameIndex, frames.length);
	const selectedFrame = frames[currentFrameIndex] ?? grant?.image;
	const [modalToken, setModalToken] = (0, react.useState)();
	const releaseRef = (0, react.useRef)();
	const liveAutoOpenCallKey = liveAutoOpenKey(String(sessionId), callId);
	(0, react.useEffect)(() => {
		if (hydrationKey === void 0 || hydrationRequest === void 0) return;
		const controller = new AbortController();
		requestPresentationGrant(hydrationRequest, presentationGrantOfMeta, { signal: controller.signal }).then((nextGrant) => {
			if (nextGrant !== void 0 && !controller.signal.aborted) setHydrated({
				key: hydrationKey,
				grant: nextGrant
			});
			else if (!controller.signal.aborted) setHydrationFailedKey(hydrationKey);
		});
		return () => {
			controller.abort();
		};
	}, [hydrationKey]);
	const closeCanvas = (0, react.useCallback)(() => {
		releaseRef.current?.();
		releaseRef.current = void 0;
		setModalToken(void 0);
	}, []);
	const openCanvas = (0, react.useCallback)(() => {
		const token = Symbol("openpencil-canvas");
		releaseRef.current?.();
		releaseRef.current = claimCanvas(token, () => {
			setModalToken((current) => current === token ? void 0 : current);
		});
		setModalToken(token);
	}, []);
	const openEditor = (0, react.useCallback)(() => {
		requestOpenPencilEditor(embeddedGrant === void 0 ? void 0 : openDetails, () => {
			if (grant === void 0) return;
			openEditorWorkbench?.({
				grant,
				sessionId: String(sessionId)
			});
		});
	}, [
		embeddedGrant,
		grant,
		openDetails,
		openEditorWorkbench,
		sessionId
	]);
	(0, react.useEffect)(() => {
		if (running && block.time >= liveAutoOpenActivatedAt) rememberLiveAutoOpenCall(liveAutoOpenCallKey);
		else if (error) forgetLiveAutoOpenCall(liveAutoOpenCallKey);
	}, [
		error,
		liveAutoOpenCallKey,
		running
	]);
	(0, react.useEffect)(() => {
		if (running || error || grant?.autoOpenEditor !== true || grant.editor?.enabled !== true || autoOpenEditorWorkbench === void 0) return;
		if (!takeLiveAutoOpenCall(liveAutoOpenCallKey)) return;
		autoOpenEditorWorkbench({
			grant,
			sessionId: String(sessionId)
		});
	}, [
		autoOpenEditorWorkbench,
		error,
		grant,
		liveAutoOpenCallKey,
		running,
		sessionId
	]);
	(0, react.useEffect)(() => () => {
		releaseRef.current?.();
	}, []);
	(0, react.useEffect)(() => {
		setSelectedFrameIndex(0);
	}, [frames.map((frame) => frame.previewUrl).join("\n")]);
	const badge = error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		style: {
			...styles.badge,
			...styles.badgeError
		},
		children: copy.error
	}) : running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		style: {
			...styles.badge,
			...styles.badgeRunning
		},
		children: copy.rendering
	}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		style: {
			...styles.badge,
			...styles.badgeOk
		},
		children: copy.done
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		style: styles.card,
		"data-tool": OPENPENCIL_RENDER_TOOL_NAME,
		"data-state": error ? "error" : running ? "running" : "success",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.head,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: copy.designRender }), badge]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.body,
				children: [
					running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.muted,
						children: copy.renderingDocument
					}) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.muted,
						children: text ?? copy.renderFailed
					}) : null,
					!running && !error && frames.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FrameGallery, {
						frames,
						selectedIndex: currentFrameIndex,
						onSelect: setSelectedFrameIndex,
						locale
					}) : null,
					!running && !error && grant?.warnings !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styles.warning,
						role: "status",
						children: grant.warnings.join(" ")
					}) : null,
					!running && !error && grant !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.meta,
						children: [
							selectedFrame !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: selectedFrame.name ?? baseName(selectedFrame.path) }) : null,
							frames.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								frames.length,
								" ",
								copy.frames
							] }) : null,
							grant.renderer !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								title: grant.rendererBinary,
								children: [grant.renderer, grant.fidelity === void 0 ? "" : ` · ${grant.fidelity}`]
							}) : null,
							grant.document !== void 0 && grant.viewer !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.primaryButton,
								onClick: openCanvas,
								children: copy.openInteractiveCanvas
							}) : null,
							grant.document !== void 0 && grant.editor?.enabled === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.primaryButton,
								onClick: openEditor,
								children: openDetails === void 0 || embeddedGrant === void 0 ? copy.editCanvas : copy.editInSidebar
							}) : null,
							selectedFrame !== void 0 && openFile !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.button,
								onClick: () => {
									openFile(selectedFrame.path);
								},
								children: copy.openRenderedPng
							}) : null,
							selectedFrame !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								style: styles.link,
								href: selectedFrame.downloadUrl,
								download: true,
								children: copy.downloadPng
							}) : null,
							grant.document?.path !== void 0 && openFile !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.button,
								onClick: () => {
									openFile(grant.document?.path ?? "");
								},
								children: copy.editSource
							}) : null,
							grant.document?.downloadUrl !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								style: styles.link,
								href: grant.document.downloadUrl,
								download: true,
								children: copy.downloadSource
							}) : null,
							inspect !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.button,
								onClick: inspect,
								children: copy.inspectToolCall
							}) : null
						]
					}) : null,
					!running && !error && grant === void 0 && hydrationPending ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.muted,
						role: "status",
						children: copy.recoveringPreview
					}) : null,
					!running && !error && grant === void 0 && !hydrationPending ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.muted,
						children: copy.noPreview
					}), text !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						style: {
							...styles.pre,
							marginTop: 8
						},
						children: text
					}) : null] }) : null
				]
			}),
			modalToken !== void 0 && grant?.document !== void 0 && grant.viewer !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasModal, {
				grant,
				onClose: closeCanvas,
				locale
			}) : null
		]
	});
}
/** Render the selected editable design inside DSH's resident details column. */
function OpenPencilEditorPanel({ block, colorScheme, locale, sessionId }) {
	const grant = grantOf(block);
	if (grant?.editor === void 0 || grant.document === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: styles.overlay,
		children: editorPanelCopy(locale).unavailable
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedOpenPencilEditor, {
		grant,
		colorScheme,
		locale,
		sessionId: String(sessionId)
	}, editorWorkbenchEditorKey(grant, String(sessionId)));
}
/** Required client services. */
const inject = [
	"slots",
	"theme",
	"locale"
];
/** Register canonical views plus a presentation-only alias for replaying historical cards. */
function apply(ctx) {
	const subscribeTheme = (notify) => ctx.on("theme/change", notify);
	const getColorScheme = () => ctx.theme.getTheme().active.colorScheme;
	const subscribeLocale = (notify) => ctx.on("locale/change", notify);
	const getLocale = () => ctx.locale.getLocale().active;
	const getEditorLocale = () => editorLocaleFromDsh(getLocale());
	let editorWorkbenchHost;
	if (typeof document !== "undefined") ctx.effect(() => {
		const host = mountEditorWorkbenchHost({
			subscribeTheme,
			getColorScheme,
			subscribeLocale,
			getLocale
		});
		editorWorkbenchHost = host;
		return () => {
			if (editorWorkbenchHost === host) editorWorkbenchHost = void 0;
			return host.dispose();
		};
	}, "dsh-openpencil: fallback editor workbench host");
	const HostSyncedDesignRenderView = (props) => {
		const locale = (0, react.useSyncExternalStore)(subscribeLocale, getLocale, getLocale);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DesignRenderView, {
			...props,
			locale,
			openEditorWorkbench: (request) => editorWorkbenchHost?.open(request) ?? false,
			autoOpenEditorWorkbench: (request) => editorWorkbenchHost?.openIfIdle(request) ?? false
		});
	};
	const HostSyncedOpenPencilEditorPanel = (props) => {
		const colorScheme = (0, react.useSyncExternalStore)(subscribeTheme, getColorScheme, getColorScheme);
		const locale = (0, react.useSyncExternalStore)(subscribeLocale, getEditorLocale, getEditorLocale);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpenPencilEditorPanel, {
			...props,
			colorScheme,
			locale
		});
	};
	const HostSyncedOpenPencilSelectionDock = (props) => {
		const locale = (0, react.useSyncExternalStore)(subscribeLocale, getLocale, getLocale);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpenPencilSelectionDock, {
			...props,
			locale
		});
	};
	for (const toolName of [OPENPENCIL_RENDER_TOOL_NAME, LEGACY_DESIGN_RENDER_TOOL_NAME]) {
		ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
			name: "tool.call.toolview",
			key: toolName
		}, HostSyncedDesignRenderView));
		ctx.slots.inject("tool.details.toolview", () => ctx.slots.register({
			name: "tool.details.toolview",
			key: toolName
		}, HostSyncedOpenPencilEditorPanel));
	}
	ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
		name: "conversation.input.dock",
		id: "openpencil-selection",
		order: 30
	}, HostSyncedOpenPencilSelectionDock));
}
//#endregion
exports.DesignRenderView = DesignRenderView;
exports.EDITOR_WORKBENCH_FULLSCREEN_BREAKPOINT = EDITOR_WORKBENCH_FULLSCREEN_BREAKPOINT;
exports.EDITOR_WORKBENCH_LEFT_CLEARANCE = EDITOR_WORKBENCH_LEFT_CLEARANCE;
exports.EDITOR_WORKBENCH_MAX_WIDTH = EDITOR_WORKBENCH_MAX_WIDTH;
exports.EDITOR_WORKBENCH_MIN_WIDTH = EDITOR_WORKBENCH_MIN_WIDTH;
exports.EDITOR_WORKBENCH_RESIZE_STEP = EDITOR_WORKBENCH_RESIZE_STEP;
exports.GALLERY_COMPACT_MAX_HEIGHT = GALLERY_COMPACT_MAX_HEIGHT;
exports.GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT = GALLERY_TOOLBAR_CONTROL_CONTENT_LAYOUT;
exports.GALLERY_TOOLBAR_CONTROL_HEIGHT = GALLERY_TOOLBAR_CONTROL_HEIGHT;
exports.GALLERY_TOOLBAR_CONTROL_LAYOUT = GALLERY_TOOLBAR_CONTROL_LAYOUT;
exports.GALLERY_ZOOM_MAX = GALLERY_ZOOM_MAX;
exports.GALLERY_ZOOM_MIN = GALLERY_ZOOM_MIN;
exports.GALLERY_ZOOM_STEP = GALLERY_ZOOM_STEP;
exports.LEGACY_DESIGN_RENDER_TOOL_NAME = LEGACY_DESIGN_RENDER_TOOL_NAME;
exports.OPENPENCIL_RENDER_TOOL_NAME = OPENPENCIL_RENDER_TOOL_NAME;
exports.OPENPENCIL_SELECTION_DOCK_LAYOUT = OPENPENCIL_SELECTION_DOCK_LAYOUT;
exports.OPENPENCIL_WORKBENCH_DOCK_ATTRIBUTE = OPENPENCIL_WORKBENCH_DOCK_ATTRIBUTE;
exports.OpenPencilEditorPanel = OpenPencilEditorPanel;
exports.PRESENTATION_HYDRATION_ENDPOINT = PRESENTATION_HYDRATION_ENDPOINT;
exports.PRESENTATION_META_KEY = PRESENTATION_META_KEY;
exports.apply = apply;
exports.applyManagedEditorUnmountPolicy = applyManagedEditorUnmountPolicy;
exports.beginEditorInitRetry = beginEditorInitRetry;
exports.calculateGalleryFitViewZoom = calculateGalleryFitViewZoom;
exports.captureManagedEditorRecovery = captureManagedEditorRecovery;
exports.claimCanvas = claimCanvas;
exports.claimEditor = claimEditor;
exports.claimEditorWorkbenchDock = claimEditorWorkbenchDock;
exports.clampEditorWorkbenchWidth = clampEditorWorkbenchWidth;
exports.clampGalleryZoom = clampGalleryZoom;
exports.clearOpenPencilSelection = clearOpenPencilSelection;
exports.closeManagedEditorLaunch = closeManagedEditorLaunch;
exports.confirmEditorClose = confirmEditorClose;
exports.confirmEditorModalClose = confirmEditorModalClose;
exports.createEditorWorkbenchStore = createEditorWorkbenchStore;
exports.designRenderCopy = designRenderCopy;
exports.discardManagedEditorRecovery = discardManagedEditorRecovery;
exports.documentSha256FromCanonicalResult = documentSha256FromCanonicalResult;
exports.editorControlUrl = editorControlUrl;
exports.editorGrantForBoot = editorGrantForBoot;
exports.editorIframeUrlWithLocale = editorIframeUrlWithLocale;
exports.editorIframeUrlWithTheme = editorIframeUrlWithTheme;
exports.editorLocaleFromDsh = editorLocaleFromDsh;
exports.editorMessageFrom = editorMessageFrom;
exports.editorModalCopy = editorModalCopy;
exports.editorOrigin = editorOrigin;
exports.editorPanelCopy = editorPanelCopy;
exports.editorRecoveryCopy = editorRecoveryCopy;
exports.editorRecoveryItemUrl = editorRecoveryItemUrl;
exports.editorRecoverySummaryOf = editorRecoverySummaryOf;
exports.editorSuccessorFromSave = editorSuccessorFromSave;
exports.editorSuccessorStorageKey = editorSuccessorStorageKey;
exports.editorWorkbenchEditorKey = editorWorkbenchEditorKey;
exports.editorWorkbenchFocusTargetIndex = editorWorkbenchFocusTargetIndex;
exports.editorWorkbenchShouldHandleEscape = editorWorkbenchShouldHandleEscape;
exports.editorWorkbenchUsesFullscreen = editorWorkbenchUsesFullscreen;
exports.editorWorkbenchWidthBounds = editorWorkbenchWidthBounds;
exports.encodeEditorOutbound = encodeEditorOutbound;
exports.frameGalleryCopy = frameGalleryCopy;
exports.frameLabel = frameLabel;
exports.galleryViewportMaxHeight = galleryViewportMaxHeight;
exports.galleryZoomCommandTarget = galleryZoomCommandTarget;
exports.galleryZoomPercent = galleryZoomPercent;
exports.galleryZoomShortcut = galleryZoomShortcut;
exports.getOpenPencilSelectionSnapshot = getOpenPencilSelectionSnapshot;
exports.grantOf = grantOf;
exports.hasOpenPencilSelection = hasOpenPencilSelection;
exports.inject = inject;
exports.isTerminalEditorSelectionStatus = isTerminalEditorSelectionStatus;
exports.launchManagedEditor = launchManagedEditor;
exports.liveSelectionOf = liveSelectionOf;
exports.loadOpenPencilSdk = loadOpenPencilSdk;
exports.mountEditorWorkbenchHost = mountEditorWorkbenchHost;
exports.nextGalleryZoom = nextGalleryZoom;
exports.normalizeFrameIndex = normalizeFrameIndex;
exports.parseEditorInbound = parseEditorInbound;
exports.prepareManagedEditor = prepareManagedEditor;
exports.prepareManagedEditorForMount = prepareManagedEditorForMount;
exports.presentationGrantOfMeta = presentationGrantOfMeta;
exports.presentationHydrationRequestOf = presentationHydrationRequestOf;
exports.preserveEditorBeforeWorkbenchDispose = preserveEditorBeforeWorkbenchDispose;
exports.publishOpenPencilSelection = publishOpenPencilSelection;
exports.rememberEditorSuccessor = rememberEditorSuccessor;
exports.requestOpenPencilEditor = requestOpenPencilEditor;
exports.requestPresentationGrant = requestPresentationGrant;
exports.resizedEditorWorkbenchWidth = resizedEditorWorkbenchWidth;
exports.restoreManagedEditorRecovery = restoreManagedEditorRecovery;
exports.selectionNodeDetail = selectionNodeDetail;
exports.selectionNodeLabel = selectionNodeLabel;
exports.sizeCanvasForDisplay = sizeCanvasForDisplay;
exports.startEditorSelectionPolling = startEditorSelectionPolling;
exports.subscribeOpenPencilSelection = subscribeOpenPencilSelection;

return module.exports; } });
