// jsdom implements no scrolling, and TanStack Router calls window.scrollTo on
// every navigation. Left unstubbed it prints a "Not implemented" stack per
// navigation, which drowns real failures without ever being one.
//
// Guarded: this file also runs for suites whose environment is node, where
// there is no window at all.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: () => {},
  })
}
