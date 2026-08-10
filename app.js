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
      return price.toLocaleString("ru-RU") + " ₽";
    }
    return String(price);
  }

  function pluralize(count) {
    var mod10 = count % 10;
    var mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "товар";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "товара";
    return "товаров";
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
    var html = '<button class="chip is-active" data-category="all">Все</button>';
    categories.forEach(function (category) {
      html += '<button class="chip" data-category="' + escapeHtml(category) + '">' +
        escapeHtml(category) + "</button>";
    });
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
      var matchesCategory = state.category === "all" || product.category === state.category;
      var matchesQuery = !state.query ||
        product.name.toLowerCase().indexOf(state.query) !== -1 ||
        (product.description || "").toLowerCase().indexOf(state.query) !== -1;
      return matchesCategory && matchesQuery;
    });
  }

  function cardHtml(product) {
    var photo = product.images.length
      ? '<img src="' + product.images[0] + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
      : '<span class="card__photo--empty" style="height:100%">🛴</span>';

    var price = formatPrice(product.price);
    var priceHtml = price
      ? '<span class="card__price">' + escapeHtml(price) + "</span>"
      : '<span class="card__price--empty">Цена по запросу</span>';

    var buyHtml = product.link
      ? '<a class="card__buy" href="' + escapeHtml(product.link) + '" target="_blank" rel="noopener">Купить</a>'
      : "";

    return (
      '<article class="card" data-id="' + product.id + '" tabindex="0" role="button" ' +
      'aria-label="' + escapeHtml(product.name) + '">' +
      '<div class="card__photo">' + photo + "</div>" +
      '<div class="card__body">' +
      '<span class="card__tag">' + escapeHtml(product.category) + "</span>" +
      '<h3 class="card__name">' + escapeHtml(product.name) + "</h3>" +
      '<div class="card__bottom">' + priceHtml + buyHtml + "</div>" +
      "</div></article>"
    );
  }

  function renderGrid() {
    var visible = getVisibleProducts();
    grid.innerHTML = visible.map(cardHtml).join("");
    emptyEl.hidden = visible.length > 0;
    countEl.textContent = visible.length + " " + pluralize(visible.length);
  }

  grid.addEventListener("click", function (event) {
    if (event.target.closest("a")) return; // кнопка «Купить» работает сама
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

  function openModal(id) {
    var product = products.find(function (item) { return item.id === id; });
    if (!product) return;
    modalState.product = product;
    modalState.index = 0;

    modalTag.textContent = product.category;
    modalName.textContent = product.name;
    modalPrice.textContent = formatPrice(product.price);
    modalDesc.textContent = product.description || "";

    if (product.link) {
      modalBuy.hidden = false;
      modalBuy.href = product.link;
    } else {
      modalBuy.hidden = true;
      modalBuy.removeAttribute("href");
    }

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
    modalImg.alt = product.name;
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

  /* ---------- Старт ---------- */

  renderChips();
  renderGrid();
})();
