import { createApp } from './app.js';
import { resolveDependencies } from './bootstrap.js';

const port = Number(process.env.PORT) || 4000;

try {
  const app = createApp(await resolveDependencies());
  app.listen(port, () => console.log(`SupplyFlow API listening on port ${port}`));
} catch (err) {
  console.error(`SupplyFlow API failed to start: ${err.message}`);
  process.exit(1);
}
