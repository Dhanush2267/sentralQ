import { useState, useCallback } from "react";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T, Args extends any[]>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (apiFunc: (...args: Args) => Promise<any>, ...args: Args): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const response = await apiFunc(...args);
        // Standard payload extraction
        const data = response.data;
        setState({ data, loading: false, error: null });
        return data;
      } catch (err: any) {
        const message = err.message || "An unexpected error occurred.";
        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    []
  );

  return {
    ...state,
    execute,
    reset: () => setState({ data: null, loading: false, error: null }),
  };
}
