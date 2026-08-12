/** Page-stable owner for the plugin fallback editor workbench. */

import { useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PresentationGrant, PresentationLocale } from './index.js'
import { editorLocaleFromDsh, type EditorColorScheme } from './editor-bridge.js'
import {
  editorModalCopy,
  editorWorkbenchEditorKey,
  ManagedOpenPencilEditorModal,
} from './editor-modal.js'
import {
  INITIAL_EDITOR_LIFECYCLE_STATE,
  type EditorLifecycleController,
  type EditorLifecycleState,
} from './editor-panel.js'

export interface EditorWorkbenchRequest {
  grant: PresentationGrant
  sessionId: string
}

type Listener = () => void

export interface EditorWorkbenchStore {
  getSnapshot: () => EditorWorkbenchRequest | undefined
  subscribe: (listener: Listener) => () => void
  open: (request: EditorWorkbenchRequest) => boolean
  close: () => void
}

function requestIdentity(request: EditorWorkbenchRequest): string {
  return editorWorkbenchEditorKey(request.grant, request.sessionId)
}

/**
 * Small external store that is deliberately not owned by a Tool card. The
 * replacement gate lets the mounted host retain a dirty editor when another
 * historical card asks to open a different document.
 */
export function createEditorWorkbenchStore(
  canReplace: (current: EditorWorkbenchRequest) => boolean = () => true,
  onRepeat: () => void = () => {},
): EditorWorkbenchStore {
  let current: EditorWorkbenchRequest | undefined
  const listeners = new Set<Listener>()
  const emit = (): void => { for (const listener of listeners) listener() }
  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    open(request) {
      if (current !== undefined && requestIdentity(current) === requestIdentity(request)) {
        onRepeat()
        return true
      }
      if (current !== undefined && !canReplace(current)) return false
      current = request
      emit()
      return true
    },
    close() {
      if (current === undefined) return
      current = undefined
      emit()
    },
  }
}

interface EditorWorkbenchHostOptions {
  subscribeTheme: (listener: Listener) => () => unknown
  getColorScheme: () => EditorColorScheme
  subscribeLocale: (listener: Listener) => () => unknown
  getLocale: () => PresentationLocale
  document?: Document
}

export interface EditorWorkbenchHost {
  open: (request: EditorWorkbenchRequest) => Promise<boolean>
  dispose: () => Promise<void>
}

export type EditorDisposePreservation = 'clean' | 'saved' | 'recovered' | 'unrecovered'

/**
 * Preserve dirty state without inventing a save the user did not request.
 * An already-running save may finish; an idle dirty editor is recovery-only.
 */
export async function preserveEditorBeforeWorkbenchDispose(
  state: EditorLifecycleState,
  controller: EditorLifecycleController,
): Promise<EditorDisposePreservation> {
  const unrecovered = (): EditorDisposePreservation => {
    // React/HMR may still remove the client tree. Suppress its DELETE so the
    // server controller remains authoritative and can capture/recover later.
    controller.retainServerSessionOnUnmount()
    return 'unrecovered'
  }
  if (state.phase === 'saving') {
    const saved = await controller.awaitExistingSave().catch(() => false)
    if (saved) return 'saved'
    return await controller.captureRecovery().catch(() => false) ? 'recovered' : unrecovered()
  }
  if (!state.dirty) return 'clean'
  return await controller.captureRecovery().catch(() => false) ? 'recovered' : unrecovered()
}

interface HostViewProps {
  store: EditorWorkbenchStore
  subscribeTheme: EditorWorkbenchHostOptions['subscribeTheme']
  getColorScheme: EditorWorkbenchHostOptions['getColorScheme']
  subscribeLocale: EditorWorkbenchHostOptions['subscribeLocale']
  getLocale: EditorWorkbenchHostOptions['getLocale']
  ownerId: string
  onLifecycleState: (state: EditorLifecycleState) => void
  onLifecycleController: (controller: EditorLifecycleController | undefined) => void
  close: () => void
}

function EditorWorkbenchHostView({
  store,
  subscribeTheme,
  getColorScheme,
  subscribeLocale,
  getLocale,
  ownerId,
  onLifecycleState,
  onLifecycleController,
  close,
}: HostViewProps) {
  const request = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const colorScheme = useSyncExternalStore(subscribeTheme, getColorScheme, getColorScheme)
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)
  if (request === undefined) return null
  return (
    <ManagedOpenPencilEditorModal
      grant={request.grant}
      colorScheme={colorScheme}
      locale={editorLocaleFromDsh(locale)}
      sessionId={request.sessionId}
      ownerId={ownerId}
      onLifecycleState={onLifecycleState}
      onLifecycleController={onLifecycleController}
      onClose={close}
    />
  )
}

let nextHostId = 0

/** Mount one imperative React root for the whole plugin fiber. */
export function mountEditorWorkbenchHost(options: EditorWorkbenchHostOptions): EditorWorkbenchHost {
  const ownerDocument = options.document ?? document
  const hostId = `dsh-openpencil-workbench-${++nextHostId}`
  const container = ownerDocument.createElement('div')
  container.dataset.openpencilWorkbenchHost = hostId
  ownerDocument.body.append(container)
  let root: Root | undefined = createRoot(container)
  let destroyed = false
  let disposing = false
  let disposePromise: Promise<void> | undefined
  let openQueue = Promise.resolve()
  let lifecycle: EditorLifecycleState = INITIAL_EDITOR_LIFECYCLE_STATE
  let lifecycleController: EditorLifecycleController | undefined

  const focusSurface = (): void => {
    const target = ownerDocument.querySelector<HTMLElement>(
      `[data-openpencil-editor-workbench-owner="${hostId}"] button, `
      + `[data-openpencil-editor-workbench-owner="${hostId}"] [tabindex="0"]`,
    )
    target?.focus()
  }
  const canDiscard = (): boolean => {
    if (lifecycle.phase === 'saving') return false
    return !lifecycle.dirty || window.confirm(
      editorModalCopy(editorLocaleFromDsh(options.getLocale())).discard,
    )
  }
  const store = createEditorWorkbenchStore(() => true, focusSurface)
  const close = (): void => {
    lifecycle = INITIAL_EDITOR_LIFECYCLE_STATE
    lifecycleController = undefined
    store.close()
  }

  const destroy = (): void => {
    if (destroyed) return
    destroyed = true
    root?.unmount()
    root = undefined
    container.remove()
  }

  root.render(
    <EditorWorkbenchHostView
      store={store}
      subscribeTheme={options.subscribeTheme}
      getColorScheme={options.getColorScheme}
      subscribeLocale={options.subscribeLocale}
      getLocale={options.getLocale}
      ownerId={hostId}
      onLifecycleState={next => { lifecycle = next }}
      onLifecycleController={next => { lifecycleController = next }}
      close={close}
    />,
  )

  return {
    open(request) {
      if (destroyed || disposing) return Promise.resolve(false)
      const operation = openQueue.then(async (): Promise<boolean> => {
        if (destroyed || disposing) return false
        const previous = store.getSnapshot()
        if (previous !== undefined && requestIdentity(previous) === requestIdentity(request)) {
          store.open(request)
          queueMicrotask(focusSurface)
          return true
        }
        if (previous !== undefined && !canDiscard()) return false
        if (previous !== undefined && lifecycleController !== undefined) {
          const closed = await lifecycleController.requestClose()
          if (!closed || destroyed || disposing) return false
        }
        const accepted = store.open(request)
        if (accepted) {
          lifecycle = INITIAL_EDITOR_LIFECYCLE_STATE
          lifecycleController = undefined
          queueMicrotask(focusSurface)
        }
        return accepted
      })
      openQueue = operation.then(() => {}, () => {})
      return operation
    },
    async dispose() {
      if (destroyed) return
      if (disposePromise !== undefined) return disposePromise
      disposing = true
      disposePromise = (async () => {
        await openQueue
        // Never turn unload into an implicit source write. Join only a save
        // the user already started; otherwise capture a recovery draft.
        if ((lifecycle.dirty || lifecycle.phase === 'saving') && lifecycleController !== undefined) {
          await preserveEditorBeforeWorkbenchDispose(lifecycle, lifecycleController)
        }
        close()
        destroy()
      })()
      return disposePromise
    },
  }
}
