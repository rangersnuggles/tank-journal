/**
 * Demo reminders for the local seed (SYNTHETIC, LOCAL ONLY). Wired in from
 * scripts/seed-local.mjs with a single call; returns SQL statements.
 *
 *   Shrimp Cube 10g   water change, every 6 weeks          — overdue (3 days)
 *   Living Room 75g   filter clean, every 4 weeks          — due in 9 days
 *   Living Room 75g   fertilizer, weekly                   — due today
 *   Living Room 75g   "Replace CO₂ cylinder", one-off       — due in 10 days
 * and the demo user's notification settings (America/New_York, 8 AM digest).
 */
export function reminderSeedSql({ sq, userId, tankId, dateAgo, demoEmail, tankA, tankB }) {
  const sql = [];
  // Seed users/tanks were just deleted + recreated (CASCADE covers this when FKs are on);
  // clear any leftovers whose user or tank no longer exists.
  sql.push(`DELETE FROM reminder_log WHERE reminder_id NOT IN (SELECT r.id FROM reminders r JOIN tanks t ON t.id = r.tank_id JOIN users u ON u.id = r.user_id);`);
  sql.push(`DELETE FROM reminders WHERE user_id NOT IN (SELECT id FROM users) OR tank_id NOT IN (SELECT id FROM tanks);`);
  sql.push(`DELETE FROM reminder_digests WHERE user_id NOT IN (SELECT id FROM users);`);
  sql.push(`DELETE FROM user_settings WHERE user_id NOT IN (SELECT id FROM users);`);

  const demo = userId(demoEmail);
  sql.push(`INSERT INTO user_settings (user_id, timezone, reminders_email, digest_hour) VALUES (${demo}, 'America/New_York', 1, 8)
    ON CONFLICT(user_id) DO UPDATE SET timezone = excluded.timezone, reminders_email = 1, digest_hour = 8, unsubscribed_at = NULL;`);

  const rows = [
    // [tank, task_type, title, interval_days, due (days from today), last_done_on (days ago | null), auto_reset, created (days ago)]
    [tankB, "water_change", null, 42, -3, null, 1, 45],
    [tankA, "filter_clean", null, 28, 9, 19, 1, 60],
    [tankA, "fertilizer", null, 7, 0, null, 1, 14],
    [tankA, "custom", "Replace CO₂ cylinder", null, 10, null, 0, 2],
  ];
  for (const [tank, type, title, interval, dueIn, lastAgo, autoReset, createdAgo] of rows) {
    const created = `${dateAgo(createdAgo)} 12:00:00`;
    sql.push(`INSERT INTO reminders (user_id, tank_id, task_type, title, interval_days, due_date, auto_reset, last_done_on, created_at, updated_at)
      VALUES (${demo}, ${tankId(tank)}, ${sq(type)}, ${sq(title)}, ${interval ?? "NULL"}, ${sq(dateAgo(-dueIn))}, ${autoReset},
              ${lastAgo == null ? "NULL" : sq(dateAgo(lastAgo))}, ${sq(created)}, ${sq(created)});`);
  }
  return sql;
}
