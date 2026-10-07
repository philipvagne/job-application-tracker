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

interface CvLineProps {
  application: Application
  cvs: readonly Cv[]
  onOpenCv: (cv: Cv) => void
}

/** The CV linked to the application: its name, and a button to open its PDF if it has one. */
function CvLine({ application, cvs, onOpenCv }: CvLineProps) {
  const { t, fileStatus } = useApp()
  const cv = cvs.find((c) => c.id === application.cvId)
  if (cv === undefined) return null
  const status = fileStatus(cv)
  return (
    <>
      <span>{t('row.cvName', { name: cv.name })}</span>
      {status === 'missing' && <span>{t('cvFile.missing')}</span>}
      {(status === 'available' || status === 'unknown') && (
        <button
          type="button"
          className="btn btn--small"
          aria-label={t('row.actionFor', { action: t('cvFile.open'), company: application.company })}
          onClick={() => onOpenCv(cv)}
        >
          {t('cvFile.open')}
        </button>
      )}
    </>
  )
}

interface ToApplyRowProps {
  application: Application
  cvs: readonly Cv[]
  onApplied: () => void
  onMenu: (action: MenuAction) => void
  onOpenCv: (cv: Cv) => void
}

export function ToApplyRow({ application, cvs, onApplied, onMenu, onOpenCv }: ToApplyRowProps) {
  const { t } = useApp()
  const hasMeta = application.url !== '' || application.cvId !== undefined
  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} />
        {hasMeta && (
          <p className="row__meta">
            {application.url !== '' && <HostLink url={application.url} />}
            <CvLine application={application} cvs={cvs} onOpenCv={onOpenCv} />
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
  onOpenCv: (cv: Cv) => void
}

export function AppliedRow({ application, cvs, now, onMenu, onOpenCv }: AppliedRowProps) {
  const { t, language } = useApp()
  const days = application.appliedAt === undefined ? null : daysSince(application.appliedAt, now)
  const when =
    days === null
      ? null
      : new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-days, 'day')
  const status = application.status === 'closed' ? 'applied' : application.status

  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} />
        <p className="row__meta">
          <span className="badge">{t(`status.${status}`)}</span>
          {when !== null && <span>{t('row.appliedWhen', { when })}</span>}
          <CvLine application={application} cvs={cvs} onOpenCv={onOpenCv} />
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
  cvs: readonly Cv[]
  onReopen: () => void
  onMenu: (action: MenuAction) => void
  onOpenCv: (cv: Cv) => void
}

export function ClosedRow({ application, cvs, onReopen, onMenu, onOpenCv }: ClosedRowProps) {
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
        <p className="row__meta">
          {reason !== null && <span>{t('row.closedWithReason', { reason })}</span>}
          <CvLine application={application} cvs={cvs} onOpenCv={onOpenCv} />
        </p>
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
