import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Photo/card data is local-device sourced; no background refetch needed
      refetchOnWindowFocus: false,
      retry: 1,
      // A month's photo set only changes when the user shoots or deletes, so
      // remounts within a session reuse the cache instead of rescanning the
      // library (which costs one native call per photo).
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});
