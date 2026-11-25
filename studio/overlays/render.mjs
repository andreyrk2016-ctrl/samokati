// Рисует именные плашки (прозрачные PNG 720x1280) для ролика.
// Запуск: node render.mjs spec.json   — spec: { outDir, cards: [{file, type, ...данные}] }
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  // глобально установленный playwright (облачная сессия Claude)
  const { execSync } = require("node:child_process");
  const root = execSync("npm root -g").toString().trim();
  ({ chromium } = require(path.join(root, "playwright")));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const fonts = path.join(here, "..", "assets", "fonts");
const furl = (f) => pathToFileURL(path.join(fonts, f)).href;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CSS = `
@font-face { font-family: "Script"; src: url("${furl("MarckScript-Regular.ttf")}"); }
@font-face { font-family: "Lob"; src: url("${furl("Lobster-Regular.ttf")}"); }
@font-face { font-family: "Kurale"; src: url("${furl("Kurale-Regular.ttf")}"); }
@font-face { font-family: "Ruslan"; src: url("${furl("RuslanDisplay-Regular.ttf")}"); }
@font-face { font-family: "PTS"; src: url("${furl("PT_Serif-Web-Regular.ttf")}"); }
@font-face { font-family: "PTS"; font-weight: 700; src: url("${furl("PT_Serif-Web-Bold.ttf")}"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 720px; height: 1280px; background: transparent; overflow: hidden; }
body { font-family: "Kurale", "PTS", serif; color: #fff; position: relative; }
.gold {
  background: linear-gradient(180deg, #fff6c9 0%, #ffd76a 38%, #f0a92c 62%, #ffe9a3 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 3px 2px rgba(60,20,0,.85)) drop-shadow(0 0 18px rgba(255,190,70,.55));
}
.white { color: #fff; text-shadow: 0 2px 3px rgba(0,10,40,.9), 0 0 16px rgba(0,20,60,.8); }
.caps { font-family: "Kurale"; letter-spacing: .16em; text-transform: uppercase; }
.center { position: absolute; left: 0; right: 0; text-align: center; padding: 0 44px; }
.panel {
  position: absolute; left: 36px; right: 36px;
  background: linear-gradient(180deg, rgba(8,22,58,.80), rgba(6,14,40,.88));
  border: 2px solid rgba(255,214,120,.75); border-radius: 30px;
  box-shadow: 0 10px 40px rgba(0,0,0,.55), inset 0 0 40px rgba(120,170,255,.12);
  padding: 30px 34px;
}
.star { color: #ffd76a; filter: drop-shadow(0 0 8px rgba(255,200,90,.9)); }
.snow { position: absolute; color: rgba(255,255,255,.9); filter: drop-shadow(0 0 6px rgba(160,210,255,.9)); }
.scrim-top { position: absolute; left: 0; right: 0; top: 0; height: 520px;
  background: linear-gradient(180deg, rgba(3,10,34,.78) 0%, rgba(3,10,34,.45) 55%, rgba(3,10,34,0) 100%); }
.scrim-bottom { position: absolute; left: 0; right: 0; bottom: 0; height: 620px;
  background: linear-gradient(0deg, rgba(3,10,34,.86) 0%, rgba(3,10,34,.55) 55%, rgba(3,10,34,0) 100%); }
`;

// размер шрифта под длину имени, чтобы длинные имена не вылезали
const fit = (text, max, min, per) => Math.max(min, Math.min(max, Math.floor(per / Math.max(1, [...String(text)].length))));

function card(c) {
  const name = esc(c.name);
  switch (c.type) {
    case "title": // заставка на тереме
      return `
        <div class="scrim-top"></div>
        <div class="center caps white" style="top:108px;font-size:27px;">Волшебная почта</div>
        <div class="center gold" style="top:150px;font-family:Ruslan;font-size:60px;line-height:1.1;">Деда Мороза</div>
        <div class="center gold" style="top:262px;font-family:Lob;font-size:${fit(c.name, 124, 64, 900)}px;line-height:1.15;">${name}!</div>
        <div class="center white" style="top:${262 + fit(c.name, 124, 64, 900) * 1.2 + 14}px;font-size:36px;">${esc(c.line || "тебе видеописьмо")}</div>`;
    case "name": { // карточка в волшебной книге
      const size = fit(c.name, 128, 66, 930);
      const photo = c.photo
        ? `<div style="position:absolute;left:50%;top:150px;width:330px;height:330px;margin-left:-165px;border-radius:50%;
              background:url('${c.photo}') center/cover;border:8px solid #ffd76a;
              box-shadow:0 0 0 4px rgba(120,60,0,.6),0 0 46px rgba(255,200,90,.85),0 12px 40px rgba(0,0,0,.6);"></div>`
        : "";
      const top = c.photo ? 500 : 190;
      return `
        <div class="scrim-top" style="height:${c.photo ? 760 : 560}px;"></div>
        ${photo}
        <div class="center caps white" style="top:${top}px;font-size:25px;">В волшебной книге записано</div>
        <div class="center gold" style="top:${top + 38}px;font-family:Lob;font-size:${size}px;line-height:1.15;">${name}</div>
        ${c.sub ? `<div class="center white" style="top:${top + 38 + size * 1.2 + 10}px;font-size:40px;">${esc(c.sub)}</div>` : ""}`;
    }
    case "facts": { // part: "bg" — панель без строк; число k — только k-я строка; иначе всё сразу
      const items = c.items || [];
      const fs_ = items.some((t) => [...t].length > 44) ? 29 : 33;
      const part = c.part;
      const lineOnly = typeof part === "number";
      const vis = (on) => (on ? "" : "visibility:hidden;");
      return `
        ${lineOnly ? "" : `<div class="scrim-bottom" style="height:560px;"></div>`}
        <div class="panel" style="bottom:70px;${lineOnly ? "background:none;border-color:transparent;box-shadow:none;" : ""}">
          <div class="caps gold" style="font-size:25px;text-align:center;margin-bottom:16px;${vis(!lineOnly)}">${esc(c.title || "Добрые дела")}</div>
          ${items.map((t, i) => `
            <div style="display:flex;gap:14px;align-items:flex-start;margin:11px 0;${vis(part === undefined || part === i)}">
              <div class="star" style="font-size:${fs_ + 3}px;line-height:1.25;">★</div>
              <div class="white" style="font-size:${fs_}px;line-height:1.25;">${esc(t)}</div>
            </div>`).join("")}
        </div>`;
    }
    case "names": { // список имён (групповое поздравление)
      const items = c.items || [];
      const cols = items.length > 16 ? 3 : items.length > 5 ? 2 : 1;
      const fs_ = items.length > 16 ? 30 : items.length > 10 ? 35 : items.length > 5 ? 40 : 48;
      const pos = c.low ? "bottom:70px;" : "top:120px;";
      return `
        <div class="${c.low ? "scrim-bottom" : "scrim-top"}" style="height:${c.low ? 700 : 760}px;"></div>
        <div class="panel" style="${pos}text-align:center;">
          <div class="caps gold" style="font-size:25px;margin-bottom:14px;">${esc(c.title || "В волшебной книге записаны")}</div>
          <div style="columns:${cols};column-gap:18px;">
            ${items.map((t) => `<div class="white" style="font-family:Lob;font-size:${fs_}px;line-height:1.28;break-inside:avoid;">${esc(t)}</div>`).join("")}
          </div>
        </div>`;
    }
    case "gift":
      return `
        <div class="scrim-bottom" style="height:520px;"></div>
        <div class="panel" style="bottom:90px;text-align:center;">
          <div class="caps gold" style="font-size:25px;margin-bottom:10px;">${esc(c.title || "Заветное желание")}</div>
          <div class="white" style="font-family:Lob;font-size:${fit(c.text, 58, 34, 1300)}px;line-height:1.2;">${esc(c.text)}</div>
        </div>`;
    case "finale": {
      const size = fit(c.name, 120, 62, 880);
      return `
        <div class="scrim-bottom" style="height:640px;"></div>
        <div class="center gold" style="bottom:${250 + size * 1.15}px;font-family:Lob;font-size:76px;line-height:1.1;">С Новым годом,</div>
        <div class="center gold" style="bottom:236px;font-family:Lob;font-size:${size}px;line-height:1.15;">${name}!</div>
        <div class="center caps white" style="bottom:168px;font-size:27px;">${esc(c.sub || "твой Дедушка Мороз")}</div>
        ${c.brand ? `<div class="center white" style="bottom:70px;font-size:23px;opacity:.85;">${esc(c.brand)}</div>` : ""}`;
    }
    case "caption": // произвольная строка внизу (для своих сценариев)
      return `
        <div class="scrim-bottom" style="height:420px;"></div>
        <div class="center white" style="bottom:120px;font-size:${fit(c.text, 46, 30, 1500)}px;line-height:1.25;">${esc(c.text)}</div>`;
    case "watermark": {
      const row = `<span style="margin:0 26px;">ОБРАЗЕЦ</span><span style="margin:0 26px;font-size:30px;">без знака — после оплаты</span>`;
      let rows = "";
      for (let i = 0; i < 9; i++) rows += `<div style="white-space:nowrap;margin:92px 0 0 ${i % 2 ? -260 : -60}px;">${row.repeat(4)}</div>`;
      return `<div style="position:absolute;left:-300px;top:-200px;width:1500px;height:1900px;transform:rotate(-24deg);
          font-family:PTS;font-weight:700;font-size:62px;color:rgba(255,255,255,.30);
          text-shadow:0 0 6px rgba(0,0,0,.45);">${rows}</div>`;
    }
    default:
      throw new Error("неизвестный тип плашки: " + c.type);
  }
}

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
fs.mkdirSync(spec.outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
for (const c of spec.cards) {
  if (c.photo && !/^(data:|file:|https?:)/.test(c.photo)) c.photo = pathToFileURL(path.resolve(c.photo)).href;
  // страницу открываем как файл: из about:blank локальные шрифты и фото не грузятся
  const tmp = path.join(spec.outDir, "_card.html");
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${card(c)}</body></html>`);
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(spec.outDir, c.file), omitBackground: true });
}
await browser.close();
try { fs.unlinkSync(path.join(spec.outDir, "_card.html")); } catch (e) {}
console.log("плашек:", spec.cards.length);
