(function () {
  "use strict";
  var C = window.MOROZ || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };

  // ── цены и сроки из config.js ──
  $$("[data-cfg]").forEach(function (el) {
    var v = C[el.getAttribute("data-cfg")];
    if (v === undefined || v === "") return;
    el.textContent = typeof v === "number" ? money(v) : v;
  });
  if (C.owner) {
    var fo = $("#foot-owner");
    fo.textContent = C.owner + (C.inn ? ", ИНН " + C.inn : "") + (C.email ? " · " + C.email : "");
    fo.hidden = false;
  }

  // ── выбор тарифа кнопкой из блока цен ──
  var form = $("#form");
  $$("[data-plan]").forEach(function (a) {
    a.addEventListener("click", function () { form.elements.plan.value = a.getAttribute("data-plan"); });
  });

  // ── анкета -> текст сообщения ──
  function val(n) { return (form.elements[n].value || "").trim(); }
  function years(n) {
    n = Math.abs(parseInt(n, 10)) || 0;
    if (n % 100 >= 11 && n % 100 <= 14) return "лет";
    return n % 10 === 1 ? "год" : (n % 10 >= 2 && n % 10 <= 4 ? "года" : "лет");
  }
  function message() {
    var facts = ["fact1", "fact2", "fact3"].map(val).filter(Boolean);
    var lines = [
      "Здравствуйте! Хочу видеопоздравление от Деда Мороза 🎅",
      "",
      "Имя: " + val("name"),
      "Кому: " + form.elements.gender.value + (val("age") ? ", " + val("age") + " " + years(val("age")) : ""),
    ];
    if (facts.length) {
      lines.push("Дед Мороз знает, что ты:");
      facts.forEach(function (f, i) { lines.push("  " + (i + 1) + ") " + f); });
    }
    if (val("advice")) lines.push("Наказ: " + val("advice"));
    if (val("gift")) lines.push("Заветное желание (подарок будет): " + val("gift"));
    if (val("from")) lines.push("Привет передают: " + val("from"));
    lines.push("Фото в волшебную книгу: " + (form.elements.photo.checked ? "да, пришлю следом" : "без фото"));
    lines.push("Тариф: " + form.elements.plan.value);
    return lines.join("\n");
  }
  function valid() {
    var ok = val("name").length > 0;
    $("#err").hidden = ok;
    if (!ok) form.elements.name.focus();
    return ok;
  }
  function toast(text) {
    var t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3800);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  }

  var links = [
    ["#go-tg", C.telegram && function (m) { return "https://t.me/" + String(C.telegram).replace(/^@/, "") + "?text=" + encodeURIComponent(m); }],
    ["#go-wa", C.whatsapp && function (m) { return "https://wa.me/" + String(C.whatsapp).replace(/\D/g, "") + "?text=" + encodeURIComponent(m); }],
    ["#go-vk", C.vk && function () { return C.vk; }],
    ["#go-max", C.max && function () { return C.max; }]
  ];
  var any = false;
  links.forEach(function (pair) {
    var el = $(pair[0]), make = pair[1];
    if (!make) return;
    any = true; el.hidden = false; el.href = "#";
    el.addEventListener("click", function (e) {
      if (!valid()) { e.preventDefault(); return; }
      var m = message();
      el.href = make(m);
      // ВК и MAX не умеют подставлять текст — кладём анкету в буфер
      if (pair[0] === "#go-vk" || pair[0] === "#go-max") {
        copy(m).then(function () { toast("Анкета скопирована — вставьте её в сообщение"); }, function () {});
      }
    });
  });
  $("#go-copy").addEventListener("click", function () {
    if (!valid()) return;
    copy(message()).then(
      function () { toast(any ? "Анкета скопирована" : "Анкета скопирована — отправьте её нам в личные сообщения"); },
      function () { toast("Не получилось скопировать — выделите текст вручную"); }
    );
  });
  if (!any) $("#note").textContent = "Нажмите «Скопировать анкету» и отправьте её нам в личные сообщения.";

  // ── видео: одновременно играет только одно ──
  $$("video").forEach(function (v) {
    v.addEventListener("play", function () { $$("video").forEach(function (o) { if (o !== v) o.pause(); }); });
  });

  // ── лёгкий снег ──
  var cv = $("#snow");
  if (cv && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    var ctx = cv.getContext("2d"), W, H, flakes = [], dpr = Math.min(2, window.devicePixelRatio || 1);
    var resize = function () {
      W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
      var n = Math.round(Math.min(90, innerWidth / 9));
      flakes = [];
      for (var i = 0; i < n; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 2 + .7) * dpr, v: (Math.random() * .5 + .25) * dpr, p: Math.random() * 6.28 });
    };
    resize(); addEventListener("resize", resize);
    var last = 0;
    (function tick(t) {
      requestAnimationFrame(tick);
      if (document.hidden || t - last < 33) return;
      last = t;
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "rgba(255,255,255,.85)";
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.v; f.x += Math.sin(f.p + f.y / (70 * dpr)) * .35 * dpr;
        if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
      }
    })(0);
  }
})();
