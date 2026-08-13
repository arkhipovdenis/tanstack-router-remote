import { useState } from 'react'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  useMatches,
  useRouter,
} from '@tanstack/react-router'
import { useRouteTreeUpdateAdapter } from '@tanstack-router-remote/route-tree-adapter'

type LoaderEvidence = {
  readonly execution: number
  readonly cacheKey: string
  readonly beforeLoadMarker?: string
}

type InvoiceSearch = {
  readonly view: 'summary' | 'payments'
}

type RuntimeComparableRouter = {
  readonly history: object
  readonly stores: object
  readonly routesById: object
  readonly options: {
    readonly context?: unknown
  }
}

type DemoRuntimeProbe = {
  readonly hostRouterId: string
  readonly rawRouter: RuntimeComparableRouter | null
  readonly routeTreeAdapter?: object
}

const cachePolicy = {
  staleTime: Infinity,
  gcTime: 5 * 60 * 1000,
} as const

const executions = new Map<string, number>()

function nextLoaderEvidence(
  cacheKey: string,
  beforeLoadMarker?: string,
): LoaderEvidence {
  const execution = (executions.get(cacheKey) ?? 0) + 1
  executions.set(cacheKey, execution)

  return { execution, cacheKey, beforeLoadMarker }
}

function validateInvoiceSearch(search: Record<string, unknown>): InvoiceSearch {
  return {
    view: search.view === 'payments' ? 'payments' : 'summary',
  }
}

function isLoaderEvidence(value: unknown): value is LoaderEvidence {
  return (
    typeof value === 'object' &&
    value !== null &&
    'execution' in value &&
    'cacheKey' in value
  )
}

function useRootLoaderEvidence() {
  return useMatches({
    select: (matches) => {
      const bridgeMatch = matches.find(
        (match) =>
          (match.staticData as { readonly exampleRoute?: string })
            .exampleRoute === 'invoices-root',
      )

      return isLoaderEvidence(bridgeMatch?.loaderData)
        ? bridgeMatch.loaderData
        : undefined
    },
  }) as LoaderEvidence | undefined
}

function InvoicesRoot() {
  const [rootClicks, setRootClicks] = useState(0)
  const router = useRouter() as unknown as RuntimeComparableRouter
  const adapter = useRouteTreeUpdateAdapter()
  const rootLoaderData = useRootLoaderEvidence()
  const runtimeContext = router.options.context as
    | { readonly demoRuntimeProbe?: DemoRuntimeProbe }
    | undefined
  const hostRuntime = runtimeContext?.demoRuntimeProbe
  const hostRouter = hostRuntime?.rawRouter
  const isHosted = Boolean(hostRouter)

  const runtimeChecks = [
    {
      label: 'Second scoped facade',
      value: hostRouter ? router !== hostRouter : false,
    },
    {
      label: 'Host history',
      value: hostRouter ? router.history === hostRouter.history : false,
    },
    {
      label: 'Host stores / route cache',
      value: hostRouter ? router.stores === hostRouter.stores : false,
    },
    {
      label: 'Host route registry',
      value: hostRouter ? router.routesById === hostRouter.routesById : false,
    },
    {
      label: 'One attachment adapter',
      value: hostRouter ? hostRuntime?.routeTreeAdapter === adapter : false,
    },
  ]

  return (
    <section className="invoices-root" data-testid="invoices-remote-root">
      <header className="header">
        <div>
          <p className="eyebrow">Nested Module Federation remote</p>
          <h2>Invoices route tree</h2>
          <p className="lede">
            This is an exposed tree loaded by the Orders remote, which was
            itself loaded by the Host. Its root is bridged and scoped a second
            time without creating another TanStack Router instance.
          </p>
        </div>
        <span className="badge" data-testid="invoices-root-loader">
          {rootLoaderData
            ? `root loader #${rootLoaderData.execution}`
            : 'root loader pending'}
        </span>
      </header>

      <p className="root-lifecycle" data-testid="invoices-root-lifecycle">
        {rootLoaderData?.beforeLoadMarker ? (
          <>
            ✓ root <code>beforeLoad</code> → loader context:{' '}
            <code>{rootLoaderData.beforeLoadMarker}</code>
          </>
        ) : (
          <>… waiting for nested root lifecycle</>
        )}
      </p>

      <nav className="nav" aria-label="Nested invoices routes">
        <Link to="/">Invoices index</Link>
        <Link to="/" search={{ view: 'payments' }}>
          Index with search
        </Link>
        <Link to="/$invoiceId" params={{ invoiceId: 'INV-42' }}>
          Invoice INV-42
        </Link>
        <Link to="/$invoiceId" params={{ invoiceId: 'INV-77' }}>
          Invoice INV-77
        </Link>
      </nav>

      <section className="runtime-panel" data-testid="nested-runtime-identity">
        <div>
          <p className="eyebrow">Nested runtime identity</p>
          <h3>Still one host runtime</h3>
        </div>
        <div className="runtime-grid">
          {runtimeChecks.map((check) => (
            <div className="runtime-check" key={check.label}>
              <span>{check.label}</span>
              <strong className={isHosted && check.value ? 'pass' : 'waiting'}>
                {isHosted
                  ? check.value
                    ? '✓ same runtime'
                    : '✕ different object'
                  : '— standalone invoices'}
              </strong>
            </div>
          ))}
        </div>
        <p className="hint">
          <code>Link to=&quot;/&quot;</code> above is deliberately native
          TanStack navigation. From this second nested scope it resolves to
          <code>/platform/orders/invoices</code>, not the host home route.
        </p>
      </section>

      <section className="state-lab" data-testid="nested-root-state">
        <div>
          <p className="eyebrow">Nested root state</p>
          <h3>Root layout remains mounted below its children</h3>
          <p>
            Switch index and detail routes after incrementing this state. It
            remains because this root bridge stays matched; leave the invoices
            mount and it resets as normal React lifecycle behavior.
          </p>
        </div>
        <div className="controls">
          <button type="button" onClick={() => setRootClicks((value) => value + 1)}>
            Nested root state +1
          </button>
          <output data-testid="nested-root-state-value">{rootClicks}</output>
        </div>
      </section>

      <Outlet />
    </section>
  )
}

function InvoicesIndex() {
  const [clicks, setClicks] = useState(0)
  const search = invoicesIndexRoute.useSearch() as InvoiceSearch
  const loaderData = invoicesIndexRoute.useLoaderData() as LoaderEvidence
  const nextView = search.view === 'summary' ? 'payments' : 'summary'

  return (
    <section className="route-card" data-testid="nested-invoices-index">
      <div className="route-heading">
        <div>
          <p className="eyebrow">Nested remote index</p>
          <h3>Invoices index component</h3>
        </div>
        <LoaderBadge data={loaderData} />
      </div>
      <p>
        Validated search is <code>{JSON.stringify(search)}</code>. The loader
        uses <code>view</code> as its dependency, so summary and payments have
        separate native cache entries on the one host router.
      </p>
      <nav className="nav compact" aria-label="Invoice index actions">
        <Link to="/" search={{ view: nextView }}>
          Change search to {nextView}
        </Link>
        <Link to="/" search={{ view: 'summary' }}>
          Return to summary cache
        </Link>
      </nav>
      <div className="controls">
        <button type="button" onClick={() => setClicks((value) => value + 1)}>
          Index state +1
        </button>
        <output data-testid="nested-index-state-value">{clicks}</output>
      </div>
    </section>
  )
}

function InvoicesWorkspace() {
  const [clicks, setClicks] = useState(0)
  const loaderData = invoicesWorkspaceRoute.useLoaderData() as LoaderEvidence

  return (
    <section className="workspace-layout" data-testid="nested-invoices-workspace">
      <div className="route-heading">
        <div>
          <p className="eyebrow">Actual pathless nested route</p>
          <h3>Invoices workspace layout</h3>
        </div>
        <LoaderBadge data={loaderData} />
      </div>
      <p>
        This <code>id: 'invoices-workspace'</code> route has no URL segment.
        It remains mounted while its index and detail children change.
      </p>
      <div className="controls">
        <button type="button" onClick={() => setClicks((value) => value + 1)}>
          Pathless state +1
        </button>
        <output data-testid="nested-pathless-state-value">{clicks}</output>
      </div>
      <Outlet />
    </section>
  )
}

function InvoiceDetail() {
  const [clicks, setClicks] = useState(0)
  const params = invoiceDetailRoute.useParams() as { readonly invoiceId: string }
  const loaderData = invoiceDetailRoute.useLoaderData() as LoaderEvidence
  const nextInvoiceId = params.invoiceId === 'INV-42' ? 'INV-77' : 'INV-42'

  return (
    <section className="route-card" data-testid="nested-invoice-detail">
      <div className="route-heading">
        <div>
          <p className="eyebrow">Nested parameterized route</p>
          <h3>
            Invoice <code>{params.invoiceId}</code>
          </h3>
        </div>
        <LoaderBadge data={loaderData} />
      </div>
      <p>
        The nested remote receives params and runs its loader through the
        shared host router. Changing the invoice id has a different cache key.
      </p>
      <nav className="nav compact" aria-label="Invoice detail actions">
        <Link to="/$invoiceId" params={{ invoiceId: nextInvoiceId }}>
          Change id to {nextInvoiceId}
        </Link>
        <Link to="/">Back to nested index</Link>
      </nav>
      <div className="controls">
        <button type="button" onClick={() => setClicks((value) => value + 1)}>
          Detail state +1
        </button>
        <output data-testid="nested-detail-state-value">{clicks}</output>
      </div>
    </section>
  )
}

function LoaderBadge({ data }: { readonly data: LoaderEvidence }) {
  return (
    <span className="badge" data-testid="nested-loader-badge">
      loader #{data.execution} · {data.cacheKey}
    </span>
  )
}

const rootRoute = createRootRoute({
  component: InvoicesRoot,
  beforeLoad: () => ({ invoicesRootBeforeLoad: 'invoices-before-load' }),
  loader: async ({ context }) =>
    nextLoaderEvidence(
      'invoices-root',
      (context as { readonly invoicesRootBeforeLoad?: string })
        .invoicesRootBeforeLoad,
    ),
  staticData: {
    exampleRoute: 'invoices-root',
  },
  ...cachePolicy,
})

const invoicesIndexRoute = createRoute({
  getParentRoute: () => invoicesWorkspaceRoute,
  path: '/',
  validateSearch: validateInvoiceSearch,
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ deps }) =>
    nextLoaderEvidence(`invoices-index:view=${deps.view}`),
  component: InvoicesIndex,
  ...cachePolicy,
})

const invoiceDetailRoute = createRoute({
  getParentRoute: () => invoicesWorkspaceRoute,
  path: '/$invoiceId',
  loader: async ({ params }) =>
    nextLoaderEvidence(`invoice-detail:${params.invoiceId}`),
  component: InvoiceDetail,
  ...cachePolicy,
})

const invoicesWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'invoices-workspace',
  component: InvoicesWorkspace,
  loader: async () => nextLoaderEvidence('invoices-workspace'),
  ...cachePolicy,
})

invoicesWorkspaceRoute.addChildren([invoicesIndexRoute, invoiceDetailRoute])

export const routeTree = rootRoute.addChildren([invoicesWorkspaceRoute])
