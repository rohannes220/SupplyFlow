export default function Layout({ children }) {
  return (
    <div className="min-h-screen md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy-900 text-slate-200 md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-semibold text-white">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded bg-blue-600">
            SF
          </span>
          SupplyFlow
        </div>
        <nav aria-label="Main" className="px-3">
          <a
            href="#orders"
            aria-current="page"
            className="block rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          >
            Purchase Orders
          </a>
        </nav>
      </aside>
      <header className="flex items-center gap-2 bg-navy-900 px-4 py-3 font-semibold text-white md:hidden">
        SupplyFlow
      </header>
      <main id="orders" className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </main>
    </div>
  );
}
