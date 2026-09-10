/* ============================================
   shopping-render.js
   負責 pages/sub-duty-free.html（線上免稅店）與
   pages/sub-must-buy.html（必買推薦(實體店)）的
   「購物清單」表格渲染。

   兩頁共用同一支 JS，用最外層 .shopping-page 的
   data-shopping-mode="duty-free"/"must-buy" 判斷差異：
   - must-buy：多一欄「退稅機制」，產品名稱拆中/韓兩行
   - duty-free：沒有退稅機制欄，產品名稱只有一行（原始
     資料本身中英文混寫在同一欄）

   會員／優惠券／購物說明等靜態介紹區塊直接寫在頁面
   HTML 裡（內容少、不太會變動），只有「購物清單」這個
   會員筆數多、之後可能常常增修的表格才用 JSON 渲染。
   ============================================ */
const SHOP_CURRENCY_SYMBOLS = { KRW: "₩", TWD: "NT$", USD: "$" };

function shopFormatPrice(item) {
  if (item.price === null || item.price === undefined) return "";
  const symbol = SHOP_CURRENCY_SYMBOLS[item.currency] || "";
  return `${symbol}${Number(item.price).toLocaleString()}`;
}

function shopRenderTableHead(mode) {
  const nameLabel = mode === "must-buy" ? "中韓文產品名稱" : "產品名稱";
  let head = `
    <th class="col-no">NO.</th>
    <th class="col-name">${nameLabel}</th>
    <th class="col-image">圖片</th>
    <th class="col-url">網址</th>
    <th class="col-price">原價</th>`;
  if (mode === "must-buy") {
    head += `<th class="col-tax">退稅機制</th>`;
  }
  head += `
    <th class="col-shops">台灣網購</th>
    <th class="col-note">備註</th>`;
  return `<thead><tr>${head}</tr></thead>`;
}

function shopRenderRow(item, mode) {
  const nameHtml =
    mode === "must-buy"
      ? `<div class="shop-name-zh">${itinEsc(item.nameZh)}</div>${
          item.nameKr
            ? `<div class="shop-name-kr">${itinEsc(item.nameKr)}</div>`
            : ""
        }`
      : `<div class="shop-name-zh">${itinEsc(item.name)}</div>`;

  const imgHtml = item.image
    ? `<a href="${itinEsc(item.image)}" class="pswp-trigger" data-pswp-width="1200" data-pswp-height="1200">
         <img class="shop-product-img" src="${itinEsc(item.image)}" alt="${itinEsc(item.nameZh || item.name || "")}" loading="lazy" />
       </a>`
    : "";

  const urlHtml = item.url
    ? `<a class="shop-url-icon" href="${itinEsc(item.url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
    : "";

  const priceHtml = shopFormatPrice(item);

  const taxHtml = item.taxRefund
    ? `<span class="shop-tax-tag">${itinEsc(item.taxRefund)}</span>`
    : "";

  const shopsHtml = (item.twShops || [])
    .map((s) => `<span class="shop-tw-tag">${itinEsc(s)}</span>`)
    .join("");

  const noteHtml = item.note ? itinEsc(item.note) : "";

  let cols = `
    <td class="col-no">${itinEsc(item.no)}</td>
    <td class="col-name">${nameHtml}</td>
    <td class="col-image">${imgHtml}</td>
    <td class="col-url">${urlHtml}</td>
    <td class="col-price">${priceHtml}</td>`;
  if (mode === "must-buy") {
    cols += `<td class="col-tax">${taxHtml}</td>`;
  }
  cols += `
    <td class="col-shops">${shopsHtml}</td>
    <td class="col-note">${noteHtml}</td>`;

  return `<tr>${cols}</tr>`;
}

function shopGroupByStore(items) {
  const groups = [];
  const map = {};
  items.forEach((it) => {
    if (!map[it.store]) {
      map[it.store] = { store: it.store, items: [] };
      groups.push(map[it.store]);
    }
    map[it.store].items.push(it);
  });
  return groups;
}

function shopRenderBtn(items) {
  const groups = shopGroupByStore(items);
  console.log(groups);
  return groups
    .map(
      (g, index) => `
      <a class="link-btn" href="#shop-group-${index}">
        ${itinEsc(g.store)}
      </a>`,
    )
    .join("");
}

function shopRenderList(items, mode) {
  const groups = shopGroupByStore(items);
  console.log(groups);
  return groups
    .map(
      (g, index) => `
    <div class="shop-group" id="shop-group-${index}">
      <div class="shop-group-title"><i class="fa-solid fa-shop"></i>${itinEsc(g.store)}</div>
      <div class="shop-table-wrap">
        <div class="shop-table-scroll js-drag-scroll">
          <table class="shop-table">
            ${shopRenderTableHead(mode)}
            <tbody>${g.items.map((it) => shopRenderRow(it, mode)).join("")}</tbody>
          </table>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

async function initShoppingPage() {
  const wrapper = document.querySelector(".shopping-page");
  if (!wrapper) return; // 不是這兩頁

  const mode = wrapper.dataset.shoppingMode; // "duty-free" | "must-buy"
  const shopbtn = document.getElementById("shop-btn");
  const mount = document.getElementById("shop-list");
  if (!mount) return;

  const dataFile =
    mode === "must-buy" ? "js/data/must-buy.json" : "js/data/duty-free.json";

  try {
    const res = await fetch(dataFile, { cache: "no-cache" });
    const data = await res.json();
    shopbtn.innerHTML = shopRenderBtn(data.items || []);
    mount.innerHTML = shopRenderList(data.items || [], mode);
    initAllDragScrollAreas(mount); // js/common.js 提供的滑鼠拖曳捲動工具
  } catch (err) {
    console.error("[shopping-render] 載入購物清單失敗", err);
    mount.innerHTML =
      '<p style="padding:20px;color:#c00;">購物清單載入失敗</p>';
  }
}

document.addEventListener("component:loaded", (event) => {
  if (event.detail.containerId === "page-container") {
    initShoppingPage();
  }
});
