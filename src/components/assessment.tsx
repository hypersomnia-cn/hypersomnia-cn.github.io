'use client';
import { useEffect, useRef } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { Question, Scale } from '@/lib/schema';
import { score, validateAnswers } from '@/lib/scoring';
import { LocaleLink, useLanguage } from './language';
import { useAssessmentForm } from './use-assessment-form';
import { Button } from './ui/button';
import Link from 'next/link';
import type { ReactNode } from 'react';
export function Assessment({
  scale,
  backlinks = [],
  description,
}: {
  scale: Scale;
  backlinks?: { key: string; title: string; route: string; locale: string }[];
  description?: ReactNode;
}) {
  const { lang } = useLanguage();
  const t = useTranslations('assessment');
  const tSite = useTranslations('site');
  const tContent = useTranslations('content');
  const format = useFormatter();
  const { form, result, errors, setResult, setErrors } = useAssessmentForm(scale, lang);
  const { register, watch, reset } = form;
  const answers = watch();
  const resultRef = useRef<HTMLElement>(null);
  const questions = scale.sections.flatMap((s) => s.questions);
  const mandatory = questions.filter((q) => q.required);
  const answered = mandatory.filter(
    (q) => answers[q.id] != null && answers[q.id] !== '' && String(answers[q.id]).trim(),
  ).length;
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);
  const focusQuestion = (id: string) => {
    const el = document.getElementById(`field-${id}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const input = el?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
    input?.focus({ preventScroll: true });
  };
  const submit = form.handleSubmit((values) => {
    const next = validateAnswers(scale, values);
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => focusQuestion(Object.keys(next)[0]));
      return;
    }
    setResult(score(scale, values));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  const renderQuestion = (q: Question) => (
    <fieldset
      id={`field-${q.id}`}
      key={q.id}
      className={`question ${errors[q.id] ? 'question-error' : ''}`}
      aria-describedby={
        [q.help ? `help-${q.id}` : '', errors[q.id] ? `error-${q.id}` : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      <legend>
        {q.label[lang]}
        {!q.required && <span className="optional">{t('optional')}</span>}
      </legend>
      {q.help && (
        <p className="field-help" id={`help-${q.id}`}>
          {q.help[lang]}
        </p>
      )}
      {q.type === 'choice' ? (
        <div className={`options ${q.options!.length === 7 ? 'options-seven' : ''}`}>
          {q.options!.map((o) => (
            <label key={o.id} className={`option ${answers[q.id] === o.id ? 'selected' : ''}`}>
              <input type="radio" value={o.id} {...register(q.id)} aria-invalid={!!errors[q.id]} />
              <span>{o.label[lang]}</span>
            </label>
          ))}
        </div>
      ) : q.type === 'text' ? (
        <textarea
          aria-label={q.label[lang]}
          aria-invalid={!!errors[q.id]}
          {...register(q.id)}
          rows={2}
          maxLength={2000}
        />
      ) : (
        <input
          className="text-input"
          aria-label={q.label[lang]}
          aria-invalid={!!errors[q.id]}
          type={q.type}
          {...register(q.id)}
          min={q.min}
          max={q.max}
          step={q.step}
          inputMode={q.type === 'number' ? 'decimal' : undefined}
        />
      )}{' '}
      {errors[q.id] && (
        <p id={`error-${q.id}`} className="field-error">
          {t(errors[q.id])}
        </p>
      )}
    </fieldset>
  );
  const band = result ? scale.bands.find((b) => b.id === result.interpretationId)! : null;
  return (
    <main id="main" className="assessment-main">
      <LocaleLink href="/" className="back-link">
        {t('all')}
      </LocaleLink>
      <section className="assessment-heading">
        <h1>{scale.title[lang]}</h1>
        <p className="scale-description">{description ?? scale.description[lang]}</p>
        <div className="assessment-meta">
          <span>{tSite('estimatedTime', { value: scale.duration[lang] })}</span>
          <span>{tSite('recallPeriod', { value: scale.recall[lang] })}</span>
        </div>
      </section>
      {result && band ? (
        <section
          className="result-panel"
          tabIndex={-1}
          ref={resultRef}
          aria-labelledby="result-title"
        >
          <h2 id="result-title">{t('result')}</h2>
          <div className="score-display">
            <div>
              <span className="score-label">{scale.scoreLabel[lang]}</span>
              <strong data-testid="score">
                {format.number(
                  result.mean ?? result.total,
                  result.mean !== undefined
                    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                    : { maximumFractionDigits: 0 },
                )}
              </strong>
              <span className="score-range"> / {scale.range[1]}</span>
            </div>
            {result.mean !== undefined && (
              <p>
                {t('total')} {format.number(result.total)} / {scale.totalRange?.[1]}
              </p>
            )}
          </div>
          <h3>{band.title[lang]}</h3>
          <p>{band.explanation[lang]}</p>
          <p className="interpretation-note">{scale.interpretationNote[lang]}</p>
          {Object.keys(result.components).length > 0 && (
            <div className="components">
              <h3>{t('components')}</h3>
              {Object.entries(result.components).map(([id, n]) => (
                <div className="component" key={id}>
                  <span>{scale.components![id][lang]}</span>
                  <span className="component-track" aria-hidden="true">
                    <i style={{ width: `${(n / 3) * 100}%` }} />
                  </span>
                  <strong>{n} / 3</strong>
                </div>
              ))}
            </div>
          )}
          <div className="advice">
            <h3>{t('advice')}</h3>
            <p>{band.advice[lang]}</p>
          </div>
          <div className="notice">
            <p>{scale.disclaimer[lang]}</p>
          </div>
          <div className="result-actions">
            <Button
              onClick={() => {
                setResult(null);
                setErrors({});
                requestAnimationFrame(() => focusQuestion(questions[0].id));
              }}
              variant="outline"
            >
              {t('edit')}
            </Button>
            <Button
              onClick={() => {
                reset({});
                setErrors({});
                setResult(null);
                requestAnimationFrame(() => focusQuestion(questions[0].id));
              }}
              variant="ghost"
            >
              {t('reset')}
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className="instructions">
            <h2>{t('instructions')}</h2>
            <p>{scale.instructions[lang]}</p>
          </div>
          <div className="progress-info">
            <span>{t('progress')}</span>
            <span>
              {answered} / {mandatory.length}
            </span>
            <progress value={answered} max={mandatory.length} aria-label={t('progressLabel')} />
          </div>
          <form onSubmit={submit} noValidate autoComplete="off">
            {Object.keys(errors).length > 0 && (
              <div role="alert" className="error-summary">
                <h2>{t('errors')}</h2>
                <ul>
                  {Object.entries(errors).map(([id, message]) => (
                    <li key={id}>
                      <button type="button" onClick={() => focusQuestion(id)}>
                        {questions.find((q) => q.id === id)!.label[lang]}: {t(message)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scale.sections.map((s) => (
              <section key={s.id} className="question-section" aria-labelledby={`section-${s.id}`}>
                <h2 id={`section-${s.id}`}>{s.title[lang]}</h2>
                {s.description && <p className="section-description">{s.description[lang]}</p>}
                {s.questions.map(renderQuestion)}
              </section>
            ))}
            <div className="submit-area">
              <p>{scale.disclaimer[lang]}</p>
              <Button type="submit">{t('viewResult')}</Button>
            </div>
          </form>
        </>
      )}
      <aside className="sources">
        <h2>{t('references')}</h2>
        <ul>
          {scale.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title[lang]}
              </a>
            </li>
          ))}
        </ul>
      </aside>
      {backlinks.length > 0 && (
        <aside className="content-backlinks">
          <h2>{tContent('backlinks')}</h2>
          <ul>
            {backlinks.map((page) => (
              <li key={page.key}>
                <Link href={page.route} prefetch={false}>
                  {page.title}
                  {page.locale !== lang ? ` (${page.locale === 'zh' ? '中文' : 'English'})` : ''}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  );
}
