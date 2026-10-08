import type { ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import { CV_ADD_BUTTON_ID } from './CvPanel'

interface WelcomeProps {
  /** The inline CV form when it is open (it replaces the button in step 1), else null. */
  cvForm: ReactNode
  onAddCv: () => void
}

/** The first-visit introduction: what the app is, and three steps. The add card follows it. */
export function Welcome({ cvForm, onAddCv }: WelcomeProps) {
  const { t } = useApp()
  return (
    <section aria-labelledby="welcome-title">
      <h2 id="welcome-title" className="welcome__title">
        {t('welcome.title')}
      </h2>
      <p className="welcome__intro">{t('welcome.intro')}</p>
      <ol className="steps" role="list" aria-label={t('welcome.steps')}>
        <li className="card step">
          <span className="step__number" aria-hidden="true">
            1
          </span>
          <h3 className="step__title">{t('welcome.step1.title')}</h3>
          <p className="step__body">{t('welcome.step1.body')}</p>
          {cvForm === null ? (
            <button type="button" id={CV_ADD_BUTTON_ID} className="btn btn--small" onClick={onAddCv}>
              {t('welcome.step1.button')}
            </button>
          ) : (
            <div className="step__form">{cvForm}</div>
          )}
        </li>
        <li className="card step">
          <span className="step__number" aria-hidden="true">
            2
          </span>
          <h3 className="step__title">{t('welcome.step2.title')}</h3>
          <p className="step__body">{t('welcome.step2.body')}</p>
        </li>
        <li className="card step">
          <span className="step__number" aria-hidden="true">
            3
          </span>
          <h3 className="step__title">{t('welcome.step3.title')}</h3>
          <p className="step__body">{t('welcome.step3.body')}</p>
        </li>
      </ol>
    </section>
  )
}
