import { useCallback, useEffect, useState } from 'react';
import * as vendorApi from '../services/vendorApi.js';
import Modal from '../components/Modal.jsx';
import RoleGate from '../components/RoleGate.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import VendorForm from '../components/VendorForm.jsx';
import { formatUsPhone } from '../utils/format.js';

const COLUMNS = ['Name', 'Email', 'Phone', 'City', 'State', 'Status', 'Actions'];
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

const controlClass =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

/** Details dialog: loads the vendor fresh from the API. */
function VendorDetails({ api, vendorId, name, onClose }) {
  const [vendor, setVendor] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .getVendor(vendorId)
      .then((data) => active && setVendor(data))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [api, vendorId]);

  const rows = vendor && [
    ['Email', vendor.email],
    ['Phone', formatUsPhone(vendor.phone)],
    ['City', vendor.city],
    ['State', vendor.state],
  ];

  return (
    <Modal title={vendor?.name ?? name} onClose={onClose}>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!vendor && !error && <p className="text-sm text-slate-500">Loading details…</p>}
      {vendor && (
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-medium text-slate-500">{label}</dt>
              <dd className="text-slate-900">{value}</dd>
            </div>
          ))}
          <dt className="font-medium text-slate-500">Status</dt>
          <dd>
            <StatusBadge status={vendor.status} />
          </dd>
        </dl>
      )}
    </Modal>
  );
}

export default function VendorsPage({ api = vendorApi }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState(null); // vendor whose details are open
  const [editing, setEditing] = useState(null); // { vendor } to edit, or { vendor: null } to add

  // Filtering happens on the server; the latest search/status wins.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    api
      .listVendors({ search, status })
      .then((data) => active && setVendors(data))
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [api, search, status, reloadKey]);

  const closeDetails = useCallback(() => setViewing(null), []);
  const closeForm = useCallback(() => setEditing(null), []);

  async function handleSave(input) {
    const existing = editing?.vendor;
    const saved = existing
      ? await api.updateVendor(existing.id, input)
      : await api.createVendor(input);
    setEditing(null);
    setNotice(`${saved.name} ${existing ? 'updated' : 'added'}.`);
    setReloadKey((key) => key + 1);
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vendors</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search vendors by name and filter by status.
          </p>
        </div>
        <RoleGate roles={['admin']}>
          <button
            type="button"
            onClick={() => {
              setNotice('');
              setEditing({ vendor: null });
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            + Add Vendor
          </button>
        </RoleGate>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="vendor-search" className="mb-1 block text-sm font-medium text-slate-700">
            Search vendors
          </label>
          <input
            id="vendor-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className={`${controlClass} w-full`}
          />
        </div>
        <div>
          <label htmlFor="vendor-status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="vendor-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${controlClass} w-full sm:w-40`}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
            {vendors.map((vendor) => (
              <tr key={vendor.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setViewing(vendor)}
                    className="text-left font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {vendor.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{vendor.email}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                  {formatUsPhone(vendor.phone)}
                </td>
                <td className="px-4 py-3 text-slate-600">{vendor.city}</td>
                <td className="px-4 py-3 text-slate-600">{vendor.state}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={vendor.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <RoleGate roles={['admin']}>
                    <button
                      type="button"
                      aria-label={`Edit ${vendor.name}`}
                      onClick={() => {
                        setNotice('');
                        setEditing({ vendor });
                      }}
                      className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      Edit
                    </button>
                  </RoleGate>
                </td>
              </tr>
            ))}
            {!loading && !loadError && vendors.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                  No vendors found.
                </td>
              </tr>
            )}
            {loading && vendors.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                  Loading vendors…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && (
        <VendorDetails api={api} vendorId={viewing.id} name={viewing.name} onClose={closeDetails} />
      )}

      {editing && (
        <Modal title={editing.vendor ? 'Edit vendor' : 'Add vendor'} onClose={closeForm}>
          <VendorForm
            vendor={editing.vendor ?? undefined}
            onSubmit={handleSave}
            onCancel={closeForm}
          />
        </Modal>
      )}
    </>
  );
}
