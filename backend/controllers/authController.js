export function createAuthController(authService) {
  return {
    async login(req, res) {
      res.json(await authService.login(req.body));
    },

    async register(req, res) {
      res.status(201).json(await authService.register(req.body));
    },

    async me(req, res) {
      res.json(await authService.getCurrentUser(req.user.id));
    },
  };
}
