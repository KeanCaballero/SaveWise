import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} })

function resolve(theme) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('savewise_theme') || 'system')
  const [resolved, setResolved] = useState(() => resolve(theme))

  useEffect(() => {
    const r = resolve(theme)
    setResolved(r)
    document.documentElement.classList.toggle('dark', r === 'dark')
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') {
        const next = resolve('system')
        setResolved(next)
        document.documentElement.classList.toggle('dark', next === 'dark')
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (next) => {
    localStorage.setItem('savewise_theme', next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
