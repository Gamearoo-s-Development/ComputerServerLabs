/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const sharedRoot = resolve(__dirname, '../shared')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@sysadmin-game/shared'] })],
    resolve: {
      alias: {
        '@sysadmin-game/shared': sharedRoot
      }
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/main.js')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Sandboxed preload cannot use top-level ESM imports (Electron 42+); emit CJS.
      rollupOptions: {
        input: resolve(__dirname, 'src/main/preload.js'),
        output: {
          format: 'cjs',
          entryFileNames: 'preload.cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, 'src/renderer/public'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@sysadmin-game/shared': sharedRoot
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          terminal: resolve(__dirname, 'src/renderer/terminal.html')
        }
      }
    }
  }
})
