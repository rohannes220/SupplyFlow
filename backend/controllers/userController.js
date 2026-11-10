export function createUserController(userService) {
  return {
    async list(_req, res) {
      res.json(await userService.listUsers());
    },
  };
}
