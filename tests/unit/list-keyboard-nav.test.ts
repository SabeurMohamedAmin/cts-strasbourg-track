import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useListKeyboardNav } from '~/composables/useListKeyboardNav'

/**
 * Unit tests for the reusable list keyboard navigation (Step 3.3),
 * extracted from AppDrawer's stop search.
 */
describe('useListKeyboardNav', () => {
  it('starts with nothing focused', () => {
    const { focusedIndex } = useListKeyboardNav(ref(['a', 'b']), vi.fn())
    expect(focusedIndex.value).toBe(-1)
  })

  it('moves the focus down and up', () => {
    const { focusedIndex, moveFocus } = useListKeyboardNav(ref(['a', 'b', 'c']), vi.fn())
    moveFocus(1)
    expect(focusedIndex.value).toBe(0)
    moveFocus(1)
    expect(focusedIndex.value).toBe(1)
    moveFocus(-1)
    expect(focusedIndex.value).toBe(0)
  })

  it('never moves below the first item', () => {
    const { focusedIndex, moveFocus } = useListKeyboardNav(ref(['a', 'b']), vi.fn())
    moveFocus(-1)
    expect(focusedIndex.value).toBe(0)
    moveFocus(-1)
    expect(focusedIndex.value).toBe(0)
  })

  it('clamps the focus to the visible slice', () => {
    // 10 items but only 3 rendered: ↓ must never focus a hidden result.
    const items = ref(Array.from({ length: 10 }, (_, i) => `item-${i}`))
    const { focusedIndex, moveFocus } = useListKeyboardNav(items, vi.fn(), 3)
    for (let i = 0; i < 6; i++) moveFocus(1)
    expect(focusedIndex.value).toBe(2)
  })

  it('selects the focused item', () => {
    const onSelect = vi.fn()
    const { moveFocus, selectFocused } = useListKeyboardNav(ref(['a', 'b']), onSelect)
    moveFocus(1)
    moveFocus(1)
    selectFocused()
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('does nothing when no item is focused', () => {
    const onSelect = vi.fn()
    const { selectFocused } = useListKeyboardNav(ref(['a']), onSelect)
    selectFocused()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('resets the focus when the items change', async () => {
    const items = ref(['a', 'b'])
    const { focusedIndex, moveFocus } = useListKeyboardNav(items, vi.fn())
    moveFocus(1)
    expect(focusedIndex.value).toBe(0)
    items.value = ['c']
    await nextTick()
    expect(focusedIndex.value).toBe(-1)
  })

  it('resetFocus clears the focus explicitly', () => {
    const { focusedIndex, moveFocus, resetFocus } = useListKeyboardNav(ref(['a']), vi.fn())
    moveFocus(1)
    resetFocus()
    expect(focusedIndex.value).toBe(-1)
  })
})
