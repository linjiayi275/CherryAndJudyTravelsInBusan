/* ============================================
   exchange-render.js
   負責 pages/sub-exchange.html（換匯）的互動邏輯：
   1. 台幣／韓元／美金 三者互轉的換匯試算機
   2. 「自訂匯率」Modal：使用者可以填入自己實際換到的
      匯率，蓋掉預設參考匯率，存進 localStorage 重新整理
      後還在

   固定表匯以「1 韓元 = ? 台幣 / ? 美金」兩個數字為基準，
   台幣與美金之間的匯率用這兩個數字換算出來，
   這樣只要維護 2 個數字，3 種幣別互轉都會一致。
   ============================================ */

const FX_CURRENCIES = {
  KRW: { flag: "🇰🇷", code: "KRW", name: "韓元", symbol: "₩", decimals: 0 },
  TWD: { flag: "🇹🇼", code: "TWD", name: "台幣", symbol: "NT$", decimals: 2 },
  USD: { flag: "🇺🇸", code: "USD", name: "美金", symbol: "$", decimals: 2 },
};

const FX_STORAGE_KEY = "travelsinbusan:fxRates";
// 預設參考匯率（1 韓元 = 多少台幣／美金）。1 KRW ≈ 0.023 TWD 這組是
// 使用者提供的參考匯率截圖換算出來的，實際匯率請以「自訂匯率」
// 按鈕填入即時匯率為準
const FX_DEFAULT_RATES = { krwToTwd: 0.023, krwToUsd: 0.00069 };

let fxRates = { ...FX_DEFAULT_RATES };
let fxFromCurrency = "KRW";
let fxToCurrency = "TWD";
let fxFromAmount = 1000;

function fxLoadRates() {
  try {
    const saved = localStorage.getItem(FX_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        typeof parsed.krwToTwd === "number" &&
        typeof parsed.krwToUsd === "number"
      ) {
        fxRates = parsed;
        return;
      }
    }
  } catch (e) {
    /* localStorage 不可用時使用預設值 */
  }
  fxRates = { ...FX_DEFAULT_RATES };
}

function fxSaveRates() {
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(fxRates));
  } catch (e) {
    /* 靜默略過 */
  }
}

function fxToKrw(amount, cur) {
  if (cur === "KRW") return amount;
  if (cur === "TWD") return amount / fxRates.krwToTwd;
  if (cur === "USD") return amount / fxRates.krwToUsd;
  return amount;
}

function fxFromKrw(krwAmount, cur) {
  if (cur === "KRW") return krwAmount;
  if (cur === "TWD") return krwAmount * fxRates.krwToTwd;
  if (cur === "USD") return krwAmount * fxRates.krwToUsd;
  return krwAmount;
}

function fxConvert(amount, fromCur, toCur) {
  return fxFromKrw(fxToKrw(amount, fromCur), toCur);
}

function fxFormatAmount(value, cur) {
  const info = FX_CURRENCIES[cur];
  const decimals = info.decimals;
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  return (
    info.symbol +
    rounded.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

function fxParseAmountInput(raw) {
  const cleaned = String(raw || "").replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/* ---------- 畫面更新 ---------- */

function fxUpdateDisplay() {
  const fromInput = document.getElementById("fx-from-amount");
  const toDisplay = document.getElementById("fx-to-amount");
  const fromSelect = document.querySelector(
    '.fx-currency-select[data-side="from"]',
  );
  const toSelect = document.querySelector(
    '.fx-currency-select[data-side="to"]',
  );
  const caption = document.getElementById("fx-rate-caption");

  if (fromSelect) fromSelect.value = fxFromCurrency;
  if (toSelect) toSelect.value = fxToCurrency;

  if (toDisplay) {
    const converted = fxConvert(fxFromAmount, fxFromCurrency, fxToCurrency);
    toDisplay.textContent = fxFormatAmount(converted, fxToCurrency);
  }

  if (caption) {
    const oneUnit = fxConvert(1, fxFromCurrency, fxToCurrency);
    caption.textContent = `匯率：1 ${fxFromCurrency} ≈ ${oneUnit.toLocaleString("en-US", { maximumFractionDigits: 5 })} ${fxToCurrency}（僅供參考）`;
  }

  if (fromInput && document.activeElement !== fromInput) {
    fromInput.value = fxFromAmount.toLocaleString("en-US", {
      maximumFractionDigits: 4,
    });
  }
}

function fxHandleFromAmountInput(event) {
  fxFromAmount = fxParseAmountInput(event.target.value);
  fxUpdateDisplay();
}

function fxHandleCurrencyChange(event) {
  const side = event.target.dataset.side;
  const newVal = event.target.value;

  if (side === "from") {
    if (newVal === fxToCurrency) {
      fxToCurrency = fxFromCurrency; // 跟對面選到一樣，把對面換成原本這邊的幣別
    }
    fxFromCurrency = newVal;
  } else {
    if (newVal === fxFromCurrency) {
      fxFromCurrency = fxToCurrency;
    }
    fxToCurrency = newVal;
  }
  fxUpdateDisplay();
}

function fxHandleSwap() {
  const convertedNow = fxConvert(fxFromAmount, fxFromCurrency, fxToCurrency);
  const tmpCur = fxFromCurrency;
  fxFromCurrency = fxToCurrency;
  fxToCurrency = tmpCur;
  fxFromAmount = Math.round(convertedNow * 10000) / 10000;
  fxUpdateDisplay();
}

/* ---------- 自訂匯率 Modal ---------- */

function fxOpenRateModalPrefill() {
  const twdInput = document.getElementById("fx-rate-input-twd");
  const usdInput = document.getElementById("fx-rate-input-usd");
  if (twdInput) twdInput.value = fxRates.krwToTwd;
  if (usdInput) usdInput.value = fxRates.krwToUsd;
}

function fxApplyCustomRates() {
  const twdInput = document.getElementById("fx-rate-input-twd");
  const usdInput = document.getElementById("fx-rate-input-usd");
  const twdVal = parseFloat(twdInput ? twdInput.value : "");
  const usdVal = parseFloat(usdInput ? usdInput.value : "");

  if (!isNaN(twdVal) && twdVal > 0) fxRates.krwToTwd = twdVal;
  if (!isNaN(usdVal) && usdVal > 0) fxRates.krwToUsd = usdVal;

  fxSaveRates();
  fxUpdateDisplay();
}

function fxResetRates() {
  fxRates = { ...FX_DEFAULT_RATES };
  fxSaveRates();
  fxOpenRateModalPrefill();
  fxUpdateDisplay();
}

/* ---------- 進入點 ---------- */

function initExchangePage() {
  const converter = document.querySelector(".fx-converter-card");
  if (!converter) return; // 目前不是換匯頁

  fxLoadRates();
  fxFromCurrency = "KRW";
  fxToCurrency = "TWD";
  fxFromAmount = 1000;

  const fromInput = document.getElementById("fx-from-amount");
  if (fromInput && !fromInput.dataset.bound) {
    fromInput.dataset.bound = "1";
    fromInput.addEventListener("input", fxHandleFromAmountInput);
    fromInput.addEventListener("focus", (e) => {
      e.target.value = fxFromAmount; // 聚焦時顯示未加千分位的原始數字，方便編輯
    });
    fromInput.addEventListener("blur", fxUpdateDisplay);
  }

  document.querySelectorAll(".fx-currency-select").forEach((sel) => {
    if (sel.dataset.bound) return;
    sel.dataset.bound = "1";
    sel.addEventListener("change", fxHandleCurrencyChange);
  });

  const swapBtn = document.getElementById("fx-swap-btn");
  if (swapBtn && !swapBtn.dataset.bound) {
    swapBtn.dataset.bound = "1";
    swapBtn.addEventListener("click", fxHandleSwap);
  }

  const rateModal = document.getElementById("fxRateModal");
  if (rateModal && !rateModal.dataset.bound) {
    rateModal.dataset.bound = "1";
    rateModal.addEventListener("show.bs.modal", fxOpenRateModalPrefill);
  }

  const applyBtn = document.getElementById("fx-rate-apply-btn");
  if (applyBtn && !applyBtn.dataset.bound) {
    applyBtn.dataset.bound = "1";
    applyBtn.addEventListener("click", fxApplyCustomRates);
  }

  const resetBtn = document.getElementById("fx-rate-reset-btn");
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = "1";
    resetBtn.addEventListener("click", fxResetRates);
  }

  fxUpdateDisplay();
}

document.addEventListener("component:loaded", (event) => {
  if (event.detail.containerId === "page-container") {
    initExchangePage();
  }
});
