import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { networkMode: "offlineFirst", retry: 1 },
      mutations: { networkMode: "offlineFirst" },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Avoid repeatedly treating every preloaded route as stale. This cuts
    // unnecessary loader/query work when moving between the main tabs.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
