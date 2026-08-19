/** Same-origin client controls for durable managed-editor recovery. */
import { editorControlUrl } from './editor-bridge.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function editorRecoverySummaryOf(value) {
    if (!isRecord(value))
        return undefined;
    if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.id)
        || typeof value.capturedAt !== 'number' || !Number.isSafeInteger(value.capturedAt) || value.capturedAt <= 0
        || typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes <= 0
        || typeof value.sourceName !== 'string' || value.sourceName.length <= 0 || value.sourceName.length > 512
        || typeof value.sourceChangedSinceCapture !== 'boolean'
        || typeof value.cacheLabel !== 'string' || !value.cacheLabel.startsWith('dsh-openpencil/recovery/'))
        return undefined;
    return value;
}
export function editorRecoveryItemUrl(launch, recoveryId) {
    if (launch.recoveryUrl === undefined)
        throw new Error('OpenPencil recovery control is unavailable');
    if (!/^[A-Za-z0-9_-]{43}$/.test(recoveryId))
        throw new Error('OpenPencil recovery id is invalid');
    return `${editorControlUrl(launch.recoveryUrl)}/${recoveryId}`;
}
async function checkedJson(response, action) {
    if (!response.ok)
        throw new Error(`${action} failed (${response.status})`);
    return response.json();
}
/** Capture the authoritative daemon document; never serializes the iframe from React. */
export async function captureManagedEditorRecovery(launch, fetcher = fetch) {
    if (launch.recoveryUrl === undefined)
        return undefined;
    const value = await checkedJson(await fetcher(editorControlUrl(launch.recoveryUrl), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: launch.sessionId }),
        keepalive: true,
    }), 'OpenPencil recovery capture');
    if (!isRecord(value) || value.ok !== true)
        throw new Error('OpenPencil recovery capture returned an invalid result');
    if (value.recovery === null)
        return undefined;
    const recovery = editorRecoverySummaryOf(value.recovery);
    if (recovery === undefined)
        throw new Error('OpenPencil recovery capture omitted recovery metadata');
    return recovery;
}
/** Explicitly restore into the live daemon. The user must still press Save to update `.op`. */
export async function restoreManagedEditorRecovery(launch, recovery, fetcher = fetch) {
    const value = await checkedJson(await fetcher(editorRecoveryItemUrl(launch, recovery.id), {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: launch.sessionId }),
    }), 'OpenPencil recovery restore');
    if (!isRecord(value) || value.ok !== true || typeof value.docJson !== 'string') {
        throw new Error('OpenPencil recovery restore returned an invalid result');
    }
    return value.docJson;
}
export async function discardManagedEditorRecovery(launch, recovery, fetcher = fetch) {
    const value = await checkedJson(await fetcher(editorRecoveryItemUrl(launch, recovery.id), {
        method: 'DELETE', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: launch.sessionId }),
    }), 'OpenPencil recovery discard');
    if (!isRecord(value) || value.ok !== true)
        throw new Error('OpenPencil recovery discard returned an invalid result');
}
const COPY = {
    'zh-CN': {
        available: sourceName => `发现 ${sourceName} 的未保存恢复稿。是否恢复？恢复后仍需点击“保存”才会写入源文件。`,
        conflict: sourceName => `发现 ${sourceName} 的未保存恢复稿，但源文件之后已被修改。仍要将恢复稿载入画布吗？恢复不会自动覆盖源文件。`,
    },
    'en-US': {
        available: sourceName => `An unsaved recovery draft for ${sourceName} is available. Restore it? You must still select Save to write the source file.`,
        conflict: sourceName => `An unsaved recovery draft for ${sourceName} is available, but the source changed later. Load the draft into the canvas anyway? Recovery will not overwrite the source automatically.`,
    },
};
export function editorRecoveryCopy(locale) {
    return COPY[locale];
}
