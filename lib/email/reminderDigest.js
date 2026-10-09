/**
 * Builds the daily reminder digest email (subject + html + text). Pure — no DB, no env.
 *
 * groups: [{ tankName, items: [{ title, dueLabel, kind: "overdue"|"today", lastLine, everyLine, doneUrl, snoozeUrl }] }]
 */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function digestSubject(groups) {
  const items = groups.flatMap((g) => g.items);
  if (items.length === 1) {
    const it = items[0];
    const when = it.kind === "overdue" ? "is overdue" : it.kind === "today" ? "is due today" : "is coming up";
    return `${it.title} ${when} — ${groups[0].tankName}`;
  }
  const overdue = items.filter((i) => i.kind === "overdue").length;
  const tanks = groups.length;
  return `${items.length} tank chores due${overdue ? ` (${overdue} overdue)` : ""}${tanks > 1 ? ` across ${tanks} tanks` : ` — ${groups[0].tankName}`}`;
}

export function renderDigestEmail({ groups, settingsUrl, unsubscribeUrl, appUrl, localDateLabel, test = false }) {
  const items = groups.flatMap((g) => g.items);
  const subject = (test ? "[Test] " : "") + digestSubject(groups);

  const chip = (it) => {
    const style =
      it.kind === "overdue" ? "background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;"
      : it.kind === "today" ? "background:#fff7ed;color:#b45309;border:1px solid #fed7aa;"
      : "background:#f8fafc;color:#475569;border:1px solid #e2e8f0;";
    return `<span style="display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;${style}">${esc(it.dueLabel)}</span>`;
  };
  const btn = (href, label, primary) =>
    `<a href="${esc(href)}" style="display:inline-block;text-decoration:none;font-size:13px;font-weight:500;padding:7px 14px;border-radius:6px;margin-right:6px;${
      primary ? "background:#0891b2;color:#ffffff;" : "background:#ffffff;color:#334155;border:1px solid #e2e8f0;"
    }">${esc(label)}</a>`;

  const groupHtml = groups
    .map(
      (g) => `
      <tr><td style="padding:22px 0 6px;font-family:Georgia,serif;font-size:17px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(g.tankName)}</td></tr>
      ${g.items
        .map(
          (it) => `
      <tr><td style="padding:14px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:15px;color:#0f172a;font-weight:500;margin:0 0 6px;">${esc(it.title)} &nbsp;${chip(it)}</div>
        ${it.lastLine ? `<div style="font-size:13px;color:#475569;margin:0 0 2px;">${esc(it.lastLine)}</div>` : ""}
        ${it.everyLine ? `<div style="font-size:12px;color:#94a3b8;margin:0 0 10px;">${esc(it.everyLine)}</div>` : `<div style="height:8px"></div>`}
        <div>${btn(it.doneUrl, "Mark done", true)}${btn(it.snoozeUrl, "Snooze", false)}</div>
      </td></tr>`
        )
        .join("")}`
    )
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <tr><td style="padding:28px 28px 8px;">
    <div style="font-family:'Courier New',monospace;font-size:20px;color:#0f172a;">AquaSlog</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px;">${esc(localDateLabel)} · ${items.length} reminder${items.length === 1 ? "" : "s"} need${items.length === 1 ? "s" : ""} attention</div>
    ${test ? `<div style="margin-top:10px;font-size:12px;color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:6px 10px;">Test email — this is what your daily digest looks like.</div>` : ""}
  </td></tr>
  <tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${groupHtml}</table></td></tr>
  <tr><td style="padding:22px 28px 26px;font-size:12px;color:#94a3b8;line-height:1.6;">
    Logging a matching journal entry resets a reminder automatically. <a href="${esc(appUrl)}" style="color:#0891b2;text-decoration:none;">Open AquaSlog</a><br>
    You get one email a day at most, only when something is due.
    <a href="${esc(settingsUrl)}" style="color:#64748b;">Email settings</a> ·
    <a href="${esc(unsubscribeUrl)}" style="color:#64748b;">Unsubscribe</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const lines = [`AquaSlog — ${localDateLabel}`, test ? "(Test email — this is what your daily digest looks like.)" : null, ""].filter((l) => l !== null);
  for (const g of groups) {
    lines.push(g.tankName.toUpperCase());
    for (const it of g.items) {
      lines.push(`- ${it.title}: ${it.dueLabel}`);
      if (it.lastLine) lines.push(`  ${it.lastLine}`);
      if (it.everyLine) lines.push(`  ${it.everyLine}`);
      lines.push(`  Mark done: ${it.doneUrl}`);
      lines.push(`  Snooze:    ${it.snoozeUrl}`);
    }
    lines.push("");
  }
  lines.push("Logging a matching journal entry resets a reminder automatically.");
  lines.push(`Email settings: ${settingsUrl}`);
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);

  return { subject, html, text: lines.join("\n") };
}
