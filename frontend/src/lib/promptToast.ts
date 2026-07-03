import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import AuraPromptToast, { type AuraPromptToastProps } from '../components/notifications/AuraPromptToast'

export interface PromptToastOptions {
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel: string
  cancelLabel: string
  validate?: (value: string) => string | null
}

const PROMPT_PORTAL_ID = 'aura-prompt-portal'

let promptContainer: HTMLDivElement | null = null
let promptRoot: Root | null = null

function ensurePromptRoot(): Root {
  if (!promptContainer || !promptRoot) {
    promptContainer = document.getElementById(PROMPT_PORTAL_ID) as HTMLDivElement | null
    if (!promptContainer) {
      promptContainer = document.createElement('div')
      promptContainer.id = PROMPT_PORTAL_ID
      document.body.appendChild(promptContainer)
    }
    promptRoot = createRoot(promptContainer)
  }
  return promptRoot
}

function unmountPrompt() {
  promptRoot?.render(null)
}

/** Input testuale luxury — sostituto di window.prompt(). */
export function showAuraPrompt(options: PromptToastOptions): Promise<string | null> {
  return new Promise(resolve => {
    const root = ensurePromptRoot()
    root.render(
      createElement(AuraPromptToast, {
        ...options,
        onConfirm: (value: string) => {
          unmountPrompt()
          resolve(value)
        },
        onCancel: () => {
          unmountPrompt()
          resolve(null)
        },
      } satisfies AuraPromptToastProps),
    )
  })
}
