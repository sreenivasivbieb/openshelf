import type { Express } from "express";
import type { AddressInfo } from "node:net";

/** Starts the app on a random port and returns a fetch bound to it. Call close() in afterAll. */
export async function serve(app: Express) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    fetch: (path: string, init?: RequestInit) => fetch(base + path, init),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
