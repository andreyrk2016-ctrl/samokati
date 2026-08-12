/* ============ SAMOKATI — логика каталога ============ */

(function () {
  "use strict";

  var DATA = (window.CATALOG && Array.isArray(window.CATALOG.products))
    ? window.CATALOG
    : { demo: false, products: [] };

  var products = DATA.products;

  var grid = document.getElementById("grid");
  var chipsWrap = document.getElementById("chips");
  var searchInput = document.getElementById("search");
  var countEl = document.getElementById("count");
  var emptyEl = document.getElementById("empty");
  var demoNote = document.getElementById("demo-note");

  var modal = document.getElementById("modal");
  var modalImg = document.getElementById("modal-img");
  var modalThumbs = document.getElementById("modal-thumbs");
  var modalTag = document.getElementById("modal-tag");
  var modalName = document.getElementById("modal-name");
  var modalPrice = document.getElementById("modal-price");
  var modalDesc = document.getElementById("modal-desc");
  var modalBuy = document.getElementById("modal-buy");

  var state = { category: "all", query: "", sort: "default" };
  var modalState = { product: null, index: 0 };

  document.getElementById("year").textContent = new Date().getFullYear();
  if (DATA.demo) demoNote.hidden = false;

  /* Живые фото товаров в шапке — кликабельные */
  (function renderHeroVisual() {
    var wrap = document.getElementById("hero-visual");
    if (!wrap) return;
    var withPhoto = products.filter(function (p) { return p.images.length; });
    var scooters = withPhoto.filter(function (p) { return p.category === "Самокаты"; });
    var picks = (scooters.length >= 3 ? scooters : withPhoto).slice(0, 3);
    if (!picks.length) return;
    wrap.innerHTML = picks.map(function (p, i) {
      return '<button type="button" class="hero-card hero-card--' + (i + 1) +
        '" data-id="' + p.id + '" tabindex="-1">' +
        '<img src="' + p.images[0] + '" alt="" loading="lazy"></button>';
    }).join("");
    wrap.addEventListener("click", function (event) {
      var card = event.target.closest(".hero-card");
      if (card) openModal(Number(card.dataset.id));
    });
  })();

  /* ---------- Языки ---------- */

  var I18N = window.I18N || { langs: [{ code: "ru", label: "RU" }], ui: { ru: {} } };
  var lang = "ru";
  try { lang = localStorage.getItem("psshop-lang") || "ru"; } catch (e) {}
  var validLangs = I18N.langs.map(function (item) { return item.code; });
  if (validLangs.indexOf(lang) === -1) lang = "ru";

  function t(key) {
    return (I18N.ui[lang] && I18N.ui[lang][key]) || (I18N.ui.ru && I18N.ui.ru[key]) || "";
  }

  function trName(product) {
    if (lang === "ru") return product.name;
    return (I18N.names && I18N.names[lang] && I18N.names[lang][product.name]) || product.name;
  }

  function trDesc(product) {
    if (lang === "ru") return product.description || "";
    return (I18N.descriptions && I18N.descriptions[lang] && I18N.descriptions[lang][product.name]) || product.description || "";
  }

  function trCategory(category) {
    if (lang === "ru") return category;
    return (I18N.categories && I18N.categories[lang] && I18N.categories[lang][category]) || category;
  }

  var langSwitch = document.getElementById("lang-switch");

  function renderLangSwitch() {
    if (!langSwitch) return;
    langSwitch.innerHTML = I18N.langs.map(function (item) {
      return '<button class="lang-btn' + (item.code === lang ? " is-active" : "") +
        '" data-lang="' + item.code + '">' + item.label + "</button>";
    }).join("");
  }

  function applyStaticTexts() {
    document.documentElement.lang = lang;
    document.title = t("title_tag") || document.title;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var text = t(el.getAttribute("data-i18n"));
      if (text) el.textContent = text;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var text = t(el.getAttribute("data-i18n-placeholder"));
      if (text) el.placeholder = text;
    });
  }

  function setLang(next) {
    lang = next;
    try { localStorage.setItem("psshop-lang", lang); } catch (e) {}
    renderLangSwitch();
    applyStaticTexts();
    renderChips();
    renderGrid();
    if (typeof renderViewed === "function") renderViewed();
    if (typeof renderAuthState === "function") renderAuthState();
    if (typeof renderOrdersPage === "function") {
      var op = document.getElementById("orders-page");
      if (op && !op.hidden) renderOrdersPage();
    }
    if (modal.open && modalState.product) {
      fillModalTexts(modalState.product);
      renderVariants(modalState.product);
    }
  }

  if (langSwitch) {
    langSwitch.addEventListener("click", function (event) {
      var btn = event.target.closest(".lang-btn");
      if (btn && btn.dataset.lang !== lang) setLang(btn.dataset.lang);
    });
  }

  /* ---------- Утилиты ---------- */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(price) {
    if (price === null || price === undefined || price === "") return "";
    if (typeof price === "number") {
      return "$" + price.toLocaleString("en-US");
    }
    return String(price);
  }

  function formatCount(count) {
    if (I18N.count) return I18N.count(lang, count);
    return count + "";
  }

  /* ---------- Всплывающие уведомления ---------- */

  var toastWrap = document.createElement("div");
  toastWrap.className = "toasts";
  toastWrap.setAttribute("aria-live", "polite");
  document.body.appendChild(toastWrap);

  function toast(icon, key) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = icon + " " + t(key);
    toastWrap.appendChild(el);
    // держим не больше трёх штук
    while (toastWrap.children.length > 3) toastWrap.removeChild(toastWrap.firstChild);
    requestAnimationFrame(function () { el.classList.add("is-in"); });
    setTimeout(function () {
      el.classList.remove("is-in");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
    }, 2200);
  }

  function bumpCartBadge() {
    var badge = document.getElementById("cart-badge");
    if (!badge) return;
    badge.classList.remove("is-bump");
    void badge.offsetWidth; // перезапуск анимации
    badge.classList.add("is-bump");
  }

  /* ---------- Категории ---------- */

  function getCategories() {
    var seen = [];
    products.forEach(function (product) {
      if (seen.indexOf(product.category) === -1) seen.push(product.category);
    });
    return seen;
  }

  function renderChips() {
    var categories = getCategories();
    var html = '<button class="chip' + (state.category === "all" ? " is-active" : "") +
      '" data-category="all">' + escapeHtml(t("chip_all") || "Все") + "</button>";
    categories.forEach(function (category) {
      html += '<button class="chip' + (state.category === category ? " is-active" : "") +
        '" data-category="' + escapeHtml(category) + '">' +
        escapeHtml(trCategory(category)) + "</button>";
    });
    var favTotal = window.AUTH ? AUTH.favs().length : 0;
    html += '<button class="chip chip--fav' + (state.category === "__fav" ? " is-active" : "") +
      '" data-category="__fav"><span class="chip-heart">♥</span> ' +
      escapeHtml(t("fav_chip") || "Избранное") + (favTotal ? " (" + favTotal + ")" : "") + "</button>";
    chipsWrap.innerHTML = html;
  }

  chipsWrap.addEventListener("click", function (event) {
    var chip = event.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.category;
    chipsWrap.querySelectorAll(".chip").forEach(function (el) {
      el.classList.toggle("is-active", el === chip);
    });
    renderGrid();
  });

  searchInput.addEventListener("input", function () {
    state.query = searchInput.value.trim().toLowerCase();
    renderGrid();
  });

  var sortSelect = document.getElementById("sort");
  sortSelect.addEventListener("change", function () {
    state.sort = sortSelect.value;
    renderGrid();
  });

  /* Товары без цены при сортировке по цене уходят в конец */
  function sortProducts(list) {
    if (state.sort === "default") return list;
    var dir = state.sort === "cheap" ? 1 : -1;
    return list.slice().sort(function (a, b) {
      var pa = typeof a.price === "number" ? a.price : Infinity * dir;
      var pb = typeof b.price === "number" ? b.price : Infinity * dir;
      if (pa === pb) return 0;
      return pa < pb ? -dir : dir;
    });
  }

  /* ---------- Сетка товаров ---------- */

  function getVisibleProducts() {
    return products.filter(function (product) {
      var matchesCategory;
      if (state.category === "__fav") {
        matchesCategory = window.AUTH && AUTH.isFav(product.name);
      } else {
        matchesCategory = state.category === "all" || product.category === state.category;
      }
      var matchesQuery = !state.query ||
        product.name.toLowerCase().indexOf(state.query) !== -1 ||
        trName(product).toLowerCase().indexOf(state.query) !== -1 ||
        trDesc(product).toLowerCase().indexOf(state.query) !== -1;
      return matchesCategory && matchesQuery;
    });
  }

  function badgeHtml(product) {
    if (product.category !== "Самокаты" || typeof product.price !== "number") return "";
    if (product.price >= 180) {
      return '<span class="card__badge card__badge--top">' + escapeHtml(t("badge_top") || "ТОП") + "</span>";
    }
    if (product.price <= 120) {
      return '<span class="card__badge">' + escapeHtml(t("badge_hot") || "ХИТ") + "</span>";
    }
    return "";
  }

  function favBtnHtml(product) {
    var isFav = window.AUTH && AUTH.isFav(product.name);
    return '<button type="button" class="card__fav' + (isFav ? " is-fav" : "") +
      '" data-fav="' + escapeHtml(product.name) + '" aria-label="В избранное">' +
      (isFav ? "♥" : "♡") + "</button>";
  }

  function cardHtml(product) {
    var name = trName(product);
    var photo = badgeHtml(product) + favBtnHtml(product) + (product.images.length
      ? '<img src="' + product.images[0] + '" alt="' + escapeHtml(name) + '" loading="lazy">'
      : '<span class="card__photo--empty" style="height:100%">🛴</span>');

    var price = formatPrice(product.price);
    var priceHtml = price
      ? '<span class="card__price">' + escapeHtml(price) + "</span>"
      : '<span class="card__price--empty">' + escapeHtml(t("price_ask") || "Цена по запросу") + "</span>";

    var buyHtml = '<div class="card__actions">' +
      '<button type="button" class="card__cart" data-cart="' + product.id + '" aria-label="В корзину">🛒</button>' +
      '<button type="button" class="card__buy" data-buy="' + product.id + '">' +
      escapeHtml(t("buy") || "Купить") + "</button></div>";

    return (
      '<article class="card" data-id="' + product.id + '" tabindex="0" role="button" ' +
      'aria-label="' + escapeHtml(name) + '">' +
      '<div class="card__photo">' + photo + "</div>" +
      '<div class="card__body">' +
      '<span class="card__tag">' + escapeHtml(trCategory(product.category)) + "</span>" +
      '<h3 class="card__name">' + escapeHtml(name) + "</h3>" +
      '<div class="card__bottom">' + priceHtml + buyHtml + "</div>" +
      "</div></article>"
    );
  }

  function renderGrid() {
    var visible = sortProducts(getVisibleProducts());
    grid.innerHTML = visible.map(cardHtml).join("");
    emptyEl.hidden = visible.length > 0;
    if (!visible.length) {
      emptyEl.textContent = state.category === "__fav" ? t("favs_empty") : t("empty");
    }
    countEl.textContent = formatCount(visible.length);
    observeReveals();
  }

  grid.addEventListener("click", function (event) {
    var favBtn = event.target.closest(".card__fav");
    if (favBtn) {
      event.stopPropagation();
      var nowFav = AUTH.toggleFav(favBtn.dataset.fav);
      favBtn.classList.toggle("is-fav", nowFav);
      favBtn.textContent = nowFav ? "♥" : "♡";
      toast(nowFav ? "♥" : "♡", nowFav ? "toast_fav_on" : "toast_fav_off");
      renderChips();
      if (state.category === "__fav") renderGrid();
      if (typeof renderAuthState === "function") renderAuthState();
      return;
    }
    var cartAddBtn = event.target.closest(".card__cart");
    if (cartAddBtn) {
      var cartProduct = products.find(function (item) { return item.id === Number(cartAddBtn.dataset.cart); });
      if (cartProduct) {
        cartAdd(cartProduct.name, null);
        cartAddBtn.textContent = "✓";
        setTimeout(function () { cartAddBtn.textContent = "🛒"; }, 800);
        toast("🛒", "toast_cart");
      }
      return;
    }
    var buyBtn = event.target.closest(".card__buy");
    if (buyBtn) {
      var buyProduct = products.find(function (item) { return item.id === Number(buyBtn.dataset.buy); });
      if (buyProduct) openCheckout([{ name: buyProduct.name, color: null, qty: 1 }], false);
      return;
    }
    var card = event.target.closest(".card");
    if (card) openModal(Number(card.dataset.id));
  });

  grid.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var card = event.target.closest(".card");
    if (!card) return;
    event.preventDefault();
    openModal(Number(card.dataset.id));
  });

  /* ---------- Модальное окно ---------- */

  function updateModalFav(product) {
    var favBtn = document.getElementById("modal-fav");
    var isFav = window.AUTH && AUTH.isFav(product.name);
    favBtn.innerHTML = (isFav ? "♥ " : "♡ ") +
      "<span>" + escapeHtml(isFav ? t("fav_added") : t("fav_add")) + "</span>";
    favBtn.classList.toggle("is-fav", isFav);
  }

  function fillModalTexts(product) {
    modalTag.textContent = trCategory(product.category);
    modalName.textContent = trName(product);
    modalPrice.textContent = formatPrice(product.price);
    modalDesc.textContent = trDesc(product);
    modalBuy.textContent = t("buy_now") || "Купить сейчас";
    updateModalFav(product);
    renderRelated(product);
  }

  /* ---------- Похожие товары ---------- */

  var modalRelated = document.getElementById("modal-related");
  var relatedStrip = document.getElementById("related-strip");

  function renderRelated(product) {
    var rel = products.filter(function (p) {
      return p.category === product.category && p.id !== product.id;
    }).slice(0, 4);
    modalRelated.hidden = !rel.length;
    relatedStrip.innerHTML = rel.map(function (p) {
      var img = p.images.length
        ? '<img src="' + p.images[0] + '" alt="" loading="lazy">'
        : "🛴";
      return '<button type="button" class="related-card" data-id="' + p.id + '">' +
        '<span class="related-card__photo">' + img + "</span>" +
        '<span class="related-card__name">' + escapeHtml(trName(p)) + "</span>" +
        '<span class="related-card__price">' + escapeHtml(formatPrice(p.price) || t("price_ask")) + "</span>" +
        "</button>";
    }).join("");
  }

  relatedStrip.addEventListener("click", function (event) {
    var card = event.target.closest(".related-card");
    if (!card) return;
    openModal(Number(card.dataset.id));
    modal.scrollTop = 0;
    var body = modal.querySelector(".modal__body");
    if (body) body.scrollTop = 0;
  });

  /* ---------- Недавно смотрели ---------- */

  var viewedSection = document.getElementById("viewed");
  var viewedStrip = document.getElementById("viewed-strip");

  function miniCardHtml(p) {
    var img = p.images.length
      ? '<img src="' + p.images[0] + '" alt="" loading="lazy">'
      : "🛴";
    return '<button type="button" class="related-card" data-id="' + p.id + '">' +
      '<span class="related-card__photo">' + img + "</span>" +
      '<span class="related-card__name">' + escapeHtml(trName(p)) + "</span>" +
      '<span class="related-card__price">' + escapeHtml(formatPrice(p.price) || t("price_ask")) + "</span>" +
      "</button>";
  }

  function renderViewed() {
    var seen = storeRead("psshop-viewed", []);
    var items = seen.map(function (id) {
      return products.find(function (p) { return p.id === id; });
    }).filter(Boolean).slice(0, 6);
    viewedSection.hidden = items.length < 2;
    viewedStrip.innerHTML = items.map(miniCardHtml).join("");
  }

  function recordView(id) {
    var seen = storeRead("psshop-viewed", []).filter(function (x) { return x !== id; });
    seen.unshift(id);
    storeWrite("psshop-viewed", seen.slice(0, 8));
    renderViewed();
  }

  viewedStrip.addEventListener("click", function (event) {
    var card = event.target.closest(".related-card");
    if (card) openModal(Number(card.dataset.id));
  });

  function openModal(id) {
    var product = products.find(function (item) { return item.id === id; });
    if (!product) return;
    modalState.product = product;
    modalState.index = 0;
    modalState.color = null;

    fillModalTexts(product);
    renderVariants(product);
    modalBuy.hidden = false;
    modalBuy.removeAttribute("href");

    renderGalleryThumbs();
    showImage(0);
    if (!modal.open) modal.showModal();
    recordView(product.id);
  }

  function renderGalleryThumbs() {
    var product = modalState.product;
    if (product.images.length < 2) {
      modalThumbs.innerHTML = "";
      return;
    }
    modalThumbs.innerHTML = product.images.map(function (src, index) {
      return '<img class="modal__thumb" data-index="' + index + '" src="' + src + '" alt="">';
    }).join("");
  }

  var modalCounter = document.getElementById("modal-counter");

  function showImage(index) {
    var product = modalState.product;
    if (!product) return;
    var total = product.images.length;
    if (!total) {
      modalImg.removeAttribute("src");
      modalCounter.hidden = true;
      return;
    }
    modalState.index = (index + total) % total;
    modalImg.src = product.images[modalState.index];
    modalImg.alt = trName(product);
    modalCounter.hidden = total < 2;
    modalCounter.textContent = (modalState.index + 1) + " / " + total;
    modalThumbs.querySelectorAll(".modal__thumb").forEach(function (thumb) {
      thumb.classList.toggle("is-active", Number(thumb.dataset.index) === modalState.index);
    });
    // если открыт полноэкранный просмотр — листаем и его
    if (!lightbox.hidden) lightboxImg.src = modalImg.src;
  }

  modalThumbs.addEventListener("click", function (event) {
    var thumb = event.target.closest(".modal__thumb");
    if (thumb) showImage(Number(thumb.dataset.index));
  });

  document.getElementById("modal-prev").addEventListener("click", function () {
    showImage(modalState.index - 1);
  });

  document.getElementById("modal-next").addEventListener("click", function () {
    showImage(modalState.index + 1);
  });

  document.getElementById("modal-close").addEventListener("click", function () {
    modal.close();
  });

  modal.addEventListener("click", function (event) {
    if (event.target === modal) modal.close(); // клик по фону закрывает окно
  });

  // Стрелки работают, где бы ни был фокус (например, после клика по «похожему»)
  document.addEventListener("keydown", function (event) {
    if (!modal.open) return;
    var tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (event.key === "ArrowLeft") showImage(modalState.index - 1);
    if (event.key === "ArrowRight") showImage(modalState.index + 1);
  });

  // Свайп по фото на телефоне листает галерею
  function attachSwipe(el) {
    var startX = null;
    var startY = null;
    el.addEventListener("touchstart", function (event) {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });
    el.addEventListener("touchend", function (event) {
      if (startX === null) return;
      var dx = event.changedTouches[0].clientX - startX;
      var dy = event.changedTouches[0].clientY - startY;
      startX = null;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
      showImage(modalState.index + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* Клик по фото — полноэкранный просмотр */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");

  attachSwipe(document.querySelector(".modal__gallery"));
  attachSwipe(lightbox);

  modalImg.addEventListener("click", function () {
    if (!modalImg.src) return;
    lightboxImg.src = modalImg.src;
    lightbox.hidden = false;
  });

  lightbox.addEventListener("click", function () {
    lightbox.hidden = true;
  });

  modal.addEventListener("close", function () {
    lightbox.hidden = true;
  });

  // Esc при открытом полноэкранном фото закрывает только фото, а не всё окно
  modal.addEventListener("cancel", function (event) {
    if (!lightbox.hidden) {
      event.preventDefault();
      lightbox.hidden = true;
    }
  });

  /* ---------- Выбор цвета ---------- */

  var modalVariants = document.getElementById("modal-variants");
  var variantChips = document.getElementById("variant-chips");

  function trColor(color) {
    if (lang === "ru") return color;
    return (I18N.colors && I18N.colors[lang] && I18N.colors[lang][color]) || color;
  }

  function renderVariants(product) {
    var list = product.variants || [];
    if (!list.length) {
      modalVariants.hidden = true;
      variantChips.innerHTML = "";
      modalState.color = null;
      return;
    }
    modalVariants.hidden = false;
    modalState.color = modalState.color || list[0];
    variantChips.innerHTML = list.map(function (color) {
      return '<button type="button" class="variant-chip' +
        (color === modalState.color ? " is-active" : "") +
        '" data-color="' + escapeHtml(color) + '">' + escapeHtml(trColor(color)) + "</button>";
    }).join("");
  }

  variantChips.addEventListener("click", function (event) {
    var chip = event.target.closest(".variant-chip");
    if (!chip) return;
    modalState.color = chip.dataset.color;
    variantChips.querySelectorAll(".variant-chip").forEach(function (el) {
      el.classList.toggle("is-active", el === chip);
    });
  });

  /* ---------- Виджет поддержки ---------- */

  var supportFab = document.getElementById("support-fab");
  var supportPanel = document.getElementById("support-panel");
  var supportMsgs = document.getElementById("support-msgs");
  var supportForm = document.getElementById("support-form");
  var supportText = document.getElementById("support-text");
  var supportClose = document.getElementById("support-close");
  var modalSupport = document.getElementById("modal-support");
  var supGreeted = false;

  var SUPPORT_TG = "https://t.me/proscooter";
  var SUPPORT_WA = "https://wa.me/79000000000";
  var SUPPORT_MAIL = "andreyrk2016@gmail.com";

  var INTENTS = [
    [/привет|здрав|hello|\bhi\b|hola|hey/i, "sup_a_hi"],
    [/достав|delivery|ship|env[ií]o|entrega/i, "sup_a_delivery"],
    [/оплат|\bплат|pay|pago/i, "sup_a_payment"],
    [/размер|рост\b|size|talla|medida/i, "sup_a_size"],
    [/цена|цен[ыуе]|стоим|price|precio|cu[aá]nto/i, "sup_a_price"],
    [/куп[ил]|заказ|\bbuy\b|order|comprar|pedido/i, "sup_a_buy"]
  ];

  function supMsg(html, who) {
    var div = document.createElement("div");
    div.className = "sup-msg sup-msg--" + who;
    div.innerHTML = html;
    supportMsgs.appendChild(div);
    supportMsgs.scrollTop = supportMsgs.scrollHeight;
  }

  function openSupport(prefill) {
    supportPanel.hidden = false;
    if (!supGreeted) {
      supGreeted = true;
      supMsg(escapeHtml(t("sup_greet")), "bot");
    }
    if (prefill) supportText.value = prefill;
    supportText.focus();
  }

  supportFab.addEventListener("click", function () {
    if (supportPanel.hidden) openSupport();
    else supportPanel.hidden = true;
  });

  supportClose.addEventListener("click", function () {
    supportPanel.hidden = true;
  });

  // Быстрые вопросы одним нажатием
  document.getElementById("support-chips").addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-msg]");
    if (!btn) return;
    supportText.value = t(btn.dataset.msg);
    supportForm.dispatchEvent(new Event("submit", { cancelable: true }));
  });

  supportForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = supportText.value.trim();
    if (!text) return;
    supportText.value = "";
    supMsg(escapeHtml(text), "user");

    var answerKey = null;
    var isOrder = /хочу заказать|i want to order|quiero pedir/i.test(text);
    if (!isOrder) {
      for (var i = 0; i < INTENTS.length; i++) {
        if (INTENTS[i][0].test(text)) { answerKey = INTENTS[i][1]; break; }
      }
    }

    setTimeout(function () {
      if (answerKey) {
        supMsg(escapeHtml(t(answerKey)), "bot");
        return;
      }
      var enc = encodeURIComponent(text);
      supMsg(
        "<div>" + escapeHtml(t("sup_fallback")) + "</div>" +
        '<div class="sup-actions">' +
        '<a href="' + SUPPORT_TG + '" target="_blank" rel="noopener">' + escapeHtml(t("sup_tg_btn")) + "</a>" +
        '<a href="' + SUPPORT_WA + "?text=" + enc + '" target="_blank" rel="noopener">' + escapeHtml(t("sup_wa_btn")) + "</a>" +
        '<a href="mailto:' + SUPPORT_MAIL + "?subject=PRO%20SCOOTER&body=" + enc + '">' + escapeHtml(t("sup_mail_btn")) + "</a>" +
        "</div>",
        "bot"
      );
    }, 450);
  });

  /* ---------- Корзина ---------- */

  function storeRead(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  function storeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var cartData = storeRead("psshop-cart", []);
  var cartBtn = document.getElementById("cart-btn");
  var cartBadge = document.getElementById("cart-badge");
  var cartModal = document.getElementById("cart-modal");
  var cartItemsEl = document.getElementById("cart-items");
  var cartEmptyEl = document.getElementById("cart-empty");
  var cartTotalRow = document.getElementById("cart-total-row");
  var cartTotalEl = document.getElementById("cart-total");
  var cartCheckoutBtn = document.getElementById("cart-checkout");

  function productByName(name) {
    return products.find(function (p) { return p.name === name; });
  }

  function updateCartBadge() {
    var count = cartData.reduce(function (sum, item) { return sum + item.qty; }, 0);
    cartBadge.textContent = count;
    cartBadge.hidden = count === 0;
  }

  function saveCart() {
    storeWrite("psshop-cart", cartData);
    updateCartBadge();
  }

  function cartAdd(name, color) {
    var existing = cartData.find(function (item) {
      return item.name === name && item.color === (color || null);
    });
    if (existing) existing.qty += 1;
    else cartData.push({ name: name, color: color || null, qty: 1 });
    saveCart();
    bumpCartBadge();
  }

  function cartLineTotal(item) {
    var product = productByName(item.name);
    return product && typeof product.price === "number" ? product.price * item.qty : 0;
  }

  function renderCart() {
    var html = cartData.map(function (item, index) {
      var product = productByName(item.name);
      if (!product) return "";
      var img = product.images.length ? '<img src="' + product.images[0] + '" alt="">' : "";
      return '<div class="cart-row">' + img +
        '<div class="cart-row__info"><strong>' + escapeHtml(trName(product)) + "</strong>" +
        (item.color ? '<span class="cart-row__color">' + escapeHtml(trColor(item.color)) + "</span>" : "") +
        '<span class="cart-row__price">' + escapeHtml(formatPrice(product.price) || "") + "</span></div>" +
        '<div class="cart-row__qty">' +
        '<button type="button" data-act="dec" data-i="' + index + '">−</button>' +
        "<span>" + item.qty + "</span>" +
        '<button type="button" data-act="inc" data-i="' + index + '">+</button>' +
        '<button type="button" class="cart-row__del" data-act="del" data-i="' + index + '">✕</button>' +
        "</div></div>";
    }).join("");
    cartItemsEl.innerHTML = html;
    var hasItems = cartData.length > 0;
    cartEmptyEl.hidden = hasItems;
    cartTotalRow.hidden = !hasItems;
    cartCheckoutBtn.hidden = !hasItems;
    var total = cartData.reduce(function (sum, item) { return sum + cartLineTotal(item); }, 0);
    cartTotalEl.textContent = "$" + total.toLocaleString("en-US");
  }

  cartBtn.addEventListener("click", function () {
    renderCart();
    cartModal.showModal();
  });

  document.getElementById("cart-close").addEventListener("click", function () { cartModal.close(); });

  cartModal.addEventListener("click", function (event) {
    if (event.target === cartModal) cartModal.close();
  });

  cartItemsEl.addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-act]");
    if (!btn) return;
    var index = Number(btn.dataset.i);
    if (btn.dataset.act === "inc") cartData[index].qty += 1;
    if (btn.dataset.act === "dec") {
      cartData[index].qty -= 1;
      if (cartData[index].qty <= 0) cartData.splice(index, 1);
    }
    if (btn.dataset.act === "del") cartData.splice(index, 1);
    saveCart();
    renderCart();
  });

  cartCheckoutBtn.addEventListener("click", function () {
    cartModal.close();
    openCheckout(cartData.map(function (item) {
      return { name: item.name, color: item.color, qty: item.qty };
    }), true);
  });

  updateCartBadge();

  /* ---------- Заказы ---------- */

  function ordersKey() {
    var user = window.AUTH ? AUTH.user : null;
    return user ? "psshop-orders-" + user.email : "psshop-orders-guest";
  }

  function loadOrders() { return storeRead(ordersKey(), []); }

  function ordersCount() { return loadOrders().length; }

  /* ---------- Страница оплаты ---------- */

  var checkoutPage = document.getElementById("checkout-page");
  var checkoutMain = document.getElementById("checkout-main");
  var checkoutSuccess = document.getElementById("checkout-success");
  var checkoutItemsEl = document.getElementById("checkout-items");
  var checkoutTotalEl = document.getElementById("checkout-total");
  var checkoutList = [];
  var checkoutFromCart = false;

  function showCheckoutPage() {
    checkoutPage.hidden = false;
    document.body.style.overflow = "hidden";
    checkoutPage.scrollTop = 0;
    if (location.hash !== "#checkout") {
      try { history.pushState(null, "", "#checkout"); } catch (e) {}
    }
  }

  function hideCheckoutPage() {
    checkoutPage.hidden = true;
    document.body.style.overflow = "";
    if (location.hash === "#checkout") {
      try { history.pushState(null, "", location.pathname + location.search); } catch (e) {}
    }
  }

  window.addEventListener("popstate", function () {
    if (location.hash !== "#checkout" && !checkoutPage.hidden) {
      checkoutPage.hidden = true;
      document.body.style.overflow = "";
    }
  });

  function openCheckout(items, fromCart) {
    checkoutList = items;
    checkoutFromCart = fromCart;
    checkoutMain.hidden = false;
    checkoutSuccess.hidden = true;
    checkoutItemsEl.innerHTML = items.map(function (item) {
      var product = productByName(item.name);
      if (!product) return "";
      var img = product.images.length ? '<img src="' + product.images[0] + '" alt="">' : "";
      return '<div class="checkout-card">' +
        '<div class="checkout-card__photo">' + img + "</div>" +
        '<div class="checkout-card__body">' +
        '<h3>' + escapeHtml(trName(product)) +
        (item.color ? " · " + escapeHtml(trColor(item.color)) : "") +
        (item.qty > 1 ? " × " + item.qty : "") + "</h3>" +
        '<span class="checkout-price">' + escapeHtml(formatPrice(product.price) || t("price_ask")) + "</span>" +
        (trDesc(product) ? '<p class="checkout-card__desc">' + escapeHtml(trDesc(product)) + "</p>" : "") +
        "</div></div>";
    }).join("");
    var total = items.reduce(function (sum, item) {
      var product = productByName(item.name);
      return sum + (product && typeof product.price === "number" ? product.price * item.qty : 0);
    }, 0);
    checkoutTotalEl.textContent = "$" + total.toLocaleString("en-US");
    prefillShip();
    shipError.hidden = true;
    if (modal.open) modal.close();
    showCheckoutPage();
  }

  var shipName = document.getElementById("ship-name");
  var shipContact = document.getElementById("ship-contact");
  var shipAddress = document.getElementById("ship-address");
  var shipError = document.getElementById("ship-error");

  function prefillShip() {
    var saved = storeRead("psshop-ship", null);
    if (!saved) return;
    if (!shipName.value) shipName.value = saved.name || "";
    if (!shipContact.value) shipContact.value = saved.contact || "";
    if (!shipAddress.value) shipAddress.value = saved.address || "";
  }

  /* Точный адрес: есть слова (город/улица) и есть номер дома или квартиры */
  function addressLooksFull(addr) {
    if (addr.length < 8) return false;
    if (!/\d/.test(addr)) return false;                 // нет номера дома/квартиры
    if (!/[a-zа-яё]{3,}/i.test(addr)) return false;     // нет названия улицы или города
    return addr.split(/[\s,./-]+/).filter(Boolean).length >= 2;
  }

  // Пока пользователь исправляет поле — убираем подсветку ошибки
  [shipName, shipContact, shipAddress].forEach(function (input) {
    input.addEventListener("input", function () {
      input.classList.remove("is-invalid");
      shipError.hidden = true;
    });
  });

  checkoutMain.addEventListener("click", function (event) {
    if (!event.target.closest(".pay-option")) return;
    var ship = {
      name: shipName.value.trim(),
      contact: shipContact.value.trim(),
      address: shipAddress.value.trim()
    };
    var missing = !ship.name || !ship.contact;
    var badAddress = !addressLooksFull(ship.address);
    if (missing || badAddress) {
      shipError.textContent = t(missing ? "ship_err" : "ship_err_addr");
      shipError.hidden = false;
      shipName.classList.toggle("is-invalid", !ship.name);
      shipContact.classList.toggle("is-invalid", !ship.contact);
      shipAddress.classList.toggle("is-invalid", badAddress);
      document.querySelector(".checkout-ship").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    shipError.hidden = true;
    shipName.classList.remove("is-invalid");
    shipContact.classList.remove("is-invalid");
    shipAddress.classList.remove("is-invalid");
    storeWrite("psshop-ship", ship); // запомним для следующего заказа
    // Тестовый режим: оплата проходит бесплатно, заказ сохраняется.
    var orders = loadOrders();
    var total = 0;
    var orderItems = checkoutList.map(function (item) {
      var product = productByName(item.name);
      var price = product && typeof product.price === "number" ? product.price : 0;
      total += price * item.qty;
      return { name: item.name, color: item.color, qty: item.qty, price: price };
    });
    orders.push({ num: orders.length + 1, items: orderItems, total: total, ts: Date.now(), ship: ship });
    storeWrite(ordersKey(), orders);
    if (checkoutFromCart) {
      cartData = [];
      saveCart();
    }
    if (typeof renderAuthState === "function") renderAuthState();
    checkoutMain.hidden = true;
    checkoutSuccess.hidden = false;
  });

  document.getElementById("checkout-close").addEventListener("click", hideCheckoutPage);

  document.getElementById("checkout-orders").addEventListener("click", function () {
    showOrdersPage();
  });

  document.getElementById("checkout-support").addEventListener("click", function () {
    var prefill = t("pay_order_prefix") + checkoutList.map(function (item) {
      return trName(productByName(item.name) || { name: item.name }) +
        (item.color ? " (" + trColor(item.color) + ")" : "") + " ×" + item.qty;
    }).join(", ");
    var ship = storeRead("psshop-ship", null);
    if (ship && ship.name) {
      prefill += " (" + ship.name + ", " + ship.contact + (ship.address ? ", " + ship.address : "") + ")";
    }
    prefill += " — ";
    hideCheckoutPage();
    openSupport(prefill);
  });

  modalBuy.addEventListener("click", function (event) {
    event.preventDefault();
    if (modalState.product) {
      openCheckout([{ name: modalState.product.name, color: modalState.color, qty: 1 }], false);
    }
  });

  document.getElementById("modal-fav").addEventListener("click", function () {
    if (!modalState.product) return;
    var nowFav = AUTH.toggleFav(modalState.product.name);
    toast(nowFav ? "♥" : "♡", nowFav ? "toast_fav_on" : "toast_fav_off");
    updateModalFav(modalState.product);
    renderChips();
    renderGrid();
    if (typeof renderAuthState === "function") renderAuthState();
  });

  document.getElementById("modal-cart").addEventListener("click", function () {
    if (!modalState.product) return;
    cartAdd(modalState.product.name, modalState.color);
    toast("🛒", "toast_cart");
    var btn = document.getElementById("modal-cart");
    btn.textContent = "✓";
    setTimeout(function () { btn.textContent = t("add_cart"); }, 800);
  });

  /* Ссылка на товар: #p<id> открывает карточку, кнопка копирует адрес */

  document.getElementById("modal-share").addEventListener("click", function () {
    if (!modalState.product) return;
    var url = location.origin + location.pathname + "#p" + modalState.product.id;
    function done() { toast("🔗", "toast_link"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () { fallbackCopy(url); done(); });
    } else {
      fallbackCopy(url);
      done();
    }
  });

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(area);
  }

  var hashMatch = location.hash.match(/^#p(\d+)$/);
  if (hashMatch) {
    var sharedProduct = products.find(function (p) { return p.id === Number(hashMatch[1]); });
    if (sharedProduct) {
      setTimeout(function () { openModal(sharedProduct.id); }, 300);
    }
  }

  modalSupport.addEventListener("click", function () {
    var product = modalState.product;
    var prefill = product
      ? t("sup_product_prefix") + trName(product) +
        (modalState.color ? " (" + trColor(modalState.color) + ")" : "") + " — "
      : "";
    modal.close();
    openSupport(prefill);
  });

  /* ---------- Профиль и «Мои товары» ---------- */

  var authModal = document.getElementById("auth-modal");
  var authForms = document.getElementById("auth-forms");
  var authProfile = document.getElementById("auth-profile");
  var authCode = document.getElementById("auth-code");
  var loginForm = document.getElementById("login-form");
  var registerForm = document.getElementById("register-form");
  var codeForm = document.getElementById("code-form");
  var authError = document.getElementById("auth-error");
  var regError = document.getElementById("reg-error");
  var codeError = document.getElementById("code-error");
  var authGoogleBtn = document.getElementById("auth-google");
  var tabLogin = document.getElementById("tab-login");
  var tabRegister = document.getElementById("tab-register");
  var profileBtn = document.getElementById("profile-btn");
  var profileIcon = document.getElementById("profile-icon");
  var profileHello = document.getElementById("profile-hello");
  var favsCountEl = document.getElementById("favs-count");
  var authLocalNote = document.getElementById("auth-local-note");
  var codeResendBtn = document.getElementById("code-resend");
  var codeTestNote = document.getElementById("code-test-note");

  var ordersCountEl = document.getElementById("orders-count");
  var profileLabel = document.getElementById("profile-label");
  var profileAvatar = document.getElementById("profile-avatar");
  var profileAvatarInner = document.getElementById("profile-avatar-inner");
  var profileEmail = document.getElementById("profile-email");
  var avatarPicker = document.getElementById("avatar-picker");

  /* ---------- Аватар: буква по умолчанию, можно выбрать эмодзи или фото ---------- */

  var AVATAR_EMOJIS = ["🛴", "🔥", "😎", "🤙", "⚡", "💀", "🐺", "👽", "🎯", "🚀"];

  function avatarKey() {
    var user = window.AUTH ? AUTH.user : null;
    return user ? "psshop-avatar-" + user.email : null;
  }

  function loadAvatarData() {
    var key = avatarKey();
    return key ? storeRead(key, null) : null;
  }

  function saveAvatarData(data) {
    var key = avatarKey();
    if (!key) return;
    if (data) storeWrite(key, data);
    else { try { localStorage.removeItem(key); } catch (e) {} }
  }

  function avatarInnerHtml(user) {
    var data = loadAvatarData();
    if (data && data.type === "img") return '<img src="' + data.value + '" alt="">';
    if (data && data.type === "emoji") return '<span class="auth-avatar__emoji">' + data.value + "</span>";
    return escapeHtml((user.name || user.email || "?").charAt(0).toUpperCase());
  }

  function renderAuthState() {
    var user = window.AUTH ? AUTH.user : null;
    profileBtn.classList.toggle("is-logged", !!user);
    profileIcon.innerHTML = user ? avatarInnerHtml(user) : "👤";
    profileLabel.textContent = user ? (user.name || user.email).split("@")[0].slice(0, 12) : t("auth_login");
    // Если гость сейчас вводит код из письма — не сбрасываем эту панель
    var keepCode = !user && !authCode.hidden;
    authForms.hidden = !!user || keepCode;
    authProfile.hidden = !user;
    authCode.hidden = !keepCode;
    avatarPicker.hidden = true;
    if (user) {
      profileHello.textContent = t("auth_hello") + ", " + (user.name || user.email).split("@")[0] + "!";
      profileAvatarInner.innerHTML = avatarInnerHtml(user);
      profileEmail.textContent = user.email || "";
    }
    favsCountEl.textContent = window.AUTH ? AUTH.favs().length : 0;
    ordersCountEl.textContent = ordersCount();
    authLocalNote.hidden = !(window.AUTH && AUTH.mode === "local");
    if (typeof resetLogoutBtn === "function") resetLogoutBtn();
  }

  document.getElementById("avatar-emojis").innerHTML = AVATAR_EMOJIS.map(function (emoji) {
    return '<button type="button" data-emoji="' + emoji + '">' + emoji + "</button>";
  }).join("");

  profileAvatar.addEventListener("click", function () {
    avatarPicker.hidden = !avatarPicker.hidden;
  });

  document.getElementById("avatar-emojis").addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-emoji]");
    if (!btn) return;
    saveAvatarData({ type: "emoji", value: btn.dataset.emoji });
    avatarPicker.hidden = true;
    renderAuthState();
    toast(btn.dataset.emoji, "toast_ava");
  });

  document.getElementById("avatar-upload").addEventListener("click", function () {
    document.getElementById("avatar-file").click();
  });

  document.getElementById("avatar-reset").addEventListener("click", function () {
    saveAvatarData(null);
    avatarPicker.hidden = true;
    renderAuthState();
  });

  // Фото ужимаем до квадрата 128×128, чтобы поместилось в хранилище браузера
  document.getElementById("avatar-file").addEventListener("change", function () {
    var file = this.files && this.files[0];
    this.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var size = 128;
        var canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        var side = Math.min(img.width, img.height);
        canvas.getContext("2d").drawImage(
          img,
          (img.width - side) / 2, (img.height - side) / 2, side, side,
          0, 0, size, size
        );
        saveAvatarData({ type: "img", value: canvas.toDataURL("image/jpeg", 0.85) });
        avatarPicker.hidden = true;
        renderAuthState();
        toast("🖼", "toast_ava");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  var DATE_LOCALES = { ru: "ru-RU", en: "en-US", es: "es-ES" };

  function orderDate(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString(DATE_LOCALES[lang] || "ru-RU", {
        day: "numeric", month: "long", year: "numeric"
      });
    } catch (e) { return ""; }
  }

  /* ---------- Страница «Мои товары» ---------- */

  var ordersPage = document.getElementById("orders-page");
  var ordersPageList = document.getElementById("orders-page-list");
  var ordersPageEmpty = document.getElementById("orders-page-empty");

  function orderItemRowHtml(item) {
    var product = productByName(item.name);
    var img = product && product.images.length
      ? '<img src="' + product.images[0] + '" alt="" loading="lazy">'
      : '<span class="order-item__noimg">🛴</span>';
    var name = product ? trName(product) : item.name;
    var lineTotal = item.price ? "$" + (item.price * item.qty).toLocaleString("en-US") : "";
    return '<div class="order-item">' +
      '<span class="order-item__photo">' + img + "</span>" +
      '<span class="order-item__name">' + escapeHtml(name) +
      (item.color ? ' <em class="order-item__color">' + escapeHtml(trColor(item.color)) + "</em>" : "") +
      "</span>" +
      '<span class="order-item__qty">×' + item.qty + "</span>" +
      '<span class="order-item__price">' + lineTotal + "</span>" +
      "</div>";
  }

  function renderOrdersPage() {
    var orders = loadOrders();
    ordersPageList.innerHTML = orders.slice().reverse().map(function (order) {
      var dateStr = orderDate(order.ts);
      var shipStr = order.ship && order.ship.name
        ? order.ship.name + " · " + order.ship.contact + (order.ship.address ? " · " + order.ship.address : "")
        : "";
      return '<article class="order-card">' +
        '<header class="order-card__head">' +
        "<div><strong>" + escapeHtml(t("order_label")) + " №" + order.num + "</strong>" +
        (dateStr ? '<span class="order-card__date">' + escapeHtml(dateStr) + "</span>" : "") + "</div>" +
        '<span class="order-card__status">' + escapeHtml(t("order_status")) + "</span>" +
        "</header>" +
        '<div class="order-card__items">' + order.items.map(orderItemRowHtml).join("") + "</div>" +
        '<footer class="order-card__foot">' +
        (shipStr ? '<span class="order-card__ship">📦 ' + escapeHtml(shipStr) + "</span>" : "<span></span>") +
        '<span class="order-card__total">' + escapeHtml(t("cart_total")) + ' <strong class="checkout-price">$' +
        order.total.toLocaleString("en-US") + "</strong></span>" +
        "</footer></article>";
    }).join("");
    ordersPageEmpty.hidden = orders.length > 0;
  }

  function showOrdersPage() {
    if (authModal.open) authModal.close();
    hideCheckoutPage();
    renderOrdersPage();
    ordersPage.hidden = false;
    document.body.style.overflow = "hidden";
    ordersPage.scrollTop = 0;
    if (location.hash !== "#orders") {
      try { history.pushState(null, "", "#orders"); } catch (e) {}
    }
  }

  function hideOrdersPage() {
    ordersPage.hidden = true;
    document.body.style.overflow = "";
    if (location.hash === "#orders") {
      try { history.pushState(null, "", location.pathname + location.search); } catch (e) {}
    }
  }

  window.addEventListener("popstate", function () {
    if (location.hash !== "#orders" && !ordersPage.hidden) {
      ordersPage.hidden = true;
      document.body.style.overflow = "";
    }
  });

  document.getElementById("orders-close").addEventListener("click", hideOrdersPage);

  document.getElementById("orders-to-catalog").addEventListener("click", function () {
    hideOrdersPage();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
  });

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function errKey(error) {
    var message = (error && error.message) || "";
    if (message === "exists" || /email-already/.test(message)) return "auth_err_exists";
    if (/weak-password/.test(message)) return "auth_err_weak";
    if (/bad-email|invalid-email/.test(message)) return "auth_err_email";
    if (/pass-match/.test(message)) return "auth_err_pass_match";
    if (/bad-code/.test(message)) return "code_err";
    return "auth_err_creds";
  }

  function showErr(el, error) {
    el.textContent = t(errKey(error));
    el.hidden = false;
  }

  function authFail(error) { showErr(authError, error); }

  function authSuccess() {
    authError.hidden = true;
    regError.hidden = true;
    codeError.hidden = true;
    loginForm.reset();
    registerForm.reset();
    codeForm.reset();
    stopResendTimer();
    authCode.hidden = true;
    setAuthTab(false);
    renderAuthState();
    renderChips();
    renderGrid();
  }

  profileBtn.addEventListener("click", function () {
    renderAuthState();
    authError.hidden = true;
    authModal.showModal();
  });

  document.getElementById("auth-close").addEventListener("click", function () {
    authModal.close();
  });

  authModal.addEventListener("click", function (event) {
    if (event.target === authModal) authModal.close();
  });

  function setAuthTab(register) {
    tabLogin.classList.toggle("is-active", !register);
    tabRegister.classList.toggle("is-active", register);
    loginForm.hidden = register;
    registerForm.hidden = !register;
    authError.hidden = true;
    regError.hidden = true;
  }

  tabLogin.addEventListener("click", function () { setAuthTab(false); });
  tabRegister.addEventListener("click", function () { setAuthTab(true); });

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    AUTH.login(document.getElementById("login-email").value.trim(),
      document.getElementById("login-pass").value).then(authSuccess).catch(authFail);
  });

  /* Регистрация с кодом подтверждения */

  var resendInterval = null;
  var resendLeft = 0;

  function stopResendTimer() {
    clearInterval(resendInterval);
    resendInterval = null;
  }

  function startResendTimer() {
    resendLeft = 120;
    codeResendBtn.disabled = true;
    stopResendTimer();
    function tick() {
      if (resendLeft <= 0) {
        stopResendTimer();
        codeResendBtn.disabled = false;
        codeResendBtn.textContent = t("code_resend");
        return;
      }
      var m = Math.floor(resendLeft / 60);
      var s = ("0" + (resendLeft % 60)).slice(-2);
      codeResendBtn.textContent = t("code_resend") + " (" + m + ":" + s + ")";
      resendLeft -= 1;
    }
    tick();
    resendInterval = setInterval(tick, 1000);
  }

  function showCodePane(email, result) {
    authForms.hidden = true;
    authCode.hidden = false;
    document.getElementById("code-email").textContent = email;
    codeError.hidden = true;
    if (result && result.testCode) {
      codeTestNote.textContent = t("code_test_note") + result.testCode;
      codeTestNote.hidden = false;
    } else {
      codeTestNote.hidden = true;
    }
    startResendTimer();
    document.getElementById("code-input").focus();
  }

  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var nick = document.getElementById("reg-name").value.trim();
    var email = document.getElementById("reg-email").value.trim();
    var pass = document.getElementById("reg-pass").value;
    var pass2 = document.getElementById("reg-pass2").value;
    if (!nick || !email) return;
    if (!EMAIL_RE.test(email)) { showErr(regError, { message: "bad-email" }); return; }
    if (pass.length < 6) { showErr(regError, { message: "weak-password" }); return; }
    if (pass !== pass2) { showErr(regError, { message: "pass-match" }); return; }
    AUTH.startRegister(email, pass, nick).then(function (result) {
      if (result && result.mode === "firebase-link") { authSuccess(); return; }
      showCodePane(email, result);
    }).catch(function (error) { showErr(regError, error); });
  });

  codeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    AUTH.confirmCode(document.getElementById("code-input").value)
      .then(authSuccess)
      .catch(function (error) { showErr(codeError, error); });
  });

  document.getElementById("code-back").addEventListener("click", function () {
    stopResendTimer();
    authCode.hidden = true;
    renderAuthState();
  });

  codeResendBtn.addEventListener("click", function () {
    AUTH.resendCode().then(function (result) {
      if (result && result.testCode) {
        codeTestNote.textContent = t("code_test_note") + result.testCode;
        codeTestNote.hidden = false;
      }
      startResendTimer();
    }).catch(function () {});
  });

  authGoogleBtn.addEventListener("click", function () {
    AUTH.loginGoogle().then(authSuccess).catch(function (error) {
      if (error && error.message === "needs-firebase") {
        authError.textContent = t("auth_err_google");
        authError.hidden = false;
      } else {
        authFail(error);
      }
    });
  });

  var logoutBtn = document.getElementById("profile-logout");
  var logoutArmed = false;
  var logoutTimer = null;

  function resetLogoutBtn() {
    logoutArmed = false;
    clearTimeout(logoutTimer);
    logoutBtn.textContent = t("auth_logout");
    logoutBtn.classList.remove("btn--danger");
  }

  logoutBtn.addEventListener("click", function () {
    if (!logoutArmed) {
      // Первое нажатие — предупреждение, второе — выход
      logoutArmed = true;
      logoutBtn.textContent = t("auth_logout_confirm");
      logoutBtn.classList.add("btn--danger");
      logoutTimer = setTimeout(resetLogoutBtn, 4000);
      return;
    }
    resetLogoutBtn();
    AUTH.logout().then(function () {
      if (state.category === "__fav") state.category = "all";
      setAuthTab(false);
      renderAuthState();
      renderChips();
      renderGrid();
    });
  });

  document.getElementById("profile-orders").addEventListener("click", showOrdersPage);

  document.getElementById("nav-orders").addEventListener("click", function (event) {
    event.preventDefault();
    showOrdersPage();
  });

  document.getElementById("profile-favs").addEventListener("click", function () {
    authModal.close();
    state.category = "__fav";
    renderChips();
    renderGrid();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
  });

  if (window.AUTH) {
    AUTH.onChange(function () {
      // Заказы, сделанные до входа, переносим в аккаунт
      if (AUTH.user) {
        var guestOrders = storeRead("psshop-orders-guest", []);
        if (guestOrders.length) {
          var userOrders = loadOrders();
          guestOrders.forEach(function (order) {
            order.num = userOrders.length + 1;
            userOrders.push(order);
          });
          storeWrite(ordersKey(), userOrders);
          storeWrite("psshop-orders-guest", []);
        }
      }
      renderAuthState();
      renderChips();
      renderGrid();
    });
    AUTH.ready.then(function () {
      renderAuthState();
      renderChips();
      renderGrid();
    });
  }

  /* ---------- Эффекты ---------- */

  var motionOk = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  var revealObserver = null;
  if (motionOk && "IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
  }

  function observeReveals() {
    if (!revealObserver) return;
    document.querySelectorAll(".card, .how__step, .contact-card, .perk, .faq__item").forEach(function (el, i) {
      if (el.classList.contains("reveal")) return;
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 4) * 60 + "ms";
      revealObserver.observe(el);
    });
  }

  // Счётчики в хиро
  document.querySelectorAll(".stat__num").forEach(function (el) {
    var target = parseInt(el.dataset.target, 10) || 0;
    if (!motionOk) { el.textContent = target; return; }
    var start = null;
    function tick(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / 900, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  // Живой глоу в хиро за курсором
  var hero = document.querySelector(".hero");
  var heroBlob = document.querySelector(".hero__blob--1");
  if (motionOk && finePointer && hero && heroBlob) {
    hero.addEventListener("mousemove", function (event) {
      var rect = hero.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      heroBlob.style.transform = "translate(" + (x * 44).toFixed(0) + "px," + (y * 44).toFixed(0) + "px)";
    });
  }

  /* ---------- Старт ---------- */

  renderLangSwitch();
  applyStaticTexts();
  renderChips();
  renderGrid();
  renderViewed();
  observeReveals();

  /* Если фото не загрузилось (битый путь) — показываем заглушку */
  document.addEventListener("error", function (event) {
    var img = event.target;
    if (!img || img.tagName !== "IMG" || img.dataset.fallback) return;
    img.dataset.fallback = "1";
    var box = img.parentNode;
    if (!box) return;
    var span = document.createElement("span");
    span.className = "img-fallback";
    span.textContent = "🛴";
    box.replaceChild(span, img);
  }, true);
})();
