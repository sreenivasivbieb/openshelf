import { z } from "zod";
import { OrderStatus } from "../domain/enums";

export const OrderRequest = z.object({ quote_id: z.string().min(1).max(64) });
export type OrderRequest = z.infer<typeof OrderRequest>;

export const OrderResponse = z.object({
  order_id: z.string(),
  quote_id: z.string(),
  status: OrderStatus, // current status; a replayed /order returns the same order
  approve_url: z.string(), // the human approves payment inside PayPal
});
export type OrderResponse = z.infer<typeof OrderResponse>;

export const TrackResponse = z.object({
  order_id: z.string(),
  status: OrderStatus, // latest event
  history: z.array(z.object({ status: OrderStatus, at: z.string() })), // oldest first
  approve_url: z.string().optional(), // only while the order waits for the human (CREATED)
});
export type TrackResponse = z.infer<typeof TrackResponse>;

export const TrackRequest = z.object({ order_id: z.string().min(1).max(64) });
export type TrackRequest = z.infer<typeof TrackRequest>;

/** Simulated shipping for the demo (admin only): CAPTURED -> SHIPPED -> DELIVERED. */
export const FulfilmentRequest = z.object({ status: z.enum(["SHIPPED", "DELIVERED"]) });
export type FulfilmentRequest = z.infer<typeof FulfilmentRequest>;
