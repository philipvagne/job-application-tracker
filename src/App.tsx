import { useState } from 'react'
import { LANGUAGES } from './domain'
import { useApp } from './state/AppContext'
import { Banners } from './ui/Banners'
import { SettingsDialog } from './ui/SettingsDialog'

export function App() {
  const { t, language, state, actions } = useApp()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app">
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
          <button type="button" className="btn" onClick={() => setSettingsOpen(true)}>
            {t('settings.open')}
          </button>
        </div>
      </header>

      <main className="main">
        <Banners />
        {state.applications.length === 0 && (
          <section className="empty" aria-labelledby="empty-title">
            <h2 id="empty-title">{t('empty.title')}</h2>
            <p>{t('empty.body')}</p>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>{t('footer.privacy')}</p>
      </footer>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
