/** Durable, explicit recovery snapshots for managed OpenPencil editors. */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { stateRoot } from './renderer.js';
const RECOVERY_VERSION = 1;
const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECOVERY_FILES = 32;
const MAX_DOCUMENT_BYTES = 64 * 1024 * 1024;
// A recovery record stores the normalized document as a JSON string. In the
// worst case every byte in that string needs one additional escape byte in the
// outer JSON envelope. Keep separate document and envelope limits so every
// document accepted by the host can still be recovered.
const MAX_RECOVERY_ENVELOPE_BYTES = 1024 * 1024;
const MAX_ESCAPED_DOCUMENT_BYTES = MAX_DOCUMENT_BYTES * 2 + 2;
const MAX_RECOVERY_RECORD_BYTES = MAX_ESCAPED_DOCUMENT_BYTES + MAX_RECOVERY_ENVELOPE_BYTES;
const RECOVERY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizedDocumentJson(value, label) {
    const bytes = Buffer.byteLength(value);
    if (bytes <= 0 || bytes > MAX_DOCUMENT_BYTES)
        throw new Error(`${label} size is invalid`);
    let document;
    try {
        document = JSON.parse(value);
    }
    catch {
        throw new Error(`${label} is not valid JSON`);
    }
    if (!isRecord(document))
        throw new Error(`${label} must be a document object`);
    const normalized = JSON.stringify(document);
    const normalizedBytes = Buffer.byteLength(normalized);
    if (normalizedBytes <= 0 || normalizedBytes > MAX_DOCUMENT_BYTES)
        throw new Error(`${label} size is invalid`);
    return normalized;
}
function serializedRecoveryRecord(record) {
    const serialized = JSON.stringify(record);
    const serializedBytes = Buffer.byteLength(serialized);
    const escapedDocumentBytes = Buffer.byteLength(JSON.stringify(record.documentJson));
    const envelopeBytes = serializedBytes - escapedDocumentBytes;
    if (envelopeBytes > MAX_RECOVERY_ENVELOPE_BYTES || serializedBytes > MAX_RECOVERY_RECORD_BYTES) {
        throw new Error('OpenPencil recovery snapshot exceeds the cache size limit');
    }
    return serialized;
}
function recoveryRecordFrom(value) {
    if (!isRecord(value))
        return undefined;
    if (value.v !== RECOVERY_VERSION
        || typeof value.id !== 'string' || !RECOVERY_ID_PATTERN.test(value.id)
        || typeof value.sourcePath !== 'string' || resolve(value.sourcePath) !== value.sourcePath
        || typeof value.sourceSha256AtCapture !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceSha256AtCapture)
        || typeof value.documentSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.documentSha256)
        || typeof value.documentJson !== 'string'
        || typeof value.daemonVersion !== 'number' || !Number.isSafeInteger(value.daemonVersion) || value.daemonVersion < 0
        || typeof value.capturedAt !== 'number' || !Number.isSafeInteger(value.capturedAt) || value.capturedAt <= 0
        || (value.reason !== 'client-dispose' && value.reason !== 'plugin-dispose'))
        return undefined;
    try {
        const documentJson = normalizedDocumentJson(value.documentJson, 'OpenPencil recovery document');
        if (sha256(documentJson) !== value.documentSha256)
            return undefined;
        return { ...value, documentJson };
    }
    catch {
        return undefined;
    }
}
function daemonOrigin(baseUrl) {
    const origin = new URL(baseUrl);
    const loopback = origin.hostname === '127.0.0.1' || origin.hostname === 'localhost' || origin.hostname === '::1';
    if (!loopback || (origin.protocol !== 'http:' && origin.protocol !== 'https:')) {
        throw new Error('OpenPencil recovery endpoint must use an HTTP loopback origin');
    }
    if (origin.pathname !== '/' || origin.search !== '' || origin.hash !== '') {
        throw new Error('OpenPencil recovery base URL must be an origin');
    }
    return origin;
}
async function boundedResponseBytes(response, label) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_DOCUMENT_BYTES + 1024 * 1024) {
        throw new Error(`${label} is too large`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_DOCUMENT_BYTES + 1024 * 1024)
        throw new Error(`${label} is too large`);
    return bytes;
}
/** Read the daemon's authoritative in-memory document without exposing its token. */
export async function readManagedDaemonDocument(baseUrl, token, fetcher = fetch, signal) {
    const origin = daemonOrigin(baseUrl);
    const timeout = AbortSignal.timeout(5_000);
    const response = await fetcher(new URL('/api/mcp/document', origin).href, {
        headers: {
            authorization: `Bearer ${token}`,
            'x-openpencil-token': token,
            accept: 'application/json',
        },
        signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    });
    const bytes = await boundedResponseBytes(response, 'OpenPencil recovery response');
    if (!response.ok)
        throw new Error(`OpenPencil recovery snapshot failed (${response.status})`);
    let value;
    try {
        value = JSON.parse(bytes.toString('utf8'));
    }
    catch {
        throw new Error('OpenPencil recovery snapshot returned invalid JSON');
    }
    if (!isRecord(value) || !isRecord(value.document) || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 0) {
        throw new Error('OpenPencil recovery snapshot returned an invalid document');
    }
    return { documentJson: normalizedDocumentJson(JSON.stringify(value.document), 'OpenPencil recovery document'), version: value.version };
}
/** Replace only the live daemon document; persisting to `.op` remains a separate Save. */
export async function restoreManagedDaemonDocument(baseUrl, token, recovery, fetcher = fetch) {
    const origin = daemonOrigin(baseUrl);
    const documentJson = normalizedDocumentJson(recovery.documentJson, 'OpenPencil recovery document');
    const response = await fetcher(new URL('/api/mcp/document', origin).href, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'x-openpencil-token': token,
            'content-type': 'application/json',
            accept: 'application/json',
        },
        body: JSON.stringify({
            document: JSON.parse(documentJson),
            sourceClientId: 'dsh-openpencil-recovery',
            baseVersion: recovery.version,
        }),
        signal: AbortSignal.timeout(5_000),
    });
    const bytes = await boundedResponseBytes(response, 'OpenPencil recovery restore response');
    if (!response.ok)
        throw new Error(`OpenPencil recovery restore failed (${response.status})`);
    let value;
    try {
        value = JSON.parse(bytes.toString('utf8'));
    }
    catch {
        throw new Error('OpenPencil recovery restore returned invalid JSON');
    }
    if (!isRecord(value) || value.ok !== true || typeof value.version !== 'number' || !Number.isSafeInteger(value.version)) {
        throw new Error('OpenPencil recovery restore returned an invalid result');
    }
    return value.version;
}
/** Filesystem-backed store keyed by an HMAC of the source path. */
export class EditorRecoveryStore {
    #key;
    #root;
    #now;
    constructor(key, root = join(stateRoot(), 'recovery'), now = Date.now) {
        if (key.length < 16)
            throw new TypeError('editor recovery key is too short');
        this.#key = Buffer.from(key);
        this.#root = root;
        this.#now = now;
    }
    async capture(options) {
        const sourcePath = resolve(options.sourcePath);
        const sourceDocumentJson = normalizedDocumentJson(options.sourceDocumentJson, 'OpenPencil source document');
        const documentJson = normalizedDocumentJson(options.daemonDocument.documentJson, 'OpenPencil recovery document');
        const id = this.#idFor(sourcePath);
        if (documentJson === sourceDocumentJson) {
            await this.discard(sourcePath, id);
            return undefined;
        }
        if (!/^[a-f0-9]{64}$/.test(options.sourceSha256))
            throw new Error('OpenPencil source hash is invalid');
        const capturedAt = this.#now();
        const record = {
            v: RECOVERY_VERSION,
            id,
            sourcePath,
            sourceSha256AtCapture: options.sourceSha256,
            documentSha256: sha256(documentJson),
            documentJson,
            daemonVersion: options.daemonDocument.version,
            capturedAt,
            reason: options.reason,
        };
        const serialized = serializedRecoveryRecord(record);
        await mkdir(this.#root, { recursive: true, mode: 0o700 });
        await this.#atomicWrite(this.#pathFor(id), serialized);
        await this.prune();
        return this.#summary(record, options.sourceSha256);
    }
    async find(sourcePathValue, currentSourceSha256, currentSourceDocumentJson) {
        const sourcePath = resolve(sourcePathValue);
        const record = await this.#read(sourcePath, this.#idFor(sourcePath));
        if (record === undefined)
            return undefined;
        if (currentSourceDocumentJson !== undefined
            && record.documentJson === normalizedDocumentJson(currentSourceDocumentJson, 'OpenPencil source document')) {
            await this.discard(sourcePath, record.id);
            return undefined;
        }
        return this.#summary(record, currentSourceSha256);
    }
    async read(sourcePathValue, id) {
        const sourcePath = resolve(sourcePathValue);
        const record = await this.#read(sourcePath, id);
        return record === undefined ? undefined : { documentJson: record.documentJson };
    }
    async discard(sourcePathValue, id) {
        const sourcePath = resolve(sourcePathValue);
        if (!RECOVERY_ID_PATTERN.test(id) || id !== this.#idFor(sourcePath))
            return false;
        try {
            await rm(this.#pathFor(id));
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return false;
            throw error;
        }
    }
    async discardFor(sourcePathValue) {
        const sourcePath = resolve(sourcePathValue);
        return this.discard(sourcePath, this.#idFor(sourcePath));
    }
    async prune() {
        let names;
        try {
            names = await readdir(this.#root);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return;
            throw error;
        }
        const candidates = [];
        for (const name of names) {
            if (!RECOVERY_ID_PATTERN.test(name.replace(/\.json$/, '')) || !name.endsWith('.json'))
                continue;
            const path = join(this.#root, name);
            const record = await this.#readPath(path);
            if (record === undefined || this.#expired(record)) {
                await rm(path, { force: true }).catch(() => { });
            }
            else {
                candidates.push({ path, capturedAt: record.capturedAt });
            }
        }
        candidates.sort((left, right) => right.capturedAt - left.capturedAt);
        await Promise.all(candidates.slice(MAX_RECOVERY_FILES).map(candidate => rm(candidate.path, { force: true })));
    }
    #idFor(sourcePath) {
        return createHmac('sha256', this.#key).update('dsh-openpencil/recovery/v1\0').update(sourcePath).digest('base64url');
    }
    #pathFor(id) {
        return join(this.#root, `${id}.json`);
    }
    #expired(record) {
        const age = this.#now() - record.capturedAt;
        return age < 0 || age > RECOVERY_TTL_MS;
    }
    async #read(sourcePath, id) {
        if (!RECOVERY_ID_PATTERN.test(id) || id !== this.#idFor(sourcePath))
            return undefined;
        const path = this.#pathFor(id);
        const record = await this.#readPath(path);
        if (record === undefined || record.sourcePath !== sourcePath || this.#expired(record)) {
            await rm(path, { force: true }).catch(() => { });
            return undefined;
        }
        return record;
    }
    async #readPath(path) {
        try {
            const info = await lstat(path);
            if (info.isSymbolicLink() || !info.isFile() || info.size <= 0 || info.size > MAX_RECOVERY_RECORD_BYTES)
                return undefined;
            const value = JSON.parse(await readFile(path, 'utf8'));
            return recoveryRecordFrom(value);
        }
        catch {
            return undefined;
        }
    }
    async #atomicWrite(path, value) {
        const temp = join(this.#root, `.recovery-${randomUUID()}.tmp`);
        let handle;
        try {
            handle = await open(temp, 'wx', 0o600);
            await handle.writeFile(value);
            await handle.sync();
            await handle.close();
            handle = undefined;
            await rename(temp, path);
        }
        finally {
            await handle?.close().catch(() => { });
            await rm(temp, { force: true }).catch(() => { });
        }
    }
    #summary(record, currentSourceSha256) {
        return {
            id: record.id,
            capturedAt: record.capturedAt,
            bytes: Buffer.byteLength(record.documentJson),
            sourceName: basename(record.sourcePath),
            sourceChangedSinceCapture: currentSourceSha256 !== record.sourceSha256AtCapture,
            cacheLabel: `dsh-openpencil/recovery/${record.id}.json`,
        };
    }
}
