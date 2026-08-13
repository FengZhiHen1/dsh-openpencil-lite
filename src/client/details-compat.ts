/** Compatibility boundary for future DSH builds that add a keyed Tool-details seam. */

import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { DetailsToolOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * Published DSH rc.2 through 0.1.0-rc.6 do not declare this slot. Keeping the
 * proposed additive contract local lets a future supporting host activate the
 * native surface without breaking current hosts. At runtime `slots.inject()`
 * waits while a slot is absent, so current releases use the plugin workbench.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'tool.details.toolview': {
      kind: 'keyed'
      scope: 'session'
      owner: DetailsToolOwnerProps
    }
  }
}

/** Details props without importing a symbol absent from current DSH releases. */
export type CompatibleToolDetailsViewProps = PropsRuntime<'tool.details.toolview'>

/** Call props with a possible future additive sidebar capability. */
export type CompatibleToolCallViewProps = ToolCallViewProps & {
  openDetails?: (() => void) | undefined
}

export type OpenPencilEditorSurface = 'details' | 'modal'

/** Prefer the native resident details panel and otherwise open our own modal. */
export function requestOpenPencilEditor(
  openDetails: (() => void) | undefined,
  openModal: () => void,
): OpenPencilEditorSurface {
  if (openDetails !== undefined) {
    openDetails()
    return 'details'
  }
  openModal()
  return 'modal'
}
