let lastRoute: string | undefined;

export function setLastRoute(pathname: string | undefined): void {
  lastRoute = pathname;
}

export function getLastRoute(): string | undefined {
  return lastRoute;
}
