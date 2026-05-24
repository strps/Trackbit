import { apiFetch, ApiError } from "./api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  role?: string;
  locale?: string;
  timezone?: string;
}

export interface SignInResult {
  token: string;
  user: AuthUser;
}

export interface SignUpResult {
  user: AuthUser;
}

interface BetterAuthSignInResponse {
  token: string;
  user: AuthUser;
}

interface BetterAuthSessionResponse {
  user: AuthUser;
  session: { id: string; expiresAt: string };
}

// The bearer plugin returns the signed token in the `set-auth-token` header.
// We prefer that over the raw token in the response body because the server
// requires a signed token (requireSignature: true) for bearer auth.
function extractToken(res: Response, fallback: string): string {
  return res.headers.get("set-auth-token") ?? fallback;
}

export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  let response: Response | undefined;
  const data = await apiFetch<BetterAuthSignInResponse>(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      body: { email, password },
      onResponse: (res) => {
        response = res;
      },
    },
  );
  return { token: extractToken(response!, data.token), user: data.user };
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<SignUpResult> {
  const data = await apiFetch<{ user: AuthUser }>("/api/auth/sign-up/email", {
    method: "POST",
    body: { name, email, password },
  });
  return { user: data.user };
}

export async function signOut(token: string): Promise<void> {
  await apiFetch<void>("/api/auth/sign-out", { method: "POST", token });
}

export async function getSession(
  token: string,
): Promise<BetterAuthSessionResponse | null> {
  try {
    return await apiFetch<BetterAuthSessionResponse>("/api/auth/get-session", {
      token,
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}
