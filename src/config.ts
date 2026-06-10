// ---------------------------------------------------------------------------
// The one file you edit. Everything else reacts to it.
// ---------------------------------------------------------------------------
export const SITE = {
  /** GitHub username — repos are pulled from here at every build. */
  username: 'markart25',

  name: 'Mark',
  title: 'markart25 — projects',
  description:
    "Mark's projects, auto-synced from GitHub. Terminal tools, Arch rice, and whatever's cooking.",

  /** Typed out in the hero, after `whoami`. */
  tagline: 'student · arch user · builds terminal tools',

  /**
   * Tech stack icons in the hero — these are skillicons.dev ids.
   * Full list: https://skillicons.dev
   */
  techStack: [
    'python', 'cs', 'rust', 'linux', 'arch', 'bash', 'git',
    'github', 'vscode', 'discord', 'raspberrypi', 'kali', 'pytorch',
  ],
  /** Icons per row before wrapping. */
  techPerLine: 7,

  /**
   * Repos to hide. Forks are excluded automatically, and the repo this site
   * lives in is excluded automatically too — this list is for anything else.
   * (Your profile README repo is here by default.)
   */
  excludeRepos: ['markart25'],
  excludeForks: true,
} as const;
