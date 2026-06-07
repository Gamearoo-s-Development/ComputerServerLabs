import React from 'react'

/**
 * @param {{
 *   title: string
 *   effectiveDate: string
 *   intro?: string
 *   sections: Array<{
 *     heading: string
 *     paragraphs?: string[]
 *     list?: string[]
 *   }>
 * }} props
 */
export default function LegalDocument({ title, effectiveDate, intro, sections }) {
  return (
    <article className="legal-doc card">
      <header className="legal-doc__header">
        <h1 className="legal-doc__title">{title}</h1>
        <p className="legal-doc__meta">Effective {effectiveDate}</p>
      </header>
      {intro ? <p className="legal-doc__intro">{intro}</p> : null}
      {sections.map((section) => (
        <section key={section.heading} className="legal-doc__section">
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.list?.length ? (
            <ul>
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  )
}
