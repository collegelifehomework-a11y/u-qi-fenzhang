/*
 * u 起旅遊分帳｜app.js｜v0.2
 *
 * 此版本是前端介面與互動骨架，使用示範資料。
 * 正式 API 尚未接線。
 * 權限、金額算法及結算一律由 GAS 後端執行。
 */

(() => {
  "use strict";

  // API 連線設定
  // url 目前留空，代表尚未連接 GAS。
  // pollMs = 120000，代表預計每 2 分鐘同步一次。
  const API = { url: "", pollMs: 120000 };

  // 簡化版的 DOM 選取工具。
  // 例如 $(" #view ") 可以取得頁面中 id 為 view 的元素。
  const $ = (selector) => document.querySelector(selector);

  // 產生唯一識別碼，供旅行、支出等資料使用。
  // 優先使用 crypto.randomUUID()。
  // 若瀏覽器不支援，就使用時間戳記產生替代編號。
  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : "local-" + Date.now());

  // HTML 安全處理：
  // 將使用者輸入的特殊字元轉換成文字，
  // 避免輸入內容被瀏覽器當成 HTML 程式碼執行。
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  // 金額格式化工具。
  // currency 可以指定 TWD 或 JPY。
  // maximumFractionDigits: 0 表示不顯示小數位。
  const money = (value, currency) =>
    new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(Number(value) || 0);

 
  // 取得旅行所在地的當地日期，格式為 YYYY-MM-DD。
  // 修改日期：2026-11-11
  const today = (timezone = state.trip.timezone || "Asia/Taipei") => {
  // 依指定時區取得年月日，避免手機時區或 UTC 造成日期偏差。
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

  // 將年月日組合成 YYYY-MM-DD。
  const date = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${date.year}-${date.month}-${date.day}`;
};

  // 依照旅程所在地日期，自動判斷旅程目前的狀態。
  // 修改日期：2026-11-11
  const getTripStatus = (trip) => {
  // 舊資料若沒有開始或結束日期，先保留原本狀態。
  if (!trip.start || !trip.end) return trip.status || "準備中";

  // 使用這趟旅程設定的時區取得當地今天日期。
  const currentDate = today(trip.timezone || "Asia/Taipei");

  // 今天尚未到開始日期，旅程為準備中。
  if (currentDate < trip.start) return "準備中";

  // 今天已超過結束日期，旅程為已結束。
  if (currentDate > trip.end) return "已結束";

  // 今天介於開始與結束日期（含首尾），旅程進行中。
  return "進行中";
};

  // =========================
  // 2. 前端資料狀態
  // =========================

  // state 是目前前端使用的資料集合。
  // 目前資料存在瀏覽器記憶體中，重新整理頁面後會重置。
  const state = {

    // 目前顯示的頁面。
    page: "home",

    // 顯示主題：優先讀取瀏覽器儲存的設定，沒有就使用淺色。
    theme: localStorage.getItem("u-theme") || "light",

    // 目前選取的旅行資料。
    trip: {
      id: "demo-trip",
      name: "福岡自由行",
      start: "2026-10-04",
      end: "2026-10-09"
    },

    // 旅行清單，目前只有一筆示範資料。
    trips: [
      {
        id: "demo-trip",
        name: "福岡自由行",
        dates: "2026/10/04 – 10/09",
        status: "進行中",
        memberCount: 1,
        totalJPY: 0,
        totalTWD: 0
      }
    ],

    // 旅伴清單。
    members: [
      { id: "m1", name: "我", role: "主要管理者" },
      { id: "m2", name: "小安", role: "旅伴" },
      { id: "m3", name: "阿哲", role: "旅伴" }
    ],

    // 支出清單。
    // jpy 是日幣金額，twd 是台幣金額。
    // twd 為 null 代表台幣金額尚未補齊。
    expenses: [
      {
        id: "e1",
        tripId: "demo-trip",
        title: "晚餐",
        date: "2026-10-04",
        category: "餐飲",
        jpy: 4800,
        twd: 1056,
        method: "現金",
        payer: "我",
        split: "equal",
        status: "已確認"
      },
      {
        id: "e2",
        tripId: "demo-trip",
        title: "地鐵車票",
        date: "2026-10-05",
        category: "交通",
        jpy: 1200,
        twd: 264,
        method: "信用卡",
        payer: "小安",
        split: "equal",
        status: "已確認"
      },
      {
        id: "e3",
        tripId: "demo-trip",
        title: "便利商店",
        date: "2026-10-05",
        category: "購物",
        jpy: 860,
        twd: null,
        method: "現金",
        payer: "阿哲",
        split: "equal",
        status: "待補"
      }
    ],

    // 記帳日期排序方向：desc 為新到舊，asc 為舊到新。
    // 修改日期：2026-11-14
    bookkeepingSort: "desc",

    // 記錄目前收合的日期。
    // 修改日期：2026-11-14
    // 空陣列代表所有日期預設展開。
    bookkeepingCollapsedDates: [],

    // 目前選取的支出編號。
    // null 代表尚未選取任何支出。
    selectedExpenseId: null
  };

    // =========================
  // 3. 支出資料與統計工具
  // =========================
  
  // 取得目前旅程中尚未取消的支出紀錄。
  // 修改日期：2026-11-12
  const activeExpenses = () =>
    state.expenses.filter(
      (item) =>
        item.tripId === state.trip.id &&
      item.status !== "已取消"
    );
  
  // 計算所有有效支出的台幣總額。
  // 若台幣金額為空，則以 0 計算。
  const totalTwd = () =>
    activeExpenses().reduce(
      (sum, item) => sum + (Number(item.twd) || 0), 0
    );

  // 計算所有有效支出的日幣總額。
  const totalJpy = () =>
    activeExpenses().reduce(
      (sum, item) => sum + (Number(item.jpy) || 0), 0
    );


  // =========================
  // 4. 共用 HTML 畫面元件
  // =========================

  // 產生每個頁面上方的標題區塊。
  // eyebrow：英文小標題
  // title：主要標題
  // subtitle：補充說明，可留空。
  const pageHeader = (eyebrow, title, subtitle = "") =>
    '<div class="hero"><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1>' +
    (subtitle ? "<p>" + subtitle + "</p>" : "") + "</div>";

  // 產生切換頁面的按鈕。
  // label：按鈕顯示文字
  // page：按下後要前往的頁面名稱。
  const pageButton = (label, page) =>
    '<button class="btn secondary small" type="button" data-page="' + page + '">' + label + "</button>";


  // =========================
  // 5. 支出清單
  // =========================

  function expenseRows() {

    // 依目前選取的旅程篩選支出。
    // 修改日期：2026-11-12
    const tripExpenses = state.expenses.filter(
      (item) => item.tripId === state.trip.id
    );

    // 如果沒有任何支出資料，就顯示空白提示。
    if (!tripExpenses.length) {
      return '<div class="empty">還沒有支出紀錄</div>';
    }

    // 使用 map() 將每筆支出轉換成 HTML。
    // 每筆支出都會產生一個可點擊的卡片。
    return tripExpenses.map((item) =>

      '<button class="trip-card" type="button" data-expense="' + item.id + '">' +

      // 支出名稱、日期、分類與付款人。
      '<span><strong>' + escapeHtml(item.title) + '</strong><small>' +
      item.date + " · " +
      escapeHtml(item.category) + " · " +
      escapeHtml(item.payer) + "</small></span>" +

      // 顯示台幣金額。
      // 如果台幣金額尚未填寫，就顯示「待補」。
      '<span><strong>' +
      (item.twd == null ? "待補" : money(item.twd, "TWD")) +

      // 顯示支出狀態。
      '<\/strong><small class="pill ' +
      (item.status === "待補" ? "pending" : "") + '">' +
      item.status + "</small></span></button>"

    // 將所有支出卡片合併成一段 HTML。
    ).join("");
  }


  // =========================
  // 6. 首頁畫面
  // =========================

  function renderHome() {

    // 顯示首頁標題與介紹文字。
    return pageHeader(
      "U TRIP EXPENSES",
      "u 起旅遊分帳",
      "管理每一趟旅行，輕鬆記錄共同支出。"
    ) +

      // 建立旅行與加入旅行的按鈕。
      '<div class="actions"><button class="btn" data-action="new-trip">＋ 建立旅程</button>' +
      '<button class="btn secondary" data-action="join">加入旅程</button></div>' +

      // 顯示旅行清單標題與旅行數量。
      '<div class="section-head"><h2>我的旅程</h2><span class="pill">' +
      state.trips.length + " 趟旅程</span></div>" +

      // 將旅行清單轉換成可點擊的旅行卡片。
      state.trips.map((trip) =>
      '<button class="trip-card" data-action="select-trip" data-id="' + 
      escapeHtml(trip.id) + '">' +
      '<span class="trip-info">' +
      '<strong>' + escapeHtml(trip.name) + '</strong>' +
      '<small>' + trip.dates + ' · ' + getTripStatus(trip) + '</small>' +
      '<small>旅伴：' + trip.memberCount + ' 人</small>' +
      '<small>總花費：¥' +
      Number(trip.totalJPY).toLocaleString() +
      ' · NT$' +
      Number(trip.totalTWD).toLocaleString() +
      '</small>' +'</span>›' +'</button>'
    ).join("");

  }


  // =========================
  // 7. 旅行總覽畫面
  // =========================

  function renderTrip() {

    // 顯示旅行名稱、開始日期與結束日期。
    return '<div class="section-head">' +
    '<button class="btn" type="button" data-page="home">← 返回旅程列表</button>' +
    '</div>' +
    
    pageHeader(
      "TRIP OVERVIEW",
      escapeHtml(state.trip.name),
      state.trip.start + " – " + state.trip.end
    ) +

    // 編輯目前旅程的基本資料。
    // 修改日期：2026-11-12
    '<div class="section-head">' +
    '<span></span>' +
    '<button class="btn" type="button" data-action="edit-trip">編輯旅程</button>' +
    '</div>' +

      // 顯示台幣與日幣支出統計。

      // 顯示台幣與日幣支出統計。
      '<div class="grid"><div class="stat"><small>總支出・台幣</small><strong>' +
      money(totalTwd(), "TWD") +
      '</strong></div><div class="stat"><small>總支出・日幣</small><strong>' +
      money(totalJpy(), "JPY") + "</strong></div></div>" +

      // 顯示近期支出標題與新增支出按鈕。
      '<div class="section-head"><h2>近期支出</h2>' +
      pageButton("＋ 新增", "expense-new") + "</div>" +

      // 顯示支出清單。
      expenseRows() +

      // 顯示旅伴區域與管理成員按鈕。
      '<div class="section-head"><h2>旅伴</h2>' +
      pageButton("管理成員", "members") + "</div>" +

      // 將所有旅伴資料轉換成畫面上的成員項目。
      '<div class="card">' +
      state.members.map((member) =>
        '<div class="member"><span class="avatar">' +
        escapeHtml(member.name.slice(0, 1)) +
        '</span><span class="member-info"><strong>' +
        escapeHtml(member.name) +
        "</strong><small>" + escapeHtml(member.role) +
        "</small></span></div>"
      ).join("") + "</div>" +

      // 顯示新增支出與查看結算按鈕。
      '<div class="actions"><button class="btn" data-page="expense-new">＋ 新增支出</button>' +
      pageButton("查看結算", "settlement") + "</div>";
  }

   // =========================
  // 8. 新增支出表單畫面
  // =========================


  // =========================
  // 記帳列表畫面
  // 修改日期：2026-11-14
  // =========================

  function renderBookkeeping() {

    // 取得目前旅程的有效支出。
    const expenses = activeExpenses();

    // 依消費日期分組。
    const grouped = {};

    expenses.forEach((item) => {
      if (!grouped[item.date]) {
        grouped[item.date] = [];
      }

      grouped[item.date].push(item);
    });

    // 依目前設定的方向排列日期。
    // desc：新到舊；asc：舊到新。
    // 修改日期：2026-11-14
    const dates = Object.keys(grouped).sort((a, b) =>
      state.bookkeepingSort === "desc"
        ? b.localeCompare(a)
        : a.localeCompare(b)
    );

    // 沒有支出時顯示提示。
    const content = dates.length
      ? dates.map((date) =>
          '<div class="card">' +

    // 日期標題：點擊可展開或收合當日支出。
    // 修改日期：2026-11-14
          '<div class="section-head">' +
          '<button class="btn secondary small" type="button" ' +
          'data-action="toggle-bookkeeping-date" ' +
          'data-date="' + escapeHtml(date) + '">' +
          (state.bookkeepingCollapsedDates.includes(date) ? "＋" : "－") +
          ' ' + escapeHtml(date) +
          '</button>' +
          '</div>' +

            // 日期收合時不顯示當日支出。
            // 修改日期：2026-11-14
          (state.bookkeepingCollapsedDates.includes(date) ? [] : 
          grouped[date]).map((item) =>
            '<button class="trip-card" type="button" data-expense="' +
          escapeHtml(item.id) + '">' +
          '<span><strong>' + escapeHtml(item.title) +
          '</strong><small>' +
          escapeHtml(item.payer) + ' · ' +
          escapeHtml(item.method) +
          '</small></span>' +
          '<span><strong>¥' +
          Number(item.jpy).toLocaleString("zh-TW") +
          '</strong><small>' +
          (item.twd == null ? "台幣待補" : money(item.twd, "TWD")) +
          '</small></span>' +
          '</button>'
        ).join("") +
        '</div>'
      ).join("")
      : '<div class="empty">目前還沒有支出紀錄</div>';

    // 顯示記帳頁面與新增按鈕。
    return pageHeader(
      "BOOKKEEPING",
      "記帳紀錄",
      state.trip.name + "｜依消費日期整理"
    ) +

    // 記帳頁面操作區：提供排序切換及新增支出。
    // 記帳頁面操作區：標題靠左，操作按鈕靠右。
    // 修改日期：2026-11-15
      '<div class="section-head" style="display:flex; justify-content:space-between; align-items:center;">' +
      '<h2>所有支出</h2>' +
      '<div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">' +
      
      // 新增支出按鈕。
      '<button class="btn" type="button" data-action="new-expense">＋ 新增</button>' +

      // 日期排序小圖示，放在新增按鈕後方。
      // 修改日期：2026-11-15
      '<button class="btn secondary small" type="button" ' +
      'data-action="toggle-bookkeeping-sort" ' +
      'style="padding:4px 8px; font-size:12px;">' +
      (state.bookkeepingSort === "desc" ? "↑↓" : "↓↑") +
      '</button>' +

    '</div>' +

    '</div>' +
    
    content;
  }



  // ==========================================
  // 消費品項明細管理與狀態（新增支出使用）
  // 依 2026-11-19 / 2026-11-20 Notion 規格實作
  // ==========================================

  const expenseDraft = {
    mode: "direct", // "direct"（直接輸入總額）或 "itemized"（逐項記錄）
    items: [],
    expandedItemId: null
  };

  // 重置支出品項暫存
  function resetExpenseDraft(mode = "direct") {
    expenseDraft.mode = mode;
    expenseDraft.items = [];
    expenseDraft.expandedItemId = null;
  }

  // 四捨五入至小數點後一位
  const round1 = (num) => Math.round((Number(num) + Number.EPSILON) * 10) / 10;

  // 計算單一品項的原始小計、折扣與折後金額
  function getItemCalculations(item) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const gross = round1(qty * price);
    const discount = Number(item.discount) || 0;
    const net = Math.max(0, round1(gross - discount));
    return { gross, discount, net };
  }

  // 計算所有品項的合計（日圓）
  function calculateItemsTotal() {
    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;
    for (const item of expenseDraft.items) {
      const calc = getItemCalculations(item);
      totalGross = round1(totalGross + calc.gross);
      totalDiscount = round1(totalDiscount + calc.discount);
      totalNet = round1(totalNet + calc.net);
    }
    return {
      count: expenseDraft.items.length,
      totalGross,
      totalDiscount,
      totalNet
    };
  }

  // 產生單一品項卡片的 HTML
  function renderItemCard(item, index) {
    const isExpanded = expenseDraft.expandedItemId === item.id;
    const calc = getItemCalculations(item);

    if (!isExpanded) {
      // 收合狀態（依 2026-11-20 規格：僅顯示品項名稱與折後金額，不顯示數量與單價）
      return (
        '<div class="expense-item-card collapsed" data-item-id="' + escapeHtml(item.id) + '" data-index="' + index + '">' +
          '<div class="item-card-collapsed-row">' +
            '<span class="drag-handle" title="按住約 1.5 秒可拖曳排序" aria-label="拖曳手柄">⋮⋮</span>' +
            '<div class="item-summary-info">' +
              '<span class="item-summary-name">' + escapeHtml(item.name || "（未命名品項）") + '</span>' +
              '<span class="item-summary-net">¥' + calc.net.toLocaleString("zh-TW") + '</span>' +
            '</div>' +
            '<button type="button" class="item-delete-btn" data-action="delete-item" data-id="' + escapeHtml(item.id) + '" title="刪除品項" aria-label="刪除品項">🗑️</button>' +
          '</div>' +
        '</div>'
      );
    }

    // 展開狀態：完整編輯欄位，底部僅設「儲存」按鈕（依 2026-11-20 規格不設「取消」按鈕）
    return (
      '<div class="expense-item-card expanded" data-item-id="' + escapeHtml(item.id) + '" data-index="' + index + '">' +
        '<div class="item-card-header">' +
          '<span class="item-card-title">品項 #' + (index + 1) + '</span>' +
          '<button type="button" class="item-delete-btn-header" data-action="delete-item" data-id="' + escapeHtml(item.id) + '" title="刪除品項" aria-label="刪除品項">🗑️ 刪除</button>' +
        '</div>' +

        '<div class="item-form-body">' +
          '<div class="field item-field-group">' +
            '<label>品項名稱 <span class="required-star">*</span></label>' +
            '<input type="text" class="item-input-name" maxlength="80" value="' + escapeHtml(item.name || "") + '" placeholder="例如：博多拉麵">' +
            '<small class="item-error error-name"></small>' +
          '</div>' +

          '<div class="form-grid">' +
            '<div class="field item-field-group">' +
              '<label>數量 <span class="required-star">*</span></label>' +
              '<input type="number" class="item-input-qty" step="0.1" min="0.1" inputmode="decimal" value="' + (item.quantity !== undefined && item.quantity !== "" ? item.quantity : "") + '" placeholder="例如：1">' +
              '<small class="item-error error-qty"></small>' +
            '</div>' +

            '<div class="field item-field-group">' +
              '<label>單位 <span class="optional-hint">(選填)</span></label>' +
              '<input type="text" class="item-input-unit" maxlength="10" value="' + escapeHtml(item.unit || "") + '" placeholder="例如：碗、份、個">' +
            '</div>' +
          '</div>' +

          '<div class="form-grid">' +
            '<div class="field item-field-group">' +
              '<label>單價 (日圓) <span class="required-star">*</span></label>' +
              '<input type="number" class="item-input-price" step="0.1" min="0.1" inputmode="decimal" value="' + (item.unitPrice !== undefined && item.unitPrice !== "" ? item.unitPrice : "") + '" placeholder="例如：950">' +
              '<small class="item-error error-price"></small>' +
            '</div>' +

            '<div class="field item-field-group">' +
              '<label>品項折扣 (日圓) <span class="optional-hint">(選填)</span></label>' +
              '<input type="number" class="item-input-discount" step="0.1" min="0" inputmode="decimal" value="' + (item.discount !== undefined ? item.discount : 0) + '" placeholder="0">' +
              '<small class="item-error error-discount"></small>' +
            '</div>' +
          '</div>' +

          '<div class="field item-field-group">' +
            '<label>備註 <span class="optional-hint">(選填)</span></label>' +
            '<input type="text" class="item-input-note" maxlength="100" value="' + escapeHtml(item.note || "") + '" placeholder="選填備註，如口味、贈品等">' +
          '</div>' +

          '<div class="item-calc-preview">' +
            '<span>原始：<b class="calc-gross">¥' + calc.gross.toLocaleString("zh-TW") + '</b></span>' +
            '<span>折抵：<b class="calc-discount">-¥' + calc.discount.toLocaleString("zh-TW") + '</b></span>' +
            '<span class="calc-net-total">折後：<b class="calc-net">¥' + calc.net.toLocaleString("zh-TW") + '</b></span>' +
          '</div>' +

          '<div class="item-card-actions">' +
            '<button type="button" class="btn small" data-action="save-item" data-id="' + escapeHtml(item.id) + '">儲存</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // 產生所有品項卡片 HTML
  function renderExpenseItemsListHtml() {
    if (expenseDraft.items.length === 0) {
      return '<div class="item-empty-tip">尚未加入品項，點擊下方「＋ 新增品項」開始記錄。</div>';
    }
    return expenseDraft.items.map((item, index) => renderItemCard(item, index)).join("");
  }

  // 更新品項列表 DOM 與總額
  function updateExpenseItemsDOM() {
    const listEl = document.getElementById("expense-items-list");
    if (listEl) {
      listEl.innerHTML = renderExpenseItemsListHtml();
    }
    updateExpenseTotalsUI();
    initItemDragAndDrop();
  }

  // 更新品項統計與日幣消費總額輸入框
  function updateExpenseTotalsUI() {
    const totals = calculateItemsTotal();
    const countEl = document.getElementById("summary-items-count");
    const totalEl = document.getElementById("summary-items-total");
    const jpyInput = document.querySelector('#expense-form input[name="jpy"]');
    const hintEl = document.getElementById("expense-jpy-hint");

    if (countEl) countEl.textContent = totals.count;
    if (totalEl) totalEl.textContent = "¥" + totals.totalNet.toLocaleString("zh-TW");

    if (jpyInput && expenseDraft.mode === "itemized") {
      jpyInput.value = totals.totalNet > 0 ? totals.totalNet : (totals.count > 0 ? 0 : "");
      jpyInput.readOnly = true;
      jpyInput.classList.add("readonly-calc");
      if (hintEl) hintEl.textContent = "逐項記錄模式：由下方品項折後金額自動加總。";
    }
  }

  // 切換消費記錄模式（直接輸入總額 vs 逐項記錄）
  function setExpenseMode(mode) {
    expenseDraft.mode = mode;
    const itemizedSection = document.getElementById("itemized-section");
    const jpyInput = document.querySelector('#expense-form input[name="jpy"]');
    const hintEl = document.getElementById("expense-jpy-hint");
    const splitSelect = document.querySelector('#expense-form select[name="split"]');
    const choices = document.querySelectorAll(".expense-mode-toggle .choice");

    choices.forEach((c) => {
      const radio = c.querySelector('input[type="radio"]');
      if (radio) {
        c.classList.toggle("active", radio.value === mode);
      }
    });

    if (mode === "itemized") {
      if (itemizedSection) itemizedSection.hidden = false;
      if (jpyInput) {
        jpyInput.readOnly = true;
        jpyInput.classList.add("readonly-calc");
      }
      if (hintEl) hintEl.textContent = "逐項記錄模式：由下方品項折後金額自動加總。";
      if (splitSelect) {
        const itemSplitOpt = splitSelect.querySelector('option[value="items"]');
        if (itemSplitOpt) itemSplitOpt.disabled = false;
      }
      // 若尚未有品項，自動新增一筆並展開
      if (expenseDraft.items.length === 0) {
        const newItem = {
          id: uid(),
          name: "",
          quantity: 1,
          unit: "",
          unitPrice: "",
          discount: 0,
          note: ""
        };
        expenseDraft.items.push(newItem);
        expenseDraft.expandedItemId = newItem.id;
      }
      updateExpenseItemsDOM();
    } else {
      // 直接輸入總額模式
      if (itemizedSection) itemizedSection.hidden = true;
      if (jpyInput) {
        jpyInput.readOnly = false;
        jpyInput.classList.remove("readonly-calc");
      }
      if (hintEl) hintEl.textContent = "最多一位小數。";
      if (splitSelect) {
        const itemSplitOpt = splitSelect.querySelector('option[value="items"]');
        if (itemSplitOpt) {
          itemSplitOpt.disabled = true;
          if (splitSelect.value === "items") {
            splitSelect.value = "equal";
          }
        }
      }
    }
  }

  // 儲存單一品項卡片並驗證
  function saveItemFromCard(card) {
    if (!card) return true;
    const itemId = card.dataset.itemId;
    const item = expenseDraft.items.find((it) => it.id === itemId);
    if (!item) return true;

    const nameInput = card.querySelector(".item-input-name");
    const qtyInput = card.querySelector(".item-input-qty");
    const unitInput = card.querySelector(".item-input-unit");
    const priceInput = card.querySelector(".item-input-price");
    const discountInput = card.querySelector(".item-input-discount");
    const noteInput = card.querySelector(".item-input-note");

    const nameVal = (nameInput ? nameInput.value : "").trim();
    const qtyVal = (qtyInput ? qtyInput.value : "").trim();
    const unitVal = (unitInput ? unitInput.value : "").trim();
    const priceVal = (priceInput ? priceInput.value : "").trim();
    const discountVal = (discountInput ? discountInput.value : "").trim();
    const noteVal = (noteInput ? noteInput.value : "").trim();

    // 清除舊的錯誤提示與紅框
    card.querySelectorAll(".item-error").forEach((el) => { el.textContent = ""; });
    card.querySelectorAll(".has-error").forEach((el) => { el.classList.remove("has-error"); });

    const errors = {};

    // 1. 品項名稱驗證：必填
    if (!nameVal) {
      errors.name = "請輸入品項名稱";
    }

    // 2. 數量驗證：必填且大於 0，最多 1 位小數
    if (!qtyVal) {
      errors.qty = "請輸入數量";
    } else if (!/^(0|[1-9]\d*)(\.\d)?$/.test(qtyVal) || Number(qtyVal) <= 0) {
      errors.qty = "數量必須大於 0，最多一位小數";
    }

    // 3. 單價驗證：必填且大於 0，最多 1 位小數
    if (!priceVal) {
      errors.price = "請輸入單價";
    } else if (!/^(0|[1-9]\d*)(\.\d)?$/.test(priceVal) || Number(priceVal) <= 0) {
      errors.price = "單價必須大於 0，最多一位小數";
    }

    // 4. 品項折扣驗證：選填，非負數且不可大於品項金額
    if (discountVal !== "") {
      if (!/^(0|[1-9]\d*)(\.\d)?$/.test(discountVal) || Number(discountVal) < 0) {
        errors.discount = "折扣不可小於 0，最多一位小數";
      } else if (!errors.qty && !errors.price) {
        const gross = round1(Number(qtyVal) * Number(priceVal));
        if (Number(discountVal) > gross) {
          errors.discount = "折扣不可大於品項金額 (¥" + gross + ")";
        }
      }
    }

    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      // 顯示錯誤訊息與紅框
      errorKeys.forEach((key) => {
        const errEl = card.querySelector(".error-" + key);
        const inpEl = card.querySelector(".item-input-" + key);
        if (errEl) errEl.textContent = errors[key];
        if (inpEl) inpEl.classList.add("has-error");
      });

      // 依 Notion 規格：卡片保持展開，自動捲動至第一個錯誤欄位並聚焦
      const firstKey = errorKeys[0];
      const firstInput = card.querySelector(".item-input-" + firstKey);
      if (firstInput) {
        firstInput.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInput.focus();
      }
      return false;
    }

    // 驗證通過：更新品項資料
    item.name = nameVal;
    item.quantity = Number(qtyVal);
    item.unit = unitVal;
    item.unitPrice = Number(priceVal);
    item.discount = discountVal === "" ? 0 : Number(discountVal);
    item.note = noteVal;

    // 自動收合卡片
    expenseDraft.expandedItemId = null;
    updateExpenseItemsDOM();
    showToast("品項已儲存");
    return true;
  }

  // ==========================================
  // 品項長按 1.5 秒拖曳排序與展開收合管理
  // ==========================================

  let dragTimer = null;
  let dragActive = false;
  let draggedItemElement = null;
  let dragPlaceholder = null;
  let dragPointerStartX = 0;
  let dragPointerStartY = 0;
  let isPointerDown = false;
  let dragMoved = false;
  let activePointerId = null;
  let activeCaptureTarget = null;

  function initItemDragAndDrop() {
    const listContainer = document.getElementById("expense-items-list");
    if (!listContainer || listContainer.dataset.dragInitialized) return;
    listContainer.dataset.dragInitialized = "true";

    listContainer.addEventListener("pointerdown", (e) => {
      // 排除按鈕、輸入框、下拉選單等互動元件
      if (e.target.closest("button, input, select, textarea, .item-delete-btn, .item-delete-btn-header")) return;

      const card = e.target.closest(".expense-item-card");
      if (!card) return;

      isPointerDown = true;
      dragMoved = false;
      dragPointerStartX = e.clientX;
      dragPointerStartY = e.clientY;
      activePointerId = e.pointerId != null ? e.pointerId : null;
      activeCaptureTarget = card;

      // 若卡片處於展開狀態，或有任何卡片展開：
      if (card.classList.contains("expanded") || expenseDraft.expandedItemId !== null) {
        // 依 2026-11-20 規格：若卡片仍處於展開編輯狀態，長按 1.5 秒不啟動拖曳，提示「請先收合品項卡片」
        dragTimer = setTimeout(() => {
          showToast("請先收合品項卡片");
          dragTimer = null;
        }, 1500);
        return;
      }

      // 收合狀態的卡片：長按 1.5 秒進入拖曳排序模式
      dragTimer = setTimeout(() => {
        dragActive = true;
        draggedItemElement = card;
        card.classList.add("is-dragging");

        // 啟用 Pointer Capture 確保指標移出容器外放開也能正常收到事件
        if (e.pointerId != null && card.setPointerCapture) {
          try {
            card.setPointerCapture(e.pointerId);
          } catch (_) {}
        }

        if (navigator.vibrate) {
          try { navigator.vibrate(50); } catch (_) {}
        }

        // 依 2026-11-20 規格：原位置顯示虛線空位
        dragPlaceholder = document.createElement("div");
        dragPlaceholder.className = "drag-placeholder";
        dragPlaceholder.style.height = (card.offsetHeight || 52) + "px";

        card.parentNode.insertBefore(dragPlaceholder, card);
        dragTimer = null;
      }, 1500);
    });

    const onPointerMove = (e) => {
      if (!isPointerDown) return;

      // 手勢位移容錯（8px）：若在長按前移動，取消長按定時器（允許正常滾動頁面）
      if (dragTimer) {
        const dist = Math.hypot(e.clientX - dragPointerStartX, e.clientY - dragPointerStartY);
        if (dist > 8) {
          clearTimeout(dragTimer);
          dragTimer = null;
          dragMoved = true;
        }
      }

      // 拖曳模式中：即時更新虛線佔位空位位置
      if (dragActive && draggedItemElement && dragPlaceholder) {
        e.preventDefault();

        const siblingCards = Array.from(listContainer.querySelectorAll(".expense-item-card:not(.is-dragging)"));
        let insertBeforeNode = null;

        for (const sibling of siblingCards) {
          const rect = sibling.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (e.clientY < midY) {
            insertBeforeNode = sibling;
            break;
          }
        }

        if (insertBeforeNode) {
          listContainer.insertBefore(dragPlaceholder, insertBeforeNode);
        } else {
          listContainer.appendChild(dragPlaceholder);
        }
      }
    };

    const endDragOrPress = (e) => {
      if (!isPointerDown) return;
      isPointerDown = false;

      // 釋放 Pointer Capture
      if (activePointerId != null && activeCaptureTarget && activeCaptureTarget.releasePointerCapture) {
        try {
          activeCaptureTarget.releasePointerCapture(activePointerId);
        } catch (_) {}
      }
      activePointerId = null;
      activeCaptureTarget = null;

      // 短按放開（未滿 1.5 秒且非滾動移動）
      if (dragTimer) {
        clearTimeout(dragTimer);
        dragTimer = null;

        if (!dragMoved && e && e.target) {
          const card = e.target.closest(".expense-item-card");
          if (card) {
            const cardId = card.dataset.itemId;
            // 點擊已展開卡片收合前：依規格先驗證保存，若失敗維持展開並定位錯誤欄位，不得因收合遺失修改
            if (expenseDraft.expandedItemId === cardId) {
              if (!saveItemFromCard(card)) {
                return; // 驗證未通過，保持原卡片展開
              }
            } else {
              // 點擊收合卡片展開前，若原本有其他卡片展開，先驗證並儲存
              if (expenseDraft.expandedItemId) {
                const prevCard = listContainer.querySelector(".expense-item-card.expanded");
                if (prevCard && !saveItemFromCard(prevCard)) {
                  return; // 原卡片有驗證錯誤，保持原卡片展開
                }
              }
              expenseDraft.expandedItemId = cardId;
              updateExpenseItemsDOM();
            }
          }
        }
        return;
      }

      // 拖曳結束（放開後更新排序）
      if (dragActive && draggedItemElement && dragPlaceholder) {
        dragActive = false;

        const siblingCards = Array.from(listContainer.querySelectorAll(".expense-item-card:not(.is-dragging)"));
        let targetIndex = 0;
        for (const sib of siblingCards) {
          if (dragPlaceholder.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_PRECEDING) {
            targetIndex++;
          }
        }

        const oldIndex = Number(draggedItemElement.dataset.index);

        draggedItemElement.classList.remove("is-dragging");
        if (dragPlaceholder.parentNode) {
          dragPlaceholder.parentNode.removeChild(dragPlaceholder);
        }
        dragPlaceholder = null;
        draggedItemElement = null;

        if (oldIndex >= 0 && targetIndex >= 0 && targetIndex !== oldIndex) {
          const [movedItem] = expenseDraft.items.splice(oldIndex, 1);
          expenseDraft.items.splice(targetIndex, 0, movedItem);
          showToast("排序已更新");
        }

        updateExpenseItemsDOM();
      }

      // 保證所有拖曳暫態旗標徹底清除，避免殘留
      dragActive = false;
      if (draggedItemElement) {
        draggedItemElement.classList.remove("is-dragging");
        draggedItemElement = null;
      }
      if (dragPlaceholder) {
        if (dragPlaceholder.parentNode) {
          dragPlaceholder.parentNode.removeChild(dragPlaceholder);
        }
        dragPlaceholder = null;
      }
    };

    // 綁定指標移動與結束事件（於 window 全域監聽，保證移出容器或視窗失焦時皆能安全結束）
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDragOrPress);
    window.addEventListener("pointercancel", endDragOrPress);
    window.addEventListener("blur", () => {
      if (isPointerDown || dragActive) {
        endDragOrPress();
      }
    });
  }

  // =========================
  // 8. 新增支出表單畫面
  // =========================

  function renderExpenseForm() {
    // 修改日期：2026-11-20
    // 新增支出表單：支援逐項記錄與直接輸入總額兩種模式

    const isItemized = expenseDraft.mode === "itemized";
    const totals = calculateItemsTotal();
    const jpyVal = isItemized ? (totals.totalNet > 0 ? totals.totalNet : "") : "";

    return (
      pageHeader("NEW EXPENSE", "新增支出", "先記錄消費，再確認付款與分帳細節。") +
      '<form id="expense-form" class="card form">' +
      '<div class="expense-basic-info">' +

      // 一、基本資料
      '<h3>基本資料</h3>' +
      '<div class="field"><label for="expense-title">支出名稱</label>' +
      '<input id="expense-title" name="title" required maxlength="80" placeholder="例如：博多拉麵"></div>' +

      '<div class="form-grid">' +
      '<div class="field"><label>消費日期</label>' +
      '<input name="date" type="date" value="' + today(state.trip.timezone) + '" required></div>' +

      '<div class="field"><label>支出分類</label>' +
      '<select name="category">' +
      '<option value="餐飲">餐飲</option>' +
      '<option value="交通">交通</option>' +
      '<option value="住宿">住宿</option>' +
      '<option value="購物">購物</option>' +
      '<option value="門票">門票</option>' +
      '<option value="其他">其他</option>' +
      '</select></div></div>' +
      '</div>' +

      // 二、消費明細
      '<h3>消費明細</h3>' +

      '<div class="field">' +
      '<label>記錄模式</label>' +
      '<div class="expense-mode-toggle">' +
      '<label class="choice ' + (!isItemized ? "active" : "") + '">' +
      '<input type="radio" name="expense-mode" value="direct" ' + (!isItemized ? "checked" : "") + '> 直接輸入總額' +
      '</label>' +
      '<label class="choice ' + (isItemized ? "active" : "") + '">' +
      '<input type="radio" name="expense-mode" value="itemized" ' + (isItemized ? "checked" : "") + '> 逐項記錄' +
      '</label>' +
      '</div></div>' +

      '<div class="field">' +
      '<label for="expense-jpy">日幣消費總額</label>' +
      '<input id="expense-jpy" name="jpy" inputmode="decimal" required placeholder="例如 1500.5" value="' + jpyVal + '" ' + (isItemized ? 'readonly class="readonly-calc"' : "") + '>' +
      '<small id="expense-jpy-hint" class="hint">' + (isItemized ? "逐項記錄模式：由下方品項折後金額自動加總。" : "最多一位小數。") + '</small></div>' +

      '<div id="itemized-section" ' + (!isItemized ? "hidden" : "") + '>' +
      '<div class="itemized-summary">' +
      '<div class="itemized-summary-grid">' +
      '<div><small>品項數</small><strong id="summary-items-count">' + totals.count + '</strong></div>' +
      '<div><small>品項折後總計</small><strong id="summary-items-total">¥' + totals.totalNet.toLocaleString("zh-TW") + '</strong></div>' +
      '</div>' +
      '<div class="itemized-calc-hint"><small class="hint">長按卡片約 1.5 秒可拖曳排序；短按可展開／收合編輯。</small></div>' +
      '</div>' +

      '<div id="expense-items-list" class="expense-items-list">' +
      renderExpenseItemsListHtml() +
      '</div>' +

      '<button type="button" class="btn secondary small" data-action="add-item" style="width: 100%; margin-top: 6px;">＋ 新增品項</button>' +
      '</div>' +

      // 三、付款資訊
      '<h3>付款資訊</h3>' +
      '<div class="field payment-method"><label>付款方式</label>' +
      '<label class="choice"><input type="radio" name="method" value="現金" checked>現金</label>' +
      '<label class="choice"><input type="radio" name="method" value="信用卡">信用卡</label></div>' +

      '<div class="form-grid">' +
      '<div class="field"><label>實際台幣金額</label>' +
      '<input name="twd" type="number" min="0" step="1" placeholder="待補可留空"></div>' +

      '<div class="field"><label>付款人</label>' +
      '<select name="payer">' +
      state.members.map((member) =>
        '<option value="' + escapeHtml(member.name) + '">' +
        escapeHtml(member.name) + '</option>'
      ).join("") +
      '</select></div></div>' +

      // 四、折扣與回饋
      '<h3>折扣與回饋</h3>' +
      '<div id="credit-card-reward-fields" hidden>' +
      '<div class="form-grid">' +
      '<div class="field">' +
      '<label>折扣金額</label>' +
      '<input name="discount" type="number" min="0" step="0.1" value="0">' +
      '<small class="hint">折扣明細及分配計算將於下一階段實作。</small></div>' +

      '<div class="field">' +
      '<label>信用卡回饋點數</label>' +
      '<input name="reward" type="number" min="0" step="1" value="0">' +
      '</div>' +
      '</div>' +

      '<div class="field">' +
      '<label>回饋分配方式</label>' +
      '<select name="rewardAllocation">' +
      '<option value="proportional">依各旅伴實際消費比例分配</option>' +
      '<option value="cardholder">全部歸刷卡人</option>' +
      '</select></div>' +
      '</div>' +

      // 五、分攤方式
      '<h3>分攤方式</h3>' +
      '<div class="field">' +
      '<select name="split">' +
      '<option value="equal">平均分攤</option>' +
      '<option value="exact">自訂金額</option>' +
      '<option value="items" ' + (!isItemized ? "disabled" : "") + '>依品項分攤</option>' +
      '</select>' +
      '<small class="hint">分攤計算與品項明細互動將於下一階段實作。</small></div>' +

      // 儲存
      '<button class="btn" type="submit">儲存支出（本機示範）</button>' +
      '</form>'
    );
  }



  // =========================
  // 9. 支出詳細資料畫面
  // =========================

  function renderExpenseDetail() {

    // 根據目前選取的支出 ID，尋找對應資料。
    const item = state.expenses.find(
      (expense) => expense.id === state.selectedExpenseId
    );

    // 找不到資料時，顯示提示與返回按鈕。
    if (!item) return '<div class="empty">找不到這筆支出。<button class="btn" data-page="trip">返回</button></div>';

    // 顯示返回按鈕、支出名稱、日期與分類。
    return '<button class="back" data-page="trip">← 返回旅行總覽</button>' +
      pageHeader("EXPENSE DETAIL", escapeHtml(item.title), item.date + " · " + escapeHtml(item.category)) +

      // 顯示支出詳細資料。
      '<div class="card">' +

      // 日幣金額。
      '<div class="row"><span>日幣金額</span><strong>' +
      money(item.jpy, "JPY") + "</strong></div>" +

      // 台幣金額；如果尚未填寫就顯示「待補」。
      '<div class="row"><span>台幣金額</span><strong>' +
      (item.twd == null ? "待補" : money(item.twd, "TWD")) + "</strong></div>" +

      // 付款方式。
      '<div class="row"><span>付款方式</span><strong>' +
      escapeHtml(item.method) + "</strong></div>" +

      // 付款人。
      '<div class="row"><span>付款人</span><strong>' +
      escapeHtml(item.payer) + "</strong></div>" +

      // 分攤方式。
      (item.split
        ? '<div class="row"><span>分攤方式</span><strong>' +
          escapeHtml(item.split === "items" ? "依品項分攤" : item.split === "exact" ? "自訂金額" : "平均分攤") +
          "</strong></div>"
        : "") +

      // 顯示實際記帳時間，依旅行所在地時區呈現。
      // 修改日期：2026-11-11
      '<div class="row"><span>記帳時間</span><strong>' +
      (item.recordedAt
        ? new Intl.DateTimeFormat("zh-TW", {
          timeZone: state.trip.timezone || "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }).format(new Date(item.recordedAt))
        : "未記錄") + "</strong></div>" +

      // 支出狀態。
      '<div class="row"><span>狀態</span><strong>' +
      escapeHtml(item.status) + "</strong></div></div>" +

      // 顯示消費品項明細（若有逐項記錄資料）
      (item.items && item.items.length > 0
        ? '<div class="card"><h3>消費品項明細</h3>' +
          item.items.map((it) =>
            '<div class="row">' +
            '<span><strong>' + escapeHtml(it.name) + '</strong><br>' +
            '<small class="hint">' + it.quantity + (it.unit ? escapeHtml(it.unit) : "") + ' × ¥' + Number(it.unitPrice).toLocaleString("zh-TW") +
            (it.discount > 0 ? '（折抵 ¥' + Number(it.discount).toLocaleString("zh-TW") + '）' : '') +
            (it.note ? ' · ' + escapeHtml(it.note) : '') +
            '</small></span>' +
            '<strong>¥' + Number(it.net).toLocaleString("zh-TW") + '</strong>' +
            '</div>'
          ).join("") +
          '</div>'
        : '') +

      // 提供取消這筆示範支出的按鈕。
      '<div class="actions"><button class="btn danger" data-action="cancel-expense" data-id="' +
      item.id + '">取消示範支出</button></div>' +

      // 提醒正式付款明細與分帳結果尚未連接後端。
      '<p class="hint">正式付款明細與分帳結果尚待後端 API 對接。</p>';
  }


  // =========================
  // 10. 還款與退款畫面
  // =========================

  function renderRepayments() {

    // 顯示還款與退款頁面的標題及說明。
    return pageHeader("REPAYMENTS & REFUNDS", "還款與退款", "追蹤每位旅伴的應付、已付與退款確認。") +

      // 目前尚未串接後端，因此只顯示功能說明。
      '<div class="card"><p>正式還款與退款資料將由後端提供。</p><p class="hint">此頁目前沒有建立示範債務，避免將假數字誤認為真實欠款。</p></div>';
  }


  // =========================
  // 11. 結算中心畫面
  // =========================

  function renderSettlement() {

    // 顯示結算中心標題與說明。
    return pageHeader("SETTLEMENT", "結算中心", "確認總額、查看付款計畫，逐筆完成收付款。") +

      // 顯示目前已記錄的台幣總金額。
      '<div class="grid"><div class="stat"><small>已記錄台幣金額</small><strong>' +
      money(totalTwd(), "TWD") +

      // 顯示目前結算狀態。
      '</strong></div><div class="stat"><small>結算狀態</small><strong>尚未確認</strong></div></div>' +

      // 提醒目前尚未建立正式結算快照。
      '<div class="card"><span class="pill pending">尚未建立結算快照</span><p>需先補齊待補付款與匯率，再由後端依正式規格產生付款計畫。</p>' +

      // 前端示範畫面不自行計算真實債務。
      '<p class="hint">此示範畫面不自行推算真實債務。</p></div>' +

      // 提供前往還款與退款頁面的按鈕。
      pageButton("查看還款與退款", "repayments");
  }


  // =========================
  // 12. 旅伴管理畫面
  // =========================

  function renderMembers() {

    // 顯示旅伴管理頁面的標題與說明。
    return pageHeader("TRAVEL MEMBERS", "旅伴管理", "查看成員並邀請旅伴加入同一本旅行帳本。") +

      // 將所有旅伴資料轉換成畫面上的成員項目。
      '<div class="card">' + state.members.map((member, index) =>

        // 顯示成員頭像、名稱與角色。
        '<div class="member"><span class="avatar">' +
        escapeHtml(member.name.slice(0, 1)) +
        '</span><span class="member-info"><strong>' +
        escapeHtml(member.name) +
        "</strong><small>" + escapeHtml(member.role) + "</small></span>" +

        // 第一位成員額外顯示「你」的標籤。
        (index === 0 ? '<span class="pill">你</span>' : "") + "</div>"

      // 合併所有成員項目，並提供產生示範邀請碼的按鈕。
      ).join("") + "</div><div class=\"actions\"><button class=\"btn\" data-action=\"invite\">產生示範邀請碼</button></div>";
  }


  // =========================
  // 13. 旅行設定畫面
  // =========================

  function renderSettings() {

    // 顯示旅行設定頁面的標題與說明。
    return pageHeader("PREFERENCES", "旅行設定", "調整外觀與同步偏好。") +

      // 顯示模式設定。
      '<div class="card"><div class="row"><strong>顯示模式</strong><select id="theme-select">' +

      // 根據目前主題設定，決定淺色模式是否被選取。
      '<option value="light" ' + (state.theme === "light" ? "selected" : "") + '>淺色</option>' +

      // 根據目前主題設定，決定深色模式是否被選取。
      '<option value="dark" ' + (state.theme === "dark" ? "selected" : "") + '>深色</option></select></div>' +

      // 顯示自動同步頻率，目前仍待串接。
      '<div class="row"><strong>自動同步</strong><span class="pill pending">每 2 分鐘・待串接</span></div>' +

      // 顯示目前前端版本。
      '<div class="row"><strong>目前版本</strong><span>前端 v0.2</span></div>' +

      // 說明正式版資料會由 GAS 後端驗證並儲存。
      '<p>正式版資料將由 GAS 驗證 Token、角色權限與資料版本後存入 Google Sheets。</p></div>';
  }

  // ========================
  // // 行程頁面
  // // =========================
// =========================
// 每日行程頁面
// 修改日期：2026-11-14
// =========================

function renderItinerary() {

  // 顯示目前旅程名稱與行程頁標題。
  return pageHeader(
    "TRAVEL ITINERARY",
    "每日行程",
    state.trip.name + "｜安排每天的景點與交通"
  ) +

  // 每日行程主要內容區域。
  '<div class="card">' +

    // 行程區塊標題。
    '<div class="section-head">' +
      '<h2>每日行程</h2>' +
    '</div>' +

    // 尚未建立行程時顯示的提示。
    '<div class="empty">' +
      '目前尚未安排每日行程' +
    '</div>' +

  '</div>';
}


  // =========================
  // 14. 頁面函式對照表
  // =========================

  // 將頁面名稱對應到負責產生該頁面的函式。
  // 切換頁面時，會根據 state.page 找到對應函式。
  const renderers = {
    home: renderHome,
    trip: renderTrip,
    itinerary: renderItinerary,
    bookkeeping: renderBookkeeping,// 修改日期：2026-11-14
    "expense-new": renderExpenseForm,
    "expense-detail": renderExpenseDetail,
    repayments: renderRepayments,
    settlement: renderSettlement,
    members: renderMembers,
    settings: renderSettings
  };


  // =========================
  // 15. 更新畫面
  // =========================

  function render() {

    // 將目前選擇的主題套用到整個網頁。
    document.documentElement.dataset.theme = state.theme;

    // 執行目前頁面對應的函式，並將產生的 HTML 放進 #view。
    // 如果頁面名稱不存在，就改為顯示首頁。
    $("#view").innerHTML = (renderers[state.page] || renderHome)();
    $(".bottom-nav").hidden = state.page === "home";
    // 更新底部導覽列的選取狀態。
    document.querySelectorAll(".nav-item").forEach((button) => {

      // 如果導覽按鈕對應目前頁面，就加入 active 樣式。
      // 支出詳細頁也會讓旅行總覽按鈕保持選取狀態。
      button.classList.toggle("active", button.dataset.page === state.page ||
        (state.page === "expense-detail" && button.dataset.page === "trip"));
    });

    // 確保新增支出畫面渲染時拖曳事件被初始化
    initItemDragAndDrop();
  }


  // =========================
  // 16. 切換頁面
  // =========================

  function navigate(page) {

    // 切換至新增支出時，重置品項草稿
    if (page === "expense-new") {
      resetExpenseDraft("direct");
    }

    // 確認目標頁面存在，不存在時返回首頁。
    state.page = renderers[page] ? page : "home";

    // 重新產生頁面內容。
    render();

    // 切換頁面後，平滑捲動至網頁頂端。
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  // =========================
  // 17. 顯示提示訊息
  // =========================

  function showToast(message) {

    // 取得提示訊息的 HTML 元素。
    const toast = $("#toast");

    // 設定提示文字。
    toast.textContent = message;

    // 加入 show 樣式，讓提示訊息顯示出來。
    toast.classList.add("show");

    // 2.3 秒後移除 show 樣式，隱藏提示訊息。
    window.setTimeout(() => toast.classList.remove("show"), 2300);
  }


  // =========================
  // 18. 開啟對話視窗
  // =========================


// 顯示共用彈出視窗。
  function showDialog(markup) {

  // 取得彈出視窗內容區域。
    const content = $("#dialog-content");

  // 放入原本的視窗內容。
    content.innerHTML = markup;

  // 找出視窗標題。
    // 修改日期：2026-11-14
    // 同時支援 h1、h2 作為彈窗標題。
    const title = content.querySelector("h2, h1");

    // 如果有標題，就將標題與關閉按鈕放在同一列。
    if (title) {
      const header = document.createElement("div");
      header.className = "dialog-header";

    // 將標題移入標題列。
      title.parentNode.insertBefore(header, title);
      header.appendChild(title);

    // 建立右上角關閉按鈕。
      const closeButton = document.createElement("button");
      closeButton.className = "dialog-close";
      closeButton.dataset.action = "close-dialog";
      closeButton.setAttribute("aria-label", "關閉");
      closeButton.textContent = "×";

      header.appendChild(closeButton);
    }

  // 顯示對話視窗。
    $("#dialog").showModal();
    initItemDragAndDrop();
  }


  // =========================
  // 19. 呼叫 GAS 後端 API
  // =========================

  async function callApi(action, payload = {}) {

    // 如果沒有設定 GAS 網址，就停止呼叫並回報錯誤。
    if (!API.url) throw new Error("GAS API 尚未設定，目前使用示範資料。");

    // 使用 POST 方法向 GAS 發送請求。
    const response = await fetch(API.url, {
      method: "POST",

      // 使用 text/plain 傳送 JSON，配合目前的 GAS 接收方式。
      headers: { "Content-Type": "text/plain;charset=utf-8" },

      // 傳送操作名稱、唯一請求編號及其他資料。
      body: JSON.stringify({ action, requestId: uid(), ...payload })
    });

    // HTTP 回應失敗時，回報伺服器連線錯誤。
    if (!response.ok) throw new Error("伺服器連線失敗");

    // 將伺服器回傳內容解析成 JSON。
    const result = await response.json();

    // 如果後端回傳 ok 不為 true，回報後端錯誤訊息。
    if (!result.ok) throw new Error(result.message || "API 發生錯誤");

    // 回傳後端提供的資料。
    return result.data;
  }


  // =========================
  // 20. 手動同步功能
  // =========================

  async function syncNow() {

    // 尚未設定 API 網址時，顯示示範模式提示。
    if (!API.url) return showToast("目前是示範模式，尚未連接雲端");

    // 更新畫面上的同步狀態。
    $("#sync-status").textContent = "同步中…";

    try {

      // 呼叫後端取得目前旅行帳本的資料快照。
      await callApi("trip.getSnapshot", { tripId: state.trip.id });

      // API 呼叫成功，更新同步狀態。
      $("#sync-status").textContent = "已同步";

    } catch (error) {

      // API 呼叫失敗，更新狀態並顯示錯誤訊息。
      $("#sync-status").textContent = "同步失敗";
      showToast(error.message);
    }
  }


  // =========================
  // 21. 點擊事件監聽
  // =========================

  // 在 document 上統一監聽點擊事件。
  // 使用事件代理，讓動態產生的按鈕也能正常觸發。
  document.addEventListener("click", (event) => {

    // 檢查點擊位置是否位於具有 data-page 屬性的元素內。
    const pageButton = event.target.closest("[data-page]");

    // 如果是頁面切換按鈕，就切換頁面並停止後續處理。
    if (pageButton) {
      event.preventDefault();
      navigate(pageButton.dataset.page);
      return;
    }

    // 檢查是否點擊支出項目。
    const expenseButton = event.target.closest("[data-expense]");

    // 記錄被選取的支出 ID，並開啟支出詳細頁。
    if (expenseButton) {
      state.selectedExpenseId = expenseButton.dataset.expense;
      navigate("expense-detail");
      return;
    }

    // 檢查是否點擊具有 data-action 屬性的操作按鈕。
    const actionButton = event.target.closest("[data-action]");

    // 沒有操作屬性時，不需要繼續處理。
    if (!actionButton) return;

    // 根據按鈕的 data-action 值執行不同操作。
    switch (actionButton.dataset.action) {

      // 選取旅程並切換目前顯示的旅行資料。
      // 修改日期：2026-11-11
      case "select-trip": {
        const selectedTrip = state.trips.find(
          (trip) => trip.id === actionButton.dataset.id
        );

        if (!selectedTrip) {
          showToast("找不到這趟旅程");
          break;
        }

        state.trip = {
          ...state.trip,
          ...selectedTrip
        };

        navigate("trip");
        break;
      }

      // 編輯目前旅程的基本資料。
      // 修改日期：2026-11-12
      case "edit-trip":
        showDialog(
          '<h2>編輯旅程</h2>' +
          '<form id="edit-trip-form" class="form">' +
          
          '<div class="field"><label>旅程名稱</label>' +
          '<input name="name" required maxlength="60" value="' +
          escapeHtml(state.trip.name) + '">' +
          '</div>' +

          '<div class="field"><label>開始日期</label>' +
          '<input name="start" type="date" required ' + 
          'onchange="this.form.elements.end.min=this.value" value="' +
          state.trip.start + '">' +
          '</div>' +

          '<div class="field"><label>結束日期</label>' +
          '<input name="end" type="date" required value="' +
          state.trip.end + '">' +
          '</div>' +

          '<div class="field"><label>旅行時區</label>' +
          '<select name="timezone" required>' +
          '<option value="Asia/Taipei">台灣</option>' +
          '<option value="Asia/Tokyo">日本</option>' +
          '<option value="Asia/Seoul">韓國</option>' +
          '<option value="Asia/Bangkok">泰國</option>' +
          '<option value="Asia/Singapore">新加坡</option>' +
          '<option value="Asia/Hong_Kong">香港</option>' +
          '</select></div>' +
          
          '<button class="btn">儲存修改</button>' +
          '</form>'
        );
        
        // 將目前旅程的時區設定為預設選項。
        $("#edit-trip-form").elements.timezone.value =
        state.trip.timezone || "Asia/Taipei";
        
        // 初始化結束日期最早可選日期。
        // 修改日期：2026-11-13
        $("#edit-trip-form").elements.end.min =
        state.trip.start;
        
        break;
        
      // 手動同步。 
       case "sync":
         syncNow();
         break;

      // 切換記帳日期排序方向。
      // 修改日期：2026-11-15
      case "toggle-bookkeeping-sort":
        state.bookkeepingSort =
        state.bookkeepingSort === "desc" ? "asc" : "desc";
        
        render();
        break;

      // 切換指定日期的支出展開／收合狀態。
      // 修改日期：2026-11-14
      case "toggle-bookkeeping-date": {
        const date = actionButton.dataset.date;
        const collapsed = state.bookkeepingCollapsedDates;
        
        if (collapsed.includes(date)) {
          state.bookkeepingCollapsedDates =
          collapsed.filter((item) => item !== date);
        } else {
          collapsed.push(date);
        }
        
        render();
        break;
      }

      // 新增支出：以全螢幕彈窗顯示原有記帳表單。
      // 修改日期：2026-11-14
      case "new-expense":
        resetExpenseDraft("direct");
        showDialog(renderExpenseForm());
        break;

      // 關閉彈出視窗。
      case "close-dialog":
        $("#dialog").close();
        break;

      // 建立新旅行：開啟輸入旅行資料的對話視窗。
      case "new-trip":
        showDialog(
          '<h2>建立新旅行</h2>' +
          '<form id="trip-form" class="form">' +

      // 旅行名稱。
          '<div class="field">' +
          '<label>旅行名稱</label>' +
          '<input name="name" required maxlength="60">' +
          '</div>' +

          // 選擇旅行地點，供系統判斷旅行所在地時區。
          '<div class="field"><label>旅行地點</label><select name="timezone" required>' +
          '<option value="Asia/Taipei">台灣</option>' +
          '<option value="Asia/Tokyo">日本</option>' +
          '<option value="Asia/Seoul">韓國</option>' +
          '<option value="Asia/Bangkok">泰國</option>' +
          '<option value="Asia/Singapore">新加坡</option>' +
          '<option value="Asia/Hong_Kong">香港</option>' +
          '</select></div>' +

      // 開始日期。
          '<div class="field">' +
          '<label>開始日期</label>' +
          '<input name="start" type="date" required onchange="this.form.elements.end.min=this.value">' +
          '</div>' +

      // 結束日期。
          '<div class="field">' +
          '<label>結束日期</label>' +
          '<input name="end" type="date" required>' +
          '</div>' +

      // 建立旅行按鈕。
          '<button class="btn">建立（本機示範）</button>' +
          '</form>'
        );
        break;

      // 加入旅行：開啟邀請碼與暱稱輸入視窗。
      case "join":
        showDialog('<h2>加入旅行</h2><form id="join-form" class="form"><div class="field"><label>邀請碼</label><input name="code" required maxlength="30"></div><div class="field"><label>暱稱</label><input name="nickname" required maxlength="20"></div><button class="btn">送出</button></form>');
        break;

      // 產生示範邀請碼。
      case "invite":
        showDialog('<h2>示範邀請碼</h2><h1>DEMO26</h1><p>此為示範文字，不是真正可用的邀請碼。</p><button class="btn" data-action="copy-code">複製</button>');
        break;

      // 複製示範邀請碼。
      case "copy-code":

        // 瀏覽器支援 Clipboard API 時，嘗試複製邀請碼。
        if (navigator.clipboard) {
          navigator.clipboard.writeText("DEMO26")
            .then(() => showToast("已複製"))
            .catch(() => showToast("邀請碼：DEMO26"));
        }

        // 不支援 Clipboard API 時，直接顯示邀請碼。
        else showToast("邀請碼：DEMO26");

        break;

      // 新增品項（依 2026-11-20 規格：若有展開中卡片先驗證保存，並展開新品項）
      case "add-item": {
        if (expenseDraft.expandedItemId) {
          const currentCard = document.querySelector(".expense-item-card.expanded");
          if (currentCard && !saveItemFromCard(currentCard)) {
            return;
          }
        }
        const newItem = {
          id: uid(),
          name: "",
          quantity: 1,
          unit: "",
          unitPrice: "",
          discount: 0,
          note: ""
        };
        expenseDraft.items.push(newItem);
        expenseDraft.expandedItemId = newItem.id;
        updateExpenseItemsDOM();
        setTimeout(() => {
          const newCard = document.querySelector(`.expense-item-card[data-item-id="${newItem.id}"]`);
          if (newCard) {
            newCard.scrollIntoView({ behavior: "smooth", block: "center" });
            const nameInput = newCard.querySelector(".item-input-name");
            if (nameInput) nameInput.focus();
          }
        }, 50);
        break;
      }

      // 儲存單一品項卡片
      case "save-item": {
        const card = actionButton.closest(".expense-item-card");
        if (card) {
          saveItemFromCard(card);
        }
        break;
      }

      // 刪除單一品項
      case "delete-item": {
        const itemId = actionButton.dataset.id;
        const itemIndex = expenseDraft.items.findIndex((it) => it.id === itemId);
        if (itemIndex >= 0) {
          expenseDraft.items.splice(itemIndex, 1);
          if (expenseDraft.expandedItemId === itemId) {
            expenseDraft.expandedItemId = null;
          }

          // 依 2026-11-19 規格：若刪除後已無任何有效品項，系統自動切換回「直接輸入總額」模式
          if (expenseDraft.items.length === 0) {
            setExpenseMode("direct");
            const directRadio = document.querySelector('input[name="expense-mode"][value="direct"]');
            if (directRadio) directRadio.checked = true;
            showToast("已無有效品項，已自動切換回直接輸入總額模式");
          } else {
            updateExpenseItemsDOM();
            showToast("品項已刪除");
          }
        }
        break;
      }

      // 取消支出。
      case "cancel-expense": {

        // 根據按鈕上的支出 ID，尋找對應資料。
        const item = state.expenses.find(
          (expense) => expense.id === actionButton.dataset.id
        );

        // 找到資料並且使用者確認後，將狀態改為已取消。
        if (item && window.confirm("確定取消這筆本機示範支出？")) {
          item.status = "已取消";
          render();
          showToast("已取消（僅本機示範）");
        }

        break;
      }
    }
  });


  // =========================
  // 22. 表單送出事件監聽
  // =========================

  // 統一監聽表單送出事件。
  document.addEventListener("submit", (event) => {


    // -------------------------
    // 編輯旅程表單
    // 修改日期：2026-11-13
    // -------------------------

    if (event.target.id === "edit-trip-form") {

      // 阻止瀏覽器重新載入頁面。
      event.preventDefault();

      // 取得表單資料。
      const form = new FormData(event.target);

      const name = String(form.get("name") || "").trim();
      const start = String(form.get("start") || "");
      const end = String(form.get("end") || "");
      const timezone = String(form.get("timezone") || "");

      // 驗證旅程名稱。
      if (!name) return showToast("請輸入旅程名稱");

      // 驗證日期。
      if (!start || !end || end < start) {
        return showToast("請確認旅程日期");
      }

      // 更新目前選取的旅程。
      state.trip = {
        ...state.trip,
        name,
        start,
        end,
        timezone
      };

      // 只更新旅程清單中相同 ID 的資料。
      state.trips = state.trips.map((trip) =>
        trip.id === state.trip.id
          ? {
              ...trip,
              name,
              start,
              end,
              dates: start + " – " + end,
              timezone
            }
          : trip
      );

      // 關閉視窗並返回旅程總覽。
      $("#dialog").close();
      navigate("trip");
      showToast("旅程資料已更新");

      return;
    }


    // -------------------------
    // 新增支出表單
    // -------------------------

    if (event.target.id === "expense-form") {

      // 阻止表單使用瀏覽器預設方式重新載入頁面。
      event.preventDefault();

      // 先取得目前記錄模式
      const modeInput = event.target.querySelector('input[name="expense-mode"]:checked');
      const mode = modeInput ? modeInput.value : (expenseDraft.mode || "direct");

      // 逐項記錄模式下的品項檢查：先驗證及保存展開中的品項，並同步總額
      let itemTotals = null;
      if (mode === "itemized") {
        // 若有展開中的品項卡片，先嘗試驗證與儲存
        if (expenseDraft.expandedItemId) {
          const currentCard = document.querySelector(".expense-item-card.expanded");
          if (currentCard && !saveItemFromCard(currentCard)) {
            showToast("品項內容有誤，請先修正後儲存品項");
            return;
          }
        }

        // 依 2026-11-19 規格：逐項記錄模式至少須有一筆有效品項
        if (expenseDraft.items.length === 0) {
          showToast("逐項記錄模式至少需要一個有效品項");
          return;
        }

        // 重新計算並確保品項折後總額與日幣輸入框完全同步
        itemTotals = calculateItemsTotal();
        const jpyInput = event.target.querySelector('input[name="jpy"]');
        if (jpyInput) {
          jpyInput.value = itemTotals.totalNet;
        }
      }

      // 先完成品項驗證／保存與總額更新後，再建立 FormData，確保取得最新數值
      const form = new FormData(event.target);

      // 取得並驗證分攤方式
      const split = String(form.get("split") || "equal");
      if (!["equal", "exact", "items"].includes(split)) {
        showToast("請選擇有效的分攤方式");
        return;
      }

      // 依 2026-11-19 規格：直接輸入總額模式不可使用「依品項分攤」
      if (mode === "direct" && split === "items") {
        showToast("直接輸入總額模式不可使用「依品項分攤」，請切換為逐項記錄或選擇其他分攤方式");
        return;
      }

      // 取得日幣金額文字（逐項記錄模式確保與品項加總完全一致）
      let jpyText = String(form.get("jpy") || "");
      if (mode === "itemized" && itemTotals) {
        jpyText = String(itemTotals.totalNet);
      }

      // 取得台幣金額文字，並移除前後空白。
      const twdText = String(form.get("twd") || "").trim();

      // 先驗證原始日幣金額。
      // 必須大於 0，且最多只能有一位小數。
      if (!/^(0|[1-9]\d*)(\.\d)?$/.test(jpyText) || Number(jpyText) <= 0) {
        showToast("請輸入大於 0、最多一位小數的日幣金額");
        return;
      }

      // 取得折扣金額（日圓），空白視為 0。
      const discountText = String(form.get("discount") || "").trim();
      const discountValue = discountText === "" ? 0 : Number(discountText);

      // 驗證折扣金額。
      // 必須是非負數，最多一位小數，且不得超過原始消費金額。
      if (
        (discountText !== "" && !/^(0|[1-9]\d*)(\.\d)?$/.test(discountText)) ||
        !Number.isFinite(discountValue) ||
        discountValue < 0 ||
        discountValue > Number(jpyText)
      ) {
        showToast("折扣金額不可小於 0 或大於消費金額，且最多一位小數");
        return;
      }

      // 計算折扣後金額（日圓）。
      const finalJpy = Number((Number(jpyText) - discountValue).toFixed(1));

      // 取得信用卡回饋點數，空白視為 0。
      const rewardText = String(form.get("reward") || "").trim();
      const rewardValue = rewardText === "" ? 0 : Number(rewardText);

      // 驗證回饋點數：必須是非負安全整數。
      if (!Number.isSafeInteger(rewardValue) || rewardValue < 0) {
        showToast("信用卡回饋點數請輸入非負整數");
        return;
      }

      // 取得回饋分配方式。
      const rewardAllocation = String(form.get("rewardAllocation") || "");

      // 只允許兩種分配方式。
      if (!["proportional", "cardholder"].includes(rewardAllocation)) {
        showToast("請選擇有效的回饋分配方式");
        return;
      }

      // 台幣欄位留空時設為 null，否則轉換成數字。
      const twdValue = twdText === "" ? null : Number(twdText);

      // 驗證台幣金額：
      // 必須是非負的安全整數。
      if (twdValue !== null && (!Number.isSafeInteger(twdValue) || twdValue < 0)) {
        showToast("台幣金額請輸入非負安全整數");
        return;
      }

      // 將新支出資料加入 expenses 陣列最前面。
      state.expenses.unshift({

        // 產生新的支出 ID。
        id: uid(),

        // 綁定目前選取的旅程。
        // 修改日期：2026-11-12
        tripId: state.trip.id,

        // 儲存支出名稱，並移除前後空白。
        title: String(form.get("title")).trim(),

        // 儲存消費日期。
        date: form.get("date"),

        // 保存實際記帳時間，使用 ISO 格式記錄。
        // 修改日期：2026-11-11
        recordedAt: new Date().toISOString(),
        
        // 儲存支出分類。
        category: form.get("category"),

        // 原始消費金額。
        jpy: Number(jpyText),

        // 折扣金額（日圓）。
        discount: discountValue,

        // 折扣後金額（日圓）。
        finalJpy: finalJpy,

        // 儲存台幣金額；可能為 null。
        twd: twdValue,

        // 儲存付款方式。
        method: form.get("method"),

        // 儲存付款人。
        payer: form.get("payer"),

        // 儲存分攤方式（平均分攤 equal、自訂金額 exact、依品項分攤 items）。
        split: split,

        // 儲存信用卡回饋點數。
        reward: rewardValue,

        // 儲存信用卡回饋分配方式。
        rewardAllocation: rewardAllocation,

        // 消費品項明細（逐項記錄時保存品項資料）
        items: mode === "itemized"
          ? expenseDraft.items.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: Number(item.quantity),
              unit: item.unit || "",
              unitPrice: Number(item.unitPrice),
              discount: Number(item.discount || 0),
              note: item.note || "",
              gross: getItemCalculations(item).gross,
              net: getItemCalculations(item).net
            }))
          : [],

        // 台幣尚未填寫時標記為待補；
        // 已填寫時標記為待後端確認。
        status: twdValue === null ? "待補" : "待後端確認"
      });

      // 儲存成功後重置品項草稿
      resetExpenseDraft("direct");

      // 顯示新增成功提示。
      showToast("已加入本機示範紀錄");

      // 返回旅行總覽頁面。
      // 修改日期：2026-11-14
      // 關閉新增支出彈窗，返回記帳頁面。
      $("#dialog").close();
      navigate("bookkeeping");
    }


    // -------------------------
    // 建立新旅行表單
    // -------------------------

    if (event.target.id === "trip-form") {

      // 阻止表單預設送出行為。
      event.preventDefault();

      // 取得表單資料。
      const form = new FormData(event.target);

      // 取得旅行開始日期與結束日期。
      const start = String(form.get("start")), end = String(form.get("end"));

      // 取得使用者選擇的旅行時區。
      const timezone = String(form.get("timezone"));

      // 檢查結束日期是否早於開始日期。
      if (end < start) return showToast("結束日期不可早於開始日期");

      // 每次建立新旅程，都產生獨立識別碼。
      // 修改日期：2026-11-11
      const newTripId = uid();

      // 更新目前旅行資料，保留原本其他欄位。
      // 取得新旅程名稱。
      const newTripName = String(form.get("name")).trim();

      // 新增旅程卡片，先設定人數與花費的初始值。
      state.trips.unshift({
        id: newTripId,
        name: newTripName,
        dates: start + " – " + end,
        start: start,          // 保存開始日期，供狀態判斷使用。
        end: end,              // 保存結束日期，供狀態判斷使用。
        status: "準備中",
        memberCount: 1, // 建立者先算 1 人。
        totalJPY: 0,    // 日幣總花費初始為 0。
        totalTWD: 0,     // 台幣總花費初始為 0。
        // 保存這趟旅行的時區。
        timezone: timezone
      });

      // 關閉對話視窗並前往旅行總覽。
      $("#dialog").close();
      navigate("home");
    }

    // -------------------------
    // 加入旅行表單
    // -------------------------

    if (event.target.id === "join-form") {

      // 阻止表單預設送出行為。
      event.preventDefault();

      // 關閉加入旅行的對話視窗。
      $("#dialog").close();

      // 目前尚未串接後端，因此不會真正驗證邀請碼或加入帳本。
      showToast("加入流程尚未連接後端，邀請碼未驗證");
    }
  });


  // =========================
  // 23. 主題切換事件
  // =========================

  // 監聽網頁欄位的變更事件。
  document.addEventListener("change", (event) => {

    // 確認變更的是主題選擇欄位。
    if (event.target.id === "theme-select") {

      // 更新目前主題設定。
      state.theme = event.target.value;

      // 將主題設定儲存在瀏覽器 localStorage。
      // 下次開啟網頁時，可以讀取先前選擇的主題。
      localStorage.setItem("u-theme", state.theme);

      // 重新產生畫面，套用新的主題。
      render();
    }

        // 確認變更的是付款方式。
    if (event.target.name === "method") {
      const rewardFields = document.getElementById("credit-card-reward-fields");

      if (rewardFields) {
        rewardFields.hidden = event.target.value !== "信用卡";
      }
    }

    // 切換消費記錄模式（直接輸入總額 vs 逐項記錄）
    if (event.target.name === "expense-mode") {
      setExpenseMode(event.target.value);
    }

  });

  // 監聽即時輸入事件（品項金額即時小計計算）
  document.addEventListener("input", (event) => {
    const card = event.target.closest(".expense-item-card.expanded");
    if (card) {
      const qtyInput = card.querySelector(".item-input-qty");
      const priceInput = card.querySelector(".item-input-price");
      const discInput = card.querySelector(".item-input-discount");

      const qty = Number(qtyInput ? qtyInput.value : 0) || 0;
      const price = Number(priceInput ? priceInput.value : 0) || 0;
      const gross = round1(qty * price);
      const disc = Number(discInput ? discInput.value : 0) || 0;
      const net = Math.max(0, round1(gross - disc));

      const grossEl = card.querySelector(".calc-gross");
      const discEl = card.querySelector(".calc-discount");
      const netEl = card.querySelector(".calc-net");

      if (grossEl) grossEl.textContent = "¥" + gross.toLocaleString("zh-TW");
      if (discEl) discEl.textContent = "-¥" + disc.toLocaleString("zh-TW");
      if (netEl) netEl.textContent = "¥" + net.toLocaleString("zh-TW");
    }
  });


  // =========================
  // 24. 自動同步與 Service Worker
  // =========================

  // 只有設定 GAS API 網址時，才啟動定時同步。
  // API.pollMs 目前設定為 120000 毫秒，也就是 2 分鐘。
  if (API.url) window.setInterval(syncNow, API.pollMs);

  // 確認瀏覽器支援 Service Worker，
  // 並且目前使用 HTTP 或 HTTPS 網址。
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {

    // 網頁載入完成後，註冊 Service Worker。
    // 註冊失敗時忽略錯誤，不影響主要頁面功能。
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("./service-worker.js").catch(() => {})
    );
  }


  // =========================
  // 25. 初始化程式
  // =========================

  // 第一次載入 app.js 時，立即產生目前頁面的畫面。
  render();

// 結束最外層的自動執行函式。
})();
