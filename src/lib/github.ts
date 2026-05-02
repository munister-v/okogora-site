const REPO_OWNER = 'munister-v';
const REPO_NAME = 'okogora';
const POSTS_PATH = 'public/data/posts.json';

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
