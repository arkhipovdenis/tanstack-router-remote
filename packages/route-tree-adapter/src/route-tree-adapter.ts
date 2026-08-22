// Named entry point: `tanstack-router-remote/route-tree-adapter`.
//
// It exposes the same surface as the package root. The root stays the short
// path for the common case; this one names the subsystem, leaving room for
// further entries (a server-only or transport-specific one) without turning
// the root into a grab bag.

export * from './index.js'
