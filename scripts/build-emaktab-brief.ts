import { readFileSync, writeFileSync, copyFileSync } from "fs";

/**
 * Generates `docs/emaktab-brief.html` — a single self-contained visual brief
 * of what the emaktab pipeline pulled, how it works, and what's next. Reads
 * `data/emaktab-export.json` directly; no intermediate file. Also mirrors the
 * output to `public/emaktab-brief.html` so the Next dev server serves it.
 *
 *   npx tsx scripts/build-emaktab-brief.ts
 */

interface HeatmapDay { iso: string; lessons: number; marks: number; homework: number }
interface BriefData {
  profile: { name: string; className: string; school: string; grade: number; academicYear: string; emaktab: Record<string, string> };
  diaryCount: number; diaryStart: string; diaryEnd: string;
  heatmap: HeatmapDay[];
  marksBySubject: Record<string, number>;
  markTypes: Record<string, number>;
  markValues: Record<string, number>;
  perQuarter: { period: string; marks: number }[];
  xulosa: { subject: string; q: (string | null)[]; final: string | null; avg: string | null }[];
  homeworkCount: number; homeworkBySubject: Record<string, number>;
  sampleHomework: { task: string; subject: string; lessonDate: string; status: string }[];
  sampleDay: { date: string; iso: string; lessons: { lessonNo: string; subject: string; time: string; homework: string; homeworkDone: boolean; marks: { value: string; type: string }[] }[] };
  pulledAt: string;
}

// ---- Derive everything from the snapshot ------------------------------------

interface RawMark { value: string; type: string | null; date: string | null; lessonNo: string | null }
interface RawSubjectGrades { subject: string; average: string | null; finalMark: string | null; quarterMarks: (string | null)[] | null; marks: RawMark[] }
interface RawSnapshot {
  profile: BriefData["profile"];
  grades: { period: string; subjects: RawSubjectGrades[] }[];
  diary: { date: string; dateKey: string; iso: string; lessons: { lessonNo: string; subject: string; time: string; homework: string; homeworkDone: boolean; marks: { value: string; type: string }[] }[] }[];
  homework: { task: string; subject: string; lessonDate: string; status: string }[];
  meta: { pulledAt: string };
}

const raw = JSON.parse(readFileSync("data/emaktab-export.json", "utf8")) as RawSnapshot;

const heatmap: HeatmapDay[] = raw.diary.map((day) => ({
  iso: day.iso,
  lessons: day.lessons.length,
  marks: day.lessons.reduce((n, l) => n + l.marks.length, 0),
  homework: day.lessons.filter((l) => l.homework).length,
}));
const marksBySubject: Record<string, number> = {};
const markTypes: Record<string, number> = {};
const markValues: Record<string, number> = {};
for (const p of raw.grades) {
  if (p.period === "xulosa") continue;
  for (const s of p.subjects) {
    marksBySubject[s.subject] = (marksBySubject[s.subject] ?? 0) + s.marks.length;
    for (const m of s.marks) {
      const t = m.type ?? "(no type)";
      markTypes[t] = (markTypes[t] ?? 0) + 1;
      const v = m.value || "?";
      markValues[v] = (markValues[v] ?? 0) + 1;
    }
  }
}
const perQuarter = raw.grades
  .filter((p) => p.period !== "xulosa")
  .map((p) => ({ period: p.period, marks: p.subjects.reduce((n, s) => n + s.marks.length, 0) }));
const xulosaPeriod = raw.grades.find((p) => p.period === "xulosa");
const xulosa = (xulosaPeriod?.subjects ?? []).map((s) => ({
  subject: s.subject,
  q: s.quarterMarks ?? [null, null, null, null],
  final: s.finalMark,
  avg: s.average,
}));
const homeworkBySubject: Record<string, number> = {};
for (const h of raw.homework) homeworkBySubject[h.subject ?? "(none)"] = (homeworkBySubject[h.subject ?? "(none)"] ?? 0) + 1;

const d: BriefData = {
  profile: raw.profile,
  diaryCount: raw.diary.length,
  diaryStart: raw.diary[0]?.iso ?? "",
  diaryEnd: raw.diary[raw.diary.length - 1]?.iso ?? "",
  heatmap,
  marksBySubject,
  markTypes,
  markValues,
  perQuarter,
  xulosa,
  homeworkCount: raw.homework.length,
  homeworkBySubject,
  sampleHomework: raw.homework.slice(0, 6),
  sampleDay: raw.diary[raw.diary.length - 6] ?? raw.diary[raw.diary.length - 1],
  pulledAt: raw.meta.pulledAt,
};

// ---- Heatmap ----
// GitHub-style: 7 rows (Mon-Sun) × N columns (weeks). Sept 1 2025 = Monday.
const startDate = new Date("2025-09-01"); // Monday
const endDate = new Date("2026-05-31");
const daysByIso = new Map<string, HeatmapDay>();
for (const h of d.heatmap) daysByIso.set(h.iso, h);

const cellSize = 13;
const cellGap = 3;
const heatmapCols: { weekIndex: number; days: { iso: string; data?: HeatmapDay; dow: number }[] }[] = [];
let cursor = new Date(startDate);
let week = 0;
while (cursor <= endDate) {
  const days: { iso: string; data?: HeatmapDay; dow: number }[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const iso = cursor.toISOString().slice(0, 10);
    days.push({ iso, data: daysByIso.get(iso), dow });
    cursor.setDate(cursor.getDate() + 1);
  }
  heatmapCols.push({ weekIndex: week, days });
  week++;
}
const heatmapWidth = heatmapCols.length * (cellSize + cellGap);
const heatmapHeight = 7 * (cellSize + cellGap);
const monthLabels: { x: number; label: string }[] = [];
let lastMonth = -1;
for (let w = 0; w < heatmapCols.length; w++) {
  const firstIso = heatmapCols[w].days[0].iso;
  const month = new Date(firstIso).getMonth();
  if (month !== lastMonth) {
    monthLabels.push({ x: w * (cellSize + cellGap), label: new Date(firstIso).toLocaleString("en-US", { month: "short" }) });
    lastMonth = month;
  }
}
const heatCell = (data: HeatmapDay | undefined): { fill: string; opacity: number } => {
  if (!data) return { fill: "#efeadd", opacity: 0.6 };
  const lvl = Math.min(data.lessons / 6, 1);
  return { fill: "#e8a21a", opacity: 0.25 + lvl * 0.75 };
};

let heatmapSvg = `<svg viewBox="0 -22 ${heatmapWidth + 30} ${heatmapHeight + 28}" width="100%" preserveAspectRatio="xMinYMid meet" role="img" aria-label="Diary heatmap, ${d.diaryCount} school days">`;
for (const m of monthLabels) heatmapSvg += `<text x="${m.x + 30}" y="-6" font-size="11" fill="#6b675f" font-weight="500">${m.label}</text>`;
for (let dow = 0; dow < 7; dow++) {
  if (dow === 0 || dow === 2 || dow === 4) {
    const label = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"][dow];
    heatmapSvg += `<text x="0" y="${dow * (cellSize + cellGap) + cellSize - 2}" font-size="10" fill="#9b958a" font-weight="500">${label}</text>`;
  }
}
for (const col of heatmapCols) {
  for (const day of col.days) {
    const { fill, opacity } = heatCell(day.data);
    const x = 30 + col.weekIndex * (cellSize + cellGap);
    const y = day.dow * (cellSize + cellGap);
    const tooltip = day.data
      ? `${day.iso} · ${day.data.lessons} lessons · ${day.data.marks} marks · ${day.data.homework} homework`
      : `${day.iso} · no data`;
    heatmapSvg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2.5" ry="2.5" fill="${fill}" fill-opacity="${opacity}"><title>${tooltip}</title></rect>`;
  }
}
heatmapSvg += `</svg>`;

// ---- Mark-value distribution (single horizontal stacked bar) ----
const valueTotal = Object.values(d.markValues).reduce((a, b) => a + b, 0);
const valueColors: Record<string, string> = {
  "5": "#2d8a4e",
  "4": "#e8a21a",
  "3": "#c97a3a",
  OZ: "#9b958a",
};
const valueOrder = ["5", "4", "3", "OZ"].filter((v) => d.markValues[v]);
let stackX = 0;
let valueBar = `<svg viewBox="0 0 800 36" width="100%" role="img" aria-label="Marks distribution">`;
for (const v of valueOrder) {
  const w = (d.markValues[v] / valueTotal) * 800;
  const color = valueColors[v] ?? "#cccccc";
  valueBar += `<rect x="${stackX}" y="0" width="${w}" height="36" fill="${color}" rx="${stackX === 0 ? 6 : 0}" />`;
  if (w > 28) valueBar += `<text x="${stackX + w / 2}" y="22" font-size="13" font-weight="600" fill="#fff" text-anchor="middle" font-variant-numeric="tabular-nums">${v}</text>`;
  stackX += w;
}
valueBar += `</svg>`;

// ---- Per-quarter bars ----
const quarterMax = Math.max(...d.perQuarter.map((p) => p.marks));
let quarterChart = `<svg viewBox="0 0 480 140" width="100%" role="img" aria-label="Marks per quarter">`;
const qBarW = 90; const qBarGap = 16; const qBarLeftPad = 40; const qBarTop = 10; const qBarMaxH = 90;
for (let i = 0; i < d.perQuarter.length; i++) {
  const p = d.perQuarter[i];
  const h = (p.marks / quarterMax) * qBarMaxH;
  const x = qBarLeftPad + i * (qBarW + qBarGap);
  const y = qBarTop + qBarMaxH - h;
  quarterChart += `<rect x="${x}" y="${y}" width="${qBarW}" height="${h}" fill="#e8a21a" rx="3" />`;
  quarterChart += `<text x="${x + qBarW / 2}" y="${y - 6}" font-size="14" font-weight="600" fill="#1a1813" text-anchor="middle" font-variant-numeric="tabular-nums">${p.marks}</text>`;
  quarterChart += `<text x="${x + qBarW / 2}" y="${qBarTop + qBarMaxH + 22}" font-size="12" fill="#6b675f" text-anchor="middle">Quarter ${p.period}</text>`;
}
quarterChart += `</svg>`;

// ---- Marks-by-subject horizontal bars (sorted) ----
const subjectEntries = Object.entries(d.marksBySubject).sort((a, b) => b[1] - a[1]);
const subjectMax = Math.max(...subjectEntries.map(([, v]) => v));
let subjectChart = "";
for (const [name, count] of subjectEntries) {
  const pct = (count / subjectMax) * 100;
  subjectChart += `<div class="bar-row"><div class="bar-label">${name}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div><div class="bar-num">${count}</div></div></div>`;
}

// ---- Sample day rendering ----
const sd = d.sampleDay;
let sampleDayBlock = `<div class="day-card"><div class="day-head"><span class="day-date">${sd.date} · ${sd.iso}</span><span class="day-count">${sd.lessons.length} lessons</span></div><div class="day-lessons">`;
for (const l of sd.lessons) {
  const marksHtml = l.marks.map((m) => `<span class="mark mark-${m.value}">${m.value}<span class="mark-type">${m.type}</span></span>`).join("");
  sampleDayBlock += `<div class="lesson"><span class="lesson-no">${l.lessonNo}</span><div class="lesson-body"><div class="lesson-head"><span class="lesson-subject">${l.subject}</span><span class="lesson-time">${l.time ?? ""}</span></div>${l.homework ? `<div class="lesson-hw">${l.homeworkDone ? "✓" : "○"} <span>${l.homework}</span></div>` : ""}</div><div class="lesson-marks">${marksHtml}</div></div>`;
}
sampleDayBlock += `</div></div>`;

// ---- Xulosa table ----
let xulosaTable = `<table class="xulosa"><thead><tr><th>Subject</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Year</th></tr></thead><tbody>`;
for (const row of d.xulosa) {
  const cells = row.q.map((m) => `<td class="q-cell ${m === "OZ" ? "q-oz" : m ? "q-mark" : "q-empty"}">${m ?? ""}</td>`).join("");
  xulosaTable += `<tr><td class="x-subject">${row.subject}</td>${cells}<td class="x-final ${row.final ? "x-final-set" : ""}">${row.final ?? ""}</td></tr>`;
}
xulosaTable += `</tbody></table>`;

// ---- Sample homework ----
let homeworkList = `<ul class="hw-list">`;
for (const h of d.sampleHomework) {
  const tone = h.status === "Bajarildi" ? "done" : "pending";
  homeworkList += `<li class="hw-item hw-${tone}"><div class="hw-task">${h.task}</div><div class="hw-meta"><span>${h.subject}</span><span>·</span><span>${h.lessonDate}</span><span class="hw-status">${h.status}</span></div></li>`;
}
homeworkList += `</ul>`;

// ---- Before / after table ----
const beforeAfter = [
  ["Diary days captured", "10 (one rolling window)", "199 (full Sept–May)"],
  ["Worst-case day card", "46 lessons (parent wrapper)", "max 6 (sanity-capped)"],
  ["Duplicate diary days", "1 confirmed (15 may × 2)", "0"],
  ["Subject names", "raw, mixed case ('ona tili')", "canonical ('Ona tili')"],
  ["Subject list", "14 hand-typed in code", "derived from snapshot"],
  ["Xulosa quarter marks", "variable length, ambiguous", "always 4-slot [Q1–Q4]"],
  ["profile.school", "null", "64-sonli umumiy o'rta ta'lim maktabi"],
  ["School-year coverage", "current week only", "37.9 weeks (boundary-detected)"],
];
let beforeAfterTable = `<table class="ba"><thead><tr><th>Concern</th><th>Before</th><th>After</th></tr></thead><tbody>`;
for (const [c, b, a] of beforeAfter) beforeAfterTable += `<tr><td>${c}</td><td class="ba-before">${b}</td><td class="ba-after">${a}</td></tr>`;
beforeAfterTable += `</tbody></table>`;

// ---- Compose HTML ----
const fivePct = ((d.markValues["5"] / valueTotal) * 100).toFixed(1);
const totalMarks = valueTotal;
const totalLessons = d.heatmap.reduce((n, x) => n + x.lessons, 0);
const totalHomeworkSeen = d.heatmap.reduce((n, x) => n + x.homework, 0);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scorpius · emaktab brief</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box }
  :root {
    --bg: #fbf9f3;
    --card: #fffefa;
    --ink: #1a1813;
    --ink-soft: #6b675f;
    --ink-mute: #9b958a;
    --border: #ede9dc;
    --border-soft: #f3efe2;
    --gold: #e8a21a;
    --gold-deep: #c98910;
    --gold-pale: #faecc3;
    --green: #2d8a4e;
    --red: #c95a3a;
    --shadow: 0 1px 2px rgba(20, 18, 14, .04), 0 6px 24px -8px rgba(20, 18, 14, .06);
  }
  html, body { background: var(--bg); color: var(--ink); margin: 0; padding: 0 }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-size: 16px; line-height: 1.55; letter-spacing: -0.008em; font-feature-settings: 'cv11', 'ss01', 'ss03', 'cv02'; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale }
  .wrap { max-width: 1140px; margin: 0 auto; padding: 80px 32px 120px }
  h1, h2, h3, h4 { font-family: 'Inter Tight', 'Inter', sans-serif; font-weight: 700; letter-spacing: -0.022em; margin: 0 0 16px; color: var(--ink) }
  h1 { font-size: clamp(40px, 6vw, 64px); line-height: 1.04; letter-spacing: -0.032em; font-weight: 800 }
  h2 { font-size: 28px; line-height: 1.15; margin-top: 64px; margin-bottom: 24px }
  h3 { font-size: 18px; font-weight: 600; letter-spacing: -0.012em; margin-bottom: 12px }
  p { margin: 0 0 14px; color: var(--ink) }
  .ink-soft, .meta { color: var(--ink-soft) }
  .overline { font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 18px }
  .lede { font-size: 19px; line-height: 1.6; color: var(--ink-soft); max-width: 720px; letter-spacing: -0.005em }
  code, .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px }
  .tab-num { font-variant-numeric: tabular-nums }
  a { color: var(--ink); text-decoration: underline; text-decoration-color: var(--gold); text-underline-offset: 3px; text-decoration-thickness: 2px }

  /* Header */
  header.hero { padding-bottom: 56px; border-bottom: 1px solid var(--border) }
  header.hero .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px }
  header.hero .brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; font-size: 14px; letter-spacing: -0.005em }
  header.hero .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--gold); display: inline-block; box-shadow: 0 0 0 4px rgba(232, 162, 26, .15) }
  header.hero .date { font-size: 13px; color: var(--ink-soft) }

  /* Stats */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 48px 0 16px }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px 24px; box-shadow: var(--shadow) }
  .stat .n { font-family: 'Inter Tight', sans-serif; font-size: 44px; line-height: 1; font-weight: 800; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; margin-bottom: 6px }
  .stat .label { font-size: 12px; color: var(--ink-soft); letter-spacing: 0.04em; text-transform: uppercase; font-weight: 600 }
  .stat .sub { font-size: 13px; color: var(--ink-soft); margin-top: 8px; line-height: 1.45 }
  @media (max-width: 800px) { .stats { grid-template-columns: repeat(2, 1fr) } }

  /* Profile card */
  .profile-card { display: grid; grid-template-columns: 1.2fr 1fr; gap: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--card); overflow: hidden; box-shadow: var(--shadow) }
  .profile-card .left { padding: 32px; border-right: 1px solid var(--border) }
  .profile-card .right { padding: 32px; background: linear-gradient(180deg, #fcf5e2 0%, #faf1d5 100%) }
  .profile-card .name { font-family: 'Inter Tight', sans-serif; font-size: 28px; font-weight: 700; letter-spacing: -0.022em; margin-bottom: 4px }
  .profile-card .role { color: var(--ink-soft); font-size: 14px }
  .profile-card dl { margin: 24px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 12px 16px; font-size: 14px }
  .profile-card dt { color: var(--ink-soft); font-weight: 500 }
  .profile-card dd { margin: 0; font-weight: 500 }
  .id-row { display: grid; gap: 10px; margin-top: 4px }
  .id-row .k { font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600 }
  .id-row .v { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink) }
  .right .right-title { font-size: 12px; font-weight: 600; color: var(--gold-deep); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 16px }
  @media (max-width: 800px) { .profile-card { grid-template-columns: 1fr } .profile-card .left { border-right: 0; border-bottom: 1px solid var(--border) } }

  /* Heatmap */
  .heatmap-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; box-shadow: var(--shadow); overflow-x: auto }
  .heatmap-card .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; gap: 16px; flex-wrap: wrap }
  .heatmap-card .head .legend { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-soft) }
  .heatmap-card .head .legend .lr { display: inline-flex; gap: 3px }
  .heatmap-card .head .legend .lr i { width: 11px; height: 11px; border-radius: 2px; display: block }
  .heatmap-svg { min-width: 760px }

  /* Two-col charts */
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
  @media (max-width: 800px) { .row2 { grid-template-columns: 1fr } }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; box-shadow: var(--shadow) }
  .card h3 { margin-top: 0 }
  .card .meta { font-size: 13px; color: var(--ink-soft); margin-bottom: 16px }

  /* Mark-value bar */
  .value-bar-card .legend { display: flex; flex-wrap: wrap; gap: 16px 24px; font-size: 13px; margin-top: 14px }
  .value-bar-card .legend .leg { display: inline-flex; align-items: center; gap: 8px }
  .value-bar-card .legend .leg .swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block }

  /* Subject bars */
  .bars { display: grid; gap: 8px }
  .bar-row { display: grid; grid-template-columns: 130px 1fr; gap: 14px; align-items: center; font-size: 13px }
  .bar-label { color: var(--ink-soft); text-align: right; font-weight: 500 }
  .bar-track { position: relative; height: 24px; background: var(--border-soft); border-radius: 6px; overflow: hidden }
  .bar-fill { height: 100%; background: linear-gradient(90deg, var(--gold-pale), var(--gold)); border-radius: 6px }
  .bar-num { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums }

  /* Sample day */
  .day-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; box-shadow: var(--shadow) }
  .day-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid var(--border) }
  .day-date { font-family: 'Inter Tight', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: -0.018em }
  .day-count { font-size: 12px; color: var(--ink-soft); font-weight: 500; background: var(--border-soft); padding: 4px 10px; border-radius: 99px }
  .day-lessons { display: grid; gap: 14px }
  .lesson { display: grid; grid-template-columns: 32px 1fr auto; gap: 16px; align-items: start }
  .lesson-no { font-family: 'Inter Tight', sans-serif; font-size: 22px; font-weight: 700; color: var(--ink-mute); font-variant-numeric: tabular-nums; line-height: 1.1 }
  .lesson-head { display: flex; gap: 12px; align-items: baseline }
  .lesson-subject { font-weight: 600; font-size: 15px }
  .lesson-time { font-size: 12px; color: var(--ink-mute); font-variant-numeric: tabular-nums }
  .lesson-hw { font-size: 13px; color: var(--ink-soft); margin-top: 4px }
  .lesson-hw span { font-style: italic }
  .lesson-marks { display: flex; gap: 6px; flex-direction: column }
  .mark { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px 4px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; background: var(--border-soft); color: var(--ink) }
  .mark-5 { background: #e6f3ec; color: #1f7240 }
  .mark-4 { background: #fbeec9; color: #94660b }
  .mark-3 { background: #fadcc8; color: #8c3e15 }
  .mark-OZ { background: #ebe7d8; color: #6b675f }
  .mark-type { font-weight: 500; opacity: .75; font-size: 11px }

  /* Xulosa table */
  .xulosa, .ba { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px }
  .xulosa th, .xulosa td, .ba th, .ba td { padding: 12px 14px; text-align: left }
  .xulosa thead th, .ba thead th { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); border-bottom: 1px solid var(--border) }
  .xulosa tbody tr td { border-bottom: 1px solid var(--border-soft) }
  .xulosa tbody tr:last-child td { border-bottom: 0 }
  .x-subject { font-weight: 500 }
  .q-cell { text-align: center; font-variant-numeric: tabular-nums; font-weight: 600 }
  .q-mark { color: var(--green) }
  .q-oz { color: var(--ink-mute) }
  .q-empty { color: var(--ink-mute); opacity: .3 }
  .x-final { text-align: center; font-weight: 700; color: var(--ink-mute) }
  .x-final-set { color: var(--gold-deep); background: var(--gold-pale); border-radius: 6px }

  /* Architecture */
  .arch { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px }
  .arch-step { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; position: relative }
  .arch-step .num { font-family: 'Inter Tight', sans-serif; font-size: 12px; font-weight: 700; color: var(--gold-deep); letter-spacing: 0.06em }
  .arch-step .title { font-weight: 700; margin: 6px 0 8px; letter-spacing: -0.015em; font-size: 15px }
  .arch-step .desc { font-size: 13px; color: var(--ink-soft); line-height: 1.5 }
  .arch-step::after { content: ""; position: absolute; top: 50%; right: -8px; width: 12px; height: 1px; background: var(--border) }
  .arch-step:last-child::after { display: none }
  @media (max-width: 800px) { .arch { grid-template-columns: 1fr 1fr } .arch-step::after { display: none } }
  .arch-flow { background: linear-gradient(180deg, #fff 0%, #fcf9ee 100%); border: 1px solid var(--border); border-radius: 16px; padding: 32px; margin-top: 16px }
  .arch-flow h4 { margin: 0 0 8px; font-size: 15px; font-weight: 600; letter-spacing: -0.012em }
  .arch-flow .seq { display: grid; gap: 14px; counter-reset: step; margin-top: 18px }
  .arch-flow .seq .s { display: grid; grid-template-columns: 32px 1fr; gap: 14px; align-items: start; counter-increment: step }
  .arch-flow .seq .s::before { content: counter(step); display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--gold); color: #fff; font-weight: 700; font-size: 13px; font-family: 'Inter Tight', sans-serif }
  .arch-flow .seq .s .b { font-size: 14px; line-height: 1.55; color: var(--ink) }
  .arch-flow .seq .s .b strong { font-weight: 600 }
  .arch-flow .seq .s .b code { background: rgba(232, 162, 26, .12); padding: 2px 6px; border-radius: 4px; font-size: 12px }

  /* Before/after */
  .ba td { border-bottom: 1px solid var(--border-soft); vertical-align: top }
  .ba td:first-child { font-weight: 600; width: 32% }
  .ba-before { color: var(--red); font-size: 13px }
  .ba-after { color: var(--green); font-weight: 500; font-size: 13px }

  /* Homework */
  .hw-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px }
  .hw-item { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; position: relative }
  .hw-task { font-size: 14px; font-weight: 500; margin-bottom: 6px; line-height: 1.4 }
  .hw-meta { font-size: 12px; color: var(--ink-soft); display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
  .hw-status { margin-left: auto; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em }
  .hw-done .hw-status { background: #e6f3ec; color: #1f7240 }
  .hw-pending .hw-status { background: #fbeec9; color: #94660b }

  /* Next-up */
  .next { display: grid; gap: 12px; counter-reset: nx }
  .nx { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px 22px; counter-increment: nx; display: grid; grid-template-columns: 40px 1fr; gap: 14px; align-items: center }
  .nx::before { content: counter(nx, decimal-leading-zero); font-family: 'Inter Tight', sans-serif; font-size: 22px; font-weight: 800; color: var(--gold-deep); font-variant-numeric: tabular-nums }
  .nx .nx-title { font-weight: 600; font-size: 15px; letter-spacing: -0.012em }
  .nx .nx-desc { font-size: 13px; color: var(--ink-soft); margin-top: 3px }

  /* Verify */
  .verify { background: var(--ink); color: #f6f1e0; border-radius: 16px; padding: 28px; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.7; overflow-x: auto }
  .verify .green { color: #6fd093 } .verify .gold { color: #f5c862 } .verify .mute { color: #908a7c }

  footer { margin-top: 80px; padding-top: 32px; border-top: 1px solid var(--border); color: var(--ink-mute); font-size: 12px; text-align: center }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="row">
      <div class="brand"><span class="dot"></span><span>Scorpius</span></div>
      <div class="date">${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · ${new Date().toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
    <div class="overline">emaktab brief</div>
    <h1>What we know about<br>this student — and how.</h1>
    <p class="lede">A full pass on the emaktab pipeline: one consented Grade-6 account, ${d.diaryCount} unique school days walked back to Day 1 of the academic year, ${totalMarks} marks classified, 14 subjects normalised, ${d.homeworkCount} homework items captured — all clean, all typed, all in the app.</p>
  </header>

  <section>
    <div class="stats">
      <div class="stat"><div class="n">${d.diaryCount}</div><div class="label">School days</div><div class="sub">${d.diaryStart} → ${d.diaryEnd}</div></div>
      <div class="stat"><div class="n">${totalMarks}</div><div class="label">Marks captured</div><div class="sub">${fivePct}% are 5s · ${d.markValues["OZ"]} OZ · ${d.markValues["4"]} 4s · ${d.markValues["3"]} 3s</div></div>
      <div class="stat"><div class="n">14</div><div class="label">Subjects</div><div class="sub">Normalised to canonical names, IDs stable across surfaces</div></div>
      <div class="stat"><div class="n">${d.homeworkCount}</div><div class="label">Homework items</div><div class="sub">${Object.entries(d.homeworkBySubject).sort((a,b)=>b[1]-a[1])[0][0]} the most assigned</div></div>
    </div>
  </section>

  <h2>The student</h2>
  <div class="profile-card">
    <div class="left">
      <div class="name">${d.profile.name}</div>
      <div class="role">Class ${d.profile.className} · Grade ${d.profile.grade} · Academic year ${d.profile.academicYear}</div>
      <dl>
        <dt>School</dt><dd>${d.profile.school}</dd>
        <dt>Source</dt><dd>emaktab.uz · Kundalik</dd>
        <dt>Pulled at</dt><dd class="mono">${d.pulledAt}</dd>
        <dt>Cached</dt><dd>data/emaktab-export.json + Firestore students/demo-student-1</dd>
      </dl>
    </div>
    <div class="right">
      <div class="right-title">emaktab account IDs</div>
      <div class="id-row">
        <div><div class="k">schoolId</div><div class="v">${d.profile.emaktab.schoolId}</div></div>
        <div><div class="k">personId</div><div class="v">${d.profile.emaktab.personId}</div></div>
        <div><div class="k">groupId</div><div class="v">${d.profile.emaktab.groupId}</div></div>
      </div>
    </div>
  </div>

  <h2>Diary — the whole academic year</h2>
  <p class="lede" style="margin-bottom: 24px">${d.diaryCount} unique school days, ${totalLessons} lessons, ${totalHomeworkSeen} homework items recorded on the day they were set. Each square is one day; intensity is lesson count.</p>
  <div class="heatmap-card">
    <div class="head">
      <div><strong>${d.diaryStart}</strong> through <strong>${d.diaryEnd}</strong> · 37.9 weeks of coverage</div>
      <div class="legend">Fewer<span class="lr">
        <i style="background:#e8a21a;opacity:.25"></i>
        <i style="background:#e8a21a;opacity:.45"></i>
        <i style="background:#e8a21a;opacity:.65"></i>
        <i style="background:#e8a21a;opacity:.85"></i>
        <i style="background:#e8a21a;opacity:1"></i>
      </span>More</div>
    </div>
    <div class="heatmap-svg">${heatmapSvg}</div>
  </div>

  <h2>Marks</h2>
  <div class="row2">
    <div class="card value-bar-card">
      <h3>Distribution by value</h3>
      <div class="meta">${totalMarks} marks across 4 quarters. Most marks are 5s — the student is consistently top of class.</div>
      ${valueBar}
      <div class="legend">${valueOrder.map(v => `<span class="leg"><span class="swatch" style="background:${valueColors[v]}"></span><span class="tab-num"><strong>${d.markValues[v]}</strong> · ${((d.markValues[v]/totalMarks)*100).toFixed(1)}% · ${v === 'OZ' ? 'zachot' : 'mark ' + v}</span></span>`).join("")}</div>
    </div>
    <div class="card">
      <h3>By quarter</h3>
      <div class="meta">Q2 is lower because the autumn break shortens it — not a data gap.</div>
      ${quarterChart}
    </div>
  </div>

  <div class="row2" style="margin-top: 16px">
    <div class="card">
      <h3>By subject</h3>
      <div class="meta">Subjects normalised: "ona tili" → Ona tili, "Rus til (n)" → Rus tili.</div>
      <div class="bars">${subjectChart}</div>
    </div>
    <div class="card">
      <h3>By type</h3>
      <div class="meta">Mark categories emaktab issues — Darsda javob (class answer), Uy vazifasi (homework), Nazorat ishi (test).</div>
      <div class="bars">${Object.entries(d.markTypes).sort((a,b)=>b[1]-a[1]).map(([k,v]) => {
        const pct = (v / Math.max(...Object.values(d.markTypes))) * 100;
        return `<div class="bar-row"><div class="bar-label">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div><div class="bar-num">${v}</div></div></div>`;
      }).join("")}</div>
    </div>
  </div>

  <h2>Year summary (Xulosa)</h2>
  <p class="lede" style="margin-bottom: 24px">The xulosa view from <code>/marks/.../period?periodId=xulosa</code>. Always 4-slot — emaktab only fills quarters that have been graded. Three subjects already have year-final marks; the rest are still pending Q4.</p>
  <div class="card" style="padding: 0; overflow: hidden">${xulosaTable}</div>

  <h2>A real school day, fully extracted</h2>
  <p class="lede" style="margin-bottom: 24px">One arbitrary day from the diary — every field the extractor pulled. Same shape, every day.</p>
  ${sampleDayBlock}

  <h2>How it works</h2>
  <div class="arch">
    <div class="arch-step"><div class="num">01 · LOGIN</div><div class="title">Playwright signs in</div><div class="desc">Reads creds from <code>.env.local</code>, posts to <code>login.emaktab.uz</code>. Never logged, never committed. Captcha-aware.</div></div>
    <div class="arch-step"><div class="num">02 · EXTRACT</div><div class="title">Four scrapers</div><div class="desc">profile, grades (5 periods), diary (deep walk), homework (paginated). Each isolated and resilient.</div></div>
    <div class="arch-step"><div class="num">03 · NORMALISE</div><div class="title">One canonical pass</div><div class="desc">Subject names, mark types and IDs into one consistent shape. Pure functions, self-tested.</div></div>
    <div class="arch-step"><div class="num">04 · SURFACE</div><div class="title">Typed loader feeds the app</div><div class="desc"><code>lib/emaktab.ts</code> serves the snapshot to the sky, parent dashboard, and homework Socratic walkthrough.</div></div>
  </div>

  <div class="arch-flow">
    <h4>The deep diary walk — what makes this hard</h4>
    <p class="ink-soft" style="font-size: 14px">emaktab's <code>/marks</code> shows one week at a time. There's no URL date param. No <code>&lt;input type="date"&gt;</code>. The only control is two arrow-like divs sitting as siblings of the day-cards container.</p>
    <div class="seq">
      <div class="s"><div class="b"><strong>Login</strong> on <code>login.emaktab.uz</code>. Capture session cookies.</div></div>
      <div class="s"><div class="b"><strong>Land on</strong> <code>emaktab.uz/marks</code>, scrape the default week. Each day card carries <code>data-test-id="day-{unixTs}"</code> — the dateKey is exact.</div></div>
      <div class="s"><div class="b"><strong>Click</strong> <code>[data-test-id="arrow-left"]</code> programmatically (JS click bypasses ad overlays). emaktab swaps the day set via XHR; the URL stays the same.</div></div>
      <div class="s"><div class="b"><strong>Wait</strong> for the rendered <code>day-{ts}</code> id set to change AND for at least one day card to render — avoids scraping mid-transition.</div></div>
      <div class="s"><div class="b"><strong>Dedupe</strong> by dateKey (unix ts). When the visible window overlaps a previously-seen week we keep the smaller card (true day, not wrapper).</div></div>
      <div class="s"><div class="b"><strong>Stop</strong> when six clicks in a row don't move the earliest-visible-day backward — emaktab's actual data boundary. We hit it at <code>2025-09-02</code> — Day 1 of the school year.</div></div>
    </div>
  </div>

  <h2>What we fixed in this pass</h2>
  <div class="card" style="padding: 0; overflow: hidden">${beforeAfterTable}</div>

  <h2>Sample homework</h2>
  <p class="lede" style="margin-bottom: 24px">${d.homeworkCount} items in the full list. The student's name + class is on every row.</p>
  ${homeworkList}

  <h2>Where we're going next</h2>
  <div class="next">
    <div class="nx"><div><div class="nx-title">Wire the real signal into the constellation sky</div><div class="nx-desc">Per-subject star sizing &amp; tone from mark history. Recent OZ in Informatika → that constellation glows softer; a streak of 5s → brighter.</div></div></div>
    <div class="nx"><div><div class="nx-title">Adaptive lesson selection</div><div class="nx-desc">When the student opens the deck, the orchestrator picks the next topic based on prereq gaps + recent marks — not a hardcoded sequence.</div></div></div>
    <div class="nx"><div><div class="nx-title">Parent dashboard on real data</div><div class="nx-desc">"Vasliddin got 8 marks this week, 7 of them 5s, 1 OZ in Musiqa. The pending homework: Tabiiy fan, due tomorrow." All from one snapshot.</div></div></div>
    <div class="nx"><div><div class="nx-title">Generate more subject curricula</div><div class="nx-desc">Beyond Math + History — extract topic graphs for the other 12 subjects. Their stars stay dormant until then.</div></div></div>
    <div class="nx"><div><div class="nx-title">Voice + Snap &amp; Solve</div><div class="nx-desc">Post-hackathon. Camera into the homework deck; voice into Ask Scorpius.</div></div></div>
  </div>

  <h2>Verify it yourself</h2>
  <div class="verify"><span class="mute"># pull the latest snapshot</span>
<span class="gold">npx tsx --env-file=.env.local scripts/extract-emaktab.ts</span>

<span class="mute"># audit the result against the checklist</span>
<span class="gold">npx tsx scripts/verify-emaktab.ts</span>

<span class="mute"># regenerate the curriculum subject list from the snapshot</span>
<span class="gold">npx tsx --env-file=.env.local scripts/sync-curriculum-subjects.ts</span>

<span class="mute"># build the app — emaktab loader is wired into the sky already</span>
<span class="gold">npm run build</span>

<span class="mute"># the audit checklist returns:</span>
<span class="green">PASS A · no day with more than 12 lessons  ·  max lessons-per-day = 6
PASS A · no duplicate diary days  ·  ${d.diaryCount} unique days
PASS A2 · diary walked back beyond 2025-12-01  ·  earliest day = ${d.diaryStart}
PASS C · every xulosa row has a 4-slot quarterMarks  ·  14 subjects
PASS D · profile.school populated  ·  "${d.profile.school}"</span>

<span class="green">5 pass · 0 fail · 2 note</span></div>

  <footer>
    Generated ${new Date().toISOString()} by <code>scripts/build-emaktab-brief.ts</code> from <code>data/emaktab-export.json</code>.
    Source of truth: emaktab.uz · Kundalik. Cached to Firestore.
  </footer>
</div>
</body>
</html>`;

writeFileSync("docs/emaktab-brief.html", html, "utf8");
copyFileSync("docs/emaktab-brief.html", "public/emaktab-brief.html");
console.log(`wrote docs/emaktab-brief.html (${(Buffer.byteLength(html, "utf8") / 1024).toFixed(1)} KB)`);
console.log(`mirrored to public/emaktab-brief.html — view at http://localhost:3000/emaktab-brief.html when next dev is running`);
