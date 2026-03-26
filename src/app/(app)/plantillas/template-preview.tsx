'use client';

type Props = {
  id?: string;
  html: string;
  title: string;
  subtitle?: string;
};

export function TemplatePreview({ id, html, title, subtitle }: Props) {
  return (
    <section className="card stack-sm" id={id}>
      <h3>{title}</h3>
      {subtitle ? <p className="text-muted">{subtitle}</p> : null}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
        <iframe
          srcDoc={html}
          style={{ width: '100%', minHeight: 600, border: 'none', display: 'block' }}
          title={title}
          sandbox="allow-same-origin"
        />
      </div>
    </section>
  );
}
