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

  var state = { category: "all", query: "" };
  var modalState = { product: null, index: 0 };

  document.getElementById("year").textContent = new Date().getFullYear();
  if (DATA.demo) demoNote.hidden = false;

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
    if (typeof renderAuthState === "function") renderAuthState();
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
    var visible = getVisibleProducts();
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

  function fillModalTexts(product) {
    modalTag.textContent = trCategory(product.category);
    modalName.textContent = trName(product);
    modalPrice.textContent = formatPrice(product.price);
    modalDesc.textContent = trDesc(product);
    modalBuy.textContent = t("buy_more") || "Купить / Подробнее";
  }

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
    modal.showModal();
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

  function showImage(index) {
    var product = modalState.product;
    if (!product) return;
    var total = product.images.length;
    if (!total) {
      modalImg.removeAttribute("src");
      return;
    }
    modalState.index = (index + total) % total;
    modalImg.src = product.images[modalState.index];
    modalImg.alt = trName(product);
    modalThumbs.querySelectorAll(".modal__thumb").forEach(function (thumb) {
      thumb.classList.toggle("is-active", Number(thumb.dataset.index) === modalState.index);
    });
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

  modal.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") showImage(modalState.index - 1);
    if (event.key === "ArrowRight") showImage(modalState.index + 1);
  });

  /* Клик по фото — полноэкранный просмотр */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");

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
    if (modal.open) modal.close();
    showCheckoutPage();
  }

  checkoutMain.addEventListener("click", function (event) {
    if (!event.target.closest(".pay-option")) return;
    // Тестовый режим: оплата проходит бесплатно, заказ сохраняется.
    var orders = loadOrders();
    var total = 0;
    var orderItems = checkoutList.map(function (item) {
      var product = productByName(item.name);
      var price = product && typeof product.price === "number" ? product.price : 0;
      total += price * item.qty;
      return { name: item.name, color: item.color, qty: item.qty, price: price };
    });
    orders.push({ num: orders.length + 1, items: orderItems, total: total, ts: Date.now() });
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
    hideCheckoutPage();
    openOrdersPane();
  });

  document.getElementById("checkout-support").addEventListener("click", function () {
    var prefill = t("pay_order_prefix") + checkoutList.map(function (item) {
      return trName(productByName(item.name) || { name: item.name }) +
        (item.color ? " (" + trColor(item.color) + ")" : "") + " ×" + item.qty;
    }).join(", ") + " — ";
    hideCheckoutPage();
    openSupport(prefill);
  });

  modalBuy.addEventListener("click", function (event) {
    event.preventDefault();
    if (modalState.product) {
      openCheckout([{ name: modalState.product.name, color: modalState.color, qty: 1 }], false);
    }
  });

  document.getElementById("modal-cart").addEventListener("click", function () {
    if (!modalState.product) return;
    cartAdd(modalState.product.name, modalState.color);
    var btn = document.getElementById("modal-cart");
    btn.textContent = "✓";
    setTimeout(function () { btn.textContent = t("add_cart"); }, 800);
  });

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
  var authForm = document.getElementById("auth-form");
  var authNameEl = document.getElementById("auth-name");
  var authEmailEl = document.getElementById("auth-email");
  var authPassEl = document.getElementById("auth-pass");
  var authError = document.getElementById("auth-error");
  var authGoogleBtn = document.getElementById("auth-google");
  var authRegisterBtn = document.getElementById("auth-register");
  var profileBtn = document.getElementById("profile-btn");
  var profileIcon = document.getElementById("profile-icon");
  var profileHello = document.getElementById("profile-hello");
  var favsCountEl = document.getElementById("favs-count");
  var authLocalNote = document.getElementById("auth-local-note");

  var authOrders = document.getElementById("auth-orders");
  var ordersListEl = document.getElementById("orders-list");
  var ordersEmptyEl = document.getElementById("orders-empty");
  var ordersCountEl = document.getElementById("orders-count");
  var profileLabel = document.getElementById("profile-label");

  function renderAuthState() {
    var user = window.AUTH ? AUTH.user : null;
    profileBtn.classList.toggle("is-logged", !!user);
    profileIcon.textContent = user ? (user.name || user.email || "?").charAt(0).toUpperCase() : "👤";
    profileLabel.textContent = user ? (user.name || user.email).split("@")[0].slice(0, 12) : t("auth_login");
    authForms.hidden = !!user;
    authProfile.hidden = !user;
    authOrders.hidden = true;
    if (user) {
      profileHello.textContent = t("auth_hello") + ", " + (user.name || user.email) + "!";
    }
    favsCountEl.textContent = window.AUTH ? AUTH.favs().length : 0;
    ordersCountEl.textContent = ordersCount();
    authLocalNote.hidden = !(window.AUTH && AUTH.mode === "local");
    if (typeof resetLogoutBtn === "function") resetLogoutBtn();
  }

  function renderOrders() {
    var orders = loadOrders();
    ordersListEl.innerHTML = orders.slice().reverse().map(function (order) {
      var lines = order.items.map(function (item) {
        var product = productByName(item.name);
        return (product ? trName(product) : item.name) +
          (item.color ? " (" + trColor(item.color) + ")" : "") + " ×" + item.qty;
      }).join(", ");
      return '<div class="order-row">' +
        '<div class="order-row__head"><strong>' + escapeHtml(t("order_label")) + " №" + order.num +
        '</strong><span class="checkout-price">$' + order.total.toLocaleString("en-US") + "</span></div>" +
        '<div class="order-row__items">' + escapeHtml(lines) + "</div>" +
        '<div class="order-row__status">' + escapeHtml(t("order_status")) + "</div></div>";
    }).join("");
    ordersEmptyEl.hidden = orders.length > 0;
  }

  function openOrdersPane() {
    renderOrders();
    authForms.hidden = true;
    authProfile.hidden = true;
    authOrders.hidden = false;
    if (!authModal.open) authModal.showModal();
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function authFail(error) {
    var message = (error && error.message) || "";
    var key = "auth_err_creds";
    if (message === "exists" || /email-already/.test(message)) key = "auth_err_exists";
    else if (/weak-password/.test(message)) key = "auth_err_weak";
    else if (/bad-email|invalid-email/.test(message)) key = "auth_err_email";
    authError.textContent = t(key);
    authError.hidden = false;
  }

  function authSuccess() {
    authError.hidden = true;
    authForm.reset();
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

  authForm.addEventListener("submit", function (event) {
    event.preventDefault();
    AUTH.login(authEmailEl.value.trim(), authPassEl.value).then(authSuccess).catch(authFail);
  });

  authRegisterBtn.addEventListener("click", function () {
    var email = authEmailEl.value.trim();
    if (!email || !authPassEl.value) return;
    if (!EMAIL_RE.test(email)) { authFail({ message: "bad-email" }); return; }
    if (authPassEl.value.length < 6) { authFail({ message: "weak-password" }); return; }
    AUTH.register(email, authPassEl.value, authNameEl.value.trim())
      .then(authSuccess).catch(authFail);
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
      renderAuthState();
      renderChips();
      renderGrid();
    });
  });

  document.getElementById("profile-orders").addEventListener("click", openOrdersPane);

  document.getElementById("orders-back").addEventListener("click", function () {
    renderAuthState();
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
    document.querySelectorAll(".card, .how__step, .contact-card").forEach(function (el, i) {
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
  observeReveals();
})();
