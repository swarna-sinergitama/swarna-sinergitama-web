/* =========================
   DOM Elements
========================= */
const modal = document.getElementById("productModal");
const modalImg = document.getElementById("modalImg");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalDesc = document.getElementById("modalDesc");
const specTableBody = document.getElementById("specTableBody");
const modalTags = document.getElementById("modalTags");
const inaprocBtn = document.getElementById("inaprocBtn");

// --- Gallery (slider) elements ---
const galleryPrev = document.getElementById("galleryPrev");
const galleryNext = document.getElementById("galleryNext");
const modalThumbs = document.getElementById("modalThumbs");

const grid = document.getElementById("catalogGrid");

// Pagination elements (optional — kalau belum ada di HTML, script tetap jalan)
const prevBtn = document.getElementById("prevPageBtn");
const nextBtn = document.getElementById("nextPageBtn");
const pageNumbersEl = document.getElementById("pageNumbers");
const pageInfoEl = document.getElementById("pageInfo");

// Filter elements (optional)
const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");
const filterOrigin = document.getElementById("filterOrigin");
const filterBrand = document.getElementById("filterBrand");
const filterBadge = document.getElementById("filterBadge");
const sortSelect = document.getElementById("sortSelect");
const clearFiltersBtn = document.getElementById("clearFilters");

/* =========================
   State
========================= */
let PRODUCTS = [];
let ACTIVE_PRODUCTS = [];

let PAGE_SIZE = 9;
let CURRENT_PAGE = 1;

// Gallery state
let GALLERY = [];
let GIDX = 0;

const PLACEHOLDER_300 = "https://via.placeholder.com/300x200?text=Lab+Equipment";
const PLACEHOLDER_500 = "https://via.placeholder.com/500x400?text=Product+Image";

/* =========================
   Helpers
========================= */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTotalPages() {
  return Math.max(1, Math.ceil((ACTIVE_PRODUCTS.length || 0) / PAGE_SIZE));
}

function clampPage(page) {
  const total = getTotalPages();
  return Math.min(Math.max(1, page), total);
}

function scrollToCatalogTop() {
  if (!grid) return;
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* -----------------------------
   URL page persistence
-------------------------------- */
function readPageFromUrl() {
  try {
    const url = new URL(window.location.href);
    const p = Number(url.searchParams.get("page"));
    return Number.isFinite(p) && p > 0 ? p : 1;
  } catch {
    return 1;
  }
}

function writePageToUrl(page) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(page));
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore
  }
}

/* =========================
   Render Catalog Grid
========================= */
function renderProducts(list) {
  if (!grid) return;

  if (!list || list.length === 0) {
    grid.innerHTML = `<p class="muted">No products found.</p>`;
    return;
  }

  grid.innerHTML = list
    .map((p) => {
      const badgeHtml = p.badge
        ? `<div class="product-badge">${escapeHtml(p.badge)}</div>`
        : "";

      return `
        <article class="product-card" data-id="${escapeHtml(p.id)}">
          ${badgeHtml}
          <img class="product-img"
            src="${escapeHtml(p.img || PLACEHOLDER_300)}"
            alt="${escapeHtml(p.title)}"
            onerror="this.src='${PLACEHOLDER_300}'">
          <h3 class="product-title">${escapeHtml(p.title)}</h3>
          <p class="product-meta">${escapeHtml(p.meta || "")}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <span style="font-weight:700;color:var(--primary-olive)">View Specs</span>
            <span style="font-size:1.2rem;">→</span>
          </div>
        </article>
      `;
    })
    .join("");
}

// Event delegation: 1 listener saja untuk grid
function bindGridClick() {
  if (!grid) return;

  // biar tidak double-bind kalau file ke-load 2x
  if (grid.dataset.boundClick === "1") return;
  grid.dataset.boundClick = "1";

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;
    const id = card.getAttribute("data-id");
    openProductModal(id);
  });
}

/* =========================
   Modal Gallery / Slider
========================= */
function applyModalImage(src) {
  if (!modalImg) return;

  // kalau src kosong, langsung placeholder
  if (!src) {
    modalImg.src = PLACEHOLDER_500;
    return;
  }

  modalImg.onerror = () => {
    modalImg.src = PLACEHOLDER_500;
  };
  modalImg.src = src;
}

function setGalleryIndex(i) {
  if (!GALLERY.length) return;

  GIDX = (i + GALLERY.length) % GALLERY.length;
  applyModalImage(GALLERY[GIDX]);

  if (modalThumbs) {
    [...modalThumbs.children].forEach((el, idx) => {
      el.classList.toggle("active", idx === GIDX);
    });
  }
}

function renderGallery(product) {
  GALLERY =
    Array.isArray(product.imgs) && product.imgs.length
      ? product.imgs
      : (product.img ? [product.img] : []);

  GIDX = 0;

  // set gambar awal
  applyModalImage(GALLERY[0] || "");

  const multi = GALLERY.length > 1;

  // show/hide tombol
  if (galleryPrev) galleryPrev.style.display = multi ? "flex" : "none";
  if (galleryNext) galleryNext.style.display = multi ? "flex" : "none";

  // thumbnails
  if (modalThumbs) {
    modalThumbs.innerHTML = "";

    if (multi) {
      GALLERY.forEach((src, idx) => {
        const t = document.createElement("img");
        t.src = src;
        t.alt = `${product.title || "Product"} image ${idx + 1}`;
        if (idx === 0) t.classList.add("active");
        t.addEventListener("click", () => setGalleryIndex(idx));
        modalThumbs.appendChild(t);
      });
    }
  }
}

// bind tombol slider sekali saja
if (galleryPrev && galleryPrev.dataset.bound !== "1") {
  galleryPrev.dataset.bound = "1";
  galleryPrev.addEventListener("click", () => setGalleryIndex(GIDX - 1));
}
if (galleryNext && galleryNext.dataset.bound !== "1") {
  galleryNext.dataset.bound = "1";
  galleryNext.addEventListener("click", () => setGalleryIndex(GIDX + 1));
}

/* =========================
   Open / Close Modal
========================= */
function openProductModal(productId) {
  const p = PRODUCTS.find((x) => x.id === productId);
  if (!p) return;

  renderGallery(p);

  if (modalTitle) modalTitle.textContent = p.title || "";

  const metaParts = [];
  if (p.kbki) metaParts.push(`KBKI: ${p.kbki}`);
  if (p.warranty) metaParts.push(`Warranty: ${p.warranty}`);
  if (modalMeta) modalMeta.textContent = metaParts.join(" | ");

  if (modalDesc) modalDesc.textContent = p.desc || "";

  // tags
  if (modalTags) {
    modalTags.innerHTML = "";
    (p.tags || []).forEach((t, idx) => {
      const bg = idx === 0 ? "var(--primary-olive)" : "#333";
      const span = document.createElement("span");
      span.textContent = t;
      span.style.cssText =
        `background:${bg};color:#fff;padding:5px 10px;font-size:.8rem;margin-right:8px;display:inline-block;border-radius:999px;`;
      modalTags.appendChild(span);
    });
  }

  // specs table
  if (specTableBody) {
    specTableBody.innerHTML = "";
    const specs = p.specs || {};
    Object.entries(specs).forEach(([k, v]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="spec-key">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td>`;
      specTableBody.appendChild(tr);
    });
  }

  // inaproc button
  if (inaprocBtn) {
    if (p.inaproc) {
      inaprocBtn.href = p.inaproc;
      inaprocBtn.style.display = "block";
    } else {
      inaprocBtn.style.display = "none";
    }
  }

  if (modal) modal.style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "auto";

  // reset gallery
  GALLERY = [];
  GIDX = 0;
  if (modalThumbs) modalThumbs.innerHTML = "";
}

// klik backdrop untuk close
window.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ESC untuk close
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal && modal.style.display === "block") {
    closeModal();
  }
});

window.closeModal = closeModal;

/* =========================
   Pagination
========================= */
function buildPageButtons(total, current) {
  const buttons = [];

  const addBtn = (p) => buttons.push({ type: "page", page: p, active: p === current });
  const addEllipsis = () => buttons.push({ type: "ellipsis" });

  if (total <= 7) {
    for (let p = 1; p <= total; p++) addBtn(p);
    return buttons;
  }

  addBtn(1);

  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) addEllipsis();
  for (let p = left; p <= right; p++) addBtn(p);
  if (right < total - 1) addEllipsis();

  addBtn(total);
  return buttons;
}

function renderPagination() {
  const total = getTotalPages();
  const current = CURRENT_PAGE;

  if (prevBtn) prevBtn.disabled = current <= 1;
  if (nextBtn) nextBtn.disabled = current >= total;

  if (pageInfoEl) pageInfoEl.textContent = `Page ${current} of ${total}`;

  if (!pageNumbersEl) return;

  const model = buildPageButtons(total, current);

  pageNumbersEl.innerHTML = model
    .map((b) => {
      if (b.type === "ellipsis") {
        return `<span class="page-ellipsis" aria-hidden="true" style="padding:0 8px;">…</span>`;
      }
      const aria = b.active ? `aria-current="page"` : "";
      const cls = b.active ? `class="page-num is-active"` : `class="page-num"`;
      return `<button type="button" ${cls} data-page="${b.page}" ${aria}>${b.page}</button>`;
    })
    .join("");

  pageNumbersEl.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = Number(btn.getAttribute("data-page"));
      if (!Number.isFinite(p)) return;
      goToPage(p, true);
    });
  });
}

function renderPage() {
  CURRENT_PAGE = clampPage(CURRENT_PAGE);

  const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = ACTIVE_PRODUCTS.slice(start, end);

  renderProducts(pageItems);
  renderPagination();

  if (prevBtn) prevBtn.disabled = CURRENT_PAGE <= 1;
  if (nextBtn) nextBtn.disabled = CURRENT_PAGE >= getTotalPages();
}

function goToPage(page, doScroll = false) {
  CURRENT_PAGE = clampPage(page);
  writePageToUrl(CURRENT_PAGE);
  renderPage();
  if (doScroll) scrollToCatalogTop();
}

function bindPaginationButtons() {
  if (prevBtn && prevBtn.dataset.bound !== "1") {
    prevBtn.dataset.bound = "1";
    prevBtn.addEventListener("click", () => goToPage(CURRENT_PAGE - 1, true));
  }
  if (nextBtn && nextBtn.dataset.bound !== "1") {
    nextBtn.dataset.bound = "1";
    nextBtn.addEventListener("click", () => goToPage(CURRENT_PAGE + 1, true));
  }
}

/* =========================
   Partners
========================= */
async function renderPartners() {
  const el = document.getElementById("partnersRow");
  if (!el) return;

  try {
    const res = await fetch("../assets/data/partners.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load partners.json");
    const partners = await res.json();

    el.innerHTML = partners
      .map(
        (p) => `
        <a class="partner-logo" href="${escapeHtml(p.url || "#")}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(p.name)}">
          <img src="${escapeHtml(p.logo)}" alt="${escapeHtml(p.name)}">
        </a>
      `
      )
      .join("");
  } catch (err) {
    console.error("Partners load error:", err);
  }
}

/* =========================
   Filters
========================= */
function getBrand(p) {
  if (p.brand) return p.brand;
  const parts = String(p.meta || "").split("|").map((s) => s.trim());
  return parts[1] || "";
}

function getOrigin(p) {
  if (p.origin) return p.origin;
  const t = (p.tags || []).find((x) => /origin/i.test(x));
  if (!t) return "";
  return t.replace(/origin/i, "").trim();
}

function getCategories(p){
  // ✅ gunakan TOPICS dulu (English topic)
  if (Array.isArray(p.topics) && p.topics.length) return p.topics;

  // fallback: categories lama (kalau ada produk yang belum diberi topics)
  if (Array.isArray(p.categories) && p.categories.length) return p.categories;

  // fallback terakhir dari tags seperti sebelumnya
  return (p.tags || []).filter(t => {
    const up = String(t).toUpperCase();
    if (up.includes("ORIGIN")) return false;
    if (["IMPORT","PDN","BEST SELLER","BESTSELLER"].includes(up)) return false;
    return true;
  });
}

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function initFilterOptions() {
  // kalau HTML filter tidak ada, skip semua
  if (!filterCategory && !filterOrigin && !filterBrand) return;

  if (filterCategory) {
    const cats = uniqSorted(PRODUCTS.flatMap((p) => getCategories(p)));
    filterCategory.innerHTML =
      `<option value="">All categories</option>` +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }

  if (filterOrigin) {
    const origins = uniqSorted(PRODUCTS.map((p) => getOrigin(p)));
    filterOrigin.innerHTML =
      `<option value="">All origins</option>` +
      origins.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
  }

  if (filterBrand) {
    const brands = uniqSorted(PRODUCTS.map((p) => getBrand(p)));
    filterBrand.innerHTML =
      `<option value="">All brands</option>` +
      brands.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  }
}

function applyFilters(resetToFirstPage = true) {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const cat = filterCategory?.value || "";
  const origin = filterOrigin?.value || "";
  const brand = filterBrand?.value || "";
  const badge = filterBadge?.value || "";
  const sort = sortSelect?.value || "relevance";

  ACTIVE_PRODUCTS = PRODUCTS.filter((p) => {
    if (badge && String(p.badge || "") !== badge) return false;
    if (brand && getBrand(p) !== brand) return false;
    if (origin && getOrigin(p) !== origin) return false;
    if (cat && !getCategories(p).includes(cat)) return false;

    if (q) {
      const blob = `${p.title || ""} ${p.meta || ""} ${p.desc || ""} ${(p.tags || []).join(" ")} ${p.kbki || ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  if (sort === "title_asc") {
    ACTIVE_PRODUCTS.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  } else if (sort === "title_desc") {
    ACTIVE_PRODUCTS.sort((a, b) => String(b.title || "").localeCompare(String(a.title || "")));
  }

  if (resetToFirstPage) CURRENT_PAGE = 1;

  CURRENT_PAGE = clampPage(CURRENT_PAGE);
  writePageToUrl(CURRENT_PAGE);
  renderPage();
}

function bindFilters() {
  if (!searchInput && !filterCategory && !filterOrigin && !filterBrand && !filterBadge && !sortSelect) return;

  if (searchInput && searchInput.dataset.bound !== "1") {
    searchInput.dataset.bound = "1";
    searchInput.addEventListener("input", () => applyFilters(true));
  }

  [filterCategory, filterOrigin, filterBrand, filterBadge, sortSelect].forEach((el) => {
    if (!el) return;
    if (el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener("change", () => applyFilters(true));
  });

  if (clearFiltersBtn && clearFiltersBtn.dataset.bound !== "1") {
    clearFiltersBtn.dataset.bound = "1";
    clearFiltersBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (filterCategory) filterCategory.value = "";
      if (filterOrigin) filterOrigin.value = "";
      if (filterBrand) filterBrand.value = "";
      if (filterBadge) filterBadge.value = "";
      if (sortSelect) sortSelect.value = "relevance";
      applyFilters(true);
    });
  }
}

/* =========================
   Init
========================= */
(async function initCatalog() {
  try {
    // Page size: bisa dibaca dari HTML <section id="catalogGrid" data-page-size="9">
    if (grid && grid.dataset.pageSize) {
      const n = Number(grid.dataset.pageSize);
      if (Number.isFinite(n) && n > 0) PAGE_SIZE = n;
    }

    bindGridClick();
    bindPaginationButtons();
    renderPartners();

    const res = await fetch("../assets/data/products.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load products.json (${res.status})`);
    PRODUCTS = await res.json();

    ACTIVE_PRODUCTS = Array.isArray(PRODUCTS) ? PRODUCTS.slice() : [];

    // ambil page dari URL
    CURRENT_PAGE = clampPage(readPageFromUrl());
    writePageToUrl(CURRENT_PAGE);

    // ✅ filter init + bind (ini yang sebelumnya belum Anda panggil)
    initFilterOptions();
    bindFilters();

    // render awal: pakai filter state (default)
    applyFilters(false);

    // support back/forward browser (hanya page)
    window.addEventListener("popstate", () => {
      CURRENT_PAGE = clampPage(readPageFromUrl());
      renderPage();
    });
  } catch (err) {
    console.error(err);
    if (grid) {
      grid.innerHTML = `<p class="muted">Failed to load catalog data. Run with a local server (Live Server).</p>`;
    }
  }
})();
