import { createApp } from './app.js';
import { pool } from './db/pool.js';
import { createOrderModel } from './models/orderModel.js';

const port = Number(process.env.PORT) || 4000;
const app = createApp({ orderModel: createOrderModel(pool) });

app.listen(port, () => console.log(`SupplyFlow API listening on port ${port}`));
