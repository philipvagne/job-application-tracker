import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { browserLanguages } from './i18n'
import { AppProvider } from './state/AppContext'
import { loadApp } from './state/load'
import { createBrowserFileStore, createBrowserStorage, createStateStore, createUiPreferences } from './storage'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

// Loaded once here, outside React, so StrictMode's double render cannot load twice.
const storage = createBrowserStorage()
const store = createStateStore(storage)
const preferences = createUiPreferences(storage)
const files = createBrowserFileStore()
const initial = loadApp(store, { navigatorLanguages: browserLanguages(navigator) })

createRoot(root).render(
  <StrictMode>
    <AppProvider store={store} files={files} preferences={preferences} initial={initial}>
      <App />
    </AppProvider>
  </StrictMode>,
)
