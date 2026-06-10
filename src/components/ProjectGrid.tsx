import { useState } from 'react';

export interface CardData {
  name: string;
  description: string;
  html_url: string;
  stars: number;
  forks: number;
  commits: number;
  language: string | null;
  topics: string[];
  pushed_at: string | null;
  homepage: string | null;
  archived: boolean;
  cover: string;
}

interface Props {
  projects: CardData[];
  /** BASE_URL without trailing slash, so links work on project-page deployments */
  base: string;
  langColors: Record<string, string>;
}

type SortKey = 'commits' | 'stars';

const StarIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
  </svg>
);

const CommitIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
  </svg>
);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function ProjectGrid({ projects, base, langColors }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('commits');

  const sorted = [...projects].sort((a, b) =>
    sortBy === 'stars'
      ? b.stars - a.stars || b.commits - a.commits
      : b.commits - a.commits || b.stars - a.stars,
  );

  return (
    <>
      <div className="sortbar" role="group" aria-label="Sort projects">
        <span>sort_by:</span>
        <span className="opts">
          {(['commits', 'stars'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={sortBy === key ? 'on' : ''}
              aria-pressed={sortBy === key}
              onClick={() => setSortBy(key)}
            >
              {key}
            </button>
          ))}
        </span>
      </div>

      <div className="grid">
        {sorted.map((p) => (
          <a key={p.name} className="card" href={`${base}/p/${p.name}/`}>
            <img
              className="og"
              src={p.cover}
              alt=""
              loading="lazy"
              width={1200}
              height={600}
            />
            <div className="body">
              <h3>
                {p.name}
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </h3>
              <p className="desc">{p.description || 'No description yet.'}</p>
              <div className="meta">
                {p.language && (
                  <span className="item">
                    <span className="dot" style={{ background: langColors[p.language] ?? 'var(--fg-dim)' }} />
                    {p.language}
                  </span>
                )}
                <span className="item" title={`${p.commits} commits`}>
                  <CommitIcon /> {p.commits}
                </span>
                <span className="item" title={`${p.stars} stars`}>
                  <StarIcon /> {p.stars}
                </span>
                <span className="item">{fmtDate(p.pushed_at)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
