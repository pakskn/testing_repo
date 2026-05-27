import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../src/lib/store'

describe('UI Zustand Store', () => {
  beforeEach(() => {
    useUIStore.setState({ isSidebarOpen: true, activeFiltersCount: 0 })
  })

  it('should have initial state', () => {
    const state = useUIStore.getState()
    expect(state.isSidebarOpen).toBe(true)
    expect(state.activeFiltersCount).toBe(0)
  })

  it('should toggle sidebar', () => {
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().isSidebarOpen).toBe(false)

    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().isSidebarOpen).toBe(true)
  })

  it('should close sidebar', () => {
    useUIStore.getState().closeSidebar()
    expect(useUIStore.getState().isSidebarOpen).toBe(false)
  })

  it('should open sidebar', () => {
    useUIStore.getState().closeSidebar()
    useUIStore.getState().openSidebar()
    expect(useUIStore.getState().isSidebarOpen).toBe(true)
  })

  it('should update active filters count', () => {
    useUIStore.getState().setActiveFiltersCount(5)
    expect(useUIStore.getState().activeFiltersCount).toBe(5)
  })
})
