// Run with: npm test   (node --test, no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeText, foldLine, icsDate, icsDateTime, sequenceFrom, buildReminderFeed, buildReminderIcs,
  reminderEventFields, icsFilename, alarmTrigger,
} from "../lib/calendar/ics.js";
import { deriveFeedToken, hashFeedToken, feedUrls, TOKEN_RE, randomNonce } from "../lib/calendar/feed.js";

const octets = (s) => new TextEncoder().encode(s).length;

test("escapeText escapes backslash, semicolon, comma and newlines", () => {
  assert.equal(escapeText("a,b;c\\d"), "a\\,b\\;c\\\\d");
  assert.equal(escapeText("line1\nline2\r\nline3\rline4"), "line1\\nline2\\nline3\\nline4");
  assert.equal(escapeText("tab\there\x07bell"), "tab\there" + "bell");
  assert.equal(escapeText(null), "");
  assert.equal(escapeText("CO₂ · 10g"), "CO₂ · 10g");
});

test("foldLine keeps lines ≤ 75 octets, continuation lines start with one space", () => {
  assert.equal(foldLine("SUMMARY:short"), "SUMMARY:short");
  const exactly75 = "X".repeat(75);
  assert.equal(foldLine(exactly75), exactly75);

  const long = "DESCRIPTION:" + "abcdefghij".repeat(20);
  const folded = foldLine(long);
  const physical = folded.split("\r\n");
  assert.ok(physical.length > 1);
  assert.equal(octets(physical[0]), 75);
  for (const l of physical.slice(1)) {
    assert.ok(l.startsWith(" ") && !l.startsWith("  "));
    assert.ok(octets(l) <= 75);
  }
  // Unfolding (remove CRLF + one space) restores the original line.
  assert.equal(folded.replace(/\r\n /g, ""), long);
});

test("foldLine never splits a multi-byte UTF-8 character", () => {
  const long = "SUMMARY:" + "CO₂ 🐟 ".repeat(30);
  const folded = foldLine(long);
  for (const l of folded.split("\r\n")) {
    assert.ok(octets(l) <= 75, `${octets(l)} octets: ${l}`);
    assert.ok(!l.includes("�"));
  }
  assert.equal(folded.replace(/\r\n /g, ""), long);
});

test("all-day dates and UTC timestamps", () => {
  assert.equal(icsDate("2026-10-09"), "20261009");
  assert.throws(() => icsDate("2026-10-9"));
  assert.equal(icsDateTime("2026-10-09 14:05:01"), "20261009T140501Z"); // D1 datetime('now') is UTC
  assert.equal(icsDateTime(new Date("2026-10-09T14:05:01.999Z")), "20261009T140501Z");
  assert.equal(sequenceFrom("2026-01-01 00:00:10"), 10);
  assert.equal(sequenceFrom("2025-06-01 00:00:00"), 0);
  assert.ok(sequenceFrom("2026-10-09 12:00:01") > sequenceFrom("2026-10-09 12:00:00"));
});

test("event spans one day; DTEND is the next day across month/year ends", () => {
  const ics = buildReminderIcs(
    { id: 9, tank_id: 1, tank_name: "Nano", task_type: "test_water", interval_days: 7, due_date: "2026-12-31", auto_reset: 1, status: "active", created_at: "2026-12-01 00:00:00", updated_at: "2026-12-01 00:00:00" },
    { today: "2026-12-01", origin: "https://aquaslog.com", now: new Date("2026-12-01T00:00:00Z") }
  );
  assert.match(ics, /\r\nDTSTART;VALUE=DATE:20261231\r\n/);
  assert.match(ics, /\r\nDTEND;VALUE=DATE:20270101\r\n/);
});

test("overdue prefix only when the due date is before today", () => {
  const r = { id: 1, tank_id: 2, tank_name: "Cube", task_type: "water_change", interval_days: 7, due_date: "2026-10-09", auto_reset: 1 };
  assert.equal(reminderEventFields(r, { today: "2026-10-09" }).summary, "Water change · Cube");
  assert.equal(reminderEventFields(r, { today: "2026-10-10" }).summary, "Overdue: Water change · Cube");
  assert.equal(reminderEventFields(r, { today: "2026-10-08" }).summary, "Water change · Cube");
});

const FIXTURE = [
  { id: 3, tank_id: 1, tank_name: "Living Room 75g", task_type: "fertilizer", title: null, interval_days: 7, due_date: "2026-10-09", auto_reset: 1, status: "active", last_done_on: null, created_at: "2026-09-25 12:00:00", updated_at: "2026-09-25 12:00:00" },
  { id: 1, tank_id: 2, tank_name: "Shrimp Cube 10g", task_type: "water_change", title: null, interval_days: 42, due_date: "2026-10-06", auto_reset: 1, status: "active", last_done_on: null, created_at: "2026-08-25 12:00:00", updated_at: "2026-08-25 12:00:00" },
  { id: 4, tank_id: 1, tank_name: "Living Room 75g", task_type: "custom", title: "Replace CO₂ cylinder; check regulator, tubing", interval_days: null, due_date: "2026-10-19", auto_reset: 0, status: "active", last_done_on: null, created_at: "2026-10-07 12:00:00", updated_at: "2026-10-07 12:00:00" },
  { id: 5, tank_id: 1, tank_name: "Living Room 75g", task_type: "filter_clean", title: null, interval_days: 28, due_date: "2026-10-18", auto_reset: 1, status: "paused", last_done_on: null, created_at: "2026-08-10 12:00:00", updated_at: "2026-08-10 12:00:00" },
];

test("full feed snapshot (CRLF, folded, sorted by due date, paused skipped)", () => {
  const feed = buildReminderFeed({
    reminders: FIXTURE,
    timezone: "America/New_York",
    today: "2026-10-09",
    origin: "https://aquaslog.com",
    now: new Date("2026-10-09T14:05:01Z"),
    lastDone: (r) => (r.id === 1 ? "2026-08-25" : null),
  });
  const expected = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AquaSlog//Reminders 1.1//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AquaSlog reminders",
    "NAME:AquaSlog reminders",
    "X-WR-TIMEZONE:America/New_York",
    "X-WR-CALDESC:Maintenance reminders from AquaSlog. Each reminder appears on ",
    " its next due date.",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    "BEGIN:VEVENT",
    "UID:reminder-1@aquaslog.com",
    "DTSTAMP:20261009T140501Z",
    "DTSTART;VALUE=DATE:20261006",
    "DTEND;VALUE=DATE:20261007",
    "SUMMARY:Overdue: Water change · Shrimp Cube 10g",
    "DESCRIPTION:Every 6 weeks. Logging it in your AquaSlog journal moves this t",
    " o the next due date.\\nLast water change: Aug 25\\, 2026.\\n\\nOpen Shrimp Cub",
    " e 10g: https://aquaslog.com/tanks/2",
    "URL:https://aquaslog.com/tanks/2",
    "CREATED:20260825T120000Z",
    "LAST-MODIFIED:20260825T120000Z",
    "SEQUENCE:20433600",
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "CATEGORIES:AquaSlog",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Overdue: Water change · Shrimp Cube 10g",
    "TRIGGER;RELATED=START:PT9H",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:reminder-3@aquaslog.com",
    "DTSTAMP:20261009T140501Z",
    "DTSTART;VALUE=DATE:20261009",
    "DTEND;VALUE=DATE:20261010",
    "SUMMARY:Fertilizer · Living Room 75g",
    "DESCRIPTION:Every week. Logging it in your AquaSlog journal moves this to t",
    " he next due date.\\nLast fertilized: none logged yet.\\n\\nOpen Living Room 7",
    " 5g: https://aquaslog.com/tanks/1",
    "URL:https://aquaslog.com/tanks/1",
    "CREATED:20260925T120000Z",
    "LAST-MODIFIED:20260925T120000Z",
    "SEQUENCE:23112000",
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "CATEGORIES:AquaSlog",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Fertilizer · Living Room 75g",
    "TRIGGER;RELATED=START:PT9H",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:reminder-4@aquaslog.com",
    "DTSTAMP:20261009T140501Z",
    "DTSTART;VALUE=DATE:20261019",
    "DTEND;VALUE=DATE:20261020",
    "SUMMARY:Replace CO₂ cylinder\\; check regulator\\, tubing · Living Room 75",
    " g",
    "DESCRIPTION:One-time reminder.\\n\\nOpen Living Room 75g: https://aquaslog.co",
    " m/tanks/1",
    "URL:https://aquaslog.com/tanks/1",
    "CREATED:20261007T120000Z",
    "LAST-MODIFIED:20261007T120000Z",
    "SEQUENCE:24148800",
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "CATEGORIES:AquaSlog",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Replace CO₂ cylinder\\; check regulator\\, tubing · Living Roo",
    " m 75g",
    "TRIGGER;RELATED=START:PT9H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
  assert.equal(feed, expected);
  // Every physical line is CRLF-terminated and ≤ 75 octets; no bare LF anywhere.
  assert.ok(!/[^\r]\n/.test(feed));
  for (const l of feed.split("\r\n")) assert.ok(octets(l) <= 75);
});

test("empty feed is still a valid calendar", () => {
  const feed = buildReminderFeed({ reminders: [], timezone: "UTC", today: "2026-10-09", origin: "https://aquaslog.com", now: new Date("2026-10-09T00:00:00Z") });
  assert.match(feed, /^BEGIN:VCALENDAR\r\n/);
  assert.match(feed, /\r\nEND:VCALENDAR\r\n$/);
  assert.ok(!feed.includes("BEGIN:VEVENT"));
});

test("single-event download has its own UID and no feed refresh hints", () => {
  const ics = buildReminderIcs(FIXTURE[1], { today: "2026-10-09", origin: "https://aquaslog.com", now: new Date("2026-10-09T14:05:01Z"), timezone: "America/New_York" });
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1);
  assert.match(ics, /\r\nUID:reminder-1-20261006@aquaslog\.com\r\n/);
  assert.ok(!ics.includes("REFRESH-INTERVAL"));
  assert.ok(!ics.includes("X-WR-CALNAME"));
  assert.equal(icsFilename(FIXTURE[1]), "water-change-shrimp-cube-10g.ics");
  assert.equal(icsFilename(FIXTURE[2]), "replace-co2-cylinder-check-regulator-tubing-living-room-75g.ics");
});

test("feed tokens: derived from a random nonce + secret, not from the user id", async () => {
  const secret = "test-secret-at-least-16-chars";
  const n1 = randomNonce();
  const n2 = randomNonce();
  assert.match(n1, /^[0-9a-f]{64}$/);
  assert.notEqual(n1, n2);
  const t1 = await deriveFeedToken(secret, n1);
  assert.match(t1, TOKEN_RE);
  assert.equal(await deriveFeedToken(secret, n1), t1); // stable → the URL can be shown again
  assert.notEqual(await deriveFeedToken(secret, n2), t1); // reset → new URL
  assert.notEqual(await deriveFeedToken("another-secret-16-chars", n1), t1);
  assert.match(await hashFeedToken(t1), /^[0-9a-f]{64}$/);
  assert.notEqual(await hashFeedToken(t1), t1);
});

test("subscription URLs", () => {
  const u = feedUrls("https://aquaslog.com/", "abc_DEF-123");
  assert.equal(u.https, "https://aquaslog.com/cal/abc_DEF-123.ics");
  assert.equal(u.webcal, "webcal://aquaslog.com/cal/abc_DEF-123.ics");
  assert.equal(u.google, "https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Faquaslog.com%2Fcal%2Fabc_DEF-123.ics");
  assert.equal(feedUrls("http://localhost:3030", "x").webcal, "webcal://localhost:3030/cal/x.ics");
});

test("alarm trigger: chosen time on the day, the day before, or none", () => {
  assert.equal(alarmTrigger(), "PT9H");
  assert.equal(alarmTrigger({ time: "07:30", day: 0 }), "PT7H30M");
  assert.equal(alarmTrigger({ time: "00:00", day: 0 }), "PT0S");
  assert.equal(alarmTrigger({ time: "18:00", day: -1 }), "-PT6H");
  assert.equal(alarmTrigger({ time: "20:45", day: -1 }), "-PT3H15M");
  assert.equal(alarmTrigger({ time: "00:00", day: -1 }), "-PT24H");
  assert.equal(alarmTrigger({ time: "none", day: 0 }), null);
  assert.equal(alarmTrigger({ time: "bogus", day: 0 }), "PT9H"); // falls back to the default
});

test("events carry the configured alarm, or no VALARM when alerts are off", () => {
  const opts = { today: "2026-10-09", origin: "https://aquaslog.com", now: new Date("2026-10-09T14:05:01Z"), timezone: "America/New_York" };
  const dayBefore = buildReminderIcs(FIXTURE[1], { ...opts, alarm: { time: "18:30", day: -1 } });
  assert.match(dayBefore, /\r\nTRIGGER;RELATED=START:-PT5H30M\r\n/);
  const none = buildReminderIcs(FIXTURE[1], { ...opts, alarm: { time: "none", day: 0 } });
  assert.ok(!none.includes("BEGIN:VALARM"));
  assert.ok(none.includes("END:VEVENT\r\nEND:VCALENDAR\r\n"));
});
