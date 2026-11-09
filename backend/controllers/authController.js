export function createAuthController(authService) {
  return {
    async login(req, res) {
      res.json(await authService.login(req.body));
    },

    async me(req, res) {
      res.json(await authService.getCurrentUser(req.user.id));
    },
  };
}
