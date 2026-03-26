/**
 * Find the first "healthy" datasource from a list.
 * Healthy = status enabled + last connection test succeeded.
 * Falls back to the first item if none is perfectly healthy.
 */
export function findFirstHealthyDs<
  T extends { id: number; status?: string; last_test_status?: string | null },
>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return (
    items.find(
      (d) => d.status === 'enabled' && d.last_test_status === 'success',
    ) || items[0]
  );
}
