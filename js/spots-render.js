/* ============================================
   spots-render.js
   負責 pages/sub-spots.html（景點與餐廳）與
   pages/sub-rain-plan.html（雨天備案）的動態渲染。

   兩個頁面共用同一支 JS、同一份資料
   （js/data/spots.json），差別只在於：
   - 景點與餐廳：全部 83 筆、5 種篩選（含雨天備案篩選）
   - 雨天備案：只顯示 rainBackup=true 的 18 筆、4 種篩選
     （雨天備案篩選拿掉，因為每一筆本來就都是雨天備案）
   用最外層 .spots-page 的 data-spots-mode="all"/"rain"
   屬性判斷是哪一種。

   卡片內容渲染重用 js/itinerary-render.js 裡已經定義好的
   全域函式（itinEsc / itinCopyButton / itinFieldRow /
   itinMetroGroupsHtml / itinExternalLinkBtn / itinLinkButton
   / attachMenuModalHandler 等），因為兩支 script 都是
   classic <script> 標籤、共用同一個全域作用域。
   ============================================ */

let spotsData = null;
let spotsMode = "all";
let spotsBaseList = [];
let spotsFilters = {
  categories: new Set(),
  indoor: new Set(),
  vbp: new Set(),
  regions: new Set(),
  inItinerary: new Set(),
  rainOnly: false,
};

function resetSpotsFilters() {
  spotsFilters = {
    categories: new Set(),
    indoor: new Set(),
    vbp: new Set(),
    regions: new Set(),
    inItinerary: new Set(),
    rainOnly: false,
  };
}

async function loadSpotsData() {
  if (spotsData) return;
  const res = await fetch("js/data/spots.json", { cache: "no-cache" });
  spotsData = await res.json();
}

/* ---------- 篩選邏輯 ---------- */

function computeSpotsFacets(list) {
  const categories = new Set();
  const indoor = new Set();
  const regions = new Set();
  const inItinerary = new Set();
  list.forEach((s) => {
    if (s.category) categories.add(s.category);
    if (s.indoor) indoor.add(s.indoor);
    if (s.region) regions.add(s.region);
    inItinerary.add(s.inItinerary ? "已排入行程" : "未排入行程");
  });
  const sortZh = (a, b) => a.localeCompare(b, "zh-Hant");
  return {
    categories: Array.from(categories).sort(sortZh),
    indoor: Array.from(indoor).sort(sortZh),
    regions: Array.from(regions).sort(sortZh),
    // 「已排入行程」排前面、「未排入行程」排後面，固定順序比較好找
    inItinerary: Array.from(inItinerary).sort((a, b) =>
      a === "已排入行程" ? -1 : 1,
    ),
  };
}

function spotMatchesFilters(spot) {
  const f = spotsFilters;
  if (f.categories.size && !f.categories.has(spot.category)) return false;
  if (f.indoor.size && !f.indoor.has(spot.indoor)) return false;
  if (f.vbp.size) {
    const val = spot.vbp || "無";
    if (!f.vbp.has(val)) return false;
  }
  if (f.regions.size && !f.regions.has(spot.region)) return false;
  if (f.inItinerary.size) {
    const state = spot.inItinerary ? "已排入行程" : "未排入行程";
    if (!f.inItinerary.has(state)) return false;
  }
  if (spotsMode === "all" && f.rainOnly && !spot.rainBackup) return false;
  return true;
}

function countActiveFilters() {
  const f = spotsFilters;
  let n =
    f.categories.size +
    f.indoor.size +
    f.vbp.size +
    f.regions.size +
    f.inItinerary.size;
  if (f.rainOnly) n += 1;
  return n;
}

/* ---------- 篩選 Modal 內容渲染 ---------- */

function spotsFilterChipHtml(dim, value, opts) {
  opts = opts || {};
  let cls = "filter-chip js-filter-chip";
  let style = "";
  if (opts.area) {
    cls += " filter-chip--area";
    const color =
      (spotsData.areaColors && spotsData.areaColors[value]) || "#595959";
    style = ` style="--area-color:${color}"`;
  }
  return `<button type="button" class="${cls}" data-filter-dim="${dim}" data-filter-value="${itinEsc(value)}"${style}>${itinEsc(value)}</button>`;
}

function spotsFilterGroupHtml(title, dim, values, opts) {
  if (!values.length) return "";
  const chips = values.map((v) => spotsFilterChipHtml(dim, v, opts)).join("");
  return `<div class="filter-group"><div class="filter-group-title">${itinEsc(title)}</div><div class="filter-chips">${chips}</div></div>`;
}

function renderSpotsFilterModalBody() {
  const body = document.getElementById("spots-filter-body");
  if (!body) return;
  const facets = computeSpotsFacets(spotsBaseList);

  let html = "";
  html += spotsFilterGroupHtml("分類", "categories", facets.categories);
  html += spotsFilterGroupHtml("室內/外", "indoor", facets.indoor);
  html += spotsFilterGroupHtml("釜山Pass", "vbp", ["無", "免費", "折扣"]);
  html += spotsFilterGroupHtml("觀光地區", "regions", facets.regions, {
    area: true,
  });
  html += spotsFilterGroupHtml("行程內", "inItinerary", facets.inItinerary);

  if (spotsMode === "all") {
    html += `
      <div class="filter-group">
        <div class="filter-group-title">雨天備案</div>
        <div class="filter-chips">
          <button type="button" class="filter-chip js-filter-chip" data-filter-dim="rainOnly" data-filter-value="1">
            <i class="fa-solid fa-umbrella"></i>只看雨天備案
          </button>
        </div>
      </div>`;
  }

  body.innerHTML = html;
}

function updateSpotsFilterApplyCount() {
  const btn = document.getElementById("spots-filter-apply-btn");
  if (!btn) return;
  const count = spotsBaseList.filter(spotMatchesFilters).length;
  btn.textContent = `套用篩選 (${count})`;
}

function updateSpotsFilterBtnBadge() {
  const badge = document.getElementById("spots-filter-badge");
  const n = countActiveFilters();
  if (!badge) return;
  if (n > 0) {
    badge.textContent = String(n);
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

/* ---------- 卡片渲染 ---------- */

function renderSpotCard(item) {
  const areaColor =
    (spotsData.areaColors && spotsData.areaColors[item.region]) || "#595959";

  let tagsHtml = `<span class="tag tag-area" style="--area-color:${areaColor}">${itinEsc(item.region)}</span>`;
  tagsHtml += `<span class="tag tag-category">${itinEsc(item.category)}</span>`;
  if (item.indoor)
    tagsHtml += `<span class="tag tag-category">${itinEsc(item.indoor)}</span>`;
  if (item.vbp) {
    const vbpUrl =
      item.vbpUrl || "https://www.visitbusanpass.com/attractions/?attrtp";
    tagsHtml += `<span class="tag tag-vbp"><a href="${itinEsc(vbpUrl)}" target="_blank" rel="noopener noreferrer">VBP <i class="fa-solid fa-arrow-up-right-from-square"></i></a></span>`;
  }
  if (spotsMode === "all" && item.rainBackup) {
    tagsHtml += `<span class="tag tag-rain"><i class="fa-solid fa-umbrella"></i>雨天備案</span>`;
  }

  let fieldsHtml = "";
  if (item.hours) {
    const isUrl = /^https?:\/\//i.test(item.hours);
    fieldsHtml += itinFieldRow(
      "營業",
      isUrl
        ? `<a href="${itinEsc(item.hours)}" target="_blank" rel="noopener noreferrer" class="text-decoration-underline link-offset-2">營業時間</a>`
        : itinEsc(item.hours),
    );
  }
  if (item.metroGroups && item.metroGroups.length) {
    fieldsHtml += itinFieldRow("地鐵", itinMetroGroupsHtml(item.metroGroups));
  }
  if (item.fee) fieldsHtml += itinFieldRow("費用", itinEsc(item.fee));
  if (item.inItinerary)
    fieldsHtml += itinFieldRow("行程內", itinEsc(item.inItinerary));

  const noteHtml = item.note
    ? `<div class="stop-note"><i class="fa-solid fa-pen"></i><span>${itinEsc(item.note)}</span></div>`
    : "";

  let actionsHtml = "";
  if (item.navermap) {
    actionsHtml += `<a class="pin-btn" href="${itinEsc(item.navermap)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-location-dot"></i></a>`;
  }
  if (item.menuImages && item.menuImages.length) {
    const imagesJson = itinEsc(JSON.stringify(item.menuImages));
    actionsHtml += `<button type="button" class="link-btn" data-bs-toggle="modal" data-bs-target="#menuModal" data-menu-title="${itinEsc(item.zh)} 菜單" data-menu-images="${imagesJson}" data-menu-as-link="${item.menuAsLink ? "1" : "0"}"><i class="fa-solid fa-utensils"></i>菜單</button>`;
  }
  if (item.website)
    actionsHtml += itinExternalLinkBtn(
      "官網",
      item.website,
      "fa-solid fa-globe",
    );
  (item.sns || []).forEach((s) => {
    actionsHtml += itinExternalLinkBtn(
      "",
      s.url,
      s.icon || "fa-solid fa-share-nodes",
    );
  });
  (item.links || []).forEach((l) => {
    actionsHtml += itinLinkButton(l);
  });

  return `
    <div class="stop-card">
      <h4 class="stop-title">${itinEsc(item.zh)}</h4>
      <div class="stop-kr">
        <span>${itinEsc(item.kr || "")}</span>
        ${itinCopyButton(item.kr)}
      </div>
      <div class="stop-tags">${tagsHtml}</div>
      ${fieldsHtml}
      ${noteHtml}
      <div class="stop-actions">${actionsHtml}</div>
    </div>`;
}

function renderSpotsList(list) {
  const container = document.getElementById("spots-list");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `
      <div class="spots-empty">
        <i class="fa-solid fa-magnifying-glass"></i>
        目前篩選條件沒有符合的項目，試著調整篩選看看
      </div>`;
    return;
  }

  container.innerHTML = list.map((item) => renderSpotCard(item)).join("");
}

function updateSpotsResultCount(n) {
  const el = document.getElementById("spots-result-count");
  if (!el) return;
  const label = spotsMode === "rain" ? "個雨天備案" : "個景點";
  el.innerHTML = `共 <strong>${n}</strong> ${label}`;
}

function applySpotsFilters() {
  const filtered = spotsBaseList.filter(spotMatchesFilters);
  filtered.sort((a, b) => a.zh.localeCompare(b.zh, "zh-Hant"));
  renderSpotsList(filtered);
  updateSpotsResultCount(filtered.length);
  updateSpotsFilterBtnBadge();
  updateSpotsFilterApplyCount();
}

function syncSpotsFilterChipVisuals() {
  document.querySelectorAll(".js-filter-chip").forEach((chip) => {
    const dim = chip.dataset.filterDim;
    const value = chip.dataset.filterValue;
    if (dim === "rainOnly") {
      chip.classList.toggle("active", spotsFilters.rainOnly);
    } else if (spotsFilters[dim]) {
      chip.classList.toggle("active", spotsFilters[dim].has(value));
    }
  });
}

/* ---------- 進入點 ---------- */

async function initSpotsPage() {
  const wrapper = document.querySelector(".spots-page");
  if (!wrapper) return; // 目前不是景點/雨天備案頁

  spotsMode = wrapper.dataset.spotsMode || "all";
  resetSpotsFilters();

  attachMenuModalHandler(); // 沿用 itinerary-render.js 的共用函式

  try {
    await loadSpotsData();
  } catch (err) {
    console.error("[spots-render] 載入景點資料失敗", err);
    const container = document.getElementById("spots-list");
    if (container)
      container.innerHTML =
        '<p style="padding:20px;color:#c00;">景點資料載入失敗</p>';
    return;
  }

  spotsBaseList =
    spotsMode === "rain"
      ? spotsData.spots.filter((s) => s.rainBackup)
      : spotsData.spots.slice();

  renderSpotsFilterModalBody();
  applySpotsFilters();
}

document.addEventListener("component:loaded", (event) => {
  if (event.detail.containerId === "page-container") {
    initSpotsPage();
  }
});

/* ---------- 篩選面板的點擊事件（chip 切換 / 清除 / 套用） ---------- */
document.addEventListener("click", (event) => {
  const chip = event.target.closest(".js-filter-chip");
  if (chip) {
    const dim = chip.dataset.filterDim;
    const value = chip.dataset.filterValue;
    if (dim === "rainOnly") {
      spotsFilters.rainOnly = !spotsFilters.rainOnly;
      chip.classList.toggle("active", spotsFilters.rainOnly);
    } else if (spotsFilters[dim]) {
      const set = spotsFilters[dim];
      if (set.has(value)) {
        set.delete(value);
        chip.classList.remove("active");
      } else {
        set.add(value);
        chip.classList.add("active");
      }
    }
    updateSpotsFilterApplyCount();
    return;
  }

  if (event.target.closest("#spots-filter-clear-btn")) {
    resetSpotsFilters();
    syncSpotsFilterChipVisuals();
    updateSpotsFilterApplyCount();
    return;
  }

  if (event.target.closest("#spots-filter-apply-btn")) {
    applySpotsFilters();
    return;
  }
});
