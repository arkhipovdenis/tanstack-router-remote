import { useState } from 'react'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  notFound,
  useMatches,
} from '@tanstack/react-router'

type LoaderEvidence = {
  readonly execution: number
  readonly cacheKey: string
  readonly beforeLoadMarker?: string
  readonly createdAt: string
}

type CatalogSearch = {
  readonly view: 'cards' | 'table'
}

type ProductSearch = {
  readonly tab: 'details' | 'history'
}

type ProductParams = {
  readonly productId: string
}

const cachePolicy = {
  staleTime: Infinity,
  gcTime: 5 * 60 * 1000,
} as const

const executionsByCacheKey = new Map<string, number>()

function nextLoaderEvidence(
  cacheKey: string,
  beforeLoadMarker?: string,
): LoaderEvidence {
  const execution = (executionsByCacheKey.get(cacheKey) ?? 0) + 1
  executionsByCacheKey.set(cacheKey, execution)

  return {
    execution,
    cacheKey,
    beforeLoadMarker,
    createdAt: new Date().toLocaleTimeString(),
  }
}

function validateCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  return {
    view: search.view === 'table' ? 'table' : 'cards',
  }
}

function validateProductSearch(search: Record<string, unknown>): ProductSearch {
  return {
    tab: search.tab === 'history' ? 'history' : 'details',
  }
}

function parseProductParams(params: { productId: string }): ProductParams {
  const productId = params.productId.toUpperCase()

  if (!/^SKU-\d+$/.test(productId)) {
    throw new Error('Product id must match SKU-<number>')
  }

  return { productId }
}

function stringifyProductParams(params: ProductParams) {
  return { productId: params.productId }
}

function isLoaderEvidence(value: unknown): value is LoaderEvidence {
  return (
    typeof value === 'object' &&
    value !== null &&
    'execution' in value &&
    'cacheKey' in value &&
    'createdAt' in value
  )
}

function useRootLoaderEvidence() {
  return useMatches({
    select: (matches) => {
      const rootBridge = matches.find(
        (match) =>
          (match.staticData as { readonly nativeExampleRoute?: string })
            .nativeExampleRoute === 'native-import-root',
      )

      return isLoaderEvidence(rootBridge?.loaderData)
        ? rootBridge.loaderData
        : undefined
    },
  }) as LoaderEvidence | undefined
}

function NativeImportRoot() {
  const [rootClicks, setRootClicks] = useState(0)
  const [draft, setDraft] = useState('')
  const loaderData = useRootLoaderEvidence()

  return (
    <section className="native-remote-root" data-testid="native-remote-root">
      <header className="native-header">
        <div>
          <p className="native-eyebrow">Plain ESM remote</p>
          <h2>Native-import route tree</h2>
          <p className="native-lede">
            This tree came from a TypeScript-built workspace package, not Module
            Federation. Its original root component is rendered through the
            adapter&apos;s pathless root bridge.
          </p>
        </div>
        <span className="native-badge">routeTree attached</span>
      </header>

      <p className="native-lifecycle" data-testid="native-root-lifecycle">
        {loaderData?.beforeLoadMarker ? (
          <>
            ✓ root <code>beforeLoad</code> → loader context:{' '}
            <code>{loaderData.beforeLoadMarker}</code> · execution #{' '}
            {loaderData.execution}
          </>
        ) : (
          <>… waiting for the remote root lifecycle</>
        )}
      </p>

      <nav className="native-nav" aria-label="Native import remote routes">
        <Link to="/">Catalog index</Link>
        <Link to="/" search={{ view: 'table' } as never}>
          Catalog table search
        </Link>
        <Link to="/$productId" params={{ productId: 'SKU-42' } as never}>
          SKU-42
        </Link>
        <Link
          to="/$productId"
          params={{ productId: 'sku-77' } as never}
          search={{ tab: 'history' } as never}
        >
          SKU-77 + history
        </Link>
      </nav>

      <section className="native-state-lab" data-testid="native-root-state-lab">
        <div>
          <p className="native-eyebrow">Remote root local state</p>
          <h3>React state belongs to the imported root layout</h3>
          <p>
            Change these values, then move between index and detail. The bridge
            remains matched, so this root stays mounted.
          </p>
        </div>
        <div className="native-controls">
          <button
            type="button"
            onClick={() => setRootClicks((value) => value + 1)}
          >
            Root state +1
          </button>
          <output data-testid="native-root-state-value">{rootClicks}</output>
          <label>
            Root draft
            <input
              aria-label="Native remote root draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="persists below /catalog"
            />
          </label>
        </div>
      </section>

      <Outlet />
    </section>
  )
}

function NativeImportNotFound() {
  return (
    <section
      className="native-route-card"
      data-testid="native-remote-not-found"
    >
      <p className="native-eyebrow">Remote structural 404</p>
      <h3>Catalog route was not found</h3>
      <p>
        The host loaded this remote tree first; its root 404 now owns the
        unmatched catalog URL.
      </p>
      <Link to="/">Return to catalog index</Link>
    </section>
  )
}

function CatalogWorkspace() {
  const [workspaceClicks, setWorkspaceClicks] = useState(0)
  const loaderData = catalogWorkspaceRoute.useLoaderData() as LoaderEvidence

  return (
    <section
      className="native-pathless-layout"
      data-testid="native-pathless-layout"
    >
      <div className="native-route-heading">
        <div>
          <p className="native-eyebrow">Actual pathless route</p>
          <h3>Catalog workspace layout</h3>
          <p>
            This route has no URL segment. It stays mounted while its index and
            parameterized descendants change.
          </p>
        </div>
        <LoaderBadge data={loaderData} />
      </div>
      <div className="native-controls">
        <button
          type="button"
          onClick={() => setWorkspaceClicks((value) => value + 1)}
        >
          Pathless state +1
        </button>
        <output data-testid="native-pathless-state-value">
          {workspaceClicks}
        </output>
      </div>
      <Outlet />
    </section>
  )
}

function CatalogIndex() {
  const [indexClicks, setIndexClicks] = useState(0)
  const search = catalogIndexRoute.useSearch() as CatalogSearch
  const loaderData = catalogIndexRoute.useLoaderData() as LoaderEvidence
  const nextView = search.view === 'cards' ? 'table' : 'cards'

  return (
    <section className="native-route-card" data-testid="native-catalog-index">
      <div className="native-route-heading">
        <div>
          <p className="native-eyebrow">Index + validated search</p>
          <h3>Catalog index component</h3>
        </div>
        <LoaderBadge data={loaderData} />
      </div>
      <p>
        Validated search: <code>{JSON.stringify(search)}</code>. Each view is a
        separate native TanStack loader cache key.
      </p>
      <nav
        className="native-nav native-nav-compact"
        aria-label="Catalog index actions"
      >
        <Link to="/" search={{ view: nextView } as never}>
          Change search to {nextView}
        </Link>
        <Link to="/" search={{ view: 'cards' } as never}>
          Return to cards cache
        </Link>
      </nav>
      <div className="native-controls">
        <button
          type="button"
          onClick={() => setIndexClicks((value) => value + 1)}
        >
          Index state +1
        </button>
        <output data-testid="native-index-state-value">{indexClicks}</output>
      </div>
      <p className="native-hint">
        With <code>staleTime: Infinity</code>, revisit a previously seen view
        and its loader execution number stays unchanged without custom MFE
        caching.
      </p>
    </section>
  )
}

function ProductDetail() {
  const [detailClicks, setDetailClicks] = useState(0)
  const params = productDetailRoute.useParams() as ProductParams
  const search = productDetailRoute.useSearch() as ProductSearch
  const loaderData = productDetailRoute.useLoaderData() as LoaderEvidence
  const nextProductId = params.productId === 'SKU-42' ? 'SKU-77' : 'SKU-42'
  const nextTab = search.tab === 'details' ? 'history' : 'details'

  return (
    <section className="native-route-card" data-testid="native-product-detail">
      <div className="native-route-heading">
        <div>
          <p className="native-eyebrow">Validated params + search</p>
          <h3>
            Product <code>{params.productId}</code>
          </h3>
        </div>
        <LoaderBadge data={loaderData} />
      </div>
      <p>
        <code>params.parse</code> accepts only <code>SKU-&lt;number&gt;</code>{' '}
        and normalizes the visible id. Validated search is{' '}
        <code>{JSON.stringify(search)}</code>.
      </p>
      <nav
        className="native-nav native-nav-compact"
        aria-label="Product detail actions"
      >
        <Link
          to="/$productId"
          params={{ productId: nextProductId } as never}
          search={{ tab: search.tab } as never}
        >
          Change id to {nextProductId}
        </Link>
        <Link
          to="/$productId"
          params={{ productId: params.productId } as never}
          search={{ tab: nextTab } as never}
        >
          Change search to {nextTab}
        </Link>
        <Link to="/">Back to catalog index</Link>
      </nav>
      <div className="native-controls">
        <button
          type="button"
          onClick={() => setDetailClicks((value) => value + 1)}
        >
          Detail state +1
        </button>
        <output data-testid="native-detail-state-value">{detailClicks}</output>
      </div>
      <p className="native-hint">
        The normalized parameter and selected tab both participate in native
        loader cache identity.
      </p>
    </section>
  )
}

function LoaderBadge({ data }: { readonly data: LoaderEvidence }) {
  return (
    <span className="native-badge" data-testid="native-loader-badge">
      loader #{data.execution} · {data.cacheKey}
    </span>
  )
}

const rootRoute = createRootRoute({
  component: NativeImportRoot,
  notFoundComponent: NativeImportNotFound,
  beforeLoad: () => ({ nativeImportRoot: 'native-import-before-load' }),
  loader: async ({ context }) =>
    nextLoaderEvidence(
      'native-import-root',
      (context as { readonly nativeImportRoot?: string }).nativeImportRoot,
    ),
  staticData: {
    nativeExampleRoute: 'native-import-root',
  },
  ...cachePolicy,
})

const catalogWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'native-import-workspace',
  component: CatalogWorkspace,
  loader: async () => nextLoaderEvidence('native-import-workspace'),
  ...cachePolicy,
})

const catalogIndexRoute = createRoute({
  getParentRoute: () => catalogWorkspaceRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ deps }) =>
    nextLoaderEvidence(`native-catalog-index:view=${deps.view}`),
  component: CatalogIndex,
  ...cachePolicy,
})

const productDetailRoute = createRoute({
  getParentRoute: () => catalogWorkspaceRoute,
  path: '/$productId',
  params: {
    parse: parseProductParams,
    stringify: stringifyProductParams,
  },
  validateSearch: validateProductSearch,
  beforeLoad: ({ params }) => {
    if (!/^SKU-\d+$/.test(params.productId)) {
      throw notFound({ data: 'Product id must match SKU-<number>' })
    }
  },
  loaderDeps: ({ search }) => ({
    tab: (search as ProductSearch).tab,
  }),
  loader: async ({ params, deps }) =>
    nextLoaderEvidence(`native-product:${params.productId}:tab=${deps.tab}`),
  component: ProductDetail,
  ...cachePolicy,
})

catalogWorkspaceRoute.addChildren([catalogIndexRoute, productDetailRoute])

/**
 * Plain ESM public entrypoint. The native-import host resolves this built
 * module using `await import('@tanstack-router-remote/example-native-import-remote/routeTree')`.
 */
export const routeTree = rootRoute.addChildren([catalogWorkspaceRoute])
