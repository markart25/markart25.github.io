/** GitHub's language dot colours (the common ones). */
export const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  'C#': '#178600',
  C: '#555555',
  'C++': '#f34b7d',
  Rust: '#dea584',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  HTML: '#e34c26',
  CSS: '#663399',
  Shell: '#89e051',
  Astro: '#ff5a03',
  Lua: '#000080',
  Go: '#00ADD8',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Dockerfile: '#384d54',
  Vim_Script: '#199f4b',
  Markdown: '#083fa1',
};

export const langColor = (lang: string | null) =>
  (lang && LANG_COLORS[lang]) || 'var(--fg-dim)';

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
