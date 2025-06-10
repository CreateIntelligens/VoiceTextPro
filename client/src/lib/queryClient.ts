import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    
    try {
      const contentType = res.headers.get('content-type') || '';
      
      // Try to get error message from response
      if (contentType.includes('application/json')) {
        try {
          const responseText = await res.text();
          if (responseText.trim()) {
            const json = JSON.parse(responseText);
            errorMessage = json.message || json.error || errorMessage;
          }
        } catch (jsonError) {
          // JSON parsing failed, use status text
          errorMessage = res.statusText || '伺服器錯誤';
        }
      } else {
        // Non-JSON response, likely HTML error page
        try {
          const responseText = await res.text();
          if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE') || responseText.length > 1000) {
            // HTML error page detected
            errorMessage = res.status === 401 ? '認證已過期' : 
                         res.status === 404 ? '找不到請求的資源' :
                         res.status === 500 ? '伺服器內部錯誤' : '伺服器錯誤';
          } else if (responseText.trim()) {
            errorMessage = responseText.substring(0, 200); // Limit error message length
          }
        } catch (textError) {
          errorMessage = `HTTP ${res.status} 錯誤`;
        }
      }
    } catch (generalError) {
      // Fallback for any unexpected errors
      errorMessage = `網路錯誤 (${res.status})`;
    }
    
    // Handle authentication errors
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      setTimeout(() => {
        window.location.reload();
      }, 500);
      throw new Error('認證已過期，正在重新載入頁面...');
    }
    
    throw new Error(`${res.status}: ${errorMessage}`);
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
    
    // Production-safe JSON parsing with comprehensive error handling
    const contentType = res.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        const text = await res.text();
        if (!text.trim()) {
          return null;
        }
        
        // Validate JSON structure before parsing
        const trimmedText = text.trim();
        if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
          throw new Error('Invalid JSON format');
        }
        
        return JSON.parse(trimmedText);
      } else if (contentType.includes('text/')) {
        return await res.text();
      } else {
        // Handle unknown content types safely
        const text = await res.text();
        const trimmedText = text.trim();
        
        if (trimmedText.startsWith('<html>') || trimmedText.startsWith('<!DOCTYPE')) {
          // HTML response in production
          throw new Error('伺服器回應HTML頁面而非預期的資料格式');
        }
        
        if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
          try {
            return JSON.parse(trimmedText);
          } catch (jsonError) {
            // JSON parsing failed, return as text
            return trimmedText;
          }
        }
        
        return trimmedText;
      }
    } catch (error: unknown) {
      // Final fallback for production environments
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Unexpected token')) {
        throw new Error('資料格式錯誤，請重新載入頁面或聯繫技術支援');
      }
      throw new Error(errorMessage);
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
