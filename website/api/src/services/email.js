/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { sendVerificationEmailForAccount } from './accountMailActions.js'

/** Registration welcome / verification — always sent to the account email on file. */
export async function sendVerificationEmail(user) {
  return sendVerificationEmailForAccount(user.id)
}
