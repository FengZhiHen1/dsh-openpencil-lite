/** Recover browser-only presentation metadata omitted from nested Tool results. */
export declare const PRESENTATION_HYDRATION_ENDPOINT = "/_dsh/dsh-openpencil-lite/presentation";
export declare const PRESENTATION_HYDRATION_META_KEY = "$dshOpenPencil";
export interface PresentationHydrationRequest {
    sessionId: string;
    callId: string;
    documentSha256: string;
}
export interface PresentationHydrationCandidate {
    block: unknown;
    toolName: string;
    sessionId: string;
    callId: string;
    embeddedGrant: unknown;
}
export type PresentationHydrationFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export interface PresentationHydrationOptions {
    fetcher?: PresentationHydrationFetcher;
    signal?: AbortSignal;
}
type PresentationMetaParser<Grant> = (meta: unknown) => Grant | undefined;
/**
 * Read only the immutable document fingerprint from one canonical text result.
 * Paths, image data, and every other model-visible result field are ignored.
 */
export declare function documentSha256FromCanonicalResult(block: unknown): string | undefined;
/** Select only canonical nested render results that actually need hydration. */
export declare function presentationHydrationRequestOf(candidate: PresentationHydrationCandidate): PresentationHydrationRequest | undefined;
/**
 * Exchange a non-secret result fingerprint for a same-origin presentation
 * grant. Concurrent subscribers share one request; an unmounted subscriber
 * can abort independently, and the network request is cancelled once nobody
 * is waiting for it.
 */
export declare function requestPresentationGrant<Grant>(request: PresentationHydrationRequest, parseMeta: PresentationMetaParser<Grant>, options?: PresentationHydrationOptions): Promise<Grant | undefined>;
export {};
