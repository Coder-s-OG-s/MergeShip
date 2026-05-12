/**
 * Fire a mock GitHub webhook at the local dev server. Lets contributors test
 * the full merge → XP → level-up loop without a real GitHub App install.
 *
 * Usage:
 *   pnpm sim:webhook pr-merged --handle bob --repo demo/sample --pr 123
 *   pnpm sim:webhook review     --handle dave --pr-url https://github.com/demo/sample/pull/123
 */

import crypto from 'node:crypto';

const WEBHOOK_URL = process.env.WEBHOOK_URL ?? 'http://localhost:3001/api/webhooks/github';
const SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? 'dev-secret';

type Args = Record<string, string>;
function parseArgs(): { event: string; flags: Args } {
  const [event, ...rest] = process.argv.slice(2);
  if (!event) {
    console.error('usage: sim-webhook <pr-merged|review|install> [--key value...]');
    process.exit(1);
  }
  const flags: Args = {};
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i]?.replace(/^--/, '');
    const v = rest[i + 1];
    if (k && v) flags[k] = v;
  }
  return { event, flags };
}

function sign(body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

async function send(event: string, payload: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify(payload);
  const deliveryId = crypto.randomUUID();
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': sign(body),
      'x-github-delivery': deliveryId,
      'x-github-event': event,
    },
    body,
  });
  console.warn(`-> ${event} (delivery ${deliveryId.slice(0, 8)}): ${res.status}`);
  console.warn(await res.text());
}

const { event, flags } = parseArgs();

async function main(): Promise<void> {
  switch (event) {
    case 'pr-merged': {
      const handle = flags['handle'] ?? 'bob';
      const repo = flags['repo'] ?? 'demo/sample-repo';
      const prNumber = Number(flags['pr'] ?? '1');
      await send('pull_request', {
        action: 'closed',
        pull_request: {
          number: prNumber,
          html_url: `https://github.com/${repo}/pull/${prNumber}`,
          title: 'mock: merged PR',
          body: 'closes #1',
          merged: true,
          merged_at: new Date().toISOString(),
          user: { login: handle },
          base: { repo: { full_name: repo } },
        },
      });
      break;
    }
    case 'pr-opened': {
      const handle = flags['handle'] ?? 'bob';
      const repo = flags['repo'] ?? 'demo/sample-repo';
      const prNumber = Number(flags['pr'] ?? '1');
      const issueRef = flags['issue'] ?? '1';
      await send('pull_request', {
        action: 'opened',
        pull_request: {
          number: prNumber,
          html_url: `https://github.com/${repo}/pull/${prNumber}`,
          title: `mock PR for #${issueRef}`,
          body: `closes #${issueRef}`,
          merged: false,
          merged_at: null,
          user: { login: handle },
          base: { repo: { full_name: repo } },
        },
      });
      break;
    }
    case 'review': {
      const reviewer = flags['handle'] ?? 'dave';
      const prUrl = flags['pr-url'] ?? 'https://github.com/demo/sample-repo/pull/1';
      const repo = prUrl.split('/').slice(3, 5).join('/');
      const prNumber = Number(prUrl.split('/').pop());
      await send('pull_request_review', {
        action: 'submitted',
        review: {
          id: Math.floor(Math.random() * 1_000_000),
          user: { login: reviewer },
          body: 'Looked at this — I think the empty-array case still needs handling, otherwise LGTM.',
          state: 'changes_requested',
          submitted_at: new Date().toISOString(),
        },
        pull_request: {
          html_url: prUrl,
          number: prNumber,
          user: { login: flags['author'] ?? 'bob' },
          base: { repo: { full_name: repo } },
        },
      });
      break;
    }
    case 'install': {
      const handle = flags['handle'] ?? 'alice';
      const installId = Number(flags['id'] ?? `${Math.floor(Math.random() * 100000)}`);
      await send('installation', {
        action: 'created',
        installation: {
          id: installId,
          account: { login: handle, type: 'User' },
          repository_selection: 'all',
        },
        repositories: [{ full_name: `${handle}/sample` }],
      });
      break;
    }
    default:
      console.error(`unknown event: ${event}`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
