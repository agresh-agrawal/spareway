const RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

/** Problems sorted critical → warning → info, newest first inside a level. */
export function sortProblems<T extends { severity: string; created_at: string }>(alerts: T[]): T[] {
  return [...alerts].sort(
    (a, b) =>
      (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}
