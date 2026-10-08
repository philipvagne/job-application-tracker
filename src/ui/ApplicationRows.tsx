import {
  daysSince,
  hostOf,
  isHttpUrl,
  replyIndicator,
  type Application,
  type Cv,
  type ReplyIndicator as ReplyKind,
} from '../domain'
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

interface CvProps {
  application: Application
  cvs: readonly Cv[]
  onOpenCv: (cv: Cv) => void
}

/** The name of the CV linked to the application, and a note when its file is gone. */
function CvName({ application, cvs }: Pick<CvProps, 'application' | 'cvs'>) {
  const { t, fileStatus } = useApp()
  const cv = cvs.find((c) => c.id === application.cvId)
  if (cv === undefined) return null
  return (
    <>
      <span>{t('row.cvName', { name: cv.name })}</span>
      {fileStatus(cv) === 'missing' && <span>{t('cvFile.missing')}</span>}
    </>
  )
}

/** "Öppna CV", only when the linked CV has a file this browser can open. */
function OpenCvButton({ application, cvs, onOpenCv }: CvProps) {
  const { t, fileStatus } = useApp()
  const cv = cvs.find((c) => c.id === application.cvId)
  if (cv === undefined) return null
  const status = fileStatus(cv)
  if (status !== 'available' && status !== 'unknown') return null
  return (
    <button
      type="button"
      className="btn btn--small"
      aria-label={t('row.actionFor', { action: t('cvFile.open'), company: application.company })}
      onClick={() => onOpenCv(cv)}
    >
      {t('cvFile.open')}
    </button>
  )
}

const REPLY_TEXT = {
  no_reply_yet: 'reply.none',
  replied: 'reply.received',
  follow_up: 'reply.followUp',
} as const

/** A quiet dot and text, never a filled pill. The text carries the meaning; the dot is decoration. */
function Reply({ kind }: { kind: Exclude<ReplyKind, 'none'> }) {
  const { t } = useApp()
  return (
    <span className={`reply reply--${kind}`}>
      <span className={`dot dot--${kind === 'no_reply_yet' ? 'none' : kind}`} aria-hidden="true" />
      {t(REPLY_TEXT[kind])}
    </span>
  )
}

interface ToApplyRowProps extends CvProps {
  onApplied: () => void
  onMenu: (action: MenuAction) => void
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
            <CvName application={application} cvs={cvs} />
          </p>
        )}
      </div>
      <div className="row__actions">
        <OpenCvButton application={application} cvs={cvs} onOpenCv={onOpenCv} />
        <button
          type="button"
          id={`apply-${application.id}`}
          className="btn btn--primary"
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

interface AppliedRowProps extends CvProps {
  now: string
  reminderDays: number
  onMenu: (action: MenuAction) => void
}

/** Rows in the applied, interview and offer tabs. */
export function AppliedRow({ application, cvs, now, reminderDays, onMenu, onOpenCv }: AppliedRowProps) {
  const { t, language } = useApp()
  // The same day count the reminder uses: local calendar days (see needsFollowUp).
  const days = application.appliedAt === undefined ? null : daysSince(application.appliedAt, now)
  const when =
    days === null ? null : new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-days, 'day')
  const reply = replyIndicator(application, now, reminderDays)
  const stage = application.status === 'interview' || application.status === 'offer' ? t(`status.${application.status}`) : null
  const whenText = when === null ? null : t('row.appliedWhen', { when })
  const statusLine = [stage, whenText].filter((part): part is string => part !== null).join(' · ') || t('status.applied')

  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} />
        <p className="row__meta">
          <span className="row__status">
            <span className="dot dot--status" aria-hidden="true" />
            <span>{statusLine}</span>
          </span>
          {application.url !== '' && <HostLink url={application.url} />}
          <CvName application={application} cvs={cvs} />
        </p>
      </div>
      <div className="row__actions">
        {reply !== 'none' && <Reply kind={reply} />}
        <OpenCvButton application={application} cvs={cvs} onOpenCv={onOpenCv} />
        <RowMenu application={application} onAction={onMenu} />
      </div>
    </li>
  )
}

interface ClosedRowProps extends CvProps {
  onReopen: () => void
  onMenu: (action: MenuAction) => void
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
          <CvName application={application} cvs={cvs} />
        </p>
      </div>
      <div className="row__actions">
        <OpenCvButton application={application} cvs={cvs} onOpenCv={onOpenCv} />
        {buttons.map((button, i) => (
          <button
            key={i}
            type="button"
            id={i === 0 ? `reopen-${application.id}` : undefined}
            className="btn btn--small"
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
