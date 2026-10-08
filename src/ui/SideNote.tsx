import { formatDate } from '../i18n'
import { useApp } from '../state/AppContext'

/** Where the data lives, when it was last backed up, and the export link. */
export function SideNote() {
  const { t, language, state, actions } = useApp()
  const last = state.settings.lastExportAt
  return (
    <div className="sidenote">
      <p>{t('footer.privacy')}</p>
      <p>
        {last === undefined
          ? t('settings.backup.neverExported')
          : t('side.lastBackup', { date: formatDate(last, language) })}{' '}
        <button type="button" className="btn btn--text" onClick={actions.exportBackup}>
          {t('side.export')}
        </button>
      </p>
    </div>
  )
}
