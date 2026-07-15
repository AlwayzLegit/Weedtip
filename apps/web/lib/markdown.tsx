import { Fragment, type ReactNode } from 'react';

/**
 * A deliberately tiny, safe Markdown subset renderer for owner-authored copy
 * (listing descriptions). It builds React elements directly — it NEVER injects
 * raw HTML (no dangerouslySetInnerHTML), so there is no XSS surface and no need
 * for a sanitizer or an external dependency.
 *
 * Supported: paragraphs (blank-line separated), bullet lists (`- ` / `* `),
 * **bold**, *italic* / _italic_, and [links](https://…) (http/https only).
 * Anything else renders as literal text.
 */

// Matches the first inline token: bold, italic (* or _), or a link.
const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(_([^_\n]+)_)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    const m = INLINE_RE.exec(rest);
    if (!m || m.index === undefined) {
      nodes.push(rest);
      break;
    }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (m[1]) nodes.push(<strong key={`${keyPrefix}${key++}`}>{m[2]}</strong>);
    else if (m[3]) nodes.push(<em key={`${keyPrefix}${key++}`}>{m[4]}</em>);
    else if (m[5]) nodes.push(<em key={`${keyPrefix}${key++}`}>{m[6]}</em>);
    else if (m[7])
      nodes.push(
        <a
          key={`${keyPrefix}${key++}`}
          href={m[9]}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-primary hover:underline"
        >
          {m[8]}
        </a>,
      );
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

type Block = { type: 'p'; lines: string[] } | { type: 'ul'; items: string[] };

export function renderMarkdown(text: string): ReactNode {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', lines: para });
    para = [];
  };
  const flushList = () => {
    if (list && list.length) blocks.push({ type: 'ul', items: list });
    list = null;
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (/^[-*]\s+/.test(t)) {
      flushPara();
      (list ??= []).push(t.replace(/^[-*]\s+/, ''));
    } else if (t === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(t);
    }
  }
  flushPara();
  flushList();

  return (
    <>
      {blocks.map((b, bi) =>
        b.type === 'ul' ? (
          <ul key={bi} className="mt-2 list-disc space-y-1 pl-5 first:mt-0">
            {b.items.map((it, ii) => (
              <li key={ii}>{renderInline(it, `${bi}-${ii}-`)}</li>
            ))}
          </ul>
        ) : (
          <p key={bi} className="mt-3 first:mt-0">
            {b.lines.map((ln, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(ln, `${bi}-${li}-`)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </>
  );
}

/** Flatten Markdown to plain text for meta descriptions / JSON-LD. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((?:https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
