/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** Global leaderboard rows use empty string — NULL breaks UNIQUE(user_id, lab_id) in MariaDB/SQLite. */
export const GLOBAL_LEADERBOARD_LAB_ID = ''
