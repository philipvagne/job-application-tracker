import { daysSince, hostOf, isHttpUrl, type Application, type Cv } from '../domain'
import { useApp } from '../state/AppContext'
import { RowMenu, type MenuAction } from './RowMenu'

function RowTitle({ application }: { application: Application }) {
  return (
    <p className="row__title">
      <strong>{application.company}</strong>
      {application.role !== '' && <span className="row__role"> · {application.role}</span>}
    </p>
  )
}

/** The link as its host only. Only http(s) links are ever used as an href. */
function HostLink({ url }: { url: string }) {
  const { t } = useApp()
  const host = hostOf(url)
  if (host === null || !isHttpUrl(url)) return null
  return (
    <a
      className="row__link"
      href={url.trim()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('row.linkOpens', { host })}
    >
      {host}
    </a>
  )
}

interface ToApplyRowProps {
  application: Application
  onApplied: () => void
  onMenu: (action: MenuAction) => void
}

export function ToApplyRow({ application, onApplied, onMenu }: ToApplyRowProps) {
  const { t } = useApp()
  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} />
        {application.url !== '' && (
          <p className="row__meta">
            <HostLink url={application.url} />
          </p>
        )}
      </div>
      <div className="row__actions">
        <button
          type="button"
          id={`apply-${application.id}`}
          className="btn btn--primary btn--big"
          aria-label={t('row.actionFor', { action: t('row.markApplied'), company: application.company })}
          onClick={onApplied}
        >
          {t('row.markApplied')}
        </button>
        <RowMenu application={application} onAction={onMenu} />
      </div>
    </li>
  )
}

interface AppliedRowProps {
  application: Application
  cvs: readonly Cv[]
  now: string
  onMenu: (action: MenuAction) => void
}

export function AppliedRow({ application, cvs, now, onMenu }: AppliedRowProps) {
  const { t, language } = useApp()
  const days = application.appliedAt === undefined ? null : daysSince(application.appliedAt, now)
  const when =
    days === null
      ? null
      : new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-days, 'day')
  const cvName = cvs.find((cv) => cv.id === application.cvId)?.name
  const status = application.status === 'closed' ? 'applied' : application.status

  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} />
        <p className="row__meta">
          <span className="badge">{t(`status.${status}`)}</span>
          {when !== null && <span>{t('row.appliedWhen', { when })}</span>}
          {cvName !== undefined && <span>{t('row.cvName', { name: cvName })}</span>}
        </p>
      </div>
      <div className="row__actions">
        <RowMenu application={application} onAction={onMenu} />
      </div>
    </li>
  )
}

interface ClosedRowProps {
  application: Application
  onReopen: () => void
  onMenu: (action: MenuAction) => void
}

export function ClosedRow({ application, onReopen, onMenu }: ClosedRowProps) {
  const { t } = useApp()
  const company = application.company
  const reason = application.closedReason === undefined ? null : t(`closedReason.${application.closedReason}`)
  const buttons: { label: string; onClick: () => void }[] = [
    { label: t('menu.reopen'), onClick: onReopen },
    { label: t('menu.edit'), onClick: () => onMenu('edit') },
    { label: t('menu.delete'), onClick: () => onMenu('delete') },
  ]
  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} />
        {reason !== null && <p className="row__meta">{t('row.closedWithReason', { reason })}</p>}
      </div>
      <div className="row__actions">
        {buttons.map((button, i) => (
          <button
            key={i}
            type="button"
            id={i === 0 ? `reopen-${application.id}` : undefined}
            className="btn"
            aria-label={t('row.actionFor', { action: button.label, company })}
            onClick={button.onClick}
          >
            {button.label}
          </button>
        ))}
      </div>
    </li>
  )
}
