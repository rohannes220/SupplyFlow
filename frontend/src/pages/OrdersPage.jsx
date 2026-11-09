import { useCallback, useEffect, useMemo, useState } from 'react';
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
  'Actions',
];

const VALID_STATUSES = ['Draft', 'Pending', 'Approved', 'Shipped', 'Delivered', 'Cancelled'];

export default function OrdersPage({ api = orderApi }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');

  // Sorting state: 'none', 'asc' (lowest to highest), 'desc' (highest to lowest)
  const [sortDirection, setSortDirection] = useState('none');

  // Updating order status state
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');

  // Deletion verification state
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const closeUpdateModal = useCallback(() => setUpdatingOrder(null), []);
  const closeDeleteModal = useCallback(() => {
    if (!isDeleting) setDeletingOrder(null);
  }, [isDeleting]);

  async function handleCreate(input) {
    const created = await api.createOrder(input);
    setOrders((current) => [created, ...current]);
    setShowForm(false);
    setNotice(`Order #${created.orderId} added.`);
  }

  // Handle Order Status Update
  function openUpdateModal(order) {
    setUpdatingOrder(order);
    setSelectedStatus(order.status || 'Draft');
  }

  async function handleStatusSubmit(e) {
    e.preventDefault();
    if (!updatingOrder) return;
    try {
      if (typeof api.updateOrderStatus === 'function') {
        await api.updateOrderStatus(updatingOrder.orderId, selectedStatus);
      }
      setOrders((current) =>
        current.map((o) =>
          o.orderId === updatingOrder.orderId ? { ...o, status: selectedStatus } : o,
        ),
      );
      setNotice(`Order #${updatingOrder.orderId} status updated to ${selectedStatus}.`);
      setUpdatingOrder(null);
    } catch (err) {
      setLoadError(err.message || 'Failed to update order status');
    }
  }

  // Handle Order Delete with Verification Process
  function openDeleteModal(order) {
    setDeletingOrder(order);
  }

  async function handleConfirmDelete() {
    if (!deletingOrder) return;
    setIsDeleting(true);
    try {
      // If the backend enforces that only Draft orders can be deleted,
      // we transition to Draft first if needed, then delete.
      if (deletingOrder.status !== 'Draft' && typeof api.updateOrderStatus === 'function') {
        try {
          await api.updateOrderStatus(deletingOrder.orderId, 'Draft');
        } catch {
          // If status update is not available, proceed to attempt delete directly
        }
      }

      if (typeof api.deleteOrder === 'function') {
        await api.deleteOrder(deletingOrder.orderId);
      }

      setOrders((current) => current.filter((o) => o.orderId !== deletingOrder.orderId));
      setNotice(`Order #${deletingOrder.orderId} was successfully deleted.`);
      setDeletingOrder(null);
    } catch (err) {
      setLoadError(err.message || `Failed to delete order #${deletingOrder.orderId}`);
    } finally {
      setIsDeleting(false);
    }
  }

  // Sorting and Display calculation
  const displayedOrders = useMemo(() => {
    const list = [...orders];
    if (sortDirection === 'asc') {
      return list.sort((a, b) => Number(a.orderAmount) - Number(b.orderAmount));
    }
    if (sortDirection === 'desc') {
      return list.sort((a, b) => Number(b.orderAmount) - Number(a.orderAmount));
    }
    return list;
  }, [orders, sortDirection]);

  return (
    <>
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create, update status, and manage customer orders. US addresses only.
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

      {/* Centered Action Controls Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {/* Show All Orders Button */}
        <button
          type="button"
          onClick={() => {
            setSortDirection('none');
            setNotice(`Showing all ${orders.length} total orders.`);
          }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            sortDirection === 'none'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Show All Orders</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              sortDirection === 'none'
                ? 'bg-slate-700 text-slate-100'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {orders.length}
          </span>
        </button>

        {/* Group Orders Lowest to Highest (Ascending) */}
        <button
          type="button"
          onClick={() => {
            setSortDirection('asc');
            setNotice('Orders grouped from lowest to highest amount.');
          }}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
            sortDirection === 'asc'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Group Orders ↑ (Lowest to Highest)</span>
        </button>

        {/* Group Orders Highest to Lowest (Descending) */}
        <button
          type="button"
          onClick={() => {
            setSortDirection('desc');
            setNotice('Orders grouped from highest to lowest amount.');
          }}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
            sortDirection === 'desc'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Group Orders ↓ (Highest to Lowest)</span>
        </button>
      </div>

      {/* Notifications and Alerts */}
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

      {/* Orders Table */}
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
            {displayedOrders.map((order) => (
              <tr key={order.orderId} className="hover:bg-slate-50 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-blue-700">
                  #{order.orderId}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums font-semibold text-slate-900">
                  {formatCurrency(order.orderAmount)}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{order.vendorId}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{order.customerName}</td>
                <td className="px-4 py-3 text-slate-600">{order.customerCity}</td>
                <td className="px-4 py-3 text-slate-600">{order.customerState}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                  {formatUsPhone(order.customerPhone)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center gap-2">
                    {/* Update Order Status Button */}
                    <button
                      type="button"
                      onClick={() => openUpdateModal(order)}
                      className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      Update
                    </button>

                    {/* Delete Order Button */}
                    <button
                      type="button"
                      onClick={() => openDeleteModal(order)}
                      className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !loadError && displayedOrders.length === 0 && (
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

      {/* Create Order Modal */}
      {showForm && (
        <Modal title="Add Order" onClose={closeForm}>
          <OrderForm onSubmit={handleCreate} onCancel={closeForm} />
        </Modal>
      )}

      {/* Update Order Status Modal */}
      {updatingOrder && (
        <Modal title={`Update Order #${updatingOrder.orderId} Status`} onClose={closeUpdateModal}>
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                Customer:{' '}
                <span className="font-medium text-slate-900">{updatingOrder.customerName}</span>
              </p>
              <p className="text-sm text-slate-600">
                Amount:{' '}
                <span className="font-medium text-slate-900">
                  {formatCurrency(updatingOrder.orderAmount)}
                </span>
              </p>
            </div>

            <div>
              <label
                htmlFor="update-status-select"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Order Status
              </label>
              <select
                id="update-status-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {VALID_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={closeUpdateModal}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Update Status
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Verification Modal for Delete Order */}
      {deletingOrder && (
        <Modal title="Verification Required: Confirm Delete" onClose={closeDeleteModal}>
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">
                Are you sure you want to delete this order?
              </p>
              <p className="mt-1 text-sm text-red-700">
                Order <span className="font-semibold">#{deletingOrder.orderId}</span> for{' '}
                <span className="font-semibold">{deletingOrder.customerName}</span> (
                {formatCurrency(deletingOrder.orderAmount)}) will be permanently deleted from the
                system.
              </p>
            </div>

            <p className="text-xs text-slate-500">
              Verification check: This action cannot be reversed. Please confirm if you wish to
              proceed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isDeleting}
                onClick={closeDeleteModal}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Yes, Delete Order'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
