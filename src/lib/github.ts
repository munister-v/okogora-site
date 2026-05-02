const REPO_OWNER = 'munister-v';
const REPO_NAME = 'okogora';
const POSTS_PATH = 'public/data/posts.json';
const TG_SYNC_WORKFLOW_ID = 'sync-telegram-posts.yml';

export interface GithubAuth {
  token: string;
  username: string;
}

export async function verifyToken(token: string): Promise<string | null> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.login;
}

async function getFileSha(token: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${POSTS_PATH}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Cannot fetch file SHA');
  const data = await res.json();
  return data.sha;
}

export async function savePosts(token: string, posts: object[]): Promise<void> {
  const sha = await getFileSha(token);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(posts, null, 2))));
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${POSTS_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `content: update posts [admin]`,
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
