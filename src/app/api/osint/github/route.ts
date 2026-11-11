
import { fetchJson, errorResponse } from '@/lib/sb-fetch';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = url.searchParams.get('username')?.trim() || '';
  if (!username) return errorResponse('Missing ?username=', 400);
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return errorResponse('Invalid GitHub username', 400);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/vnd.github+json',
  };
  const [user, repos] = await Promise.all([
    fetchJson<any>(`https://api.github.com/users/${encodeURIComponent(username)}`, { timeout: 8000, headers }),
    fetchJson<any>(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=10&sort=updated`, { timeout: 8000, headers }),
  ]);

  if (!user) {
    return errorResponse('GitHub API unreachable (rate-limited or network error)', 503);
  }
  if (user.message === 'Not Found') {
    return errorResponse('GitHub user not found', 404);
  }
  if (user.message && user.message.includes('rate limit')) {
    return errorResponse('GitHub API rate limit exceeded (60/hr per IP unauthenticated). Try later or set GITHUB_TOKEN.', 429);
  }

  return Response.json({
    username,
    profile: {
      name: user.name,
      bio: user.bio,
      company: user.company,
      location: user.location,
      blog: user.blog,
      public_repos: user.public_repos,
      public_gists: user.public_gists,
      followers: user.followers,
      following: user.following,
      created_at: user.created_at,
      updated_at: user.updated_at,
      html_url: user.html_url,
      avatar_url: user.avatar_url,
    },
    repos: (Array.isArray(repos) ? repos : []).slice(0, 10).map((r: any) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      updated_at: r.updated_at,
      html_url: r.html_url,
    })),
    source: 'GitHub REST API',
    timestamp: Date.now(),
  });
}
