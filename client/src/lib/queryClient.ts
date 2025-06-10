import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text = res.statusText;
    let isJson = false;
    
    try {
      // Check content type first
      const contentType = res.headers.get('content-type') || '';
      isJson = contentType.includes('application/json');
      
      if (isJson) {
        // Clone response to avoid consuming the stream
        const responseClone = res.clone();
        const json = await responseClone.json();
        text = json.message || json.error || text;
      } else {
        // For non-JSON responses (like HTML error pages)
        const responseText = await res.text();
        if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
          // HTML error page detected
          text = res.status === 401 ? '認證已過期' : '伺服器錯誤';
        } else {
          text = responseText || text;
        }
      }
    } catch (parseError) {
      // If any parsing fails, use a safe fallback
      console.warn('Response parsing failed:', parseError);
      text = res.status === 401 ? '認證已過期' : `伺服器錯誤 (${res.status})`;
    }
    
    // Handle authentication errors specifically
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      setTimeout(() => {
        window.location.reload();
      }, 100);
      throw new Error(`認證已過期，請重新登入`);
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string = "GET",
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    };

    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Enhanced safe JSON parsing
    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const text = await res.text();
        if (!text.trim()) {
          return null; // Empty response
        }
        return JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parsing failed:', parseError);
        console.error('Response text:', await res.clone().text());
        throw new Error('伺服器回應格式錯誤');
      }
    } else if (contentType.includes('text/')) {
      return await res.text();
    } else {
      // For unknown content types, try JSON first, then text
      try {
        const text = await res.text();
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          return JSON.parse(text);
        }
        return text;
      } catch (e) {
        return await res.text();
      }
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Always fetch fresh data for transcription updates
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
