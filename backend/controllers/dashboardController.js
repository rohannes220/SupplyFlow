export function createDashboardController(dashboardService) {
  return {
    async get(_req, res) {
      res.json(await dashboardService.getDashboard());
    },
  };
}
