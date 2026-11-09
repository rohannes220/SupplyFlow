export function createVendorController(vendorService) {
  return {
    async list(req, res) {
      const { search, status } = req.query;
      res.json(await vendorService.listVendors({ search, status }));
    },

    async get(req, res) {
      res.json(await vendorService.getVendor(req.params.id));
    },

    async create(req, res) {
      const vendor = await vendorService.createVendor(req.body);
      res.status(201).location(`/api/vendors/${vendor.id}`).json(vendor);
    },

    async update(req, res) {
      res.json(await vendorService.updateVendor(req.params.id, req.body));
    },
  };
}
