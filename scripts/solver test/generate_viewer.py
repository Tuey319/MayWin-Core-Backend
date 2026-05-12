"""
generate_viewer.py
------------------
Reads "browser claude result.json" and generates schedule_viewer.html —
a self-contained, open-in-browser schedule grid that mirrors the Excel layout.

Run:
    python generate_viewer.py
Then open schedule_viewer.html in any browser.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
INPUT = HERE / "browser claude result.json"
OUTPUT = HERE / "schedule_viewer.html"

with open(INPUT, encoding="utf-8") as f:
    data = json.load(f)

# Inject data as JSON string — Python handles escaping
data_json = json.dumps(data, ensure_ascii=False)

HTML = f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Schedule Viewer — MayWin</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background: #f8fafc; color: #1e293b; }}

  /* ── header ─────────────────────────────────────── */
  header {{ background: #1e293b; color: #f8fafc; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }}
  header h1 {{ font-size: 18px; font-weight: 600; }}
  header span {{ font-size: 13px; color: #94a3b8; }}

  /* ── tabs ───────────────────────────────────────── */
  .tabs {{ display: flex; gap: 4px; padding: 16px 24px 0; border-bottom: 2px solid #e2e8f0; background: #fff; }}
  .tab {{ padding: 8px 20px; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 14px; font-weight: 500;
           border: 2px solid transparent; border-bottom: none; color: #64748b; transition: all .15s; }}
  .tab:hover {{ color: #1e293b; background: #f1f5f9; }}
  .tab.active {{ color: #1e40af; border-color: #e2e8f0; border-bottom: 2px solid #fff; background: #fff; margin-bottom: -2px; }}

  /* ── content pane ───────────────────────────────── */
  .pane {{ display: none; padding: 24px; }}
  .pane.active {{ display: block; }}

  /* ── section cards ──────────────────────────────── */
  .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }}
  .card-header {{ padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-weight: 600;
                   display: flex; align-items: center; gap: 10px; }}
  .card-body {{ padding: 20px; overflow-x: auto; }}

  /* ── legend ─────────────────────────────────────── */
  .legend {{ display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }}
  .legend-item {{ display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; }}
  .legend-swatch {{ width: 28px; height: 20px; border-radius: 4px; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: 700; }}

  /* ── grid ───────────────────────────────────────── */
  .grid-wrap {{ overflow-x: auto; }}
  table.grid {{ border-collapse: collapse; font-size: 12px; min-width: max-content; }}
  table.grid th, table.grid td {{ border: 1px solid #e2e8f0; padding: 0; text-align: center; }}
  table.grid th {{ background: #f1f5f9; font-weight: 600; padding: 6px 8px; white-space: nowrap; font-size: 11px; }}
  table.grid .nurse-name {{ text-align: left; padding: 6px 12px; white-space: nowrap; font-weight: 500; min-width: 180px;
                              position: sticky; left: 0; background: #f8fafc; z-index: 2; border-right: 2px solid #cbd5e1; }}
  table.grid .day-head {{ min-width: 38px; font-size: 10px; padding: 4px 2px; }}
  table.grid .day-head.weekend {{ background: #fef3c7; }}

  /* ── shift cells ────────────────────────────────── */
  .cell {{ width: 38px; height: 38px; position: relative; cursor: default; }}
  .cell .badge {{ position: absolute; inset: 3px; border-radius: 5px; display: flex; align-items: center;
                   justify-content: center; font-weight: 700; font-size: 13px; transition: transform .1s; }}
  .cell .badge:hover {{ transform: scale(1.15); z-index: 5; }}

  .shift-morning .badge {{ background: #dbeafe; color: #1d4ed8; }}
  .shift-evening .badge {{ background: #fed7aa; color: #c2410c; }}
  .shift-night   .badge {{ background: #312e81; color: #c7d2fe; }}
  .shift-off     .badge {{ background: #f1f5f9; color: #cbd5e1; }}

  /* OT ring */
  .is-ot .badge {{ outline: 2.5px solid #ef4444; outline-offset: -2px; }}
  /* OT dot */
  .cell .ot-dot {{ position: absolute; top: 4px; right: 4px; width: 7px; height: 7px;
                    background: #ef4444; border-radius: 50%; z-index: 3; }}

  /* Requested: red border + bold text */
  .is-requested .badge {{ outline: 2.5px solid #dc2626; outline-offset: -2px; color: #dc2626 !important; }}

  /* ── violations banner ──────────────────────────── */
  .violations {{ margin-bottom: 20px; }}
  .v-item {{ display: flex; gap: 10px; align-items: flex-start; padding: 8px 12px; border-radius: 8px;
              background: #fef2f2; border: 1px solid #fecaca; margin-bottom: 6px; font-size: 13px; }}
  .v-badge {{ background: #ef4444; color: #fff; border-radius: 4px; padding: 2px 7px; font-size: 11px;
               font-weight: 700; white-space: nowrap; flex-shrink: 0; }}
  .v-ok {{ background: #f0fdf4; border-color: #86efac; }}
  .v-ok .v-badge {{ background: #16a34a; }}

  /* ── stats grid ─────────────────────────────────── */
  .stats-row {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }}
  .stat-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }}
  .stat-box .label {{ font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }}
  .stat-box .value {{ font-size: 22px; font-weight: 700; color: #1e293b; }}
  .stat-box .sub {{ font-size: 12px; color: #64748b; margin-top: 2px; }}

  /* ── per-nurse table ────────────────────────────── */
  table.nurse-table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
  table.nurse-table th {{ background: #f1f5f9; padding: 8px 14px; text-align: left; font-weight: 600;
                           border-bottom: 2px solid #e2e8f0; }}
  table.nurse-table td {{ padding: 8px 14px; border-bottom: 1px solid #f1f5f9; }}
  table.nurse-table tr:hover td {{ background: #f8fafc; }}
  .m-pill {{ background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; }}
  .e-pill {{ background: #fed7aa; color: #c2410c; padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; }}
  .n-pill {{ background: #312e81; color: #c7d2fe; padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; }}

  /* ── requests table ─────────────────────────────── */
  table.req-table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
  table.req-table th {{ background: #f1f5f9; padding: 8px 14px; text-align: left; border-bottom: 2px solid #e2e8f0; }}
  table.req-table td {{ padding: 8px 14px; border-bottom: 1px solid #f1f5f9; }}
  .req-honored {{ background: #f0fdf4; }}
  .req-ignored {{ background: #fef2f2; }}

  /* ── tooltip ────────────────────────────────────── */
  .tooltip {{ position: fixed; background: #1e293b; color: #f8fafc; font-size: 12px; padding: 6px 10px;
               border-radius: 6px; pointer-events: none; z-index: 999; display: none; white-space: nowrap; }}
</style>
</head>
<body>

<header>
  <div>
    <h1>MayWin — Schedule Viewer</h1>
    <span>Human-made schedule extracted from Excel · Compare with solver output</span>
  </div>
</header>

<div class="tabs" id="tabs"></div>
<div id="panes"></div>
<div class="tooltip" id="tooltip"></div>

<script>
const RAW = {data_json};

const SHIFT_LABEL = {{ morning: 'ช', evening: 'บ', night: 'ด' }};
const SHIFT_EN    = {{ morning: 'Morning', evening: 'Evening', night: 'Night' }};
const VTYPE_LABEL = {{
  night_to_morning: 'Night → Morning',
  consecutive_nights_exceeded: 'Consecutive Nights > 3',
  '3morning_then_evening': '3× Morning then Evening',
  over_21_shifts: 'Over 21 Shifts',
}};

function shortName(full) {{
  const parts = full.trim().split(' ');
  return parts.length >= 2 ? parts[parts.length - 1] : full;
}}

function isWeekend(dateStr) {{
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}}

function dayNum(dateStr) {{ return parseInt(dateStr.split('-')[2], 10); }}

// ─── build assignment lookup ─────────────────────────────────────────────────
function buildLookup(assignments) {{
  const map = {{}};
  for (const a of assignments) {{
    const key = a.nurse + '|' + a.date;
    map[key] = a;
  }}
  return map;
}}

// ─── violation checker ───────────────────────────────────────────────────────
function checkViolations(assignments, nurses) {{
  const byNurse = {{}};
  for (const a of assignments) {{
    if (!a.shift) continue;
    (byNurse[a.nurse] = byNurse[a.nurse] || []).push(a);
  }}
  const viols = [];
  for (const nurse of Object.keys(byNurse)) {{
    const seq = byNurse[nurse].sort((a,b) => a.date.localeCompare(b.date));
    // night → morning
    for (let i = 0; i < seq.length - 1; i++) {{
      const d1 = new Date(seq[i].date + 'T00:00:00');
      const d2 = new Date(seq[i+1].date + 'T00:00:00');
      const diff = (d2 - d1) / 86400000;
      if (diff === 1 && seq[i].shift === 'night' && seq[i+1].shift === 'morning')
        viols.push({{ type: 'night_to_morning', nurse, dates: [seq[i].date, seq[i+1].date] }});
    }}
    // consecutive nights
    let run = [];
    for (const a of seq) {{
      if (a.shift === 'night') {{ run.push(a.date); }}
      else {{
        if (run.length > 3) viols.push({{ type: 'consecutive_nights_exceeded', nurse, count: run.length, dates: [run[0], run[run.length-1]] }});
        run = [];
      }}
    }}
    if (run.length > 3) viols.push({{ type: 'consecutive_nights_exceeded', nurse, count: run.length, dates: [run[0], run[run.length-1]] }});
    // >21 shifts
    if (seq.length > 21) viols.push({{ type: 'over_21_shifts', nurse, count: seq.length }});
  }}
  return viols;
}}

// ─── render schedule grid ────────────────────────────────────────────────────
function renderGrid(monthData) {{
  const {{ nurses, days, assignments, demand }} = monthData;
  const lookup = buildLookup(assignments);

  let html = '<div class="grid-wrap"><table class="grid">';

  // Header row
  html += '<thead><tr><th class="nurse-name">Nurse</th>';
  for (const d of days) {{
    const n = dayNum(d);
    const we = isWeekend(d) ? ' weekend' : '';
    const totalDemand = Object.values(demand[d] || {{}}).reduce((s,v) => s+v, 0);
    const dimmed = totalDemand === 0 ? ' style="opacity:.4"' : '';
    html += `<th class="day-head${{we}}"${{dimmed}}>{{d.split('-')[2]}}</th>`;
  }}
  html += '</tr></thead><tbody>';

  // Demand row
  html += '<tr><th class="nurse-name" style="font-size:10px;color:#64748b">Demand M/E/N</th>';
  for (const d of days) {{
    const dm = demand[d] || {{}};
    const total = (dm.morning||0) + (dm.evening||0) + (dm.night||0);
    if (total === 0) {{ html += '<td style="opacity:.3;font-size:10px">—</td>'; continue; }}
    html += `<td style="font-size:9px;line-height:1.3;padding:2px;background:#f8fafc">
      <div style="color:#1d4ed8">${{dm.morning||0}}</div>
      <div style="color:#c2410c">${{dm.evening||0}}</div>
      <div style="color:#6d28d9">${{dm.night||0}}</div>
    </td>`;
  }}
  html += '</tr>';

  // Nurse rows
  for (const nurse of nurses) {{
    html += `<tr><td class="nurse-name">${{nurse}}</td>`;
    for (const d of days) {{
      const a = lookup[nurse + '|' + d];
      const shift = a?.shift || null;
      const isOt = a?.overtime || false;
      const isReq = a?.requested || false;
      const totalDemand = Object.values(demand[d] || {{}}).reduce((s,v) => s+v, 0);

      let cls = shift ? `shift-${{shift}}` : 'shift-off';
      if (isOt) cls += ' is-ot';
      if (isReq) cls += ' is-requested';
      if (totalDemand === 0) cls += '';

      const label = shift ? SHIFT_LABEL[shift] : (totalDemand === 0 ? '' : '·');
      const opacity = totalDemand === 0 ? ' style="opacity:.25"' : '';
      const title = [
        nurse,
        d,
        shift ? SHIFT_EN[shift] : 'Day off',
        isOt ? '⚡ OT' : '',
        isReq ? '★ Requested' : '',
      ].filter(Boolean).join(' | ');

      html += `<td class="cell ${{cls}}"${{opacity}} data-tip="${{title}}">
        <div class="badge">${{label}}</div>
        ${{isOt ? '<div class="ot-dot"></div>' : ''}}
      </td>`;
    }}
    html += '</tr>';
  }}

  html += '</tbody></table></div>';
  return html;
}}

// ─── render violations ───────────────────────────────────────────────────────
function renderViolations(violations) {{
  if (violations.length === 0)
    return '<div class="v-item v-ok"><span class="v-badge">✓</span>No constraint violations</div>';

  return violations.map(v => {{
    const label = VTYPE_LABEL[v.type] || v.type;
    const dates = v.dates ? v.dates.map(d => d.slice(5)).join(' → ') : '';
    const count = v.count ? ` (${{v.count}} shifts)` : '';
    return `<div class="v-item">
      <span class="v-badge">${{label}}</span>
      <span><strong>${{shortName(v.nurse)}}</strong>${{dates ? ' · ' + dates : ''}}${{count}}</span>
    </div>`;
  }}).join('');
}}

// ─── render per-nurse stats ──────────────────────────────────────────────────
function renderNurseStats(summary) {{
  const per = summary.per_nurse;
  let html = '<table class="nurse-table"><thead><tr>'
    + '<th>Nurse</th><th>Morning</th><th>Evening</th><th>Night</th><th>Total</th><th>OT</th><th>Days Off</th>'
    + '</tr></thead><tbody>';
  for (const [name, s] of Object.entries(per)) {{
    const total = s.morning + s.evening + s.night;
    const over = total > 21 ? ' style="color:#dc2626;font-weight:700"' : '';
    html += `<tr>
      <td>${{name}}</td>
      <td><span class="m-pill">${{s.morning}}</span></td>
      <td><span class="e-pill">${{s.evening}}</span></td>
      <td><span class="n-pill">${{s.night}}</span></td>
      <td${{over}}>${{total}}</td>
      <td>${{s.ot}}</td>
      <td>${{s.days_off}}</td>
    </tr>`;
  }}
  html += '</tbody></table>';
  return html;
}}

// ─── render requests table ───────────────────────────────────────────────────
function renderRequests(monthData) {{
  const {{ preferences, assignments }} = monthData;
  if (!preferences || preferences.length === 0)
    return '<p style="color:#64748b;font-size:13px">No nurse requests recorded for this month.</p>';

  const lookup = buildLookup(assignments);
  let html = '<table class="req-table"><thead><tr>'
    + '<th>Nurse</th><th>Date</th><th>Requested Shift</th><th>Actual Shift</th><th>Honored?</th>'
    + '</tr></thead><tbody>';

  for (const p of preferences) {{
    const actual = lookup[p.nurse + '|' + p.date];
    const actualShift = actual?.shift || null;
    const honored = actualShift === p.shift;
    const rowCls = honored ? 'req-honored' : 'req-ignored';
    html += `<tr class="${{rowCls}}">
      <td>${{p.nurse}}</td>
      <td>${{p.date}}</td>
      <td><span class="${{p.shift === 'morning' ? 'm' : p.shift === 'evening' ? 'e' : 'n'}}-pill">${{SHIFT_EN[p.shift]}}</span></td>
      <td>${{actualShift ? `<span class="${{actualShift === 'morning' ? 'm' : actualShift === 'evening' ? 'e' : 'n'}}-pill">${{SHIFT_EN[actualShift]}}</span>` : '—'}}</td>
      <td>${{honored ? '✅ Yes' : '❌ No'}}</td>
    </tr>`;
  }}
  html += '</tbody></table>';
  return html;
}}

// ─── build month pane ────────────────────────────────────────────────────────
function buildPane(monthKey, monthData) {{
  const {{ ward, month, summary, constraint_violations }} = monthData;
  const violations = checkViolations(monthData.assignments, monthData.nurses);
  const totalShifts = summary.total_shifts;
  const totalOt = summary.total_ot;

  return `
    <div class="pane" id="pane-${{monthKey}}">
      <div class="stats-row">
        <div class="stat-box">
          <div class="label">Ward</div>
          <div class="value" style="font-size:16px">${{ward}}</div>
          <div class="sub">${{month}}</div>
        </div>
        <div class="stat-box">
          <div class="label">Nurses</div>
          <div class="value">${{monthData.nurses.length}}</div>
        </div>
        <div class="stat-box">
          <div class="label">Total Shifts</div>
          <div class="value">${{totalShifts}}</div>
          <div class="sub">OT: ${{totalOt}}</div>
        </div>
        <div class="stat-box">
          <div class="label">Constraint Violations</div>
          <div class="value" style="color:${{violations.length > 0 ? '#dc2626' : '#16a34a'}}">${{violations.length}}</div>
          <div class="sub">${{violations.length === 0 ? 'All rules satisfied' : 'See details below'}}</div>
        </div>
        <div class="stat-box">
          <div class="label">Preferences</div>
          <div class="value">${{(monthData.preferences||[]).length}}</div>
          <div class="sub">Honored: ${{summary.total_requested_honored}}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">📅 Schedule Grid</div>
        <div class="card-body">
          <div class="legend">
            <div class="legend-item"><div class="legend-swatch" style="background:#dbeafe;color:#1d4ed8">ช</div> Morning (เช้า)</div>
            <div class="legend-item"><div class="legend-swatch" style="background:#fed7aa;color:#c2410c">บ</div> Evening (บ่าย)</div>
            <div class="legend-item"><div class="legend-swatch" style="background:#312e81;color:#c7d2fe">ด</div> Night (ดึก)</div>
            <div class="legend-item"><div class="legend-swatch" style="background:#f1f5f9;color:#cbd5e1">·</div> Day off</div>
            <div class="legend-item"><div class="legend-swatch" style="background:#dbeafe;color:#1d4ed8;outline:2.5px solid #ef4444;outline-offset:-2px">ช</div> OT shift</div>
            <div class="legend-item"><div class="legend-swatch" style="background:#dbeafe;color:#dc2626;outline:2.5px solid #dc2626;outline-offset:-2px;font-weight:700">ช</div> Requested</div>
          </div>
          ${{renderGrid(monthData)}}
        </div>
      </div>

      <div class="card">
        <div class="card-header">⚠️ Constraint Violations (${{violations.length}})</div>
        <div class="card-body">
          <div class="violations">${{renderViolations(violations)}}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">👩‍⚕️ Per-Nurse Statistics</div>
        <div class="card-body">${{renderNurseStats(summary)}}</div>
      </div>

      <div class="card">
        <div class="card-header">⭐ Nurse Shift Requests</div>
        <div class="card-body">${{renderRequests(monthData)}}</div>
      </div>
    </div>
  `;
}}

// ─── boot ────────────────────────────────────────────────────────────────────
const MONTH_LABELS = {{ january: 'January 2026 (ม.ค.)', february: 'February 2026 (ก.พ.)' }};
const MONTHS = Object.keys(RAW).filter(k => RAW[k]?.ward);

const tabsEl = document.getElementById('tabs');
const panesEl = document.getElementById('panes');

MONTHS.forEach((key, i) => {{
  const tab = document.createElement('div');
  tab.className = 'tab' + (i === 0 ? ' active' : '');
  tab.textContent = MONTH_LABELS[key] || key;
  tab.addEventListener('click', () => {{
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('pane-' + key).classList.add('active');
  }});
  tabsEl.appendChild(tab);

  const pane = document.createElement('div');
  pane.innerHTML = buildPane(key, RAW[key]);
  const inner = pane.firstElementChild;
  if (i === 0) inner.classList.add('active');
  panesEl.appendChild(inner);
}});

// ─── tooltip ────────────────────────────────────────────────────────────────
const tip = document.getElementById('tooltip');
document.addEventListener('mouseover', e => {{
  const cell = e.target.closest('[data-tip]');
  if (!cell) {{ tip.style.display = 'none'; return; }}
  tip.textContent = cell.dataset.tip;
  tip.style.display = 'block';
}});
document.addEventListener('mousemove', e => {{
  tip.style.left = (e.clientX + 14) + 'px';
  tip.style.top  = (e.clientY + 14) + 'px';
}});
document.addEventListener('mouseout', e => {{
  if (!e.target.closest('[data-tip]')) tip.style.display = 'none';
}});
</script>
</body>
</html>"""

OUTPUT.write_text(HTML, encoding="utf-8")
print(f"Generated: {OUTPUT}")
print("Open in browser to view the schedule.")
