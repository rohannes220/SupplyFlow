import { useCallback, useEffect, useState } from 'react';
import * as orderApi from '../services/orderApi.js';
import Modal from '../components/Modal.jsx';
import OrderForm from '../components/OrderForm.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatCurrency, formatUsPhone } from '../utils/format.js';

const COLUMNS = [
  'Order ID',
  'Order Amount',
  'Vendor ID',
  'Customer Name',
  'City',
  'State',
  'Phone',
  'Status',
];

export default function OrdersPage({ api = orderApi }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    api
      .listOrders()
      .then((data) => active && setOrders(data))
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [api]);

  const closeForm = useCallback(() => setShowForm(false), []);

  async function handleCreate(input) {
    const created = await api.createOrder(input);
    setOrders((current) => [created, ...current]);
    setShowForm(false);
    setNotice(`Order #${created.orderId} added.`);
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and review customer orders. US addresses only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice('');
            setShowForm(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          + Add Order
        </button>
      </div>

      <div aria-live="polite">
        {notice && (
          <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {notice}
          </p>
        )}
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {loadError}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-600"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.orderId} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-blue-700">
                  #{order.orderId}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {formatCurrency(order.orderAmount)}
                </td>
                <td className="px-4 py-3 tabular-nums">{order.vendorId}</td>
                <td className="px-4 py-3">{order.customerName}</td>
                <td className="px-4 py-3">{order.customerCity}</td>
                <td className="px-4 py-3">{order.customerState}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {formatUsPhone(order.customerPhone)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
            {!loading && !loadError && orders.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                  No orders yet. Use “Add Order” to create the first one.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                  Loading orders…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Add Order" onClose={closeForm}>
          <OrderForm onSubmit={handleCreate} onCancel={closeForm} />
        </Modal>
      )}
    </>
  );
}
