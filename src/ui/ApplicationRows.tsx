import {
  accessibleTitle,
  daysSince,
  notePreview,
  openableLink,
  replyIndicator,
  titleParts,
  type Application,
  type Cv,
  type ReplyIndicator as ReplyKind,
} from '../domain'
import { useApp } from '../state/AppContext'
import { RowMenu, type MenuAction } from './RowMenu'

/**
 * The visible title: the company, or a muted "Company missing" with a button to fill it in.
 * The stored role follows; with neither company nor role a muted "Role missing" does. The
 * website name and the link's path hint are never shown, only read out in accessible names.
 */
function RowTitle({ application, onAddCompany }: { application: Application; onAddCompany: () => void }) {
  const { t } = useApp()
  const { company } = titleParts(application)
  return (
    <p className="row__title">
      {company !== null ? (
        <strong>{company}</strong>
      ) : (
        <strong className="row__missing">{t('row.companyMissing')}</strong>
      )}
      {application.role !== '' && <span className="row__role"> · {application.role}</span>}
      {company === null && application.role === '' && (
        <span className="row__missing"> · {t('row.roleMissing')}</span>
      )}
      {company === null && (
        <button
          type="button"
          className="btn btn--text row__add-company"
          aria-label={t('row.actionFor', { action: t('row.addCompany'), company: accessibleTitle(application) })}
          onClick={onAddCompany}
        >
          {t('row.addCompany')}
        </button>
      )}
    </p>
  )
}

/** "Added 8 Oct", shown on every row in the To apply tab only. */
function AddedOn({ application }: { application: Application }) {
  const { t, language } = useApp()
  const added = new Date(application.createdAt)
  if (Number.isNaN(added.getTime())) return null
  const date = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(added)
  return <span>{t('row.addedOn', { date })}</span>
}

/** "Application": the saved link, in a new tab. Only an http(s) link is ever used as an href. */
function ApplicationLink({ application }: { application: Application }) {
  const { t } = useApp()
  const href = openableLink(application.url)
  if (href === null) return null
  return (
    <a
      className="row__link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('row.applicationLinkOpens', { name: accessibleTitle(application) })}
    >
      {t('row.applicationLink')}
      <span className="row__link-mark" aria-hidden="true">
        ↗
      </span>
    </a>
  )
}

interface CvProps {
  application: Application
  cvs: readonly Cv[]
  onOpenCv: (cv: Cv) => void
}

/** The name of the CV linked to the application. A missing file is explained in the CV card. */
function CvName({ application, cvs }: Pick<CvProps, 'application' | 'cvs'>) {
  const { t } = useApp()
  const cv = cvs.find((c) => c.id === application.cvId)
  if (cv === undefined) return null
  return <span>{t('row.cvName', { name: cv.name })}</span>
}

interface NoteProps {
  onShowNote: (application: Application) => void
}

/**
 * A short preview of the notes, as plain text, and a button for the whole note when there is more.
 * The hidden prefix says what the text is; the ellipsis is only a visual cue.
 */
function NotePreview({ application, onShowNote }: { application: Application } & NoteProps) {
  const { t } = useApp()
  const preview = notePreview(application.notes)
  if (preview === null) return null
  return (
    <p className="row__note">
      <span className="sr-only">{t('row.notePrefix')} </span>
      <span className="row__note-text">{preview.text}</span>
      {preview.truncated && <span aria-hidden="true">…</span>}
      {preview.hasMore && (
        <>
          {' '}
          <button
            type="button"
            className="btn btn--text"
            aria-label={t('row.actionFor', { action: t('note.showFull'), company: accessibleTitle(application) })}
            onClick={() => onShowNote(application)}
          >
            {t('note.showAll')}
          </button>
        </>
      )}
    </p>
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
      aria-label={t('row.actionFor', { action: t('cvFile.open'), company: accessibleTitle(application) })}
      onClick={() => onOpenCv(cv)}
    >
      {t('cvFile.open')}
    </button>
  )
}

const REPLY_TEXT = {
  no_reply_yet: 'reply.none',
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

interface ToApplyRowProps extends CvProps, NoteProps {
  onApplied: () => void
  onMenu: (action: MenuAction) => void
}

export function ToApplyRow({ application, cvs, onApplied, onMenu, onOpenCv, onShowNote }: ToApplyRowProps) {
  const { t } = useApp()
  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} onAddCompany={() => onMenu('edit')} />
        <p className="row__meta">
          <ApplicationLink application={application} />
          <CvName application={application} cvs={cvs} />
          <AddedOn application={application} />
        </p>
        <NotePreview application={application} onShowNote={onShowNote} />
      </div>
      <div className="row__actions">
        <OpenCvButton application={application} cvs={cvs} onOpenCv={onOpenCv} />
        <button
          type="button"
          id={`apply-${application.id}`}
          className="btn btn--primary"
          aria-label={t('row.actionFor', { action: t('row.markApplied'), company: accessibleTitle(application) })}
          onClick={onApplied}
        >
          {t('row.markApplied')}
        </button>
        <RowMenu application={application} onAction={onMenu} />
      </div>
    </li>
  )
}

interface AppliedRowProps extends CvProps, NoteProps {
  now: string
  reminderDays: number
  onMenu: (action: MenuAction) => void
}

/** Rows in the applied, interview and offer tabs. */
export function AppliedRow({ application, cvs, now, reminderDays, onMenu, onOpenCv, onShowNote }: AppliedRowProps) {
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
        <RowTitle application={application} onAddCompany={() => onMenu('edit')} />
        <p className="row__meta">
          <span className="row__status">
            <span className="dot dot--status" aria-hidden="true" />
            <span>{statusLine}</span>
          </span>
          <ApplicationLink application={application} />
          <CvName application={application} cvs={cvs} />
        </p>
        <NotePreview application={application} onShowNote={onShowNote} />
      </div>
      <div className="row__actions">
        {reply !== 'none' && <Reply kind={reply} />}
        <OpenCvButton application={application} cvs={cvs} onOpenCv={onOpenCv} />
        <RowMenu application={application} onAction={onMenu} />
      </div>
    </li>
  )
}

interface ClosedRowProps extends CvProps, NoteProps {
  onReopen: () => void
  onMenu: (action: MenuAction) => void
}

export function ClosedRow({ application, cvs, onReopen, onMenu, onOpenCv, onShowNote }: ClosedRowProps) {
  const { t } = useApp()
  const company = accessibleTitle(application)
  const reason = application.closedReason === undefined ? null : t(`closedReason.${application.closedReason}`)
  const buttons: { label: string; onClick: () => void }[] = [
    { label: t('menu.reopen'), onClick: onReopen },
    { label: t('menu.edit'), onClick: () => onMenu('edit') },
    { label: t('menu.delete'), onClick: () => onMenu('delete') },
  ]
  return (
    <li className="row">
      <div className="row__main">
        <RowTitle application={application} onAddCompany={() => onMenu('edit')} />
        <p className="row__meta">
          {reason !== null && <span>{t('row.closedWithReason', { reason })}</span>}
          <CvName application={application} cvs={cvs} />
        </p>
        <NotePreview application={application} onShowNote={onShowNote} />
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
