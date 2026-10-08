import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'p', 'a', 'ul', 'ol', 'li',
  'b', 'i', 'strong', 'em', 'strike', 'code', 'pre', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'span',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'],
    pre: ['class'],
    span: ['class'],
    th: ['align'],
    td: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  transformTags: {
    a: (tagName, attribs) => {
      // Force safe rel attributes on links
      return {
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      };
    },
  },
};

/**
 * Parses markdown to HTML and sanitizes it against XSS vectors
 */
export function renderAndSanitizeMarkdown(markdownText: string): string {
  const rawHtml = marked.parse(markdownText, { async: false }) as string;
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

/**
 * Sanitizes an already rendered HTML string
 */
export function sanitizeUserHtml(htmlString: string): string {
  return sanitizeHtml(htmlString, SANITIZE_OPTIONS);
}
