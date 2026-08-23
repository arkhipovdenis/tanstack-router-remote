import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        // solid-js must go through Vite's resolver so the conditions below
        // apply; externalised, Node picks its own (server) export.
        inline: [/solid-js/],
      },
    },
  },
  resolve: {
    // Solid ships separate server and browser builds behind export conditions.
    // Without `browser` here, `solid-js/web` resolves to the server build and
    // any client-only API throws "Client-only API called on the server side"
    // even under jsdom.
    conditions: ['browser', 'development'],
  },
})
