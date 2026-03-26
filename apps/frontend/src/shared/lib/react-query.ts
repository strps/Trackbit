import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 1 minute
            staleTime: 1000 * 60,
            // Do not retry immediately on 404s, etc.
            retry: 1,
        },
    },
})

export { queryClient };