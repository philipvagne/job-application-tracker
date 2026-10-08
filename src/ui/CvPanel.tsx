import type { ReactNode } from 'react'
import { applicationsUsingCv, type Application, type Cv } from '../domain'
import { formatFileSize } from '../i18n'
import { useApp } from '../state/AppContext'

export const CV_ADD_BUTTON_ID = 'cv-add-button'

interface CvPanelProps {
  cvs: readonly Cv[]
  applications: readonly Application[]
  onAdd: () => void
  onOpenCv: (cv: Cv) => void
  /** The inline form for a new CV, when it is open. */
  form: ReactNode
}

/** The "My CVs" card: a read-only list with a button to add one. No edit or delete. */
export function CvPanel({ cvs, applications, onAdd, onOpenCv, form }: CvPanelProps) {
  const { t, language, fileStatus } = useApp()
  const plural = new Intl.PluralRules(language)

  return (
    <section className="card" aria-labelledby="cv-panel-title">
      <div className="cvpanel__head">
        <h2 id="cv-panel-title" className="label">
          {t('cvPanel.title')}
        </h2>
        <button type="button" id={CV_ADD_BUTTON_ID} className="btn btn--small" onClick={onAdd}>
          {t('cvPanel.add')}
        </button>
      </div>
      <p className="hint">{t('cvPanel.help')}</p>
      {form}
      {cvs.length === 0 ? (
        <p className="hint">{t('cvPanel.empty')}</p>
      ) : (
        <ul className="cvlist">
          {cvs.map((cv) => {
            const count = applicationsUsingCv(applications, cv.id)
            const used = t(plural.select(count) === 'one' ? 'cvPanel.usedOne' : 'cvPanel.usedOther', { count })
            const status = fileStatus(cv)
            const first =
              cv.file === undefined
                ? t('cvPanel.noFile')
                : t('cvPanel.pdf', { size: formatFileSize(cv.file.size, language) })
            return (
              <li key={cv.id} className="cvlist__item">
                <p className="cvlist__name">{cv.name}</p>
                <p className="cvlist__meta">{`${first} · ${used}`}</p>
                {status === 'missing' && <p className="cvlist__meta">{t('cvFile.missing')}</p>}
                {(status === 'available' || status === 'unknown') && (
                  <button
                    type="button"
                    className="btn btn--text"
                    aria-label={t('cvPanel.openFor', { name: cv.name })}
                    onClick={() => onOpenCv(cv)}
                  >
                    {t('cvPanel.open')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
