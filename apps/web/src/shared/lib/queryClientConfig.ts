import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes before re-fetching
            gcTime: 1000 * 60 * 10, // 10 minutes before garbage collection
            retry: 2,
            refetchOnWindowFocus: false,
        }
    }
});