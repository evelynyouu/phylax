// One value per server process. Next bundles pages and route handlers into separate module
// graphs, so a plain module-level `let` can exist twice; globalThis is shared by both.
export function processWide<T>(key: string, init: () => T): T {
  const g = globalThis as unknown as Record<symbol, T | undefined>;
  const sym = Symbol.for(`phylax.${key}`);
  return (g[sym] ??= init());
}
