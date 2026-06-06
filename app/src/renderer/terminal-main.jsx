/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import LabTerminal from './components/labs/LabTerminal.jsx'
import './styles/globals.css'
import './styles/lab-terminal.css'

const params = new URLSearchParams(window.location.search)
const sessionId = params.get('sessionId') ?? ''

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LabTerminal sessionId={sessionId} standalone />
  </React.StrictMode>
)
