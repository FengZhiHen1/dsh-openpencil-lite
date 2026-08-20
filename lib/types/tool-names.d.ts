/** Canonical model-facing OpenPencil tool names. */
export declare const OPENPENCIL_RENDER_TOOL_NAME: "openpencil_render";
export declare const OPENPENCIL_NEW_TOOL_NAME: "openpencil_new";
export declare const OPENPENCIL_APPLY_TOOL_NAME: "openpencil_apply";
/**
 * Historical render name retained only by the browser presentation layer so
 * existing conversation cards and details panels remain replayable. The host
 * deliberately does not register this alias as a model-facing tool.
 */
export declare const LEGACY_DESIGN_RENDER_TOOL_NAME: "design_render";
export declare const OPENPENCIL_TOOL_NAMES: readonly ["openpencil_render", "openpencil_new", "openpencil_apply"];
