import type { NextConfig } from 'next';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const basePath =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName
    ? `/${repositoryName}`
    : '';

const nextConfig: NextConfig = {
  // GitHub Pages can only serve static files. The app keeps all quiz state in
  // the browser, so it can be exported without a server.
  output: 'export',
  basePath,
  env: {
    // Plain <img> tags need the repository prefix when Pages serves this site
    // below https://<owner>.github.io/<repository>/.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
