import type { ReactNode } from 'react'
import { useApp } from '../state/AppContext'

interface BannerProps {
  tone: 'info' | 'warn'
  /** "alert" is announced at once, "status" politely. */
  role: 'alert' | 'status'
  title: string
  children?: ReactNode
  actions?: ReactNode
  onDismiss?: () => void
}

function Banner({ tone, role, title, children, actions, onDismiss }: BannerProps) {
  const { t } = useApp()
  return (
    <div className={`banner banner--${tone}`} role={role}>
      <p className="banner__title">{title}</p>
      {children !== undefined && <p className="banner__body">{children}</p>}
      <div className="banner__actions">
        {actions}
        {onDismiss !== undefined && (
          <button type="button" className="btn btn--quiet" onClick={onDismiss}>
            {t('common.dismiss')}
          </button>
        )}
      </div>
    </div>
  )
}

/** The safety banners, most serious first. Each has an action the user can take. */
export function Banners() {
  const { t, status, saveError, backupDue, actions } = useApp()

  const exportButton = (
    <button type="button" className="btn btn--primary" onClick={actions.exportBackup}>
      {t('common.export')}
    </button>
  )

  const unreadableBody = status.backedUp
    ? t('banner.unreadable.bodyKept')
    : status.hasCorruptCopy
      ? t('banner.unreadable.bodyOlderCopy')
      : t('banner.unreadable.bodyNoCopy')

  return (
    <div className="banners">
      {!status.persistent && (
        <Banner tone="warn" role="alert" title={t('banner.notSaved.title')} actions={exportButton}>
          {t('banner.notSaved.body')}
        </Banner>
      )}

      {status.recovered && (
        <Banner
          tone="warn"
          role="alert"
          title={t('banner.unreadable.title')}
          actions={
            status.hasCorruptCopy && (
              <>
                <button type="button" className="btn btn--primary" onClick={actions.downloadUnreadable}>
                  {t('banner.unreadable.download')}
                </button>
                <button type="button" className="btn" onClick={actions.clearUnreadable}>
                  {t('banner.unreadable.clear')}
                </button>
              </>
            )
          }
        >
          {unreadableBody}
        </Banner>
      )}

      {saveError !== null && (
        <Banner
          tone="warn"
          role="alert"
          title={t('banner.saveFailed.title')}
          actions={exportButton}
          onDismiss={actions.dismissSaveError}
        >
          {saveError === 'quota' ? t('banner.saveFailed.bodyQuota') : t('banner.saveFailed.bodyUnknown')}
        </Banner>
      )}

      {backupDue && (
        <Banner
          tone="info"
          role="status"
          title={t('banner.backupDue.title')}
          actions={exportButton}
          onDismiss={actions.dismissBackupReminder}
        >
          {t('banner.backupDue.body')}
        </Banner>
      )}
    </div>
  )
}
