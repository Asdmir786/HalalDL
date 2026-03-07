export function createId(): string {
  const g = globalThis as unknown as { crypto?: Crypto };
  const uuid = g.crypto?.randomUUID?.();
  if (uuid && typeof uuid === "string") return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

