import { Link, Outlet } from "react-router";

export function Layout() {
  return (
    <>
      <nav style={{ display: "flex", gap: 16, padding: 16 }}>
        <strong>OpenShelf</strong>
        <Link to="/">New store</Link>
      </nav>
      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </>
  );
}
