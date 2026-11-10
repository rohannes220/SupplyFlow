export function createOrderController(orderService) {
  return {
    async list(_req, res) {
      res.json(await orderService.listOrders());
    },

    async get(req, res) {
      res.json(await orderService.getOrder(req.params.id));
    },

    async create(req, res) {
      const order = await orderService.createOrder(req.body, req.user);
      res.status(201).location(`/api/orders/${order.orderId}`).json(order);
    },

    async update(req, res) {
      res.json(await orderService.updateOrder(req.params.id, req.body, req.user));
    },

    async updateStatus(req, res) {
      res.json(await orderService.updateOrderStatus(req.params.id, req.body?.status, req.user));
    },

    async remove(req, res) {
      await orderService.deleteOrder(req.params.id, req.user);
      res.status(204).end();
    },
  };
}
