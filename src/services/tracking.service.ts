import type { TrackResponse } from "../schemas/order.schema";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { OrderRepository } from "../repositories/order.repository";
import { AppError } from "../shared/errors";
import { requireMerchant } from "./lookups";

export interface TrackingService {
  track(merchantId: string, orderId: string): TrackResponse;
}

/**
 * FR-12. Status = latest order event; history = every event, oldest first. While the order waits for
 * the human (CREATED) the approve link is included so an agent can share it again.
 * Shipping is simulated in the MVP (admin fulfilment route).
 */
export function createTrackingService(deps: {
  merchants: MerchantRepository;
  orders: OrderRepository;
}): TrackingService {
  return {
    track(merchantId, orderId) {
      requireMerchant(deps.merchants, merchantId);
      const order = deps.orders.findById(merchantId, orderId);
      if (!order) throw new AppError("ORDER_NOT_FOUND", "No such order in this store.", 404);

      const events = deps.orders.events(order.id);
      const last = events.at(-1);
      if (!last) throw new Error(`order ${order.id} has no events`);
      return {
        order_id: order.id,
        status: last.status,
        history: events.map((e) => ({ status: e.status, at: e.createdAt })),
        ...(last.status === "CREATED" ? { approve_url: order.approveUrl } : {}),
      };
    },
  };
}
