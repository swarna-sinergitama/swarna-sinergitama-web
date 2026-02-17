(async function initClientsMap() {
  const mapDiv = document.getElementById("leafletMap");
  const tbody = document.getElementById("clientsTbody");
  if (!mapDiv || !tbody) return;

  // Panel tabel (buat scroll halaman ke area tabel)
  const tablePanel = document.querySelector(".clients-table-panel");
  const tableWrap = document.querySelector(".clients-table-wrap");

  // Brand colors from CSS variables (fallback kalau tidak ada)
  const css = getComputedStyle(document.documentElement);
  const COLOR_RED = (css.getPropertyValue("--primary-red") || "").trim() || "#DD4C35";
  const COLOR_OLIVE = (css.getPropertyValue("--primary-olive") || "").trim() || "#51602D";

  // Simple HTML escape (untuk keamanan kalau data mengandung karakter khusus)
  const esc = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // Load data
  let clients = [];
  try {
    const res = await fetch("../assets/data/clients.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load clients.json");
    clients = await res.json();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="muted" style="padding:14px;">
          Failed to load clients data. Run with a local server (Live Server).
        </td>
      </tr>`;
    return;
  }

  // Sort: terbaru di atas (year desc), lalu west→east biar stabil
  clients.sort((a, b) => {
    const ya = Number(a.year ?? 0);
    const yb = Number(b.year ?? 0);
    if (yb !== ya) return yb - ya;
    return (Number(a.lon) - Number(b.lon)) || (Number(b.lat) - Number(a.lat));
  });

  // Render table (4 kolom)
  tbody.innerHTML = clients.map(c => `
  <tr data-id="${String(c.id)}">
    <td><strong>${c.institution || ""}</strong></td>
    <td>${c.focus || ""}</td>
    <td>${c.city || ""}</td>
    <td style="text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">
      ${c.year ?? ""}
    </td>
  </tr>
`).join("");  

  // Init Leaflet map
  const map = L.map(mapDiv, {
    zoomControl: true,
    scrollWheelZoom: true,
  });

  // OpenStreetMap tiles (wajib attribution)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Marker layer
  const markersById = new Map();
  const latlngs = [];

  // Normal/active styles
  const normalStyle = {
    radius: 6,
    color: COLOR_RED,
    weight: 2,
    fillColor: COLOR_RED,
    fillOpacity: 0.85,
  };
  const activeStyle = {
    radius: 8,
    color: COLOR_OLIVE,
    weight: 2,
    fillColor: COLOR_OLIVE,
    fillOpacity: 0.9,
  };

  // State
  let pinnedId = null;

  function clearTableActive() {
    tbody.querySelectorAll("tr").forEach((r) => r.classList.remove("is-active"));
  }

  function setMarkerActive(id, isActive) {
    const m = markersById.get(id);
    if (!m) return;
    m.setStyle(isActive ? activeStyle : normalStyle);
    m.setRadius(isActive ? activeStyle.radius : normalStyle.radius);
  }

  function clearAllActive() {
    // reset marker styles
    markersById.forEach((_, id) => setMarkerActive(id, false));
    clearTableActive();
  }

  function setRowActive(id) {
    const row = tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (!row) return;
    row.classList.add("is-active");
  }

  function scrollToRow(id) {
    const row = tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (!row) return;

    // scroll halaman ke panel tabel (biar “pindah ke bawah”)
    (tablePanel || tableWrap || row).scrollIntoView({ behavior: "smooth", block: "start" });

    // setelah panel terlihat, scroll ke row di dalam container tabel
    setTimeout(() => {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
  }

  function setActive(id, opts = {}) {
    const { panTo = false, scroll = false } = opts;

    clearAllActive();
    setMarkerActive(id, true);
    setRowActive(id);

    if (panTo) {
      const m = markersById.get(id);
      if (m) map.panTo(m.getLatLng(), { animate: true, duration: 0.35 });
    }

    // ✅ scroll hanya bila diminta (click/preset), bukan hover
    if (scroll) scrollToRow(id);
  }

  function hoverActive(id) {
    if (pinnedId) return; // kalau ada pin, hover tidak ganggu
    setActive(id, { panTo: false, scroll: false });
  }

  function unhover() {
    if (pinnedId) {
      setActive(pinnedId, { panTo: false, scroll: false });
    } else {
      clearAllActive();
    }
  }

  function togglePin(id, opts = {}) {
    const { panTo = true, scroll = true } = opts;

    if (pinnedId === id) {
      pinnedId = null;
      clearAllActive();
      return;
    }

    pinnedId = id;
    setActive(id, { panTo, scroll });
  }

  // Create markers
  clients.forEach((c) => {
    const lat = Number(c.lat);
    const lon = Number(c.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const id = String(c.id);

    const m = L.circleMarker([lat, lon], normalStyle).addTo(map);
    m.bindTooltip(c.institution || "", { direction: "top", offset: [0, -6], opacity: 0.95 });

    markersById.set(id, m);
    latlngs.push([lat, lon]);

    // ✅ Hover = highlight only
    m.on("mouseover", () => hoverActive(id));
    m.on("mouseout", () => unhover());

    // ✅ Click = pin + scroll + (opsional) pan
    m.on("click", (e) => {
      // penting: biar map.on("click") tidak ikut terpanggil
      L.DomEvent.stop(e);
      togglePin(id, { panTo: true, scroll: true });
    });
  });

  // Fit extent ke semua titik
  if (latlngs.length) {
    map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 6 });
  } else {
    map.setView([-2.5, 118], 4); // fallback Indonesia-ish
  }

  // Row interactions
  tbody.querySelectorAll("tr").forEach((row) => {
    const id = String(row.dataset.id);

    // ✅ hover row = highlight only
    row.addEventListener("mouseenter", () => hoverActive(id));
    row.addEventListener("mouseleave", () => unhover());

    // ✅ click row = pin + scroll + pan
    row.addEventListener("click", () => togglePin(id, { panTo: true, scroll: true }));
  });

  // Klik area kosong map untuk unpin
  map.on("click", () => {
    pinnedId = null;
    clearAllActive();
  });

  // Preset buttons (kalau tombol ada)
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-preset");
      const presetMap = {
        ui: "ui",
        uho: "uho",
        itk: "itk",
        bpom: "bpom",
        brin: "brin",
        bpib: "bpib",
      };

      const id = presetMap[preset];
      if (!id) return;

      togglePin(String(id), { panTo: true, scroll: true });
    });
  });
})();
