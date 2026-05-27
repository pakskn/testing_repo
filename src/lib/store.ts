import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  openSidebar: () => void
  activeFiltersCount: number
  setActiveFiltersCount: (count: number) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      closeSidebar: () => set({ isSidebarOpen: false }),
      openSidebar: () => set({ isSidebarOpen: true }),
      activeFiltersCount: 0,
      setActiveFiltersCount: (count) => set({ activeFiltersCount: count }),
    }),
    {
      name: 'niche-ui-storage', // key name in localStorage
      partialize: (state) => ({ isSidebarOpen: state.isSidebarOpen }), // only persist sidebar open state
    }
  )
)
