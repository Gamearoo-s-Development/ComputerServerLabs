/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import FakeTerminal from '../FakeTerminal.jsx'

/** Dashboard wrapper — fictional terminal ambience only. */
export default function TerminalWidget() {
  return (
    <FakeTerminal
      subtle
      className="border-accent/20 shadow-glow"
      title="lab terminal — bash (simulated)"
    />
  )
}
