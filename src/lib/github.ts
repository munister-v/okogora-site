const REPO_OWNER = 'munister-v';
const REPO_NAME = 'okogora';
const POSTS_PATH = 'public/data/posts.json';
const RSS_CONFIG_PATH = 'public/data/rss_twitter_config.json';
const TG_SYNC_WORKFLOW_ID = 'sync-telegram-posts.yml';
const X_RSS_SYNC_WORKFLOW_ID = 'sync-x-rss.yml';
const DEPLOY_WORKFLOW_ID = 'deploy.yml';

export interface GithubAuth {
  token: string;
  username: string;
}

export interface WorkflowRunStatus {
  id: number;
  htmlUrl: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | null | string;
  createdAt: string;
  name: string;
}

export interface RssSyncConfig {
  windowDays: number;
  maxItems: number;
  authors: Array<{ handle: string; name: string }>;
  keywords: string[];
  excludeKeywords: string[];
}

export async function verifyToken(token: string): Promise<string | null> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.login;
}

async function getFileSha(token: string, filePath: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Cannot fetch file SHA');
  const data = await res.json();
  return data.sha;
}

async function saveJsonFile(token: string, filePath: string, payload: unknown, message: string): Promise<void> {
  const sha = await getFileSha(token, filePath);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content,
        sha,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to save');
  }
}

export async function savePosts(token: string, posts: object[]): Promise<void> {
  await saveJsonFile(token, POSTS_PATH, posts, 'content: update posts [admin]');
}

export async function saveRssConfig(token: string, config: RssSyncConfig): Promise<void> {
  await saveJsonFile(token, RSS_CONFIG_PATH, config, 'content: update x rss config [admin]');
}

export async function triggerTelegramSync(
  token: string,
  channelUrl?: string,
  maxPosts = 40
): Promise<void> {
  const inputs: Record<string, string> = {
    max_posts: String(maxPosts),
  };

  if (channelUrl?.trim()) {
    inputs.channel_url = channelUrl.trim();
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${TG_SYNC_WORKFLOW_ID}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs,
      }),
    }
  );

  if (!res.ok) {
    let message = 'Failed to trigger workflow';
    try {
      const err = await res.json();
      message = err.message || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }
}

export async function triggerXRssSync(token: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${X_RSS_SYNC_WORKFLOW_ID}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
      }),
    }
  );

  if (!res.ok) {
    let message = 'Failed to trigger workflow';
    try {
      const err = await res.json();
      message = err.message || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }
}

async function fetchLatestWorkflowRun(token: string, workflowId: string): Promise<WorkflowRunStatus | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflowId}/runs?branch=main&per_page=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error('Failed to fetch workflow status');
  const data = await res.json();
  const run = data?.workflow_runs?.[0];
  if (!run) return null;

  return {
    id: run.id,
    htmlUrl: run.html_url,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    name: run.name,
  };
}

export async function fetchWorkflowDashboard(token: string): Promise<{
  sync: WorkflowRunStatus | null;
  xRssSync: WorkflowRunStatus | null;
  deploy: WorkflowRunStatus | null;
}> {
  const [sync, xRssSync, deploy] = await Promise.all([
    fetchLatestWorkflowRun(token, TG_SYNC_WORKFLOW_ID),
    fetchLatestWorkflowRun(token, X_RSS_SYNC_WORKFLOW_ID),
    fetchLatestWorkflowRun(token, DEPLOY_WORKFLOW_ID),
  ]);

  return { sync, xRssSync, deploy };
}
