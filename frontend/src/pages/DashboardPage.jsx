import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as dashboardApi from '../services/dashboardApi.js';
import MetricCard from '../components/MetricCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';

const STATUS_BAR = {
  Draft: 'bg-slate-400',
  Pending: 'bg-amber-400',
  Approved: 'bg-blue-500',
  Shipped: 'bg-indigo-500',
  Delivered: 'bg-green-500',
  Cancelled: 'bg-red-400',
};

const number = new Intl.NumberFormat('en-US');

function Panel({ title, action, children }) {
  const id = `panel-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id={id} className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusBreakdown({ ordersByStatus, totalOrders }) {
  return (
    <ul className="space-y-3">
      {Object.entries(ordersByStatus).map(([status, count]) => {
        const share = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
        return (
          <li key={status}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{status}</span>
              <span className="tabular-nums text-slate-900">
                {number.format(count)}
                <span className="sr-only"> orders</span>
              </span>
            </div>
            <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${STATUS_BAR[status] ?? 'bg-slate-400'}`}
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RecentOrders({ orders }) {
  if (orders.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No orders yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {orders.map((order) => (
        <li key={order.id} className="flex items-center justify-between gap-4 py-3 text-sm">
          <div>
            <p className="font-medium text-blue-700">#{order.id}</p>
            <p className="text-slate-500">Vendor {order.vendorId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums font-medium text-slate-900">
              {formatCurrency(order.amount)}
            </span>
            <StatusBadge status={order.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Supply chain metrics. Loads fresh data every time the page is opened (on mount). */
export default function DashboardPage({ api = dashboardApi }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .getDashboard()
      .then((data) => active && setMetrics(data))
      .catch((err) => active && setError(err.message || 'Could not load the dashboard.'));
    return () => {
      active = false;
    };
  }, [api]);

  const overdueTracked = metrics?.overdueDeliveries != null;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Overview of your supply chain operations.</p>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {!metrics && !error && (
        <p role="status" className="py-10 text-center text-sm text-slate-500">
          Loading dashboard…
        </p>
      )}

      {metrics && (
        <>
          <section
            aria-label="Summary"
            className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            <MetricCard
              label="Total Orders"
              value={number.format(metrics.totalOrders)}
              icon="#"
              accent="blue"
            />
            <MetricCard
              label="Active Vendors"
              value={number.format(metrics.activeVendors)}
              icon="✓"
              accent="green"
            />
            <MetricCard
              label="Pending Orders"
              value={number.format(metrics.pendingOrders)}
              hint="Awaiting approval"
              icon="…"
              accent="amber"
            />
            <MetricCard
              label="Total Spending"
              value={formatCurrency(metrics.totalSpending)}
              hint="Excludes cancelled orders"
              icon="$"
              accent="indigo"
            />
            <MetricCard
              label="Overdue Deliveries"
              value={overdueTracked ? number.format(metrics.overdueDeliveries) : '—'}
              hint={overdueTracked ? 'Past expected delivery date' : 'Not tracked yet'}
              icon="!"
              accent={overdueTracked && metrics.overdueDeliveries > 0 ? 'red' : 'slate'}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Orders by status">
              <StatusBreakdown
                ordersByStatus={metrics.ordersByStatus}
                totalOrders={metrics.totalOrders}
              />
            </Panel>
            <Panel
              title="Recent orders"
              action={
                <Link to="/orders" className="text-sm font-medium text-blue-600 hover:underline">
                  View all
                </Link>
              }
            >
              <RecentOrders orders={metrics.recentOrders} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
