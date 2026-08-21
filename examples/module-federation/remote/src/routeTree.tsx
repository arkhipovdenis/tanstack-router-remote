import { useState } from 'react'
import { loadRemote } from '@module-federation/runtime'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  notFound,
  useMatches,
  useRouter,
  type AnyRoute,
} from '@tanstack/react-router'
import {
  createRemoteRoute,
  RemoteRouteMount,
} from '@tanstack-router-remote/route-tree-adapter'

type LoaderEvidence = {
  readonly route: string
  readonly execution: number
  readonly cacheKey: string
  readonly createdAt: string
  readonly beforeLoadMarker?: string
}

type IndexSearch = {
  readonly view: 'summary' | 'audit'
  readonly query: string
}

type OrderSearch = {
  readonly tab: 'overview' | 'history'
}

type DemoStaticData = {
  readonly demoRoute?: string
  readonly remoteRootBridge?: boolean
}

type EvidenceMatch = {
  readonly demoRoute?: string
  readonly isRemoteRootBridge: boolean
  readonly loaderData?: LoaderEvidence
}

type RuntimeComparableRouter = {
  readonly history: object
  readonly stores: object
  readonly routesById: object
  readonly state: {
    readonly location: {
      readonly href: string
    }
    readonly matches: readonly {
      readonly loaderData?: unknown
      readonly staticData?: unknown
    }[]
  }
  readonly options: {
    readonly context?: unknown
  }
  invalidate(): Promise<unknown>
}

type DemoRuntimeProbe = {
  readonly hostRouterId: string
  readonly rawRouter: RuntimeComparableRouter | null
  readonly routeTreeAdapter?: object | null
}

type NestedRemoteRouteTreeModule = {
  readonly routeTree: AnyRoute
}

const cachePolicy = {
  staleTime: Infinity,
  gcTime: 5 * 60 * 1000,
} as const

const executionByRoute = new Map<string, number>()

const loadInvoicesRouteTree = async () => {
  const remote =
    await loadRemote<NestedRemoteRouteTreeModule>('invoices/routeTree')

  if (!remote?.routeTree) {
    throw new Error('invoices/routeTree did not expose routeTree')
  }

  return remote.routeTree
}

function nextLoaderEvidence(
  route: string,
  cacheKey: string,
  beforeLoadMarker?: string,
): LoaderEvidence {
  const execution = (executionByRoute.get(route) ?? 0) + 1
  executionByRoute.set(route, execution)

  return {
    route,
    execution,
    cacheKey,
    createdAt: new Date().toLocaleTimeString(),
    beforeLoadMarker,
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function validateIndexSearch(search: Record<string, unknown>): IndexSearch {
  return {
    view: search.view === 'audit' ? 'audit' : 'summary',
    query: typeof search.query === 'string' ? search.query : '',
  }
}

function validateOrderSearch(search: Record<string, unknown>): OrderSearch {
  return {
    tab: search.tab === 'history' ? 'history' : 'overview',
  }
}

function isLoaderEvidence(value: unknown): value is LoaderEvidence {
  return (
    typeof value === 'object' &&
    value !== null &&
    'route' in value &&
    'execution' in value &&
    'cacheKey' in value &&
    'createdAt' in value
  )
}

function useEvidenceMatches() {
  return useMatches({
    select: (matches) =>
      matches.map((match) => {
        const staticData = match.staticData as DemoStaticData

        return {
          demoRoute: staticData.demoRoute,
          isRemoteRootBridge: staticData.remoteRootBridge === true,
          loaderData: isLoaderEvidence(match.loaderData)
            ? match.loaderData
            : undefined,
        } satisfies EvidenceMatch
      }),
  }) as EvidenceMatch[]
}

function getActiveLoaderSnapshot(router: RuntimeComparableRouter) {
  const loaders = router.state.matches.flatMap((match) => {
    const staticData = match.staticData as DemoStaticData

    if (!staticData.demoRoute || !isLoaderEvidence(match.loaderData)) {
      return []
    }

    return [`${staticData.demoRoute} #${match.loaderData.execution}`]
  })

  return loaders.length > 0 ? loaders.join(' · ') : 'no active loader evidence'
}

function OrdersRoot() {
  const [rootClicks, setRootClicks] = useState(0)
  const [rootDraft, setRootDraft] = useState('')
  const matches = useEvidenceMatches()
  const bridgeMatch = matches.find((match) => match.isRemoteRootBridge)
  const activeRoutes = new Set(
    matches.flatMap((match) => (match.demoRoute ? [match.demoRoute] : [])),
  )

  return (
    <section className="remote-root" data-testid="remote-root-component">
      <header className="remote-header">
        <div>
          <p className="eyebrow">Federated remote · interactive evidence</p>
          <h2>Orders route tree</h2>
          <p className="lede">
            This is the original remote root component, rendered below the host
            mount through the pathless root bridge.
          </p>
        </div>
        <span className="badge badge-pass" data-testid="remote-root-rendered">
          ✓ root rendered
        </span>
      </header>

      <nav className="demo-nav" aria-label="Remote route examples">
        <Link to="/">Index</Link>
        <Link to="/" search={{ view: 'audit', query: 'cache-demo' }}>
          Index search
        </Link>
        <Link to="/$orderId" params={{ orderId: '42' }}>
          Order 42
        </Link>
        <Link
          to="/$orderId"
          params={{ orderId: '77' }}
          search={{ tab: 'history' }}
        >
          Order 77 + search
        </Link>
        <Link to="/$orderId/activity" params={{ orderId: '42' }}>
          Nested activity
        </Link>
        <Link to="/invoices">Invoices nested remote</Link>
        <Link to="/slow">Pending boundary</Link>
        <Link to="/failure">Error boundary</Link>
        <Link to="/not-found">Not-found boundary</Link>
        <Link to={'/42/not-a-real-child' as never}>Unknown nested path</Link>
      </nav>

      <EvidenceMatrix
        activeRoutes={activeRoutes}
        rootLoaderData={bridgeMatch?.loaderData}
      />

      <RuntimeIdentityPanel />

      <section className="state-lab" data-testid="remote-root-state-lab">
        <div>
          <p className="eyebrow">Root React state</p>
          <h3>State belongs to the remote root layout</h3>
          <p>
            Increment or type a value, then switch between Index, Order,
            Activity, Pending and back. This root match stays mounted across
            remote descendants, so its local state remains intact.
          </p>
        </div>
        <div className="state-controls">
          <button
            type="button"
            onClick={() => setRootClicks((value) => value + 1)}
          >
            Root clicks +1
          </button>
          <output data-testid="remote-root-state-value">{rootClicks}</output>
          <label>
            Root draft
            <input
              aria-label="Root draft"
              value={rootDraft}
              onChange={(event) => setRootDraft(event.target.value)}
              placeholder="persists across descendants"
            />
          </label>
        </div>
        <p className="hint">
          Going to Host home unmounts the remote root, so this state resets on
          the next entry. That reset is expected native React lifecycle
          behavior—not a router cache failure.
        </p>
      </section>

      <Outlet />
    </section>
  )
}

function EvidenceMatrix({
  activeRoutes,
  rootLoaderData,
}: {
  activeRoutes: Set<string>
  rootLoaderData: LoaderEvidence | undefined
}) {
  return (
    <section className="evidence-panel" aria-labelledby="evidence-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Live route evidence</p>
          <h3 id="evidence-heading">What is running now</h3>
        </div>
        <span className="cache-policy">native cache: stale ∞ · gc 5 min</span>
      </div>
      <div className="table-scroll">
        <table className="evidence-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Live result</th>
              <th>How to verify it</th>
            </tr>
          </thead>
          <tbody>
            <EvidenceRow
              testId="evidence-root-bridge"
              capability="Remote root + bridge loader"
              result={
                rootLoaderData
                  ? `✓ loader execution #${rootLoaderData.execution}`
                  : '… waiting for bridge loader'
              }
              positive={Boolean(rootLoaderData)}
              detail={
                rootLoaderData
                  ? `cache key: ${rootLoaderData.cacheKey}`
                  : 'The original __root__ component is already visible above.'
              }
            />
            <EvidenceRow
              testId="evidence-before-load"
              capability="Remote root beforeLoad → loader context"
              result={
                rootLoaderData?.beforeLoadMarker
                  ? `✓ ${rootLoaderData.beforeLoadMarker}`
                  : '… waiting for root lifecycle'
              }
              positive={Boolean(rootLoaderData?.beforeLoadMarker)}
              detail="The bridge executes the remote root beforeLoad, then passes its context to the root loader."
            />
            <EvidenceRow
              testId="evidence-pathless-layout"
              capability="Remote pathless workspace layout"
              result={
                activeRoutes.has('pathless-workspace')
                  ? '✓ mounted for every remote child'
                  : '— inactive'
              }
              positive={activeRoutes.has('pathless-workspace')}
              detail="Its own local state is visible below this table."
            />
            <EvidenceRow
              testId="evidence-index"
              capability="Index + validated search + loader deps"
              result={activeRoutes.has('index') ? '✓ active' : '— choose Index'}
              positive={activeRoutes.has('index')}
              detail="Switch summary → audit → summary to observe native cache reuse."
            />
            <EvidenceRow
              testId="evidence-detail"
              capability="Detail route + params + validated search"
              result={
                activeRoutes.has('order') ? '✓ active' : '— choose Order 42'
              }
              positive={activeRoutes.has('order')}
              detail="Change order id or tab; the same detail component keeps its local state."
            />
            <EvidenceRow
              testId="evidence-nested"
              capability="Nested activity route + inherited params"
              result={
                activeRoutes.has('activity')
                  ? '✓ active'
                  : '— choose Nested activity'
              }
              positive={activeRoutes.has('activity')}
              detail="It is a child below the remote detail route, not a host route."
            />
            <EvidenceRow
              testId="evidence-boundaries"
              capability="Pending, error and not-found boundaries"
              result="✓ routes are available"
              positive
              detail="Open the three boundary links above; each is a normal remote route boundary."
            />
          </tbody>
        </table>
      </div>
      <p className="hint">
        The root loader data is read from the bridge match. The generated remote{' '}
        <code>__root__</code> still has no host-tree identity, so this example
        deliberately does not call <code>rootRoute.useLoaderData()</code>.
      </p>
    </section>
  )
}

function EvidenceRow({
  testId,
  capability,
  result,
  detail,
  positive,
}: {
  testId: string
  capability: string
  result: string
  detail: string
  positive: boolean
}) {
  return (
    <tr data-testid={testId}>
      <th>{capability}</th>
      <td>
        <span className={positive ? 'status-pass' : 'status-waiting'}>
          {result}
        </span>
      </td>
      <td>{detail}</td>
    </tr>
  )
}

function RuntimeIdentityPanel() {
  const router = useRouter() as unknown as RuntimeComparableRouter
  const [cacheOutcome, setCacheOutcome] = useState(
    'No invalidation requested in this runtime yet.',
  )
  const [isInvalidating, setIsInvalidating] = useState(false)
  const context = router.options.context as
    { demoRuntimeProbe?: DemoRuntimeProbe } | undefined
  const hostRuntime = context?.demoRuntimeProbe
  const hostRouter = hostRuntime?.rawRouter
  const isHosted = Boolean(hostRouter)

  const invalidateActiveNativeCache = async () => {
    const before = getActiveLoaderSnapshot(router)

    setIsInvalidating(true)
    setCacheOutcome(`… invalidating active native entries: ${before}`)

    try {
      await router.invalidate()

      const after = getActiveLoaderSnapshot(router)
      setCacheOutcome(`✓ native cache refreshed: ${before} → ${after}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setCacheOutcome(`✕ invalidate failed: ${message}`)
    } finally {
      setIsInvalidating(false)
    }
  }

  const checks = [
    {
      label: 'Scoped router facade',
      value: hostRouter ? router !== hostRouter : false,
      passLabel: '✓ expected facade',
      inactiveLabel: '— standalone remote',
    },
    {
      label: 'Browser history object',
      value: hostRouter ? router.history === hostRouter.history : false,
      passLabel: '✓ same object',
      inactiveLabel: '— no host probe',
    },
    {
      label: 'TanStack stores / native cache',
      value: hostRouter ? router.stores === hostRouter.stores : false,
      passLabel: '✓ same object',
      inactiveLabel: '— no host probe',
    },
    {
      label: 'Route registry',
      value: hostRouter ? router.routesById === hostRouter.routesById : false,
      passLabel: '✓ same object',
      inactiveLabel: '— no host probe',
    },
    {
      label: 'Current location',
      value: hostRouter
        ? router.state.location.href === hostRouter.state.location.href
        : false,
      passLabel: '✓ same host location',
      inactiveLabel: '— no host probe',
    },
  ]

  return (
    <section className="runtime-panel" data-testid="runtime-identity-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Runtime identity</p>
          <h3>One host runtime, not a second router</h3>
        </div>
        <span className={isHosted ? 'badge badge-pass' : 'badge badge-neutral'}>
          {isHosted
            ? `host: ${hostRuntime?.hostRouterId}`
            : 'standalone remote'}
        </span>
      </div>
      <div className="runtime-grid">
        {checks.map((check) => (
          <div className="runtime-check" key={check.label}>
            <span>{check.label}</span>
            <strong
              className={
                isHosted && check.value ? 'status-pass' : 'status-waiting'
              }
            >
              {isHosted
                ? check.value
                  ? check.passLabel
                  : '✕ different object'
                : check.inactiveLabel}
            </strong>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="secondary-button"
        data-testid="native-cache-invalidate"
        disabled={isInvalidating}
        onClick={() => void invalidateActiveNativeCache()}
      >
        {isInvalidating
          ? 'Invalidating active native route cache…'
          : 'Invalidate active native route cache'}
      </button>
      <output
        className="cache-outcome"
        data-testid="native-cache-invalidation-outcome"
        aria-live="polite"
      >
        {cacheOutcome}
      </output>
      <p className="hint">
        This calls TanStack Router’s native <code>router.invalidate()</code>. It
        does not use a custom MFE cache. After it finishes, active loader
        execution numbers increase; normal navigation reuses the entries while
        they remain fresh.
      </p>
    </section>
  )
}

function OrdersWorkspace() {
  const [workspaceClicks, setWorkspaceClicks] = useState(0)
  const workspaceLoaderData = workspaceRoute.useLoaderData() as LoaderEvidence

  return (
    <section className="workspace-layout" data-testid="remote-pathless-layout">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Actual pathless remote route</p>
          <h3>Workspace layout</h3>
        </div>
        <span className="badge badge-pass" data-testid="pathless-loader-run">
          ✓ loader #{workspaceLoaderData.execution}
        </span>
      </div>
      <p>
        This is a real <code>id: 'workspace'</code> pathless route below the
        remote root bridge. It remains mounted while any of its child routes
        change.
      </p>
      <div className="compact-state">
        <button
          type="button"
          onClick={() => setWorkspaceClicks((value) => value + 1)}
        >
          Pathless state +1
        </button>
        <output data-testid="pathless-state-value">{workspaceClicks}</output>
        <span>
          Switch any child route; this value should stay. Return through Host
          home; it resets because this layout unmounted.
        </span>
      </div>
      <Outlet />
    </section>
  )
}

function OrdersIndex() {
  const [indexClicks, setIndexClicks] = useState(0)
  const [draft, setDraft] = useState('')
  const search = indexRoute.useSearch() as IndexSearch
  const loaderData = indexRoute.useLoaderData() as LoaderEvidence
  const nextView = search.view === 'summary' ? 'audit' : 'summary'

  return (
    <section className="route-card" data-testid="remote-index-component">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Index route</p>
          <h3>Remote index is active</h3>
        </div>
        <LoaderRun data={loaderData} testId="index-loader-run" />
      </div>
      <p>
        Validated search: <code>{JSON.stringify(search)}</code>. Its loader
        dependency is <code>view</code>, so summary and audit get distinct
        native cache entries.
      </p>
      <nav className="inline-nav" aria-label="Index interactions">
        <Link to="/" search={{ view: nextView, query: search.query }}>
          Change search to {nextView}
        </Link>
        <Link to="/" search={{ view: 'summary', query: 'cache-demo' }}>
          Return to cached summary
        </Link>
        <Link to="/$orderId" params={{ orderId: '42' }}>
          Leave index for detail
        </Link>
      </nav>
      <LeafStateLab
        label="Index local state"
        value={indexClicks}
        onIncrement={() => setIndexClicks((value) => value + 1)}
        draft={draft}
        onDraftChange={setDraft}
        testId="index-state-value"
        explanation="Changing only index search keeps this component mounted, so the value and draft stay. Navigating to a different branch (Detail) unmounts Index and resets it on return—expected React behavior."
      />
    </section>
  )
}

function OrderLayout() {
  const [detailClicks, setDetailClicks] = useState(0)
  const [draft, setDraft] = useState('')
  const params = orderRoute.useParams() as { orderId: string }
  const search = orderRoute.useSearch() as OrderSearch
  const loaderData = orderRoute.useLoaderData() as LoaderEvidence
  const navigate = orderRoute.useNavigate()
  const nextOrderId = params.orderId === '42' ? '77' : '42'
  const nextTab = search.tab === 'overview' ? 'history' : 'overview'

  return (
    <section
      className="route-card order-layout"
      data-testid="remote-detail-component"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Detail parent route</p>
          <h3>
            Order <code data-testid="detail-param-value">{params.orderId}</code>
          </h3>
        </div>
        <LoaderRun data={loaderData} testId="detail-loader-run" />
      </div>
      <p>
        Params: <code>{JSON.stringify(params)}</code> · validated search:{' '}
        <code>{JSON.stringify(search)}</code>
      </p>
      <nav className="inline-nav" aria-label="Detail interactions">
        <Link
          to="/$orderId"
          params={{ orderId: nextOrderId }}
          search={{ tab: search.tab }}
        >
          Change param to {nextOrderId}
        </Link>
        <Link
          to="/$orderId"
          params={{ orderId: params.orderId }}
          search={{ tab: nextTab }}
        >
          Change search to {nextTab}
        </Link>
        <Link
          to="/$orderId/activity"
          params={{ orderId: params.orderId }}
          search={{ tab: search.tab }}
        >
          Open nested activity
        </Link>
      </nav>
      <section className="route-api-lab" data-testid="detail-route-api-lab">
        <div>
          <p className="eyebrow">Route-bound navigation APIs</p>
          <h4>
            Actual <code>orderRoute.Link</code> and{' '}
            <code>orderRoute.useNavigate()</code>
          </h4>
          <p>
            These controls are bound to this remote route object, not to the
            generic <code>Link</code> above. Both still resolve{' '}
            <code>to="/"</code>
            inside the Orders mount through the scoped host router.
          </p>
        </div>
        <div className="route-api-controls">
          <orderRoute.Link data-testid="detail-route-link-to-index" to="/">
            Route.Link → remote Index
          </orderRoute.Link>
          <button
            type="button"
            data-testid="detail-route-navigate-to-index"
            onClick={() => {
              void navigate({ to: '/' } as never)
            }}
          >
            Route.useNavigate() → remote Index
          </button>
        </div>
        <p className="hint">
          After either action, inspect the host URL: it becomes the mounted
          remote index instead of host <code>/platform/</code>.
        </p>
      </section>
      <LeafStateLab
        label="Detail local state"
        value={detailClicks}
        onIncrement={() => setDetailClicks((value) => value + 1)}
        draft={draft}
        onDraftChange={setDraft}
        testId="detail-state-value"
        explanation="This route has no remountDeps. Changing its params or search retains this component instance and local state. Leaving the order branch unmounts it, which is expected."
      />
      <Outlet />
    </section>
  )
}

function OrderOverview() {
  const [overviewClicks, setOverviewClicks] = useState(0)

  return (
    <section
      className="nested-card"
      data-testid="remote-detail-index-component"
    >
      <p className="eyebrow">Detail index child</p>
      <h4>Order overview</h4>
      <p>
        This is the index child of <code>/$orderId</code>; it proves the remote
        tree can render an index below a parameterized parent.
      </p>
      <div className="compact-state">
        <button
          type="button"
          onClick={() => setOverviewClicks((value) => value + 1)}
        >
          Overview state +1
        </button>
        <output data-testid="detail-index-state-value">{overviewClicks}</output>
        <span>
          It persists through detail param/search updates, but not after
          switching to Activity because that child is replaced.
        </span>
      </div>
    </section>
  )
}

function OrderActivity() {
  const [activityClicks, setActivityClicks] = useState(0)
  const params = activityRoute.useParams() as { orderId: string }
  const loaderData = activityRoute.useLoaderData() as LoaderEvidence
  const nextOrderId = params.orderId === '42' ? '77' : '42'

  return (
    <section className="nested-card" data-testid="remote-activity-component">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Nested child route</p>
          <h4>Activity for order {params.orderId}</h4>
        </div>
        <LoaderRun data={loaderData} testId="activity-loader-run" />
      </div>
      <p>
        The activity loader receives the parameter inherited from the parent
        detail route.
      </p>
      <nav className="inline-nav" aria-label="Activity interactions">
        <Link to="/$orderId/activity" params={{ orderId: nextOrderId }}>
          Change activity param to {nextOrderId}
        </Link>
        <Link to="/$orderId" params={{ orderId: params.orderId }}>
          Replace Activity with overview
        </Link>
      </nav>
      <div className="compact-state">
        <button
          type="button"
          onClick={() => setActivityClicks((value) => value + 1)}
        >
          Activity state +1
        </button>
        <output data-testid="activity-state-value">{activityClicks}</output>
        <span>
          A parameter update uses the same Activity route component. Leaving for
          overview replaces this leaf and resets its state as expected.
        </span>
      </div>
    </section>
  )
}

function SlowRoute() {
  const loaderData = slowRoute.useLoaderData() as LoaderEvidence

  return (
    <section className="route-card" data-testid="remote-slow-component">
      <p className="eyebrow">Resolved pending route</p>
      <h3>Slow loader completed</h3>
      <LoaderRun data={loaderData} testId="slow-loader-run" />
      <p>
        The route deliberately waited before rendering. Visit it again while the
        cache is fresh to reuse its loader result.
      </p>
    </section>
  )
}

function SlowRoutePending() {
  return (
    <section
      className="route-card boundary-card"
      data-testid="remote-pending-boundary"
    >
      <p className="eyebrow">Route pending boundary</p>
      <h3>Loading remote slow route…</h3>
      <p>This is the remote route’s native TanStack pendingComponent.</p>
    </section>
  )
}

function IntentionalFailureBoundary({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    <section
      className="route-card boundary-card"
      data-testid="remote-error-boundary"
    >
      <p className="eyebrow">Route error boundary</p>
      <h3>Remote failure was contained</h3>
      <p>
        <code>{message}</code>
      </p>
      <Link to="/">Recover to remote Index</Link>
    </section>
  )
}

function RemoteNotFoundBoundary() {
  return (
    <section
      className="route-card boundary-card"
      data-testid="remote-not-found-boundary"
    >
      <p className="eyebrow">Route not-found boundary</p>
      <h3>Remote route was not found</h3>
      <p>
        This boundary belongs to the remote tree/bridge; the host global 404 did
        not take over.
      </p>
      <Link to="/">Recover to remote Index</Link>
    </section>
  )
}

function InvoicesMount() {
  return (
    <RemoteRouteMount
      mountRoute={invoicesMountRoute}
      loadRouteTree={loadInvoicesRouteTree}
      loading={
        <section className="route-card" data-testid="invoices-loading">
          <p className="eyebrow">Nested Module Federation mount</p>
          <h3>Loading invoices route tree…</h3>
          <p>
            Orders is resolving <code>invoices/routeTree</code> and attaching it
            with the host-owned adapter from React context.
          </p>
        </section>
      }
      error={(error) => (
        <section
          className="route-card boundary-card"
          data-testid="invoices-error"
        >
          <p className="eyebrow">Nested remote failed to load</p>
          <h3>Invoices route tree could not attach</h3>
          <p>
            <code>{error.message}</code>
          </p>
          <Link to="/">Recover to Orders index</Link>
        </section>
      )}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}

function LeafStateLab({
  label,
  value,
  onIncrement,
  draft,
  onDraftChange,
  testId,
  explanation,
}: {
  label: string
  value: number
  onIncrement: () => void
  draft: string
  onDraftChange: (value: string) => void
  testId: string
  explanation: string
}) {
  return (
    <section className="leaf-state-lab">
      <h4>{label}</h4>
      <div className="state-controls">
        <button type="button" onClick={onIncrement}>
          Local state +1
        </button>
        <output data-testid={testId}>{value}</output>
        <label>
          Local draft
          <input
            aria-label={`${label} draft`}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
        </label>
      </div>
      <p className="hint">{explanation}</p>
    </section>
  )
}

function LoaderRun({ data, testId }: { data: LoaderEvidence; testId: string }) {
  return (
    <span className="badge badge-pass" data-testid={testId}>
      loader #{data.execution} · {data.cacheKey}
    </span>
  )
}

const rootRoute = createRootRoute({
  component: OrdersRoot,
  beforeLoad: () => ({ remoteRootBeforeLoad: 'root-before-load' }),
  loader: async ({ context }) =>
    nextLoaderEvidence(
      'remote-root-bridge',
      'root',
      (context as { remoteRootBeforeLoad?: string }).remoteRootBeforeLoad,
    ),
  notFoundComponent: RemoteNotFoundBoundary,
  errorComponent: IntentionalFailureBoundary,
  staticData: {
    demoRoute: 'remote-root',
  },
  ...cachePolicy,
})

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'workspace',
  component: OrdersWorkspace,
  loader: async () => nextLoaderEvidence('pathless-workspace', 'workspace'),
  staticData: {
    demoRoute: 'pathless-workspace',
  },
  ...cachePolicy,
})

const indexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/',
  validateSearch: validateIndexSearch,
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ deps }) =>
    nextLoaderEvidence('index', `index:view=${deps.view}`),
  component: OrdersIndex,
  staticData: {
    demoRoute: 'index',
  },
  ...cachePolicy,
})

const orderRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/$orderId',
  validateSearch: validateOrderSearch,
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: async ({ params, deps }) =>
    nextLoaderEvidence('order', `order:${params.orderId}:tab=${deps.tab}`),
  component: OrderLayout,
  notFoundComponent: RemoteNotFoundBoundary,
  staticData: {
    demoRoute: 'order',
  },
  ...cachePolicy,
})

const orderIndexRoute = createRoute({
  getParentRoute: () => orderRoute,
  path: '/',
  component: OrderOverview,
  staticData: {
    demoRoute: 'order-index',
  },
})

const activityRoute = createRoute({
  getParentRoute: () => orderRoute,
  path: '/activity',
  loader: async ({ params }) =>
    nextLoaderEvidence('activity', `activity:order=${params.orderId}`),
  component: OrderActivity,
  staticData: {
    demoRoute: 'activity',
  },
  ...cachePolicy,
})

const slowRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/slow',
  loader: async () => {
    await wait(700)
    return nextLoaderEvidence('slow', 'slow:700ms')
  },
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: SlowRoutePending,
  component: SlowRoute,
  staticData: {
    demoRoute: 'slow',
  },
  ...cachePolicy,
})

const failureRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/failure',
  loader: async () => {
    throw new Error('Intentional remote loader error')
  },
  errorComponent: IntentionalFailureBoundary,
  component: () => null,
  staticData: {
    demoRoute: 'failure',
  },
})

const notFoundDemoRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/not-found',
  loader: async () => {
    throw notFound({ data: 'Intentional remote not-found' })
  },
  notFoundComponent: RemoteNotFoundBoundary,
  component: () => null,
  staticData: {
    demoRoute: 'not-found',
  },
})

const invoicesMountRoute = createRemoteRoute({
  getParentRoute: () => workspaceRoute,
  path: '/invoices',
  component: InvoicesMount,
  staticData: {
    demoRoute: 'invoices-mount',
  },
}) as AnyRoute

orderRoute.addChildren([orderIndexRoute, activityRoute])
workspaceRoute.addChildren([
  indexRoute,
  orderRoute,
  invoicesMountRoute,
  slowRoute,
  failureRoute,
  notFoundDemoRoute,
])

// Exposed as orders/routeTree. A second host mount needs a factory returning
// fresh root/child route instances rather than this mutable singleton.
export const routeTree = rootRoute.addChildren([workspaceRoute])
