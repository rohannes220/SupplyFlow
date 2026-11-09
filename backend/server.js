import { createApp } from './app.js';
import { pool } from './db/pool.js';
import { createOrderModel } from './models/orderModel.js';
import { createUserModel } from './models/userModel.js';
import { createVendorModel } from './models/vendorModel.js';

const port = Number(process.env.PORT) || 4000;
const app = createApp({
  orderModel: createOrderModel(pool),
  userModel: createUserModel(pool),
  vendorModel: createVendorModel(pool),
  jwtSecret: process.env.JWT_SECRET,
});

app.listen(port, () => console.log(`SupplyFlow API listening on port ${port}`));
