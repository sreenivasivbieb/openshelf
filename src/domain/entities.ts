import type {
  AgentTool,
  Channel,
  FirewallStatus,
  OrderStatus,
  QuoteReasonCode,
  SpecStatus,
} from "./enums";

/**
 * Core entities, as the services see them (camelCase, money in minor units).
 * Repositories map these to and from database rows (database/migrations/001_init.sql).
 */
export interface Merchant {
  id: string;
  name: string;
  currency: string;
  paypalPayeeEmail: string | null;
  specJson: string | null;
  specStatus: SpecStatus;
  createdAt: string;
}

export interface Product {
  merchantId: string;
  sku: string;
  name: string;
  descriptionRaw: string;
  descriptionAgent: string | null;
  category: string | null;
  priceMinor: number;
  stock: number;
  shippingDays: number;
  returnDays: number;
  ratingAvg: number | null;
  reviewCount: number | null;
  firewallStatus: FirewallStatus;
  firewallReason: string | null;
  updatedAt: string;
}

export interface Quote {
  id: string;
  merchantId: string;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
  currency: string;
  shippingDays: number;
  returnDays: number;
  guardrails: Record<string, unknown>;
  agentId: string | null;
  createdAt: string;
  expiresAt: string;
  quoteHash: string;
}

export interface Order {
  id: string;
  merchantId: string;
  quoteId: string;
  quoteHash: string;
  paypalOrderId: string;
  approveUrl: string;
  createdAt: string;
}

export interface OrderEvent {
  orderId: string;
  status: OrderStatus;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface TelemetryEvent {
  merchantId: string;
  agentId: string | null;
  channel: Channel;
  tool: AgentTool;
  request: unknown;
  outcome: "ok" | "pass" | "fail" | "error";
  errorCode: string | null; // AppError code when outcome = "error"
  reasonCodes: QuoteReasonCode[] | null;
  quoteId: string | null;
  orderId: string | null;
  latencyMs: number;
  isSimulated: boolean;
  agentVerified: boolean; // the call carried a valid X-Agent-Key (ADR-0012)
  createdAt: string;
}

/** Who is calling and through which door. Built by the api layer, passed to services and telemetry. */
export interface AgentContext {
  merchantId: string;
  /** The key's label when agentVerified; otherwise self-declared (X-Agent-Id, ADR-0009). */
  agentId: string | null;
  channel: Channel;
  isSimulated: boolean; // X-Simulated: 1 from tools/simulator
  agentVerified: boolean; // true only for a valid X-Agent-Key (ADR-0012)
}

/** A scoped agent API key (ADR-0012). The key itself is never stored, only its sha256 hash. */
export interface AgentKey {
  id: string;
  merchantId: string;
  label: string;
  keyHash: string;
  createdAt: string;
  revokedAt: string | null;
}
