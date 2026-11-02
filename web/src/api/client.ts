/** Thin fetch wrapper for /admin/* (admin token kept in sessionStorage after a prompt). */
export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("openshelf.adminToken") ?? "";
  const res = await fetch(path, {
    ...init,
    headers: { ...init?.headers, authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}
