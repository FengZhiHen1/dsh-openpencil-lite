/** Compatibility boundary for future DSH builds that add a keyed Tool-details seam. */

import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

/** Call props with a possible future additive sidebar capability. */
export type CompatibleToolCallViewProps = ToolCallViewProps & {
  openDetails?: (() => void) | undefined
}
