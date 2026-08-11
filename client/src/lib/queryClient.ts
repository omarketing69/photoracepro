import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Helper function to get auth headers for admin endpoints
function getAuthHeaders(): HeadersInit {
  try {
    const userStr = localStorage.getItem('race_photo_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user && user.token) {
        // Check token expiry before sending it
        try {
          const payload = JSON.parse(atob(user.token.split('.')[1]));
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn('⚠️ JWT token expired - clearing session');
            localStorage.removeItem('race_photo_user');
            window.location.href = '/admin-login';
            return {};
          }
        } catch {
          localStorage.removeItem('race_photo_user');
          window.location.href = '/admin-login';
          return {};
        }
        return { 'Authorization': `Bearer ${user.token}` };
      }
      // Si el usuario admin no tiene token, es de sesión antigua - limpiar localStorage
      if (user && user.role === 'admin' && !user.token) {
        console.warn('⚠️ Admin user without token detected - clearing session');
        localStorage.removeItem('race_photo_user');
        window.location.href = '/admin-login';
        return {};
      }
    }
  } catch (error) {
    console.error('Error getting auth headers:', error);
  }
  return {};
}

// Helper function to check if endpoint requires admin auth
function requiresAdminAuth(url: string): boolean {
  // All /api/admin routes require admin auth
  if (url.includes('/api/admin')) {
    return true;
  }
  
  // Photo upload endpoints require auth
  if (url.includes('/api/photos/upload') || url.includes('/api/photos/resume-upload')) {
    return true;
  }
  
  // Event pricing configuration requires admin auth
  if (url.match(/\/api\/events\/\d+\/pricing$/)) {
    return true;
  }
  
  // Specific /api/users routes also require admin auth
  return url.includes('/api/users') && (
    !!url.match(/\/api\/users$/) ||           // GET /api/users, POST /api/users
    !!url.match(/\/api\/users\/\d+$/) ||      // PUT /api/users/:id, DELETE /api/users/:id  
    !!url.match(/\/api\/users\/\d+\/password$/) || // PATCH /api/users/:id/password
    !!url.match(/\/api\/users\/\d+\/events/)     // POST/DELETE/GET /api/users/:id/events
  );
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check if this is a file upload
  const isFileUpload = data instanceof FormData;
  
  let headers: HeadersInit = isFileUpload 
    ? {} // Let browser set Content-Type for FormData
    : data 
      ? { "Content-Type": "application/json" } 
      : {};

  // Add auth headers for admin endpoints
  if (requiresAdminAuth(url)) {
    headers = { ...headers, ...getAuthHeaders() };
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isFileUpload ? data as FormData : data ? JSON.stringify(data) : undefined,
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
    const url = queryKey[0] as string;
    let headers: HeadersInit = {};
    
    // Add auth headers for admin endpoints
    if (requiresAdminAuth(url)) {
      headers = { ...headers, ...getAuthHeaders() };
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
