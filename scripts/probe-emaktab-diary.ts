import { chromium } from "playwright";

/**
 * One-shot probe: logs in to emaktab and dumps every plausible date-related
 * control on /marks so we can wire the real selector into the diary walker.
 * Read-only — does not write anything.
 *
 *   npx tsx --env-file=.env.local scripts/probe-emaktab-diary.ts
 */
async function main() {
  const username = process.env.EMAKTAB_USERNAME;
  const password = process.env.EMAKTAB_PASSWORD;
  if (!username || !password) throw new Error("EMAKTAB credentials missing");

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "uz-UZ", viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();

    await page.goto("https://login.emaktab.uz/login", { waitUntil: "domcontentloaded" });
    await page.locator('[data-test-id="login-field"]').fill(username);
    await page.locator('[data-test-id="password-field"]').fill(password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.locator('[data-test-id="login-button"]').click(),
    ]);
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.goto("https://emaktab.uz/marks", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    console.log("\n== URL on /marks: ", page.url());

    // String-form evaluate — tsx/esbuild injects __name on named arrow functions
    // which crashes in the page context (see extract-emaktab.ts comment).
    const PROBE = `(() => {
      const result = [];
      const cap = (el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.getAttribute("id") || "";
        const cls = (el.getAttribute("class") || "").slice(0, 80);
        const dti = el.getAttribute("data-test-id") || "";
        const role = el.getAttribute("role") || "";
        const txt = (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80);
        const href = el.getAttribute("href") || "";
        return "<" + tag + (id ? " id=\\"" + id + "\\"" : "") + (dti ? " data-test-id=\\"" + dti + "\\"" : "") + (role ? " role=\\"" + role + "\\"" : "") + (cls ? " class=\\"" + cls + "\\"" : "") + (href ? " href=\\"" + href + "\\"" : "") + "> \\"" + txt + "\\"";
      };
      const grab = (sel, label) => {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length) result.push({ what: label + " (" + els.length + ")", matches: els.slice(0, 8).map(cap) });
      };
      grab("input", "all <input>");
      grab('[data-test-id*="date" i]', 'data-test-id contains "date"');
      grab('[data-test-id*="calendar" i]', 'data-test-id contains "calendar"');
      grab('[data-test-id*="picker" i]', 'data-test-id contains "picker"');
      grab('[data-test-id*="week" i]', 'data-test-id contains "week"');
      grab('[data-test-id*="prev" i], [data-test-id*="next" i]', 'data-test-id prev/next');
      grab('[class*="date" i]', 'class contains "date"');
      grab('[class*="calendar" i]', 'class contains "calendar"');
      grab('[class*="picker" i]', 'class contains "picker"');
      grab('a[href*="marks"]', 'anchors to /marks');
      const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      const arrows = allButtons.filter((b) => /[\\u2190-\\u21FF\\u25C0\\u25B6<>\\u2039\\u203A]/.test((b.textContent || '').trim().slice(0, 4)));
      if (arrows.length) result.push({ what: "arrow-textual buttons (" + arrows.length + ")", matches: arrows.slice(0, 8).map(cap) });
      return result;
    })()`;
    const dump = (await page.evaluate(PROBE)) as { what: string; matches: string[] }[];

    for (const block of dump) {
      console.log(`\n-- ${block.what} --`);
      for (const m of block.matches) console.log("   " + m);
    }

    // Also dump network requests in case the date nav is XHR-driven.
    // Watch network requests during scroll — maybe new weeks lazy-load.
    const reqs: { url: string; method: string }[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (u.includes("emaktab.uz") && !u.match(/\.(svg|png|jpg|css|woff|js)/i)) reqs.push({ url: u.slice(0, 200), method: r.method() });
    });

    console.log("\n== Day-card count before scroll ==");
    const before = await page.evaluate(`document.querySelectorAll('[data-test-id^="day-"]').length`);
    console.log("  count =", before);

    // Try scroll-to-bottom several times — emaktab might lazy-load earlier weeks.
    for (let i = 0; i < 6; i++) {
      await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
      await page.waitForTimeout(900);
    }
    const afterScrollDown = await page.evaluate(`document.querySelectorAll('[data-test-id^="day-"]').length`);
    console.log("== Day-card count after 6× scroll-down ==");
    console.log("  count =", afterScrollDown);

    // Scroll up — maybe the FORWARD direction lazy-loads
    await page.evaluate(`window.scrollTo(0, 0)`);
    await page.waitForTimeout(600);
    for (let i = 0; i < 6; i++) {
      await page.evaluate(`window.scrollTo(0, -document.body.scrollHeight)`);
      await page.waitForTimeout(600);
    }

    console.log("\n== Network requests during scroll (last 20) ==");
    for (const r of reqs.slice(-20)) console.log("  ", r.method, r.url);

    // Sniff anything OUTSIDE the day-cards container that might be a control.
    console.log("\n== Siblings of [data-test-id='day-cards'] ==");
    const SIBLINGS = `(() => {
      const dc = document.querySelector('[data-test-id="day-cards"]');
      if (!dc) return "no day-cards container";
      const out = [];
      let p = dc.parentElement;
      let depth = 0;
      while (p && depth < 4) {
        const sibs = Array.from(p.children).filter((c) => c !== dc.parentElement && c !== dc);
        for (const s of sibs.slice(0, 8)) {
          const txt = (s.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120);
          const dti = s.getAttribute('data-test-id') || '';
          const cls = (s.getAttribute('class') || '').slice(0, 60);
          out.push("  L" + depth + " <" + s.tagName.toLowerCase() + (dti ? " test-id=" + dti : "") + (cls ? " class=" + cls : "") + "> \\"" + txt + "\\"");
        }
        p = p.parentElement;
        depth++;
      }
      return out.join("\\n");
    })()`;
    const siblings = (await page.evaluate(SIBLINGS)) as string;
    console.log(siblings);

    console.log("\n== Direct selector test for arrow controls ==");
    const ARROW = `(() => {
      const tests = [
        '[data-test-id="arrow-left"]',
        '[test-id="arrow-left"]',
        '[data-test-id="arrow-right"]',
        '[test-id="arrow-right"]',
        '[class*="arrow"]',
      ];
      const out = {};
      for (const sel of tests) {
        const els = Array.from(document.querySelectorAll(sel));
        out[sel] = els.length;
        if (els.length > 0 && els[0]) {
          const e = els[0];
          out[sel + " :outerHTML"] = e.outerHTML.slice(0, 300);
          out[sel + " :attrs"] = Array.from(e.attributes).map((a) => a.name + "=" + a.value).join(" | ");
        }
      }
      return out;
    })()`;
    const arrowProbe = (await page.evaluate(ARROW)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(arrowProbe)) console.log("  ", k, "→", v);

    console.log("\n== HTML around any visible date heading ==");
    const SNIFF = `(() => {
      const cand = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,button')).find((el) => {
        const t = (el.textContent || '').trim();
        return /\\d+\\s+(yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentyabr|oktyabr|noyabr|dekabr)/i.test(t) && t.length < 60;
      });
      if (!cand) return null;
      const p = cand.parentElement && cand.parentElement.parentElement && cand.parentElement.parentElement.parentElement
        ? cand.parentElement.parentElement.parentElement
        : (cand.parentElement && cand.parentElement.parentElement ? cand.parentElement.parentElement : (cand.parentElement || cand));
      return p.outerHTML.slice(0, 4000);
    })()`;
    const sniff = (await page.evaluate(SNIFF)) as string | null;
    if (sniff) console.log(sniff);
    else console.log("no Uzbek-month date heading found in DOM");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
