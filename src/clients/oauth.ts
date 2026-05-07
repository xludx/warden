import { env } from "@/util/env";

type Provider = "google" | "github";

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
}

interface Profile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Build the OAuth authorization URL to redirect the user to.
 */
export function buildAuthorizationUrl(
  provider: Provider,
  clientId: string,
  redirectUri: string,
  scope: string,
  state: string,
): string {
  const urls: Record<Provider, string> = {
    google: "https://accounts.google.com/o/oauth2/v2/auth",
    github: "https://github.com/login/oauth/authorize",
  };

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state,
  });

  return `${urls[provider]}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCode(
  provider: Provider,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const endpoints: Record<Provider, string> = {
    google: "https://oauth2.googleapis.com/token",
    github: "https://github.com/login/oauth/access_token",
  };

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const acceptHeaders: Record<Provider, string> = {
    google: "application/json",
    github: "application/json",
  };

  const response = await fetch(endpoints[provider], {
    method: "POST",
    headers: { Accept: acceptHeaders[provider] },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as Record<string, string>;

  if (data.error) {
    throw new Error(`OAuth token exchange error: ${data.error} — ${data.error_description ?? ""}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    scope: data.scope,
  };
}

/**
 * Fetch the user's profile from the OAuth provider.
 */
export async function fetchProfile(provider: Provider, accessToken: string): Promise<Profile> {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  if (provider === "google") {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: authHeader });
    if (!response.ok) throw new Error(`Google profile fetch failed: ${response.status}`);
    const data = await response.json() as { id: string; email: string; name: string; picture: string };
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      avatarUrl: data.picture ?? null,
    };
  }

  if (provider === "github") {
    const response = await fetch("https://api.github.com/user", { headers: authHeader });
    if (!response.ok) throw new Error(`GitHub profile fetch failed: ${response.status}`);
    const data = await response.json() as { id: number; email: string | null; login: string; avatar_url: string };

    // GitHub's /user endpoint may not return a public email; fetch emails separately if needed
    let email = data.email;
    if (!email) {
      try {
        const emailRes = await fetch("https://api.github.com/user/emails", { headers: authHeader });
        if (emailRes.ok) {
          const emails = await emailRes.json() as { email: string; primary: boolean }[];
          const primary = emails.find((e) => e.primary);
          email = primary?.email ?? emails[0]?.email ?? null;
        }
      } catch {
        // Fallback to login
      }
    }

    return {
      id: String(data.id),
      email: email ?? `${data.login}@github.users`,
      name: data.login,
      avatarUrl: data.avatar_url ?? null,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export type { Provider, TokenResponse, Profile };
