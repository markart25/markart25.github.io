// ---------------------------------------------------------------------------
// Build-time data layer.
//
// Tries the live GitHub API first (in GitHub Actions this is authenticated
// with the workflow's GITHUB_TOKEN, so it never rate-limits). If the API is
// unreachable — school wifi, rate limits, offline — it falls back to the
// bundled snapshot in src/data/snapshot.json so the site still builds.
//
// Every public, non-fork repo automatically gets a card + its own page.
// ---------------------------------------------------------------------------
import { SITE } from '../config';
import snapshot from '../data/snapshot.json';

export interface Project {
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
  readme: string;
}

const API = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'markfolio-build',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (token) headers.Authorization = `Bearer ${token}`;

const gh = (path: string, accept?: string) =>
  fetch(API + path, { headers: accept ? { ...headers, Accept: accept } : headers });

/** Total commits on the default branch, via the Link pagination header. */
function commitsFromLink(link: string | null): number | null {
  const m = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return m ? parseInt(m[1], 10) : null;
}

// The repo this site itself lives in (set by Actions) — never list it.
const selfRepo = (process.env.GITHUB_REPOSITORY ?? '').split('/')[1] ?? '';

function isExcluded(name: string, fork: boolean): boolean {
  if (fork && SITE.excludeForks) return true;
  if ((SITE.excludeRepos as readonly string[]).includes(name)) return true;
  if (selfRepo && name.toLowerCase() === selfRepo.toLowerCase()) return true;
  return false;
}

async function fromApi(): Promise<Project[]> {
  const res = await gh(`/users/${SITE.username}/repos?per_page=100&type=owner&sort=pushed`);
  if (!res.ok) throw new Error(`repo list: HTTP ${res.status}`);
  const list = (await res.json()) as any[];
  const repos = list.filter((r) => !isExcluded(r.name, r.fork));

  return Promise.all(
    repos.map(async (r): Promise<Project> => {
      let commits = 1;
      try {
        const cr = await gh(`/repos/${SITE.username}/${r.name}/commits?per_page=1`);
        if (cr.ok) commits = commitsFromLink(cr.headers.get('link')) ?? ((await cr.json()) as any[]).length;
      } catch { /* keep default */ }

      let readme = '';
      try {
        const rr = await gh(`/repos/${SITE.username}/${r.name}/readme`, 'application/vnd.github.raw+json');
        if (rr.ok) readme = await rr.text();
      } catch { /* repo without a README is fine */ }

      return {
        name: r.name,
        description: r.description ?? '',
        html_url: r.html_url,
        stars: r.stargazers_count ?? 0,
        forks: r.forks_count ?? 0,
        commits,
        language: r.language ?? null,
        topics: r.topics ?? [],
        pushed_at: r.pushed_at ?? null,
        homepage: r.homepage || null,
        archived: !!r.archived,
        readme,
      };
    }),
  );
}

function fromSnapshot(): Project[] {
  return (snapshot.repos as any[])
    .filter((r) => !isExcluded(r.name, r.fork))
    .map((r) => ({
      name: r.name,
      description: r.description ?? '',
      html_url: r.html_url,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      commits: r.commits ?? 1,
      language: r.language ?? null,
      topics: r.topics ?? [],
      pushed_at: r.pushed_at ?? null,
      homepage: r.homepage || null,
      archived: !!r.archived,
      readme: r.readme ?? '',
    }));
}

let cache: Project[] | null = null;

export async function getProjects(): Promise<Project[]> {
  if (cache) return cache;
  try {
    cache = await fromApi();
    console.log(`[github] live API: ${cache.length} repos${token ? ' (authenticated)' : ''}`);
  } catch (e) {
    console.warn(`[github] live fetch failed (${(e as Error).message}) — building from bundled snapshot`);
    cache = fromSnapshot();
  }
  return cache;
}

// ---- custom cover images -------------------------------------------------
// Drop an image at public/covers/<repo>.<ext> to override that project's
// picture (card + repo page). Anything without one falls back to GitHub's
// auto-generated social preview. Matching is case-insensitive on the repo name.
import fs from 'node:fs';
import path from 'node:path';

const COVER_DIR = path.resolve('public/covers');
const COVER_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];

function coverFor(name: string): string | null {
  if (!fs.existsSync(COVER_DIR)) return null;
  const files = fs.readdirSync(COVER_DIR);
  const hit = files.find((f) => {
    const ext = f.split('.').pop()?.toLowerCase() ?? '';
    const stem = f.slice(0, -(ext.length + 1)).toLowerCase();
    return COVER_EXTS.includes(ext) && stem === name.toLowerCase();
  });
  return hit ? hit : null;
}

/** GitHub's social-preview URL — the default when no custom cover exists. */
export const githubPreview = (name: string) =>
  `https://opengraph.githubassets.com/1/${SITE.username}/${name}`;

/**
 * The image to show for a repo. Returns a site-relative path for custom
 * covers (so it respects the base path) or the GitHub preview URL otherwise.
 */
export function coverImage(name: string, base: string): string {
  const file = coverFor(name);
  return file ? `${base}/covers/${file}` : githubPreview(name);
}

/** Same list without README bodies, plus a resolved cover — for the grid island. */
export async function getProjectCards(base = '') {
  return (await getProjects()).map(({ readme, ...card }) => ({
    ...card,
    cover: coverImage(card.name, base),
  }));
}
