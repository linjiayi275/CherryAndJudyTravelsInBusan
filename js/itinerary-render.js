/* ============================================
   itinerary-render.js
   負責 pages/sub-itinerary.html（行程頁）的動態渲染：
   1. 從 js/data/itinerary.json 讀取資料（只 fetch 一次，
      快取在模組變數 itineraryData 裡）
   2. 畫出上方 Day 切換分頁列（10/1 10/2 10/3 10/4）
   3. 畫出當天的時間軸：景點卡片 / 交通路段卡片 /
      多選項交通方式卡片
   4. 處理「菜單」「廁所」兩個共用 Modal 的內容動態帶入

   跟 js/component-loader.js、js/common.js 一樣，
   這支只在瀏覽器環境執行，不依賴任何框架。
   ============================================ */

let itineraryData = null;
let itineraryActiveDay = 1;

/* ---------- 共用小工具 ---------- */

function itinEsc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itinFormatDuration(d) {
  if (d === null || d === undefined || d === "") return "";
  if (typeof d === "string") return `${d}分`;
  if (d < 60) return `${d}分`;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m === 0 ? `${h}小時` : `${h}小時${m}分`;
}

function itinFormatFee(fee, tollOptions) {
  if (!fee && fee !== 0) return "";
  let out = `₩${Number(fee).toLocaleString()}`;
  if (tollOptions) {
    // tollOptions 是 "0/1000/2000" 這種字串，因為過路費會隨司機
    // 走的路不同而不一樣，用 "/" 列出所有可能金額
    const parts = tollOptions
      .split("/")
      .map((n) => `₩${Number(n).toLocaleString()}`)
      .join("/");
    out += ` (含過路費${parts})`;
  }
  return out;
}

function itinCopyButton(text) {
  if (!text) return "";
  return `<button type="button" class="js-copy copy-icon" data-copy-text="${itinEsc(text)}" aria-label="複製韓文"><i class="fa-solid fa-copy"></i></button>`;
}

function itinExternalLinkBtn(label, url, iconClass) {
  return `<a class="link-btn" href="${itinEsc(url)}" target="_blank" rel="noopener noreferrer"><i class="${iconClass}"></i>${itinEsc(label)}</a>`;
}

/* 交通路段內的連結一律用灰色樣式（修正點 6） */
function itinTransitLinkBtn(label, url, iconClass) {
  return `<a class="link-btn link-btn--muted" href="${itinEsc(url)}" target="_blank" rel="noopener noreferrer"><i class="${iconClass}"></i>${itinEsc(label)}</a>`;
}

function itinLinkButton(l) {
  if (l.internal) {
    return `<a href="#" class="link-btn js-nav-link" data-page-url="${itinEsc(l.url)}" data-page-key="${itinEsc(l.pageKey || "")}"><i class="fa-solid fa-link"></i>${itinEsc(l.label)}</a>`;
  }
  return itinExternalLinkBtn(l.label, l.url, "fa-solid fa-link");
}

function itinTransitLinkButton(l) {
  if (l.internal) {
    return `<a href="#" class="link-btn link-btn--muted js-nav-link" data-page-url="${itinEsc(l.url)}" data-page-key="${itinEsc(l.pageKey || "")}"><i class="fa-solid fa-link"></i>${itinEsc(l.label)}</a>`;
  }
  return itinTransitLinkBtn(l.label, l.url, "fa-solid fa-link");
}

function itinFieldRow(label, valueHtml) {
  return `<div class="stop-field"><span class="field-label">${itinEsc(label)}</span><span class="field-value">${valueHtml}</span></div>`;
}

/* 地鐵圓形代碼：用文字顏色，不用底色（修正點 2） */
function itinMetroBadge(code, color) {
  return `<span class="metro-badge" style="color:${color}">${itinEsc(code)}</span>`;
}

function itinMetroGroupsHtml(groups) {
  if (!groups || !groups.length) return "";
  return groups
    .map((g) => {
      const badges = (g.badges || [])
        .map((b) => itinMetroBadge(b.code, b.color))
        .join("");
      return `<span class="metro-group">${badges} ${itinEsc(g.name || "")}</span>`;
    })
    .join('<span class="metro-group-sep">/</span>');
}

function itinScheduleHtml(lines) {
  if (!lines || !lines.length) return "";
  const rows = lines
    .map((l) => {
      if (l.code) {
        return `<div class="transit-schedule-line" style="color:${l.color}">${itinMetroBadge(l.code, l.color)}<span>${itinEsc(l.text)}</span></div>`;
      }
      return `<div class="transit-schedule-line"><span>${itinEsc(l.text)}</span></div>`;
    })
    .join("");
  return `<div class="transit-schedule">${rows}</div>`;
}

/* ---------- 景點卡片 ---------- */

function renderStop(item) {
  const areaColor =
    (itineraryData.areaColors && itineraryData.areaColors[item.region]) ||
    "#595959";
  const backupClass = item.isBackup ? " stop-card--backup" : "";

  // 修正點 13,20,21,23,25：hideNum 的景點不畫號碼圓點
  const numHtml = item.hideNum
    ? ""
    : `<span class="itin-num${item.isBackup ? " itin-num--backup" : ""}">${itinEsc(item.numLabel || item.num)}</span>`;

  // 只有 arrive、沒有 leave（例如當天最後回飯店，沒有離開時間）
  // 時，不顯示「– 離開時間」跟「停留」字樣
  let timeHtml = "";
  if (item.arrive && item.leave) {
    timeHtml = `
      <div class="stop-time">
        <span class="stop-time-range">${itinEsc(item.arrive)} – ${itinEsc(item.leave)}</span>
        <span class="stop-time-duration">停留${itinFormatDuration(item.duration)}</span>
      </div>`;
  } else if (item.arrive) {
    timeHtml = `
      <div class="stop-time">
        <span class="stop-time-range">${itinEsc(item.arrive)}</span>
      </div>`;
  }

  let tagsHtml = `<span class="tag tag-area" style="--area-color:${areaColor}">${itinEsc(item.region)}</span>`;
  tagsHtml += `<span class="tag tag-category">${itinEsc(item.category)}</span>`;
  if (item.indoor)
    tagsHtml += `<span class="tag tag-category">${itinEsc(item.indoor)}</span>`;
  if (item.vbp) {
    const vbpUrl =
      item.vbpUrl || "https://www.visitbusanpass.com/attractions/?attrtp";
    tagsHtml += `<span class="tag tag-vbp"><a href="${itinEsc(vbpUrl)}" target="_blank" rel="noopener noreferrer">VBP <i class="fa-solid fa-arrow-up-right-from-square"></i></a></span>`;
  }

  let backupOfHtml = "";
  if (item.isBackup && item.backupOf) {
    backupOfHtml += `<div class="itin-backup-label">${itinEsc(item.backupOf)}備案</div>`;
  }

  let fieldsHtml = "";
  if (item.hours) {
    // 營業時間欄位若本身是網址，就整段變成連結
    const isUrl = /^https?:\/\//i.test(item.hours);
    fieldsHtml += itinFieldRow(
      "營業",
      isUrl
        ? `<a href="${itinEsc(item.hours)}" class="text-decoration-underline link-offset-2" target="_blank" rel="noopener noreferrer">營業時間</a>`
        : itinEsc(item.hours),
    );
  }
  if (item.metroGroups && item.metroGroups.length) {
    fieldsHtml += itinFieldRow("地鐵", itinMetroGroupsHtml(item.metroGroups));
  }
  if (item.address) {
    fieldsHtml += itinFieldRow(
      "地址",
      `${itinEsc(item.address)} ${itinCopyButton(item.address)}`,
    );
  }
  if (item.fee) fieldsHtml += itinFieldRow("費用", itinEsc(item.fee));

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
  if (item.restroomLinks && item.restroomLinks.length) {
    const linksJson = itinEsc(JSON.stringify(item.restroomLinks));
    actionsHtml += `<button type="button" class="link-btn" data-bs-toggle="modal" data-bs-target="#restroomModal" data-restroom-title="${itinEsc(item.zh)} 廁所" data-restroom-links="${linksJson}"><i class="fa-solid fa-restroom"></i>廁所</button>`;
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
    <li class="itin-item">
      ${numHtml}
      <div class="stop-card${backupClass}">
        <h4 class="stop-title">${itinEsc(item.zh)}</h4>
        <div class="stop-kr">
          <span>${itinEsc(item.kr || "")}</span>
          ${itinCopyButton(item.kr)}
        </div>
        ${timeHtml}
        <div class="stop-tags">${tagsHtml}</div>
        ${backupOfHtml}
        ${fieldsHtml}
        ${noteHtml}
        <div class="stop-actions">${actionsHtml}</div>
      </div>
    </li>`;
}

/* ---------- 交通路段卡片（單一方式） ---------- */

function renderTransit(item) {
  let head = `<div class="transit-head">
    <span class="transit-label">${itinEsc(item.label)}</span>
    <span class="transit-duration">${itinFormatDuration(item.duration)}</span>`;
  if (item.routeUrl) {
    head += `<a class="transit-route-btn" href="${itinEsc(item.routeUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-route"></i></a>`;
  }
  head += `</div>`;

  let body = "";
  if (item.taxiFrom) {
    body += `<div class="transit-taxi-row"><i class="fa-solid fa-location-dot"></i>上車：${itinEsc(item.taxiFrom)} ${itinCopyButton(item.taxiFrom)}</div>`;
  }
  if (item.taxiTo) {
    body += `<div class="transit-taxi-row"><i class="fa-solid fa-location-dot"></i>下車：${itinEsc(item.taxiTo)} ${itinCopyButton(item.taxiTo)}</div>`;
  }
  body += itinScheduleHtml(item.scheduleLines);
  if (item.note)
    body += `<div class="transit-note d-flex">
  <i class="fa-solid fa-highlighter me-2 mt-1"></i>
  <div>${itinEsc(item.note)}</div>
  </div>`;

  if (item.fee)
    body += `<div class="transit-fee"><i class="fa-solid fa-sack-dollar me-2"></i>${itinFormatFee(item.fee, item.tollOptions)}</div>`;

  const linksHtml = (item.links || [])
    .map((l) => itinTransitLinkButton(l))
    .join("");
  const actionsHtml = linksHtml
    ? `<div class="stop-actions">${linksHtml}</div>`
    : "";

  return `
    <li class="itin-item itin-item--transit">
      <span class="itin-transit-icon"><i class="${item.icon}"></i></span>
      <div class="transit-card">${head}${body}${actionsHtml}</div>
    </li>`;
}

/* ---------- 多選項交通方式（合併進同一張卡片，不用標題也不用 icon） ---------- */

function renderTransitOptions(item) {
  const routeBtn =
    item.sharedWalk && item.sharedWalk.routeUrl
      ? `<a class="transit-route-btn" href="${itinEsc(item.sharedWalk.routeUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-route"></i></a>`
      : "";

  const sharedWalkHtml = item.sharedWalk
    ? `<div class="transit-head">
        <span class="transit-label">走路</span>
        <span class="transit-duration">${itinFormatDuration(item.sharedWalk.duration)}</span>
        ${routeBtn}
      </div><div class="transit-note"><i class="fa-solid fa-highlighter me-2"></i>${item.sharedWalk.note}</div>`
    : "";

  const optionsHtml = item.options
    .map((o) => {
      let head = `<div class="transit-head">
        <span class="transit-label">${itinEsc(o.modeText)}</span>
        <span class="transit-duration">${itinFormatDuration(o.duration)}</span>`;
      if (o.routeUrl) {
        head += `<a class="transit-route-btn" href="${itinEsc(o.routeUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-route"></i></a>`;
      }
      head += `</div>`;

      let body = "";
      if (o.taxiFrom) {
        body += `<div class="transit-taxi-row"><i class="fa-solid fa-location-dot"></i>上車：${itinEsc(o.taxiFrom)} ${itinCopyButton(o.taxiFrom)}</div>`;
      }
      if (o.taxiTo) {
        body += `<div class="transit-taxi-row"><i class="fa-solid fa-location-dot"></i>下車：${itinEsc(o.taxiTo)} ${itinCopyButton(o.taxiTo)}</div>`;
      }
      body += itinScheduleHtml(o.scheduleLines);
      if (o.note)
        body += `<div class="transit-note d-flex"><i class="fa-solid fa-highlighter me-2 mt-1"></i><div>${itinEsc(o.note)}</div>
      </div>`;

      if (o.fee)
        body += `<div class="transit-fee"><i class="fa-solid fa-sack-dollar me-2"></i>${itinFormatFee(o.fee, o.tollOptions)}</div>`;

      const labelHtml = o.label
        ? `<span class="transit-option-label">${itinEsc(o.label)}</span>`
        : "";
      return `<div class="transit-option">${labelHtml}${head}${body}</div>`;
    })
    .join("");

  return `
    <li class="itin-item itin-item--transit">
      <span class="itin-transit-icon"><i class="fa-solid fa-person-walking"></i></span>
      <div class="transit-card">
        ${sharedWalkHtml}
        <div class="transit-options-list">${optionsHtml}</div>
      </div>
    </li>`;
}

/* ---------- Day 內容渲染 ---------- */

function renderItineraryDay(dayObj) {
  const container = document.getElementById("itinerary-content");
  if (!container) return;

  const itemsHtml = dayObj.items
    .map((item) => {
      if (item.kind === "stop") return renderStop(item);
      if (item.kind === "transit") return renderTransit(item);
      if (item.kind === "transit-options") return renderTransitOptions(item);
      return "";
    })
    .join("");

  container.innerHTML = `
    <section class="day-block" style="--day-color:${dayObj.dayColor}">
      <div class="itin-day-header">
        <div class="itin-day-label">
          <span class="day-label">Day ${dayObj.day}</span>
          <span class="day-date">${itinEsc(dayObj.dateLabel)}</span>
        </div>
        <span class="day-stop-count">${dayObj.stopCount} STOPS</span>
      </div>
      <ul class="itin-list">${itemsHtml}</ul>
    </section>`;
}

function renderItineraryDayTabs() {
  const wrap = document.getElementById("itinerary-day-tabs");
  if (!wrap) return;
  wrap.innerHTML = itineraryData.days
    .map((d) => {
      const isActive = d.day === itineraryActiveDay;
      return `<button type="button" class="day-tab${isActive ? " active" : ""}" data-day="${d.day}" style="--tab-color:${d.dayColor}">${itinEsc(d.dateShort)}</button>`;
    })
    .join("");
}

function selectItineraryDay(dayNum) {
  itineraryActiveDay = dayNum;
  renderItineraryDayTabs();
  const dayObj = itineraryData.days.find((d) => d.day === dayNum);
  if (dayObj) renderItineraryDay(dayObj);
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ---------- 菜單 Modal（支援多張圖片 / 改用連結呈現） ---------- */

function attachMenuModalHandler() {
  const modalEl = document.getElementById("menuModal");
  if (!modalEl || modalEl.dataset.bound) return;
  modalEl.dataset.bound = "1";
  modalEl.addEventListener("show.bs.modal", (event) => {
    const trigger = event.relatedTarget;
    if (!trigger) return;
    const titleEl = document.getElementById("menuModalTitle");
    const bodyEl = document.getElementById("menuModalBody");
    if (titleEl) titleEl.textContent = trigger.dataset.menuTitle || "菜單";
    if (bodyEl) {
      let images = [];
      try {
        images = JSON.parse(trigger.dataset.menuImages || "[]");
      } catch (e) {
        images = [];
      }
      const asLink = trigger.dataset.menuAsLink === "1";
      if (asLink) {
        bodyEl.innerHTML = images
          .map((src, idx) => {
            const label =
              images.length > 1 ? `查看菜單 ${idx + 1}` : "查看菜單";
            return `<a class="restroom-link-item" href="${itinEsc(src)}" target="_blank" rel="noopener noreferrer">
              <i class="fa-solid fa-utensils"></i>${itinEsc(label)}
              <i class="fa-solid fa-arrow-up-right-from-square ext-icon"></i>
            </a>`;
          })
          .join("");
      } else {
        bodyEl.innerHTML = images
          .map(
            (src) =>
              `<a href="${itinEsc(src)}" class="pswp-trigger" data-pswp-width="1200" data-pswp-height="1200">
                <img src="${itinEsc(src)}" alt="菜單" />
              </a>`,
          )
          .join("");
      }
    }
  });
}

/* ---------- 廁所 Modal（列出所有相關連結） ---------- */

function attachRestroomModalHandler() {
  const modalEl = document.getElementById("restroomModal");
  if (!modalEl || modalEl.dataset.bound) return;
  modalEl.dataset.bound = "1";
  modalEl.addEventListener("show.bs.modal", (event) => {
    const trigger = event.relatedTarget;
    if (!trigger) return;
    const titleEl = document.getElementById("restroomModalTitle");
    const bodyEl = document.getElementById("restroomModalBody");
    if (titleEl) titleEl.textContent = trigger.dataset.restroomTitle || "廁所";
    if (bodyEl) {
      let links = [];
      try {
        links = JSON.parse(trigger.dataset.restroomLinks || "[]");
      } catch (e) {
        links = [];
      }
      bodyEl.innerHTML = links
        .map((l, idx) => {
          const label = links.length > 1 ? `${l.label}${idx + 1}` : l.label;
          return `<a class="restroom-link-item" href="${itinEsc(l.url)}" target="_blank" rel="noopener noreferrer">
            <i class="fa-solid fa-location-dot"></i>${itinEsc(label)}
            <i class="fa-solid fa-arrow-up-right-from-square ext-icon"></i>
          </a>`;
        })
        .join("");
    }
  });
}

/* ---------- 進入點 ---------- */

async function initItineraryPage() {
  const mount = document.getElementById("itinerary-content");
  if (!mount) return; // 目前不是「行程」頁，不用做事

  attachMenuModalHandler();
  attachRestroomModalHandler();

  const tabsWrap = document.getElementById("itinerary-day-tabs");
  if (tabsWrap && !tabsWrap.dataset.bound) {
    tabsWrap.dataset.bound = "1";
    tabsWrap.addEventListener("click", (event) => {
      const btn = event.target.closest(".day-tab");
      if (!btn) return;
      selectItineraryDay(Number(btn.dataset.day));
    });
  }

  try {
    if (!itineraryData) {
      const res = await fetch("js/data/itinerary.json", { cache: "no-cache" });
      itineraryData = await res.json();
    }
    selectItineraryDay(itineraryActiveDay);
  } catch (err) {
    console.error("[itinerary-render] 載入行程資料失敗", err);
    mount.innerHTML =
      '<p style="padding:20px;color:#c00;">行程資料載入失敗</p>';
  }
}

document.addEventListener("component:loaded", (event) => {
  if (event.detail.containerId === "page-container") {
    initItineraryPage();
  }
});
