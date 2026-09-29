/**
 * Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
 * (and later receive registered routes). Noops when the app is not embedded.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  collectRoutePathsFromTree,
  installPreviewHostBridge,
} from "@/lib/preview-host-bridge";

export function PreviewHostBridge() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        try {
          const url = new URL(path, window.location.origin);
          const next = `${url.pathname}${url.search}${url.hash}`;
          const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          if (next === cur) return;
        } catch {
          return;
        }
        routerRef.current.history.push(path);
      },
      getRoutePaths: () => collectRoutePathsFromTree(routerRef.current.routeTree),
    });
  }, []);

  return null;
}