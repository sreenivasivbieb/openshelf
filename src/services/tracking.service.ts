import type { TrackResponse } from "../schemas/order.schema";
import type { OrderRepository } from "../repositories/order.repository";
import { notImplemented } from "../shared/errors";

export interface TrackingService {
  track(merchantId: string, orderId: string): TrackResponse;
}

/** FR-12. Build step 5. Status = latest order event; shipping is simulated in the MVP. */
export function createTrackingService(_deps: { orders: OrderRepository }): TrackingService {
  return {
    track: () => notImplemented("step 5"),
  };
}
