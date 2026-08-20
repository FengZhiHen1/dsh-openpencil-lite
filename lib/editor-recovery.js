/** Read the OpenPencil managed daemon's authoritative in-memory document. */
const MAX_DOCUMENT_BYTES = 64 * 1024 * 1024;
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
function daemonOrigin(baseUrl) {
    const origin = new URL(baseUrl);
    const loopback = origin.hostname === '127.0.0.1' || origin.hostname === 'localhost' || origin.hostname === '::1';
    if (!loopback || (origin.protocol !== 'http:' && origin.protocol !== 'https:')) {
        throw new Error('OpenPencil daemon endpoint must use an HTTP loopback origin');
    }
    if (origin.pathname !== '/' || origin.search !== '' || origin.hash !== '') {
        throw new Error('OpenPencil daemon base URL must be an origin');
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
    const bytes = await boundedResponseBytes(response, 'OpenPencil daemon document response');
    if (!response.ok)
        throw new Error(`OpenPencil daemon document read failed (${response.status})`);
    let value;
    try {
        value = JSON.parse(bytes.toString('utf8'));
    }
    catch {
        throw new Error('OpenPencil daemon document returned invalid JSON');
    }
    if (!isRecord(value) || !isRecord(value.document) || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 0) {
        throw new Error('OpenPencil daemon document returned an invalid document');
    }
    const documentJson = normalizedDocumentJson(JSON.stringify(value.document), 'OpenPencil daemon document');
    return { documentJson, version: value.version };
}
