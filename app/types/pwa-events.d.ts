/**
 * PWA install events are not part of the official DOM standard yet,
 * so TypeScript's built-in WindowEventMap does not know about them.
 *
 * Declaring them here fixes errors like:
 *   "Argument of type '\"beforeinstallprompt\"' is not assignable to
 *    parameter of type 'keyof WindowEventMap'"
 * and gives event handlers a fully typed event object.
 *
 * This file is types-only: it adds nothing to the final bundle.
 */

declare global {
  /** Fired by the browser when the app can be installed as a PWA. */
  interface BeforeInstallPromptEvent extends Event {
    /** Opens the browser's install dialog. */
    prompt: () => Promise<void>
    /** Resolves with the user's answer to the install dialog. */
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
    appinstalled: Event
  }
}

export {}
