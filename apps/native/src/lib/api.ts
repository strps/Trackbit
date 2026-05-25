const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  onResponse?: (res: Response) => void;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public payload: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {}, token, onResponse } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  onResponse?.(response);

  if (!response.ok) {
    let message = response.statusText;
    let code: string | undefined;
    let payload: Record<string, unknown> = {};
    try {
      const data = await response.json();
      if (typeof data?.message === "string") message = data.message;
      if (typeof data?.error === "string") code = data.error;
      const { error: _e, message: _m, ...rest } = data ?? {};
      payload = rest;
    } catch {
      // leave as defaults
    }
    throw new ApiError(response.status, message, code, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
