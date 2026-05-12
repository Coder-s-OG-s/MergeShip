import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { cacheGet, cacheSet } from '../cache';

/**
 * Octokit factories. Three flavors:
 *  - getAppOctokit()          App JWT, app-level ops only (list installs)
 *  - getInstallOctokit(id)    Install token, cached 1h, the workhorse for that user's data
 *  - getUserOctokit(token)    User OAuth (sign-in identity ops only)
 *
 * Hard rule: no raw fetch to GitHub anywhere in the codebase.
 */

type AppCreds = {
  appId: string;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
};

function readAppCreds(): AppCreds {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set');
  }
  return {
    appId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
  };
}

export function getAppOctokit(): Octokit {
  const creds = readAppCreds();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId: creds.appId, privateKey: creds.privateKey },
  });
}

/**
 * Mint an installation access token. 1h TTL, cached.
 * Cache key is namespaced so test fixtures stay isolated.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const cacheKey = `gh:install:${installationId}:token`;
  const cached = await cacheGet<{ token: string; expiresAt: number }>(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.token;
  }

  const app = getAppOctokit();
  const res = await app.request('POST /app/installations/{installation_id}/access_tokens', {
    installation_id: installationId,
  });

  const token = res.data.token;
  const expiresAt = new Date(res.data.expires_at).getTime();
  const ttl = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000) - 60);
  await cacheSet(cacheKey, { token, expiresAt }, ttl);
  return token;
}

export async function getInstallOctokit(installationId: number): Promise<Octokit> {
  const token = await getInstallationToken(installationId);
  return new Octokit({ auth: token });
}

export function getUserOctokit(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}
