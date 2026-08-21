/**
 * useListKeyboardNav (Step 3.3)
 *
 * Reusable arrow-key navigation for a rendered list of items.
 * Extracted from AppDrawer's stop search so any list (search results,
 * pickers, menus) can share the exact same behavior:
 *
 *   - moveFocus(±1) moves the highlight, clamped to the VISIBLE slice:
 *     when only `maxVisible` items are rendered, ↓ must never focus a
 *     hidden result.
 *   - selectFocused() fires the callback for the highlighted item.
 *   - The focus resets automatically whenever the items change.
 *
 * Explicit vue imports (no Nuxt auto-imports) so the composable can be
 * unit tested under plain Vitest.
 */
import { ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

export function useListKeyboardNav<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  onSelect: (item: T) => void,
  maxVisible: number = Number.POSITIVE_INFINITY,
) {
  /** Index of the highlighted item; -1 means nothing is highlighted. */
  const focusedIndex = ref(-1)

  // New results → the old highlight no longer points at the same item.
  watch(items, () => { focusedIndex.value = -1 })

  function moveFocus(delta: number) {
    // Clamp to the VISIBLE slice, otherwise ↓ could focus a hidden result.
    const max = Math.min(items.value.length, maxVisible) - 1
    focusedIndex.value = Math.max(0, Math.min(focusedIndex.value + delta, max))
  }

  function selectFocused() {
    const item = items.value[focusedIndex.value]
    if (item) onSelect(item)
  }

  function resetFocus() { focusedIndex.value = -1 }

  return { focusedIndex, moveFocus, selectFocused, resetFocus }
}
