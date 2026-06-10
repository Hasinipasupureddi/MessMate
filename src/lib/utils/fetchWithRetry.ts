export type FetchRetryOptions = {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
};

function shouldRetry(error: unknown) {
  if (error instanceof TypeError && /Failed to fetch|NetworkError/i.test(error.message)) {
    return true;
  }

  if (error instanceof DOMException) {
    return error.name === 'AbortError' || error.name === 'TimeoutError';
  }

  return false;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchRetryOptions = {},
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Response> {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch is unavailable in this environment.');
  }

  const retries = options.retries ?? 2;
  const backoffMs = options.backoffMs ?? 300;
  const timeoutMs = options.timeoutMs ?? 15000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    try {
      const response = await fetchImpl(input, {
        ...init,
        signal: init.signal ?? controller?.signal,
      });

      if (response.ok || response.status < 500) {
        return response;
      }

      if (attempt < retries) {
        throw new Error(`Server returned ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      const canRetry = attempt < retries && shouldRetry(error);
      if (!canRetry) {
        throw error;
      }

      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, backoffMs * (attempt + 1));
      });
    } finally {
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed.');
}
