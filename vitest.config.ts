import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'
import vueJsx from '@vitejs/plugin-vue-jsx'

// Two projects, because JSX is not portable: the React suite needs esbuild's
// React transform, the Solid suite needs Solid's own Babel pass. One config
// would compile one of them into a runtime that cannot render it.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'react',
          setupFiles: ['tests/support/jsdom-setup.ts'],
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: [
            'tests/**/solid-*.test.{ts,tsx}',
            'tests/**/vue-*.test.{ts,tsx}',
          ],
          server: {
            deps: {
              // solid-js must go through Vite's resolver so the conditions
              // below apply; externalised, Node picks its own server export.
              inline: [/solid-js/],
            },
          },
        },
        resolve: {
          conditions: ['browser', 'development'],
        },
      },
      {
        plugins: [solid()],
        test: {
          name: 'solid',
          setupFiles: ['tests/support/jsdom-setup.ts'],
          include: ['tests/**/solid-*.test.{ts,tsx}'],
          server: { deps: { inline: [/solid-js/] } },
        },
        resolve: {
          conditions: ['browser', 'development'],
        },
      },
      {
        plugins: [vueJsx()],
        test: {
          name: 'vue',
          setupFiles: ['tests/support/jsdom-setup.ts'],
          include: ['tests/**/vue-*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
