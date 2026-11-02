/**
 * Buyer simulator (FR-16). Build step 8.
 * For each scenario: MCP client (@modelcontextprotocol/sdk, Streamable HTTP) -> search -> quote ->
 * order on pass. Sends X-Simulated: 1 so the dashboard labels the rows. Prints a result table and the
 * number of calls made, which must equal the new telemetry rows (NFR-06 check).
 *
 * Usage: pnpm simulate -- --base http://localhost:8787 --merchant m_xxx
 */
import { SCENARIOS } from "./scenarios";

console.log(
  `simulator: ${SCENARIOS.length} scenarios defined; runner not implemented yet (build step 8)`,
);
