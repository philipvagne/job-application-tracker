import { useCallback, useEffect, useRef, useState } from 'react'
import { LANGUAGES } from './domain'
import { useApp } from './state/AppContext'
import { takeAddFromUrl, type IncomingAdd } from './state/incomingAdd'
import { Banners } from './ui/Banners'
import { SettingsDialog } from './ui/SettingsDialog'
import { Tracker } from './ui/Tracker'

interface AppProps {
  /** An add payload that was in the address when the page loaded (see main.tsx). */
  initialAdd: IncomingAdd['result'] | null
}

export function App({ initialAdd }: AppProps) {
  const { t, language, dataResetCount, actions } = useApp()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // A payload waits here until the quick-add card has used it. The number is new for each one.
  const addCounter = useRef(1)
  const [incomingAdd, setIncomingAdd] = useState<IncomingAdd | null>(
    initialAdd === null ? null : { id: 1, result: initialAdd },
  )
  const onAddHandled = useCallback(() => setIncomingAdd(null), [])

  // The address changed while the app is open (the bookmarklet used again in an open tab).
  useEffect(() => {
    function onHashChange(): void {
      const result = takeAddFromUrl(window)
      if (result === null) return
      addCounter.current += 1
      setIncomingAdd({ id: addCounter.current, result })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <header className="header">
        <h1 className="header__title">{t('app.title')}</h1>
        <div className="header__tools">
          <div role="group" aria-label={t('language.label')} className="lang">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                className="btn btn--toggle"
                aria-pressed={language === code}
                aria-label={t(`language.${code}`)}
                onClick={() => actions.setLanguage(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--small" onClick={() => setSettingsOpen(true)}>
            {t('settings.open')}
          </button>
        </div>
      </header>

      <main className="main">
        <Banners />
        <Tracker key={dataResetCount} incomingAdd={incomingAdd} onAddHandled={onAddHandled} />
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
