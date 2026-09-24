import { useState, useEffect, useCallback } from 'react'

const THEME_STORAGE_KEY = 'vlaams_theme'

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
    }
  }, [isDark])

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev)
  }, [])

  return { isDark, toggleTheme }
}
