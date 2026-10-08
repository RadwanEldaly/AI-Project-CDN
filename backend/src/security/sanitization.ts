import { marked } from 'marked';

/**
 * Strips script tags, style tags, dangerous elements, event handlers, and javascript: links
 * to protect against stored and reflected Cross-Site Scripting (XSS).
 */
export function sanitizeUserHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let sanitized = html;

  // 1. Remove dangerous blocks: <script>...</script>, <style>...</style>, <iframe>...</iframe>, <object>...</object>, <embed>...</embed>
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

  // 2. Remove dangerous standalone tags
  sanitized = sanitized.replace(/<\/?(?:script|style|iframe|object|embed|form|input|button|svg|base|link|meta)\b[^>]*>/gi, '');

  // 3. Remove inline JavaScript event handlers (e.g. onload=, onclick=, onerror=, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 4. Remove dangerous protocol schemes (javascript:, vbscript:, data: for non-images)
  sanitized = sanitized.replace(/href\s*=\s*(['"]?)\s*(?:javascript|vbscript|data):[^'">]*\1/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*(['"]?)\s*(?:javascript|vbscript):[^'">]*\1/gi, 'src="#"');

  // 5. Ensure all <a> tags have safe rel and target attributes
  sanitized = sanitized.replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
    let cleanAttrs = attrs.replace(/\s+rel\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
    cleanAttrs = cleanAttrs.replace(/\s+target\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
    return `<a${cleanAttrs} target="_blank" rel="noopener noreferrer nofollow">`;
  });

  return sanitized.trim();
}

/**
 * Parses markdown to HTML and sanitizes it against XSS vectors
 */
export function renderAndSanitizeMarkdown(markdownText: string): string {
  if (!markdownText || typeof markdownText !== 'string') return '';
  const rawHtml = marked.parse(markdownText, { async: false }) as string;
  return sanitizeUserHtml(rawHtml);
}
