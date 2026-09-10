/* ============================================
   common.js
   全站共用工具函式：
   1. SPA 換頁（.js-nav-link → navigateTo）
   2. App 優先開啟，沒安裝改開網頁（.js-open-app → openAppOrWeb）
   3. 子頁面自動載入對應 header 元件
   4. footer 目前所在頁面 active 狀態同步
   ============================================ */

/**
 * 依據目前頁面 key，幫 footer 對應項目加上 .active
 * @param {string} pageKey - 例如 'home' / 'itinerary' / 'departure' / 'exchange' / 'expense'
 */
function setActiveFooterItem(pageKey) {
  const items = document.querySelectorAll(".footer-item");
  items.forEach((item) => {
    item.classList.toggle("active", item.dataset.pageKey === pageKey);
  });
}

/**
 * SPA 換頁：更新 #page-container 內容並同步 footer active 狀態
 * @param {string} pageUrl - 例如 'pages/sub-itinerary.html'
 * @param {string} pageKey - 對應 footer / 選單 data-page-key 的值，用來同步 active 狀態
 */
function navigateTo(pageUrl, pageKey) {
  if (!pageUrl) return;
  loadComponent(pageUrl, "page-container", () => {
    if (pageKey) setActiveFooterItem(pageKey);
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}

/**
 * 嘗試喚起手機內的原生 App；如果沒有安裝（頁面在短時間內
 * 仍保持在前景、沒有被瀏覽器切換出去），則改開網頁版連結。
 *
 * 原理：呼叫 App 的自訂網址協定（例如 uber://）後，若成功喚起
 * App，瀏覽器分頁會被切到背景（document.hidden 變成 true）；
 * 如果協定沒有對應的 App 可以處理，頁面會停留在原地，此時等
 * timeout 時間到了還沒被切走，就改用 window.open 開啟備用網頁。
 *
 * ⚠️ 這是業界通用的 fallback 手法，但不同瀏覽器（尤其 iOS Safari／
 * 部分 Android WebView）對未註冊的自訂協定處理方式不完全一致，
 * 無法保證 100% 準確；若公司之後有更穩定的 App 偵測方案（例如
 * Universal Link / App Link 搭配後端 User-Agent 判斷），建議取代
 * 這裡的簡易版本。
 *
 * @param {string} appUrl - App 自訂協定網址，例如 'uber://'
 * @param {string} webUrl - 備用網頁網址
 * @param {number} [timeout=1200] - 等待 App 喚起的時間（毫秒）
 */
function openAppOrWeb(appUrl, webUrl, timeout = 1200) {
  if (!webUrl) return;

  // 沒有提供 App 協定，或非行動裝置環境，直接開網頁版
  const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
  if (!appUrl || !isMobile) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  let didHide = false;

  function onVisibilityChange() {
    if (document.hidden) {
      didHide = true;
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  // 嘗試喚起 App
  window.location.href = appUrl;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!didHide) {
      // App 沒有被喚起（可能未安裝），改開網頁版
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
  }, timeout);
}

/**
 * 子頁面若在自己最外層容器上標記了 data-header-title，
 * 就自動載入對應的 header 元件並帶入標題文字。
 * 用法（寫在 pages/sub-xxx.html 裡）：
 *   <div class="sub-page" data-header-style="style1" data-header-title="行程">
 *     <div id="header-container"></div>
 *     ...
 *   </div>
 */
function initSubPageHeader() {
  const root = document.querySelector("#page-container [data-header-title]");
  if (!root) return;

  const style = root.dataset.headerStyle || "style1";
  const title = root.dataset.headerTitle || "";
  const icon = root.dataset.headerIcon || ""; // 例如 "fa-plane" ，只有 style4 會用到
  const headerMount = root.querySelector("#header-container");
  if (!headerMount) return;

  loadComponent(`components/header/sub-header-${style}.html`, "header-container", (container) => {
    const titleEl = container.querySelector(".sub-header-title");
    if (titleEl) titleEl.textContent = title;

    if (icon) {
      const iconEl = container.querySelector(".js-header-icon");
      if (iconEl) {
        iconEl.className = `${icon} js-header-icon`;
      }
    }
  });
}

/**
 * 複製文字到剪貼簿（例如韓文地名、韓文地址），
 * 並在複製成功的按鈕上短暫顯示「已複製」的視覺回饋
 * （靠 CSS 的 .copied class 變色，1.2 秒後自動移除）。
 * @param {string} text - 要複製的文字
 * @param {HTMLElement} [triggerEl] - 觸發複製的按鈕元素（用於視覺回饋）
 */
function copyToClipboard(text, triggerEl) {
  if (!text || !navigator.clipboard) return;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      if (!triggerEl) return;
      triggerEl.classList.add("copied");
      window.setTimeout(() => triggerEl.classList.remove("copied"), 1200);
    })
    .catch(() => {
      /* 複製失敗（例如非 HTTPS/localhost 環境）時靜默處理，不打斷使用者 */
    });
}

/**
 * 讓一個「內容比容器大」的區塊支援滑鼠拖曳捲動
 * （上下 + 左右都支援）。手機/平板本身用手指滑動就能
 * 捲動兩個方向，這個只是額外幫桌機滑鼠使用者補上
 * 「按住拖曳」的操作方式，不需要特別去抓 scrollbar。
 *
 * 拖曳跟點擊的衝突處理：容器裡如果有可點擊的內容（例如
 * 商品圖片要點擊放大），拖曳超過一定位移量之後放開滑鼠，
 * 會把「緊接著那次 click」攔截掉，避免使用者本來只是想
 * 拖曳捲動，結果放開時剛好誤觸點擊、跳出圖片放大燈箱。
 *
 * 用法：在容器上加 class="js-drag-scroll"，
 * component:loaded 時會自動幫頁面裡所有這個 class 的元素初始化。
 * @param {HTMLElement} container
 */
function initDragScroll(container) {
  if (!container || container.dataset.dragBound) return;
  container.dataset.dragBound = "1";

  const DRAG_THRESHOLD = 6; // px，低於這個位移量視為單純點擊，不算拖曳

  let isDown = false;
  let dragged = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  container.addEventListener("mousedown", (e) => {
    isDown = true;
    dragged = false;
    container.classList.add("grabbing");
    startX = e.pageX;
    startY = e.pageY;
    startScrollLeft = container.scrollLeft;
    startScrollTop = container.scrollTop;
  });

  container.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    const deltaX = e.pageX - startX;
    const deltaY = e.pageY - startY;
    if (!dragged && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      dragged = true;
    }
    if (dragged) {
      e.preventDefault();
      container.scrollLeft = startScrollLeft - deltaX;
      container.scrollTop = startScrollTop - deltaY;
    }
  });

  const endDrag = () => {
    isDown = false;
    container.classList.remove("grabbing");
  };
  container.addEventListener("mouseup", endDrag);
  container.addEventListener("mouseleave", endDrag);

  // capture 階段攔截：拖曳後緊接著觸發的 click 會被吃掉，
  // 比子元素（例如圖片的點擊放大）更早攔截，兩者才不會衝突
  container.addEventListener(
    "click",
    (e) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
      }
      dragged = false;
    },
    true
  );
}

function initAllDragScrollAreas(root) {
  const scope = root || document;
  scope.querySelectorAll(".js-drag-scroll").forEach((el) => initDragScroll(el));
}

/* ---------- 事件委派：點擊攔截（適用於動態載入進來的內容） ---------- */
document.addEventListener("click", (event) => {
  const navLink = event.target.closest(".js-nav-link");
  if (navLink) {
    event.preventDefault();
    navigateTo(navLink.dataset.pageUrl, navLink.dataset.pageKey);
    return;
  }

  const appLink = event.target.closest(".js-open-app");
  if (appLink) {
    event.preventDefault();
    openAppOrWeb(appLink.dataset.appUrl, appLink.dataset.webUrl);
    return;
  }

  const copyBtn = event.target.closest(".js-copy");
  if (copyBtn) {
    event.preventDefault();
    copyToClipboard(copyBtn.dataset.copyText, copyBtn);
    return;
  }

  // header 上的返回鍵：目前這個簡易版 SPA 沒有維護瀏覽紀錄堆疊，
  // 所以先固定導回首頁；若之後要做「真正的上一頁」，可以改用
  // history.pushState() 記錄每次 navigateTo() 的頁面，再由這裡讀取。
  const backBtn = event.target.closest(".js-back");
  if (backBtn) {
    event.preventDefault();
    navigateTo("pages/home.html", "home");
    return;
  }
});

/**
 * 每次 #page-container 換內容時，重新播放淡入動畫。
 * 因為瀏覽器不會重播「已經套用過」的 CSS animation class，
 * 所以要先移除 class、強制觸發一次 reflow，再重新加回去，
 * 動畫才會每次換頁都重新播放一次。
 */
function playPageFadeIn() {
  const container = document.getElementById("page-container");
  if (!container) return;

  container.classList.remove("page-fade-in");
  // 強制 reflow：讀取 offsetWidth 會讓瀏覽器立刻重新計算版面，
  // 藉此「打斷」瀏覽器對同一個 class 的動畫快取
  void container.offsetWidth;
  container.classList.add("page-fade-in");
}

/* ---------- 元件載入完成後的後續處理 ---------- */
document.addEventListener("component:loaded", (event) => {
  if (event.detail.containerId === "page-container") {
    initSubPageHeader();
    playPageFadeIn();
    initAllDragScrollAreas(document.getElementById("page-container"));
  }
});
