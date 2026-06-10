import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// In GitHub Actions, GITHUB_REPOSITORY is "owner/repo". We use it to set the
// correct base path automatically:
//   repo named  <user>.github.io  →  served from /
//   any other repo name           →  served from /<repo>/
// Locally (no env var) it falls back to / so `npm run dev` just works.
const [ghOwner, ghRepo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const owner = ghOwner || 'markart25';
const isUserSite = !ghRepo || ghRepo.toLowerCase() === `${owner.toLowerCase()}.github.io`;

export default defineConfig({
  site: `https://${owner.toLowerCase()}.github.io`,
  base: isUserSite ? '/' : `/${ghRepo}`,
  integrations: [react()],
});
