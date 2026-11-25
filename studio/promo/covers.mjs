// Обложки для объявлений и соцсетей. Запуск: node studio/promo/covers.mjs [цена]
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { ({ chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"))); }

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const out = path.join(root, "moroz", "promo");
const F = (f) => pathToFileURL(path.join(root, "studio", "assets", "fonts", f)).href;
const I = (f) => pathToFileURL(path.join(root, "studio", "assets", "img", f)).href;
const price = process.argv[2] || "490";

const css = `
@font-face{font-family:Ruslan;src:url("${F("RuslanDisplay-Regular.ttf")}")}
@font-face{font-family:Lob;src:url("${F("Lobster-Regular.ttf")}")}
@font-face{font-family:Kurale;src:url("${F("Kurale-Regular.ttf")}")}
@font-face{font-family:PTS;src:url("${F("PT_Serif-Web-Regular.ttf")}")}
@font-face{font-family:PTS;font-weight:700;src:url("${F("PT_Serif-Web-Bold.ttf")}")}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:PTS,serif;color:#fff;background:#071432;overflow:hidden;position:relative}
.bg{position:absolute;inset:0;background-size:cover;background-position:center}
.shade{position:absolute;inset:0}
.gold{background:linear-gradient(180deg,#fff6c9,#ffd76a 40%,#f0a92c 70%,#ffe9a3);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 3px 2px rgba(60,20,0,.9)) drop-shadow(0 0 20px rgba(255,190,70,.5))}
.caps{font-family:Kurale;letter-spacing:.18em;text-transform:uppercase}
.sh{text-shadow:0 2px 4px rgba(0,8,30,.95),0 0 22px rgba(0,16,60,.9)}
.pill{display:inline-block;border-radius:999px;font-weight:700;color:#3a1a00;
  background:linear-gradient(180deg,#ffe9a3,#ffd26a 45%,#f2a52b);box-shadow:0 10px 34px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.6)}
.chip{display:inline-block;border-radius:999px;border:2px solid rgba(255,214,120,.8);background:rgba(7,20,50,.78);font-weight:700}
.abs{position:absolute}
li{list-style:none}
`;

const pages = {
  // 1. Главная обложка Авито 4:3
  "avito-1.jpg": { w: 1280, h: 960, html: `
    <div class="bg" style="background-image:url('${I("s2_ded_1.jpg")}');left:520px;background-position:center 12%"></div>
    <div class="shade" style="background:linear-gradient(90deg,#071432 0%,#071432 40%,rgba(7,20,50,.75) 54%,rgba(7,20,50,0) 74%)"></div>
    <div class="abs caps sh" style="left:64px;top:70px;font-size:30px">Волшебная почта</div>
    <div class="abs gold" style="left:64px;top:108px;font-family:Ruslan;font-size:66px">Деда Мороза</div>
    <div class="abs sh" style="left:64px;top:250px;width:620px;font-weight:700;font-size:74px;line-height:1.08">Именное видео&shy;поздравление</div>
    <div class="abs sh" style="left:64px;top:510px;width:560px;font-size:37px;line-height:1.3">Назовёт ребёнка по имени, похвалит за успехи, передаст привет от мамы и папы</div>
    <div class="abs pill" style="left:64px;top:742px;font-size:66px;padding:18px 46px">${price} ₽</div>
    <div class="abs chip sh" style="left:64px;top:872px;font-size:28px;padding:10px 24px">Оплата после просмотра</div>` },
  // 2. Что внутри
  "avito-2.jpg": { w: 1280, h: 960, html: `
    <div class="bg" style="background-image:url('${I("s3_book_1.jpg")}');left:600px"></div>
    <div class="shade" style="background:linear-gradient(90deg,#071432 0%,#071432 46%,rgba(7,20,50,.7) 60%,rgba(7,20,50,.05) 86%)"></div>
    <div class="abs gold" style="left:64px;top:64px;font-family:Lob;font-size:84px">Что услышит ребёнок</div>
    <ul class="abs sh" style="left:64px;top:214px;width:760px;font-size:43px;line-height:1.28">
      ${["Своё имя и возраст", "Три добрых дела, за которые его хвалит Дед Мороз", "Наказ: например, убирать игрушки", "Заветное желание", "Привет от мамы, папы, бабушки"].map((t) => `<li style="display:flex;gap:20px;margin-bottom:22px"><span style="color:#ffd76a">★</span><span>${t}</span></li>`).join("")}
    </ul>
    <div class="abs chip sh" style="left:64px;top:860px;font-size:30px;padding:12px 26px">Ролик до 2 минут · можно с фото</div>` },
  // 3. Как заказать
  "avito-3.jpg": { w: 1280, h: 960, html: `
    <div class="bg" style="background-image:url('${I("s1_terem_1.jpg")}');left:640px"></div>
    <div class="shade" style="background:linear-gradient(90deg,#071432 0%,#071432 50%,rgba(7,20,50,.7) 64%,rgba(7,20,50,.05) 90%)"></div>
    <div class="abs gold" style="left:64px;top:64px;font-family:Lob;font-size:84px">Как заказать</div>
    <div class="abs sh" style="left:64px;top:220px;width:800px">
      ${[["Напишите имя, возраст и пару достижений", "займёт 2 минуты"], ["Получите образец с водяным знаком", "обычно за 1–2 часа"], ["Понравилось — оплатите", "и получите чистое видео"]].map((s, i) => `
        <div style="display:flex;gap:26px;align-items:flex-start;margin-bottom:44px">
          <div style="font-family:Lob;font-size:104px;line-height:1;flex:0 0 84px;color:#ffd76a;text-shadow:0 3px 2px rgba(60,20,0,.9),0 0 22px rgba(255,190,70,.55);margin-top:-14px">${i + 1}</div>
          <div><div style="font-weight:700;font-size:44px;line-height:1.15">${s[0]}</div><div style="font-size:33px;color:#cfd8f0;margin-top:6px">${s[1]}</div></div>
        </div>`).join("")}
    </div>
    <div class="abs pill" style="left:64px;top:846px;font-size:40px;padding:14px 36px">Не понравилось — не платите</div>` },
  // Квадрат для VK / Telegram
  "post-1080.jpg": { w: 1080, h: 1080, html: `
    <div class="bg" style="background-image:url('${I("s2_ded_1.jpg")}');left:170px;right:170px;bottom:auto;height:1316px;background-size:100% 100%"></div>
    <div class="shade" style="background:linear-gradient(90deg,#071432 14%,rgba(7,20,50,0) 34%,rgba(7,20,50,0) 66%,#071432 86%)"></div>
    <div class="shade" style="background:linear-gradient(180deg,rgba(7,20,50,.7) 0%,rgba(7,20,50,0) 17%,rgba(7,20,50,0) 56%,rgba(7,20,50,.96) 70%,#071432 100%)"></div>
    <div class="abs caps sh" style="left:0;right:0;top:34px;text-align:center;font-size:27px">Волшебная почта</div>
    <div class="abs gold" style="left:0;right:0;top:68px;text-align:center;font-family:Ruslan;font-size:56px">Деда Мороза</div>
    <div class="abs sh" style="left:60px;right:60px;top:748px;text-align:center;font-weight:700;font-size:60px;line-height:1.1">Видеопоздравление с&nbsp;именем вашего ребёнка</div>
    <div class="abs" style="left:0;right:0;top:936px;text-align:center">
      <span class="pill" style="font-size:54px;padding:14px 44px">${price} ₽</span>
      <span class="chip sh" style="font-size:30px;padding:14px 26px;margin-left:16px;vertical-align:12px">оплата после просмотра</span>
    </div>` },
  // Сторис 9:16
  "story-1080x1920.jpg": { w: 1080, h: 1920, html: `
    <div class="bg" style="background-image:url('${I("s2_ded_1.jpg")}')"></div>
    <div class="shade" style="background:linear-gradient(180deg,rgba(7,20,50,.8) 0%,rgba(7,20,50,0) 22%,rgba(7,20,50,0) 52%,rgba(7,20,50,.95) 76%,#071432 100%)"></div>
    <div class="abs caps sh" style="left:0;right:0;top:150px;text-align:center;font-size:36px">Волшебная почта</div>
    <div class="abs gold" style="left:0;right:0;top:198px;text-align:center;font-family:Ruslan;font-size:80px">Деда Мороза</div>
    <div class="abs sh" style="left:70px;right:70px;top:1230px;text-align:center;font-weight:700;font-size:78px;line-height:1.1">Дед Мороз назовёт вашего ребёнка по имени</div>
    <div class="abs sh" style="left:90px;right:90px;top:1490px;text-align:center;font-size:42px;line-height:1.3">и расскажет, что знает о его успехах</div>
    <div class="abs" style="left:0;right:0;top:1640px;text-align:center"><span class="pill" style="font-size:64px;padding:18px 56px">${price} ₽</span></div>
    <div class="abs sh" style="left:0;right:0;top:1790px;text-align:center;font-size:34px;color:#cfd8f0">Сначала смотрите — потом платите</div>` },
  // Превью ссылки сайта
  "../img/og.jpg": { w: 1200, h: 630, html: `
    <div class="bg" style="background-image:url('${I("s2_ded_1.jpg")}');left:560px;background-position:center 14%"></div>
    <div class="shade" style="background:linear-gradient(90deg,#071432 0%,#071432 44%,rgba(7,20,50,.72) 58%,rgba(7,20,50,0) 80%)"></div>
    <div class="abs caps sh" style="left:56px;top:54px;font-size:24px">Волшебная почта</div>
    <div class="abs gold" style="left:56px;top:86px;font-family:Ruslan;font-size:52px">Деда Мороза</div>
    <div class="abs sh" style="left:56px;top:206px;width:640px;font-weight:700;font-size:62px;line-height:1.08">Видеопоздравление с именем ребёнка</div>
    <div class="abs pill" style="left:56px;top:470px;font-size:46px;padding:14px 38px">${price} ₽</div>
    <div class="abs chip sh" style="left:270px;top:480px;font-size:26px;padding:12px 22px">оплата после просмотра</div>` },
};

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, pg] of Object.entries(pages)) {
  const page = await browser.newPage({ viewport: { width: pg.w, height: pg.h }, deviceScaleFactor: 1 });
  const tmp = path.join(out, "_tmp.html");
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${css}body{width:${pg.w}px;height:${pg.h}px}</style></head><body>${pg.html}</body></html>`);
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, name), type: "jpeg", quality: 88 });
  await page.close();
  fs.unlinkSync(tmp);
  console.log("готово:", name);
}
await browser.close();
