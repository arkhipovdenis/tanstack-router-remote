import { expect, test, type Page } from '@playwright/test'

/**
 * The production counterpart to the jsdom suites. Each scenario here needs
 * something jsdom cannot provide: a real chunk request, the Module Federation
 * runtime resolving a remote entry over HTTP, or a genuine network failure.
 *
 * These mirror the manual checks recorded in docs/browser-checks.md.
 */

/** Distinct JS resources the document has actually requested. */
const requestedScripts = (page: Page) =>
  page.evaluate(
    () =>
      new Set(
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => name.endsWith('.js')),
      ).size,
  )

test('renders a two-level deep link on one host runtime', async ({ page }) => {
  await page.goto('/platform/orders/invoices/INV-42')

  // Both bridged remote roots resolved below the host mount.
  await expect(page.getByTestId('remote-root-component')).toBeVisible()
  await expect(page.getByTestId('invoices-remote-root')).toBeVisible()
  await expect(page.getByTestId('nested-invoice-detail')).toContainText(
    'INV-42',
  )

  // The nested scope must report the host runtime, not a second router.
  const identity = page.getByTestId('nested-runtime-identity')
  await expect(identity).toBeVisible()
  await expect(identity.getByText('✕')).toHaveCount(0)

  expect(new URL(page.url()).pathname).toBe('/platform/orders/invoices/INV-42')
})

test('follows browser history in both directions', async ({ page }) => {
  await page.goto('/platform/orders/invoices/INV-42')
  await page.getByRole('link', { name: 'Change id to INV-77' }).click()
  await expect(page.getByTestId('nested-invoice-detail')).toContainText(
    'INV-77',
  )

  await page.goBack()
  await expect(page.getByTestId('nested-invoice-detail')).toContainText(
    'INV-42',
  )

  await page.goForward()
  await expect(page.getByTestId('nested-invoice-detail')).toContainText(
    'INV-77',
  )
})

test('reentry reuses the attached tree without new chunks', async ({
  page,
}) => {
  await page.goto('/platform/orders')
  await expect(page.getByTestId('remote-root-component')).toBeVisible()

  const hostId = await page
    .getByTestId('runtime-identity-panel')
    .getByText(/host: host-router-/)
    .textContent()
  const before = await requestedScripts(page)

  // Leaving unmounts the remote root; returning must not re-attach it.
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.getByTestId('host-runtime-id')).toBeVisible()
  await page.getByRole('link', { name: 'Orders remote', exact: true }).click()
  await expect(page.getByTestId('remote-root-component')).toBeVisible()

  expect(await requestedScripts(page)).toBe(before)
  await expect(
    page.getByTestId('runtime-identity-panel').getByText(/host: host-router-/),
  ).toHaveText(hostId!)
})

test('contains a real remote-entry network failure and recovers', async ({
  page,
}) => {
  // The switch points the federation runtime at an absent asset URL, so this
  // is an actual ScriptNetworkError rather than a thrown stub.
  await page.goto('/platform/orders?remoteFailure=network')

  const error = page.getByTestId('orders-error')
  await expect(error).toBeVisible()
  await expect(error).toContainText('Failed to load script')

  // The failure belongs to the mount; the host shell stays interactive.
  await expect(
    page.getByRole('link', { name: 'Home', exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('remote-root-component')).toHaveCount(0)

  await page.goto('/platform/orders')
  await expect(page.getByTestId('remote-root-component')).toBeVisible()
  await expect(page.getByTestId('orders-error')).toHaveCount(0)
})

test('a structural miss reaches the remote boundary, not the host 404', async ({
  page,
}) => {
  // Regression cover for the bootstrap not-found boundary: the host root
  // declares its own notFoundComponent, which used to intercept this URL
  // before the mount could start loading its remote.
  await page.goto('/platform/orders/unknown/deeper')

  await expect(page.getByTestId('remote-not-found-boundary')).toBeVisible()
  await expect(page.getByText('Host page not found')).toHaveCount(0)
})
