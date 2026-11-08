"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { http } from "@/lib/http";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => http.get(url),
        revalidateOnFocus: true,
        dedupingInterval: 15_000,
        keepPreviousData: true,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
