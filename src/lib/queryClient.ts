import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Photo/card data is local-device sourced; no background refetch needed
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
