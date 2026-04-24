import { usePathname } from "expo-router";
import { useEffect } from "react";

import { setLastRoute } from "./routeContext";

export function RouteCapture(): null {
  const pathname = usePathname();
  useEffect(() => {
    setLastRoute(pathname);
  }, [pathname]);
  return null;
}
