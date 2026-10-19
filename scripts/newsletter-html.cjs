#!/usr/bin/env node
// Haftalık bülten e-postası: en son data/reports/<tarih>.json'dan MailerLite "Custom HTML" editörüne yapıştırılacak HTML üretir.
// MailerLite ücretsiz planında API ile gönderim yok; HTML her pazartesi kampanyaya elle yapıştırılır.
// Çıktı: data/reports/<tarih>.email.html (+ konu satırı ekrana). Kullanım: node scripts/newsletter-html.cjs [--date YYYY-MM-DD]
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'data/reports');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const date = arg('--date') || fs.readdirSync(dir).filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop().slice(0, 10);
const r = JSON.parse(fs.readFileSync(path.join(dir, `${date}.json`), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = m => '$' + (m / 100).toFixed(2);
const pct = x => `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;
const day = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const utm = u => `${u}${u.includes('?') ? '&' : '?'}utm_source=newsletter&utm_medium=email&utm_campaign=weekly-${date}`;
const reportUrl = utm(`${SITE}/reports/${date}/`);
const link = c => c.group ? utm(`${SITE}/compare/${c.group}/`) : reportUrl;

const td = 'padding:8px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;';
const table = (rows, kind) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><th align="left" style="${td}color:#6b7280;font-weight:600">Supplier · product</th><th align="right" style="${td}color:#6b7280;font-weight:600">Before</th><th align="right" style="${td}color:#6b7280;font-weight:600">Now</th><th align="right" style="${td}color:#6b7280;font-weight:600">Change</th></tr>
${rows.map(c => `<tr><td style="${td}"><b>${esc(r.suppliers.find(s => s.id === c.providerId)?.name || c.providerId)}</b><br><a href="${esc(link(c))}" style="color:#111827;text-decoration:none">${esc(c.title.replace(/\s*\|\s*Ships from USA/i, ''))}</a></td><td align="right" style="${td}color:#6b7280">${usd(c.old)}</td><td align="right" style="${td}font-weight:700;color:${kind === 'down' ? '#15803d' : '#b91c1c'}">${usd(c.new)}</td><td align="right" style="${td}">${pct(c.pct)}</td></tr>`).join('\n')}
</table>`;

const T = r.totals;
const subject = `POD prices this week: ${T.down} drops, ${T.up} increases (${day(r.baseDate)}–${day(r.date)})`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1a1440;padding:22px 28px"><span style="font-size:24px;font-weight:800;color:#ffffff">POD</span><span style="font-size:24px;font-weight:800;color:#ff8a3d">Pricing</span><div style="color:#c7cde0;font-size:13px;margin-top:4px">Weekly print-on-demand price report · ${esc(day(r.baseDate))} → ${esc(day(r.date))}</div></td></tr>
<tr><td style="padding:24px 28px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="center" style="padding:10px;background:#f4f6fb;border-radius:10px"><div style="font-size:24px;font-weight:800">${T.changed}</div><div style="font-size:12px;color:#6b7280">price changes</div></td><td width="8"></td>
<td align="center" style="padding:10px;background:#f0fdf4;border-radius:10px"><div style="font-size:24px;font-weight:800;color:#15803d">${T.down}</div><div style="font-size:12px;color:#6b7280">drops</div></td><td width="8"></td>
<td align="center" style="padding:10px;background:#fef2f2;border-radius:10px"><div style="font-size:24px;font-weight:800;color:#b91c1c">${T.up}</div><div style="font-size:12px;color:#6b7280">increases</div></td>
</tr></table>
${(r.intro || '').split(/\n{2,}/).filter(Boolean).map(p => `<p style="font-size:15px;line-height:1.6;margin:16px 0">${esc(p)}</p>`).join('\n')}
</td></tr>
${r.drops.length ? `<tr><td style="padding:8px 28px"><h2 style="font-size:18px;margin:12px 0 6px">⬇ Biggest price drops</h2>${table(r.drops.slice(0, 8), 'down')}</td></tr>` : ''}
${r.rises.length ? `<tr><td style="padding:8px 28px"><h2 style="font-size:18px;margin:18px 0 6px">⬆ Biggest price increases</h2>${table(r.rises.slice(0, 8), 'up')}</td></tr>` : ''}
<tr><td align="center" style="padding:24px 28px"><a href="${esc(reportUrl)}" style="display:inline-block;background:#c2410c;color:#ffffff;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px">See the full report →</a>
<p style="font-size:13px;color:#6b7280;margin:14px 0 0">Base cost with print included, before shipping and tax. Compare ${esc(T.products.toLocaleString('en-US'))} products from ${T.suppliers} suppliers at <a href="${esc(utm(SITE + '/'))}" style="color:#c2410c">podpricing.com</a>.</p></td></tr>
<tr><td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6">
You get this because you subscribed at podpricing.com. Questions or a supplier we should add? Just reply.<br>
<a href="${esc(cfg.facebookGroup)}" style="color:#6b7280">Facebook group</a> · <a href="{$unsubscribe}" style="color:#6b7280">Unsubscribe</a><br>{$account_address}
</td></tr>
</table></td></tr></table></body></html>
`;
const out = path.join(dir, `${date}.email.html`);
fs.writeFileSync(out, html);
console.log(`Konu: ${subject}\nHTML: ${out}`);
