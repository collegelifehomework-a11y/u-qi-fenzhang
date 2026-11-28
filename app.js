/* u 起旅遊分帳｜app.js｜v0.2
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

  // 日期加減工具（UTC 日期算術，避免時區偏移）。
  // 修改日期：2026-11-26
  const addDays = (dateStr, n) => {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // 取得指定日期的中文星期（短）。
  // 修改日期：2026-11-26
  const weekdayZh = (dateStr) => {
    try {
      return new Intl.DateTimeFormat("zh-TW", { weekday: "short", timeZone: "UTC" }).format(
        new Date(dateStr + "T00:00:00Z")
      );
    } catch (e) {
      return "";
    }
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
      end: "2026-10-09",
      timezone: "Asia/Taipei"
    },

    // 旅行清單，目前只有一筆示範資料。
    trips: [
      {
        id: "demo-trip",
        name: "福岡自由行",
        dates: "2026-10-04 – 2026-10-09",
        start: "2026-10-04",
        end: "2026-10-09",
        status: "進行中",
        memberCount: 1,
        totalJPY: 0,
        totalTWD: 0,
        timezone: "Asia/Taipei"
      }
    ],

    // 行程資料依旅程保存，避免不同旅程共用。
    // 修改日期：2026-11-26
    itineraryByTrip: {
      "demo-trip": {}
    },

    // 旅伴清單改為依旅程保存，避免不同旅程共用同一份成員資料。
    // 修改日期：2026-11-24
    membersByTrip: {
      "demo-trip": [
        { id: "m1", name: "我", role: "主要管理者" },
        { id: "m2", name: "小安", role: "旅伴" },
        { id: "m3", name: "阿哲", role: "旅伴" }
      ]
    },

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
        members: [
          { id: "m1", name: "我" },
          { id: "m2", name: "小安" },
          { id: "m3", name: "阿哲" }
        ],
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
        members: [
          { id: "m1", name: "我" },
          { id: "m2", name: "小安" },
          { id: "m3", name: "阿哲" }
        ],
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
        members: [
          { id: "m1", name: "我" },
          { id: "m2", name: "小安" },
          { id: "m3", name: "阿哲" }
        ],
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
    selectedExpenseId: null,

    // 行程資料依旅程保存，避免不同旅程共用。
    // 修改日期：2026-11-26
    itineraryByTrip: {
      "demo-trip": {}
    },

    // 目前選取的行程日期（YYYY-MM-DD）。
    // null 代表尚未選取，進入行程頁時預設為第一天。
    // 修改日期：2026-11-28
    selectedItineraryDate: null,
  };

  // 旅伴資料依旅程隔離：state.members 作為目前旅程的成員清單代理。
  // 修改日期：2026-11-24
  Object.defineProperty(state, "members", {
    get() {
      if (!state.membersByTrip[state.trip.id]) {
        state.membersByTrip[state.trip.id] = [];
      }
      // 已移除（軟刪除）的旅伴不顯示於目前成員清單。
      // 修改日期：2026-11-24
      return state.membersByTrip[state.trip.id].filter((m) => !m.removed);
    },
    set(value) {
      state.membersByTrip[state.trip.id] = value;
    }
  });

  // 行程資料依旅程隔離：state.itinerary 作為目前旅程的行程代理。
  // 修改日期：2026-11-26
  Object.defineProperty(state, "itinerary", {
    get() {
      if (!state.itineraryByTrip[state.trip.id]) {
        state.itineraryByTrip[state.trip.id] = {};
      }
      return state.itineraryByTrip[state.trip.id];
    },
    set(value) {
      state.itineraryByTrip[state.trip.id] = value;
    }
  });

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
      state.trips.map((trip) => {
        // 依該旅程的支出即時計算總金額，避免使用過時的靜態值。
        // 修改日期：2026-11-25
        const tripExpenses = state.expenses.filter(
          (e) => e.tripId === trip.id && e.status !== "已取消"
        );
        const tripJpy = tripExpenses.reduce((s, e) => s + (Number(e.jpy) || 0), 0);
        const tripTwd = tripExpenses.reduce((s, e) => s + (Number(e.twd) || 0), 0);
        return (
        '<button class="trip-card" data-action="select-trip" data-id="' +
        escapeHtml(trip.id) + '">' +
        '<span class="trip-info">' +
        '<strong>' + escapeHtml(trip.name) + '</strong>' +
        '<small>' + trip.dates + ' · ' + getTripStatus(trip) + '</small>' +
        '<small>旅伴：' + trip.memberCount + ' 人</small>' +
        '<small>總花費：¥' +
        Number(tripJpy).toLocaleString() +
        ' · NT$' +
        Number(tripTwd).toLocaleString() +
        '</small>' +'</span>›' +'</button>'
        );
      }).join("");

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
  mode: "direct",
  items: [],
  expandedItemId: null,
  split: "equal",
  loadedExpenseId: null
};

const expenseFxState = {
  requestId: 0,
  isManual: false,
  loading: false,
  error: null,
  rate: null,
  lastDate: null
};

  // 重置支出品項暫存
  function resetExpenseDraft(mode = "direct") {
    expenseDraft.mode = mode;
    expenseDraft.items = [];
    expenseDraft.expandedItemId = null;
    expenseDraft.split = "equal";
    expenseDraft.loadedExpenseId = null;
    // 重置匯率狀態
    expenseFxState.requestId = 0;
    expenseFxState.isManual = false;
    expenseFxState.loading = false;
    expenseFxState.error = null;
    expenseFxState.rate = null;
    expenseFxState.lastDate = null;
  }

  // 將既有支出載入草稿，供編輯模式使用。
  // 修改日期：2026-11-26
  function loadExpenseIntoDraft(expense) {
    if (!expense) return;
    const isItemized = !!(expense.items && expense.items.length);
    resetExpenseDraft(isItemized ? "itemized" : "direct");
    expenseDraft.split = expense.split || "equal";
    expenseDraft.loadedExpenseId = expense.id;
    if (isItemized) {
      expenseDraft.items = expense.items.map((it) => ({
        id: it.id || uid(),
        name: it.name || "",
        quantity: it.quantity != null ? it.quantity : 1,
        unit: it.unit || "",
        unitPrice: it.unitPrice != null ? it.unitPrice : "",
        discount: it.discount != null ? it.discount : 0,
        note: it.note || "",
        allocations: { ...(it.allocations || {}) },
        saved: true,
        savedAllocations: { ...(it.allocations || {}) },
        gross: it.gross,
        net: it.net
      }));
      expenseDraft.expandedItemId = null;
    }
    // 匯率狀態
    expenseFxState.isManual = !!expense.fxRateManual;
    expenseFxState.rate = expense.fxRate || null;
    expenseFxState.error = null;
  }

  // 四捨五入至小數點後一位
  const round1 = (num) => Math.round((Number(num) + Number.EPSILON) * 10) / 10;

  // =========================
  // 現金付款匯率換算（依 2026-11-21 規格）
  // =========================

  // 取得指定日期的 JPY→TWD 匯率（來源：fawazahmed0 currency-api，jsdelivr CDN）
  async function fetchFxRate(date) {
    const urls = [
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@" + date + "/v1/currencies/jpy.json",
      "https://" + date + ".currency-api.pages.dev/v1/currencies/jpy.json"
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const rate = data && data.jpy && data.jpy.twd;
        if (typeof rate === "number" && rate > 0) return rate;
      } catch (e) {
        // 嘗試下一個來源
      }
    }
    throw new Error("無法取得 " + date + " 的 JPY/TWD 匯率");
  }

  // 依目前日幣金額與匯率重新計算台幣金額
  function updateFxConversion() {
    const form = document.getElementById("expense-form");
    if (!form) return;
    const methodInput = form.querySelector('input[name="method"]:checked');
    if (!methodInput || methodInput.value !== "現金") return;

    const rateInput = document.getElementById("fx-rate");
    const twdInput = form.querySelector('input[name="twd"]');
    const convertedEl = document.getElementById("fx-converted");
    const errorEl = document.getElementById("fx-error");

    const rate = rateInput ? Number(rateInput.value) : NaN;
    let jpy = 0;
    const modeInput = form.querySelector('input[name="expense-mode"]:checked');
    const isItemized = modeInput && modeInput.value === "itemized";
    if (isItemized) {
      const totals = calculateItemsTotal();
      jpy = totals.totalNet || 0;
      const jpyInput = form.querySelector('input[name="jpy"]');
      if (jpyInput) jpyInput.value = jpy > 0 ? jpy : (totals.count > 0 ? 0 : "");
    } else {
      const jpyInput = form.querySelector('input[name="jpy"]');
      jpy = jpyInput ? (Number(jpyInput.value) || 0) : 0;
    }
    const discountInput = form.querySelector('input[name="discount"]');
    const discount = discountInput ? (Number(discountInput.value) || 0) : 0;
    const finalJpy = Math.max(0, round1(jpy - discount));

    if (errorEl) {
      if (expenseFxState.error) {
        errorEl.textContent = expenseFxState.error;
        errorEl.style.display = "";
      } else {
        errorEl.style.display = "none";
      }
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      if (twdInput) twdInput.value = "";
      if (convertedEl) convertedEl.value = "";
      return;
    }
    const converted = Math.round(finalJpy * rate);
    if (twdInput) twdInput.value = converted > 0 ? converted : (finalJpy > 0 ? converted : "");
    if (convertedEl) convertedEl.value = converted > 0 ? converted : (finalJpy > 0 ? converted : "");
  }

  // 載入指定日期的系統匯率
  async function loadFxRateForDate(date) {
    if (!date) return;
    const form = document.getElementById("expense-form");
    if (!form) return;
    const methodInput = form.querySelector('input[name="method"]:checked');
    if (!methodInput || methodInput.value !== "現金") return;

    const rateInput = document.getElementById("fx-rate");
    const statusEl = document.getElementById("fx-rate-status");
    const errorEl = document.getElementById("fx-error");

    const reqId = ++expenseFxState.requestId;
    expenseFxState.loading = true;
    expenseFxState.error = null;
    expenseFxState.lastDate = date;
    if (statusEl) statusEl.textContent = "匯率載入中…";
    if (rateInput) rateInput.placeholder = "載入中…";
    if (errorEl) errorEl.style.display = "none";

    try {
      const rate = await fetchFxRate(date);
      if (reqId !== expenseFxState.requestId) return; // 過期請求忽略
      expenseFxState.rate = rate;
      expenseFxState.loading = false;
      expenseFxState.isManual = false;
      if (rateInput) {
        rateInput.value = rate;
        rateInput.placeholder = "";
      }
      if (statusEl) statusEl.textContent = "系統匯率（JPY→TWD）";
      updateFxConversion();
    } catch (e) {
      if (reqId !== expenseFxState.requestId) return;
      expenseFxState.loading = false;
      expenseFxState.error = "無法取得 " + date + " 的匯率，請手動輸入。";
      if (statusEl) statusEl.textContent = "查詢失敗";
      if (rateInput) rateInput.value = "";
      if (errorEl) {
        errorEl.textContent = expenseFxState.error;
        errorEl.style.display = "";
      }
      updateFxConversion();
    }
  }

  // 初始化表單匯率狀態（現金時載入匯率）
  function initExpenseFormFx() {
    const form = document.getElementById("expense-form");
    if (!form || form.dataset.fxInitialized === "true") return;
    form.dataset.fxInitialized = "true";

    const methodInput = form.querySelector('input[name="method"]:checked');
    const cashFx = document.getElementById("cash-fx-fields");
    const twdInput = form.querySelector('input[name="twd"]');
    const twdHint = document.getElementById("twd-hint");

    if (methodInput && methodInput.value === "現金") {
      if (cashFx) cashFx.hidden = false;
      if (twdInput) {
        twdInput.readOnly = true;
        twdInput.classList.add("readonly-calc");
      }
      if (twdHint) twdHint.textContent = "由日幣金額 × 匯率自動換算";
      const dateInput = form.querySelector('input[name="date"]');
      // 編輯模式且已有保存的匯率時，不重新取得，保留原值。
      if (dateInput && dateInput.value && expenseFxState.rate == null) {
        loadFxRateForDate(dateInput.value);
      }
    } else {
      if (cashFx) cashFx.hidden = true;
      if (twdInput) {
        twdInput.readOnly = false;
        twdInput.classList.remove("readonly-calc");
      }
      if (twdHint) twdHint.textContent = "以帳單實際請款金額為準";
    }

    // 匯率手動修改
    const rateInput = document.getElementById("fx-rate");
    if (rateInput) {
      rateInput.addEventListener("input", () => {
        expenseFxState.isManual = true;
        const statusEl = document.getElementById("fx-rate-status");
        if (statusEl) statusEl.textContent = "手動覆寫";
        updateFxConversion();
      });
    }

    // 消費日期變更 → 重新取得匯率（僅現金）
    const dateInput = form.querySelector('input[name="date"]');
    if (dateInput) {
      dateInput.addEventListener("change", () => {
        const m = form.querySelector('input[name="method"]:checked');
        if (m && m.value === "現金") {
          expenseFxState.isManual = false;
          loadFxRateForDate(dateInput.value);
        }
      });
    }

    // 日幣金額變更 → 重新換算
    const jpyInput = form.querySelector('input[name="jpy"]');
    if (jpyInput) {
      jpyInput.addEventListener("input", () => {
        const m = form.querySelector('input[name="method"]:checked');
        if (m && m.value === "現金") updateFxConversion();
      });
    }

    // 折扣變更 → 重新換算
    const discountInput = form.querySelector('input[name="discount"]');
    if (discountInput) {
      discountInput.addEventListener("input", () => {
        const m = form.querySelector('input[name="method"]:checked');
        if (m && m.value === "現金") updateFxConversion();
      });
    }

    // 信用卡回饋切換仍保留既有行為
  }

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
            '<span class="drag-handle" title="按住約 1 秒可拖曳排序" aria-label="拖曳手柄">⋮⋮</span>' +
            '<div class="item-summary-info">' +
              '<span class="item-summary-name">' + escapeHtml(item.name || "（未命名品項）") + '</span>' +
              '<span class="item-summary-net">¥' + calc.net.toLocaleString("zh-TW") + '</span>' +
            '</div>' +
            '<button type="button" class="item-delete-btn" data-action="delete-item" data-id="' + escapeHtml(item.id) + '" title="刪除品項" aria-label="刪除品項">🗑️</button>' +
          '</div>' +
        '</div>'
      );
    }

    // 展開狀態：完整編輯欄位，底部僅設「儲存」按鈕（依 2026-11-20 / 2026-11-22 規格不設「取消」及「刪除」按鈕）
    const allocInfo = getAllocationStatus(item);
    const unitLabel = item.unit ? escapeHtml(item.unit) : "件";
    const currentSplit = expenseDraft.split || "equal";
    const isItemsSplit = currentSplit === "items";

    const memberInputs = state.members.map((member) => {
      const val = (item.allocations && item.allocations[member.id] != null && item.allocations[member.id] !== "")
        ? String(item.allocations[member.id])
        : "";
      const avatarChar = escapeHtml(member.name ? member.name.slice(0, 1) : "?");

      return (
        '<div class="allocation-member-row">' +
          '<div class="allocation-member-info">' +
            '<div class="avatar-mini">' + avatarChar + '</div>' +
            '<label class="allocation-member-name" for="allocation-' + escapeHtml(item.id) + '-' + escapeHtml(member.id) + '">' +
              escapeHtml(member.name) +
            '</label>' +
          '</div>' +
          '<div class="allocation-member-input-wrap">' +
            '<input ' +
              'id="allocation-' + escapeHtml(item.id) + '-' + escapeHtml(member.id) + '" ' +
              'class="allocation-quantity-input" ' +
              'type="text" ' +
              'inputmode="decimal" ' +
              'data-item-id="' + escapeHtml(item.id) + '" ' +
              'data-member-id="' + escapeHtml(member.id) + '" ' +
              'value="' + escapeHtml(val) + '" ' +
              'placeholder="0" ' +
              'autocomplete="off">' +
            '<span class="allocation-unit">' + unitLabel + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    return (
      '<div class="expense-item-card expanded" data-item-id="' + escapeHtml(item.id) + '" data-index="' + index + '">' +
        '<div class="item-card-header">' +
          '<span class="item-card-title">品項 #' + (index + 1) + '</span>' +
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

          '<div class="item-allocation-card-block"' + (isItemsSplit ? "" : ' style="display:none;"') + '>' +
            '<div class="item-allocation-card-header">' +
              '<span class="item-allocation-card-title">旅伴分配數量</span>' +
              '<span class="allocation-badge ' + allocInfo.status + '">' +
                allocInfo.allocated + ' / ' + allocInfo.quantity + (allocInfo.status === "complete" ? " ✓" : "") +
              '</span>' +
            '</div>' +
            '<div class="allocation-members-list">' + memberInputs + '</div>' +
            '<div class="allocation-progress-bar-wrap">' +
              '<div class="allocation-progress-bar ' + allocInfo.status + '" style="width:' + allocInfo.percent + '%;"></div>' +
            '</div>' +
            '<div class="allocation-footer-status">' +
              '<span class="allocation-progress-text">已分配：' + allocInfo.allocated + ' / ' + allocInfo.quantity + ' ' + unitLabel + '</span>' +
              '<span class="allocation-diff-text ' + allocInfo.status + '">' + escapeHtml(allocInfo.statusText) + '</span>' +
            '</div>' +
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

  // 計算單一品項的分配狀態與統計
  function getAllocationStatus(item) {
    const quantity = round1(Number(item.quantity) || 0);
    const allocations = item.allocations || {};
    let allocated = 0;
    state.members.forEach((m) => {
      allocated = round1(allocated + (Number(allocations[m.id]) || 0));
    });
    const diff = round1(allocated - quantity);
    let status = "complete";
    let statusText = "✓ 分配完成";
    if (diff < -0.0001) {
      status = "incomplete";
      statusText = "尚缺 " + round1(quantity - allocated);
    } else if (diff > 0.0001) {
      status = "over";
      statusText = "⚠️ 超額 " + diff;
    }
    const percent = quantity > 0 ? Math.min(100, Math.max(0, (allocated / quantity) * 100)) : 0;
    return {
      quantity,
      allocated,
      diff,
      status,
      statusText,
      percent
    };
  }

  // 即時更新單一品項分配狀態（不重建 DOM，保持輸入游標與焦點）
  function updateItemAllocationStatusInPlace(itemId) {
    const item = expenseDraft.items.find((it) => it.id === itemId);
    if (!item) return;

    const itemEl = document.querySelector(`.expense-item-card[data-item-id="${itemId}"]`);
    if (!itemEl) return;

    const info = getAllocationStatus(item);
    const unitLabel = item.unit ? item.unit : "件";

    // 1. 更新卡片標題 Badge
    const badge = itemEl.querySelector(".allocation-badge");
    if (badge) {
      badge.className = "allocation-badge " + info.status;
      badge.textContent = `${info.allocated} / ${info.quantity}${info.status === "complete" ? " ✓" : ""}`;
    }

    // 2. 更新進度條
    const progressBar = itemEl.querySelector(".allocation-progress-bar");
    if (progressBar) {
      progressBar.className = "allocation-progress-bar " + info.status;
      progressBar.style.width = info.percent + "%";
    }

    // 3. 更新進度文字
    const progressText = itemEl.querySelector(".allocation-progress-text");
    if (progressText) {
      progressText.textContent = `已分配：${info.allocated} / ${info.quantity} ${unitLabel}`;
    }

    // 4. 更新狀態提示文字
    const diffText = itemEl.querySelector(".allocation-diff-text");
    if (diffText) {
      diffText.className = "allocation-diff-text " + info.status;
      diffText.textContent = info.statusText;
    }
  }

  // 更新品項列表 DOM 與總額
  function updateExpenseItemsDOM() {
    const listEl = document.getElementById("expense-items-list");
    if (listEl) {
      listEl.innerHTML = renderExpenseItemsListHtml();
    }
    updateExpenseTotalsUI();
    initItemDragAndDrop();
    // 現金付款時，品項變更後重新換算台幣。
    try { updateFxConversion(); } catch (e) {}
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
  // 修改日期：2026-11-23
  function setExpenseMode(mode) {
    // 依規格：切換記錄模式時不自動儲存品項。
    // 尚未儲存的新品項直接丟棄；已儲存品項則還原上次儲存的資料。
    if (expenseDraft.expandedItemId) {
      const expandedId = expenseDraft.expandedItemId;
      const expandedItem = expenseDraft.items.find((it) => it.id === expandedId);

      if (expandedItem) {
        if (!expandedItem.saved) {
          // 從未儲存的新品項：整筆移除，連同輸入與分配資料。
          expenseDraft.items = expenseDraft.items.filter((it) => it.id !== expandedId);
        } else {
          // 已儲存品項：丟棄未儲存的分配修改，還原上次儲存內容。
          expandedItem.allocations = { ...(expandedItem.savedAllocations || {}) };
        }
      }

      expenseDraft.expandedItemId = null;
    }

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
      // 若尚未有品項，自動新增一筆並展開
      if (expenseDraft.items.length === 0) {
        const newItem = {
          id: uid(),
          name: "",
          quantity: 1,
          unit: "",
          unitPrice: "",
          discount: 0,
          note: "",
          allocations: {},
          saved: false,
          savedAllocations: {}
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
      if (splitSelect && splitSelect.value === "items") {
        splitSelect.value = "equal";
        expenseDraft.split = "equal";
        // 修改日期：2026-11-23
        // 同步重設分攤方式提示，避免停留在「依品項分攤」說明。
        const splitHint = document.getElementById("expense-split-hint");
        if (splitHint) {
          splitHint.textContent = "選擇分攤方式後，設定旅伴如何分配這筆支出。";
        }
      }
      // 重新渲染，確保被丟棄的未儲存品項不會留在畫面上。
      updateExpenseItemsDOM();
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

    // 同步讀取卡片內旅伴分配輸入
    const allocInputs = card.querySelectorAll(".allocation-quantity-input");
    if (allocInputs.length > 0) {
      if (!item.allocations) item.allocations = {};
      allocInputs.forEach((inp) => {
        const mId = inp.dataset.memberId;
        const v = inp.value.trim();
        item.allocations[mId] = v === "" ? 0 : round1(Number(v));
      });
    }

    // 記錄已儲存狀態與分配快照，供切換記錄模式時還原。
    // 修改日期：2026-11-23
    item.saved = true;
    item.savedAllocations = { ...(item.allocations || {}) };

    // 自動收合卡片
    expenseDraft.expandedItemId = null;
    updateExpenseItemsDOM();
    showToast("品項已儲存");
    return true;
  }

  // ==========================================
  // 行程頁左右滑動切換日期（觸控手勢）。
  // 修改日期：2026-11-28
  function initItinerarySwipe() {
    const container = document.querySelector(".itinerary-list");
    if (!container || container.dataset.swipeInitialized === "true") return;
    container.dataset.swipeInitialized = "true";

    let startX = 0;
    let startY = 0;
    let tracking = false;

    container.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) { tracking = false; return; }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    }, { passive: true });

    container.addEventListener("touchmove", (e) => {
      if (!tracking || !e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // 垂直滑動為主時，停止追蹤，允許頁面捲動。
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        tracking = false;
      }
    }, { passive: true });

    container.addEventListener("touchend", (e) => {
      if (!tracking) return;
      tracking = false;
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // 滑動距離門檻。
      if (Math.abs(dx) < 60) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return;

      const start = state.trip.start;
      const end = state.trip.end;
      const days = [];
      if (start && end && start <= end) {
        let cur = start;
        while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
      }
      const idx = days.indexOf(state.selectedItineraryDate);
      if (idx < 0) return;

      let newIdx = idx;
      if (dx < 0) {
        // 向左滑 → 下一天
        if (idx < days.length - 1) newIdx = idx + 1;
      } else {
        // 向右滑 → 上一天
        if (idx > 0) newIdx = idx - 1;
      }
      if (newIdx !== idx) {
        state.selectedItineraryDate = days[newIdx];
        render();
      }
    }, { passive: true });
  }

  // 行程頁時間軸長按拖曳排序（觸控 + 滑鼠）。
  // 修改日期：2026-11-28
  let itinDragTimer = null;
  let itinDragActive = false;
  let itinDraggedEl = null;
  let itinDragPlaceholder = null;
  let itinIsPointerDown = false;
  let itinDragMoved = false;
  let itinDragPointerStartX = 0;
  let itinDragPointerStartY = 0;

  let itinDragDelegated = false;

  function initItineraryTimelineDragAndDrop() {
    const container = document.querySelector(".itinerary-timeline");
    if (!container || container.dataset.dragInitialized === "true") return;
    container.dataset.dragInitialized = "true";

    if (itinDragDelegated) return;
    itinDragDelegated = true;

    document.addEventListener("pointerdown", (e) => {
      const handle = e.target && e.target.closest ? e.target.closest(".itinerary-drag-handle") : null;
      if (!handle) return;
      showToast("pointerdown on handle");
      if (e.target.closest("button, input, select, textarea, a")) return;
      const row = handle.closest(".timeline-row");
      if (!row) return;

      const lc = document.querySelector(".itinerary-timeline");
      if (!lc) return;

      itinIsPointerDown = true;
      itinDragMoved = false;
      itinDragPointerStartX = e.clientX;
      itinDragPointerStartY = e.clientY;

      itinDragTimer = setTimeout(() => {
        showToast("drag timer fired");
        itinDragActive = true;
        itinDraggedEl = row;
        row.classList.add("is-dragging");
        const rect = row.getBoundingClientRect();
        const placeholder = document.createElement("div");
        placeholder.className = "itinerary-drag-placeholder";
        placeholder.style.height = rect.height + "px";
        itinDragPlaceholder = placeholder;
        const c = document.querySelector(".itinerary-timeline");
        if (c) c.insertBefore(placeholder, row);

        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        row.style.position = "fixed";
        row.style.left = rect.left + "px";
        row.style.top = rect.top + "px";
        row.style.width = rect.width + "px";
        row.style.zIndex = "1000";
        row.style.pointerEvents = "none";
        row.style.opacity = "0.9";
        itinDragTimer = null;
      }, 700);
    });

    const onPointerMove = (e) => {
      if (!itinIsPointerDown) return;
      if (itinDragTimer) {
        const dist = Math.hypot(e.clientX - itinDragPointerStartX, e.clientY - itinDragPointerStartY);
        if (dist > 8) {
          clearTimeout(itinDragTimer);
          itinDragTimer = null;
          itinDragMoved = true;
        }
      }
      if (itinDragActive && itinDraggedEl && itinDragPlaceholder) {
        e.preventDefault();
        itinDraggedEl.style.left = (e.clientX - dragOffsetX) + "px";
        itinDraggedEl.style.top = (e.clientY - dragOffsetY) + "px";

        const c = document.querySelector(".itinerary-timeline");
        if (!c) return;
        const rows = Array.from(c.querySelectorAll(".timeline-row:not(.is-dragging)"));
        let insertBefore = null;
        for (const r of rows) {
          const rect = r.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (e.clientY < midY) { insertBefore = r; break; }
        }
        if (insertBefore) {
          c.insertBefore(itinDragPlaceholder, insertBefore);
        } else {
          c.appendChild(itinDragPlaceholder);
        }
      }
    };

    const endDrag = (e) => {
      if (!itinIsPointerDown) return;
      itinIsPointerDown = false;

      if (itinDragTimer) {
        clearTimeout(itinDragTimer);
        itinDragTimer = null;
        return;
      }

      if (itinDragActive && itinDraggedEl && itinDragPlaceholder) {
        itinDragActive = false;
        const c = document.querySelector(".itinerary-timeline");
        const rows = c ? Array.from(c.querySelectorAll(".timeline-row:not(.is-dragging)")) : [];
        let targetIndex = 0;
        for (const r of rows) {
          if (itinDragPlaceholder.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_PRECEDING) {
            targetIndex++;
          }
        }
        const oldIndex = Number(itinDraggedEl.dataset.index);

        // cleanup
        itinDraggedEl.classList.remove("is-dragging");
        itinDraggedEl.style.position = "";
        itinDraggedEl.style.left = "";
        itinDraggedEl.style.top = "";
        itinDraggedEl.style.width = "";
        itinDraggedEl.style.zIndex = "";
        itinDraggedEl.style.pointerEvents = "";
        itinDraggedEl.style.opacity = "";
        if (itinDragPlaceholder.parentNode) {
          itinDragPlaceholder.parentNode.removeChild(itinDragPlaceholder);
        }
        itinDragPlaceholder = null;

        if (oldIndex >= 0 && targetIndex >= 0 && targetIndex !== oldIndex) {
          const date = state.selectedItineraryDate;
          const arr = state.itinerary[date];
          if (Array.isArray(arr)) {
            const oldSpots = [...arr];
            const [moved] = arr.splice(oldIndex, 1);
            arr.splice(targetIndex, 0, moved);
            // transport cleanup
            arr.forEach((spot, j) => {
              const oldIdx = oldSpots.indexOf(spot);
              const oldPred = oldIdx > 0 ? oldSpots[oldIdx - 1] : null;
              const newPred = j > 0 ? arr[j - 1] : null;
              if (oldPred !== newPred) {
                spot.transport = null;
                spot.travelTime = null;
              }
            });
            showToast("排序已更新：" + arr.map(s => s.name).join(","));
            render();
          }
        } else {
          showToast("未排序：" + oldIndex + " -> " + targetIndex);
          render();
        }
        itinDraggedEl = null;
      }
    };

    window.addEventListener("pointermove", (e) => {
      if (!itinIsPointerDown) return;
      if (itinDragTimer) {
        const dist = Math.hypot(e.clientX - itinDragPointerStartX, e.clientY - itinDragPointerStartY);
        if (dist > 8) {
          clearTimeout(itinDragTimer);
          itinDragTimer = null;
          itinDragMoved = true;
        }
      }
      if (itinDragActive && itinDraggedEl && itinDragPlaceholder) {
        e.preventDefault();
        itinDraggedEl.style.left = (e.clientX - dragOffsetX) + "px";
        itinDraggedEl.style.top = (e.clientY - dragOffsetY) + "px";

        const c = document.querySelector(".itinerary-timeline");
        if (!c) return;
        const rows = Array.from(c.querySelectorAll(".timeline-row:not(.is-dragging)"));
        let insertBefore = null;
        for (const r of rows) {
          const rect = r.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (e.clientY < midY) { insertBefore = r; break; }
        }
        if (insertBefore) {
          c.insertBefore(itinDragPlaceholder, insertBefore);
        } else {
          c.appendChild(itinDragPlaceholder);
        }
      }
    }, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", () => {
      if (itinIsPointerDown || itinDragActive) endDrag();
    });
  }

  // 品項長按 1 秒拖曳排序與展開收合管理
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
  // 記錄手指在卡片上的抓取位置，避免卡片移動時偏移
  let dragOffsetX = 0;
  let dragOffsetY = 0;

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
        // 依 2026-11-20 規格：若卡片仍處於展開編輯狀態，長按 1 秒不啟動拖曳，提示「請先收合品項卡片」
        dragTimer = setTimeout(() => {
          showToast("請先收合品項卡片");
          dragTimer = null;
        }, 1000);
        return;
      }

      // 收合狀態的卡片：長按 1 秒進入拖曳排序模式
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
// 建立原位置的虛線佔位
const rect = card.getBoundingClientRect();

dragPlaceholder = document.createElement("div");
dragPlaceholder.className = "drag-placeholder";
dragPlaceholder.style.height = rect.height + "px";
dragPlaceholder.style.width = rect.width + "px";
dragPlaceholder.style.boxSizing = "border-box";

card.parentNode.insertBefore(dragPlaceholder, card);

// 記錄手指抓取卡片的位置
dragOffsetX = e.clientX - rect.left;
dragOffsetY = e.clientY - rect.top;

// 將卡片改為浮動狀態，讓它跟隨手指
card.style.position = "fixed";
card.style.left = rect.left + "px";
card.style.top = rect.top + "px";
card.style.width = rect.width + "px";
card.style.boxSizing = "border-box";
card.style.margin = "0";
card.style.zIndex = "1000";
card.style.pointerEvents = "none";
card.style.transition = "none";
card.style.transform = "scale(1.03)";
card.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.2)";
card.style.willChange = "left, top";

dragTimer = null;
      }, 1000);
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
// 拖曳模式中：卡片跟隨手指，其他卡片即時讓位
if (dragActive && draggedItemElement && dragPlaceholder) {
  e.preventDefault();

  // 讓浮動卡片跟隨手指移動
  draggedItemElement.style.left = (e.clientX - dragOffsetX) + "px";
  draggedItemElement.style.top = (e.clientY - dragOffsetY) + "px";

  // 依手指位置調整虛線佔位
  const siblingCards = Array.from(
    listContainer.querySelectorAll(".expense-item-card:not(.is-dragging)")
  );

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

      // 短按放開（未滿 1 秒且非滾動移動）
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

    const editingExpense = state.editingExpenseId
      ? state.expenses.find((e) => e.id === state.editingExpenseId && e.tripId === state.trip.id)
      : null;

    // 編輯模式：載入原始資料至草稿。
    if (editingExpense && expenseDraft.loadedExpenseId !== editingExpense.id) {
      loadExpenseIntoDraft(editingExpense);
    }

    const isItemized = expenseDraft.mode === "itemized";
    const totals = calculateItemsTotal();
    const jpyVal = isItemized
      ? (totals.totalNet > 0 ? totals.totalNet : (editingExpense ? editingExpense.jpy : ""))
      : (editingExpense ? editingExpense.jpy : "");
    const twdVal = editingExpense && editingExpense.twd != null ? editingExpense.twd : "";
    const titleVal = editingExpense ? escapeHtml(editingExpense.title || "") : "";
    const dateVal = editingExpense ? (editingExpense.date || today(state.trip.timezone)) : today(state.trip.timezone);
    const categoryVal = editingExpense ? editingExpense.category : "餐飲";
    const methodVal = editingExpense ? editingExpense.method : "現金";
    const payerVal = editingExpense ? editingExpense.payer : null;
    const discountVal = editingExpense ? (editingExpense.discount != null ? editingExpense.discount : 0) : 0;
    const rewardVal = editingExpense ? (editingExpense.reward != null ? editingExpense.reward : 0) : 0;
    const rewardAllocVal = editingExpense ? (editingExpense.rewardAllocation || "proportional") : "proportional";
    const fxRateVal = editingExpense && editingExpense.fxRate != null ? editingExpense.fxRate : "";

    // 若為現金且有系統匯率，初始化載入旗標
    if (editingExpense && editingExpense.method === "現金" && expenseFxState.rate == null && editingExpense.fxRate) {
      expenseFxState.rate = editingExpense.fxRate;
      expenseFxState.isManual = !!editingExpense.fxRateManual;
    }

    return (
      pageHeader("NEW EXPENSE", "新增支出", "先記錄消費，再確認付款與分帳細節。") +
      '<form id="expense-form" class="card form">' +
      '<div class="expense-basic-info">' +

      // 一、基本資料
      '<h3>基本資料</h3>' +
      '<div class="field"><label for="expense-title">支出名稱</label>' +
      '<input id="expense-title" name="title" required maxlength="80" placeholder="例如：博多拉麵" value="' + titleVal + '"></div>' +

      '<div class="form-grid">' +
      '<div class="field"><label>消費日期</label>' +
      '<input name="date" type="date" value="' + dateVal + '" required></div>' +

      '<div class="field"><label>支出分類</label>' +
      '<select name="category">' +
      ['餐飲','交通','住宿','購物','門票','其他'].map((c) =>
        '<option value="' + c + '"' + (categoryVal === c ? " selected" : "") + '>' + c + '</option>'
      ).join("") +
      '</select></div></div>' +
      '</div>' +

      // 二、分攤方式
      '<h3>分攤方式</h3>' +
      '<div class="field">' +
      '<select name="split">' +
      '<option value="personal"' + ((expenseDraft.split || "equal") === "personal" ? " selected" : "") + '>個人費用</option>' +
      '<option value="equal"' + ((expenseDraft.split || "equal") === "equal" ? " selected" : "") + '>平均分攤</option>' +
      '<option value="exact"' + ((expenseDraft.split || "equal") === "exact" ? " selected" : "") + '>自訂金額</option>' +
      '<option value="items"' + ((expenseDraft.split || "equal") === "items" ? " selected" : "") + '>依品項分攤</option>' +
      '</select>' +
      '<small id="expense-split-hint" class="hint">' +
      (expenseDraft.split === "personal"
        ? "個人費用由付款人本人負擔，不分攤給其他旅伴。"
        : expenseDraft.split === "items"
        ? "依各品項設定旅伴分配數量。"
        : "選擇分攤方式後，設定旅伴如何分配這筆支出。") +
      '</small></div>' +

      // 三、消費明細
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
      '<div class="itemized-calc-hint"><small class="hint">長按卡片約 1 秒可拖曳排序；短按可展開／收合編輯。</small></div>' +
      '</div>' +

      '<div id="expense-items-list" class="expense-items-list">' +
      renderExpenseItemsListHtml() +
      '</div>' +

      '<button type="button" class="btn secondary small" data-action="add-item" style="width: 100%; margin-top: 6px;">＋ 新增品項</button>' +
      '</div>' +

      // 四、付款資訊
      '<h3>付款資訊</h3>' +
      '<div class="field payment-method"><label>付款方式</label>' +
      '<label class="choice"><input type="radio" name="method" value="現金"' + (methodVal === "現金" ? " checked" : "") + '>現金</label>' +
      '<label class="choice"><input type="radio" name="method" value="信用卡"' + (methodVal === "信用卡" ? " checked" : "") + '>信用卡</label></div>' +

      // 現金付款：依消費日期取得匯率並自動換算台幣（依 2026-11-21 規格）
      '<div id="cash-fx-fields">' +
      '<div class="form-grid">' +
      '<div class="field">' +
      '<label>匯率 (JPY→TWD) <span class="optional-hint">(可手動修改)</span></label>' +
      '<input id="fx-rate" name="fxRate" type="number" step="0.0001" min="0" inputmode="decimal" placeholder="載入中…" value="' + escapeHtml(String(fxRateVal)) + '">' +
      '<small id="fx-rate-status" class="hint">' + (expenseFxState.isManual ? "手動覆寫" : "系統匯率") + '</small></div>' +
      '<div class="field">' +
      '<label>換算台幣金額</label>' +
      '<input id="fx-converted" type="text" readonly class="readonly-calc" placeholder="—" value="' + (twdVal !== "" ? twdVal : "") + '">' +
      '<small class="hint">由日幣金額 × 匯率自動計算</small></div>' +
      '</div>' +
      '<small id="fx-error" class="hint" style="color:var(--danger); display:none;"></small>' +
      '</div>' +

      '<div class="form-grid">' +
      '<div class="field"><label>實際台幣金額</label>' +
      '<input id="expense-twd" name="twd" type="number" min="0" step="1" placeholder="待補可留空" value="' + (twdVal !== "" ? twdVal : "") + '">' +
      '<small id="twd-hint" class="hint">' + (methodVal === "現金" ? "由匯率自動換算" : "以帳單實際請款金額為準") + '</small></div>' +

      '<div class="field"><label>付款人</label>' +
      '<select name="payer">' +
      state.members.map((member) =>
        '<option value="' + escapeHtml(member.name) + '"' + (payerVal === member.name ? " selected" : "") + '>' +
        escapeHtml(member.name) + '</option>'
      ).join("") +
      '</select></div></div>' +

      // 五、折扣與回饋
      '<h3>折扣與回饋</h3>' +
      '<div id="credit-card-reward-fields" hidden>' +
      '<div class="form-grid">' +
      '<div class="field">' +
      '<label>折扣金額</label>' +
      '<input name="discount" type="number" min="0" step="0.1" value="' + discountVal + '">' +
      '<small class="hint">折扣明細及分配計算將於下一階段實作。</small></div>' +

      '<div class="field">' +
      '<label>信用卡回饋點數</label>' +
      '<input name="reward" type="number" min="0" step="1" value="' + rewardVal + '">' +
      '</div>' +
      '</div>' +

      '<div class="field">' +
      '<label>回饋分配方式</label>' +
      '<select name="rewardAllocation">' +
      '<option value="proportional"' + (rewardAllocVal === "proportional" ? " selected" : "") + '>依各旅伴實際消費比例分配</option>' +
      '<option value="cardholder"' + (rewardAllocVal === "cardholder" ? " selected" : "") + '>全部歸刷卡人</option>' +
      '</select></div>' +
      '</div>' +

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
    return '<button class="back" data-page="bookkeeping">← 返回記帳清單</button>' +
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
          escapeHtml(item.split === "items" ? "依品項分攤" : item.split === "exact" ? "自訂金額" : item.split === "personal" ? "個人費用" : "平均分攤") +
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
          item.items.map((it) => {
            let allocInfo = "";
            if (item.split === "items" && it.allocations && Object.keys(it.allocations).length > 0) {
              // 優先使用支出建立時保存的旅伴快照。
              // 沒有快照時，使用來源旅程的旅伴清單。
              // 來源旅程不存在時，顯示「未知旅伴」，不再回退目前旅程的成員。
              // 修改日期：2026-11-24
              const detailMembers = (item.members && item.members.length)
                ? item.members
                : (state.membersByTrip[item.tripId] || []);
              const memberNameById = Object.fromEntries(
                detailMembers.map((m) => [m.id, m.name])
              );
              const allocatedList = Object.keys(it.allocations)
                .filter((id) => Number(it.allocations[id]) > 0)
                .map((id) => {
                  const name = memberNameById[id] || "未知旅伴";
                  return `${escapeHtml(name)}: ${it.allocations[id]} ${escapeHtml(it.unit || "件")}`;
                })
                .join("、");
              if (allocatedList) {
                allocInfo = '<div class="allocation-detail-list">分配：' + allocatedList + '</div>';
              }
            }
            return (
              '<div class="row">' +
              '<span><strong>' + escapeHtml(it.name) + '</strong><br>' +
              '<small class="hint">' + it.quantity + (it.unit ? escapeHtml(it.unit) : "") + ' × ¥' + Number(it.unitPrice).toLocaleString("zh-TW") +
              (it.discount > 0 ? '（折抵 ¥' + Number(it.discount).toLocaleString("zh-TW") + '）' : '') +
              (it.note ? ' · ' + escapeHtml(it.note) : '') +
              '</small>' +
              allocInfo +
              '</span>' +
              '<strong>¥' + Number(it.net).toLocaleString("zh-TW") + '</strong>' +
              '</div>'
            );
          }).join("") +
          '</div>'
        : '') +

      // 提供編輯與取消這筆示範支出的按鈕。
      '<div class="actions">' +
      '<button class="btn" type="button" data-action="edit-expense" data-id="' + escapeHtml(item.id) + '">編輯支出</button>' +
      '<button class="btn danger" type="button" data-action="cancel-expense" data-id="' + escapeHtml(item.id) + '">取消示範支出</button>' +
      '</div>' +

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
    const fullMembers = state.membersByTrip[state.trip.id] || [];
    return pageHeader("TRAVEL MEMBERS", "旅伴管理", "查看成員並邀請旅伴加入同一本旅行帳本。") +
      // 將所有未移除的旅伴資料轉換成畫面上的成員項目。
      '<div class="card">' + state.members.map((member) => {
        const isCreator = fullMembers.findIndex((m) => m.id === member.id) === 0;
        return (
          '<div class="member" data-member-id="' + escapeHtml(member.id) + '">' +
          '<span class="avatar">' + escapeHtml(member.name.slice(0, 1)) + '</span>' +
          '<span class="member-info"><strong>' + escapeHtml(member.name) + '</strong>' +
          '<small>' + escapeHtml(member.role) + '</small></span>' +
          (isCreator ? '<span class="pill">你</span>' : '') +
          '<div style="display:flex;gap:6px;">' +
          '<button class="btn secondary small" type="button" data-action="edit-member" data-id="' + escapeHtml(member.id) + '">編輯</button>' +
          (isCreator ? '' : '<button class="btn danger small" type="button" data-action="remove-member" data-id="' + escapeHtml(member.id) + '">移除</button>') +
          '</div></div>'
        );
      }).join("") + '</div>' +
      '<div class="actions">' +
      '<button class="btn" type="button" data-action="add-member">＋ 新增旅伴</button>' +
      '<button class="btn secondary" type="button" data-action="invite">產生示範邀請碼</button>' +
      '</div>';
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

// =========================
// 每日行程頁面
// 修改日期：2026-11-14
// =========================

function renderItinerary() {
  // 顯示目前旅程名稱與行程頁標題。
  const start = state.trip.start;
  const end = state.trip.end;

  // 產生每日日期清單（含開始日與結束日）。
  const days = [];
  if (start && end && start <= end) {
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
  }

  // 預設選取第一天。
  if (state.selectedItineraryDate === null || !days.includes(state.selectedItineraryDate)) {
    state.selectedItineraryDate = days.length ? days[0] : null;
  }
  const selectedDate = state.selectedItineraryDate;

  const itinerary = state.itinerary || {};

  // 日期標籤列（精簡橫向）。
  const dateBar = days.length
    ? '<div class="itinerary-date-bar">' +
      days.map((d) => {
        const isActive = d === selectedDate;
        return (
          '<button type="button" class="itinerary-date-tab' + (isActive ? " active" : "") + '" ' +
          'data-action="select-itinerary-date" data-date="' + escapeHtml(d) + '">' +
          escapeHtml(d.slice(5).replace("-", "/")) + "（" + escapeHtml(weekdayZh(d)) + "）" +
          "</button>"
        );
      }).join("") +
      "</div>"
    : "";

  let body = "";
  if (days.length === 0) {
    body = '<div class="empty">目前尚未設定旅程日期，無法產生每日行程。</div>';
  } else if (!selectedDate) {
    body = '<div class="empty">請選擇日期。</div>';
  } else {
    const spots = Array.isArray(itinerary[selectedDate]) ? itinerary[selectedDate] : [];

    const renderAddBtn = (index) =>
      '<div class="timeline-add-row">' +
      '<button class="btn small" type="button" data-action="add-itinerary-spot" data-date="' + escapeHtml(selectedDate) + '" data-index="' + index + '">＋新增景點</button>' +
      "</div>";

    const renderSpot = (spot, index, isLast) => {
      const arrive = spot.arriveTime ? escapeHtml(spot.arriveTime) : "";
      const depart = spot.departTime ? escapeHtml(spot.departTime) : "";
      const timeLabel = depart || arrive
        ? (depart ? depart : "") + (depart && arrive ? " → " : "") + (arrive ? arrive : "")
        : "";
      const address = spot.address
        ? '<div class="itinerary-address">' + escapeHtml(spot.address) + '</div>'
        : "";
      const note = spot.note
        ? '<div class="itinerary-note">' + escapeHtml(spot.note) + '</div>'
        : "";
      const mapLink = spot.mapUrl
        ? '<a class="itinerary-map-link" href="' + escapeHtml(spot.mapUrl) + '" target="_blank" rel="noopener">地圖</a>'
        : "";
      return (
        '<div class="timeline-row" data-index="' + index + '">' +
        '<div class="timeline-time-col">' +
        (timeLabel ? '<span class="timeline-time">' + timeLabel + '</span>' : "") +
        "</div>" +
        '<div class="timeline-dot-col">' +
        '<span class="timeline-dot"></span>' +
        (isLast ? "" : '<span class="timeline-line"></span>') +
        "</div>" +
        '<div class="timeline-card-col">' +
        '<div class="itinerary-spot" data-index="' + index + '" data-id="' + escapeHtml(spot.id) + '">' +
        '<div class="itinerary-spot-name">' +
        '<span class="itinerary-drag-handle" title="長按可拖曳排序" aria-label="拖曳手柄">⋮⋮</span>' +
        escapeHtml(spot.name || "未命名景點") + mapLink +
        '<button class="btn secondary small" type="button" data-action="edit-itinerary-spot" data-date="' + escapeHtml(selectedDate) + '" data-id="' + escapeHtml(spot.id) + '" style="margin-left:auto;">編輯</button>' +
        '<button class="btn danger small" type="button" data-action="remove-itinerary-spot" data-date="' + escapeHtml(selectedDate) + '" data-id="' + escapeHtml(spot.id) + '">刪除</button>' +
        "</div>" +
        address +
        note +
        "</div>" +
        "</div>" +
        "</div>"
      );
    };

    const renderTransportSegment = (date, destIndex, spot) => {
      const transport = spot.transport;
      const travelTime = spot.travelTime;
      const transportText = transport
        ? "交通：" + escapeHtml(transport) + (travelTime ? " · " + escapeHtml(String(travelTime)) + " 分鐘" : "")
        : "交通：未設定";
      return (
        '<div class="timeline-transport-row">' +
        '<div class="timeline-time-col"></div>' +
        '<div class="timeline-dot-col"><span class="timeline-line"></span></div>' +
        '<div class="timeline-card-col">' +
        '<div class="itinerary-transport">' + transportText +
        '<button class="btn secondary small" type="button" data-action="edit-itinerary-transport" data-date="' + escapeHtml(date) + '" data-index="' + destIndex + '" style="margin-left:8px;">編輯交通</button>' +
        "</div>" +
        "</div>" +
        "</div>"
      );
    };

    let timelineHtml = '<div class="itinerary-timeline">';

    // 頂部新增景點入口
    timelineHtml += renderAddBtn(0);

    if (spots.length === 0) {
      timelineHtml += '<div class="empty itinerary-empty">尚未安排景點</div>';
    } else {
      spots.forEach((spot, index) => {
        timelineHtml += renderSpot(spot, index, index === spots.length - 1);
        if (index < spots.length - 1) {
          timelineHtml += renderTransportSegment(selectedDate, index + 1, spots[index + 1]);
          timelineHtml += renderAddBtn(index + 1);
        }
      });
      // 最後新增景點入口
      timelineHtml += renderAddBtn(spots.length);
    }

    timelineHtml += "</div>";
    body = timelineHtml;
  }

  // 捲動日期列讓選取日期可見（僅在不可見時調整）。
  setTimeout(() => {
    const bar = document.querySelector(".itinerary-date-bar");
    const active = bar && bar.querySelector(".itinerary-date-tab.active");
    if (!bar || !active) return;
    const barRect = bar.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    if (tabRect.left >= barRect.left && tabRect.right <= barRect.right) return;
    const targetLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, 0);

  return pageHeader(
    "TRAVEL ITINERARY",
    "每日行程",
    state.trip.name + "｜安排每天的景點與交通"
  ) +
    dateBar +
    '<div class="itinerary-list">' + body + "</div>";
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

    // 行程頁：渲染前保存日期列水平捲動位置。
    const isItin = state.page === "itinerary";
    let savedDateBarScroll = 0;
    if (isItin) {
      const _bar = document.querySelector(".itinerary-date-bar");
      if (_bar) savedDateBarScroll = _bar.scrollLeft;
    }

    // 將目前選擇的主題套用到整個網頁。
    document.documentElement.dataset.theme = state.theme;

    // 執行目前頁面對應的函式，並將產生的 HTML 放進 #view。
    // 如果頁面名稱不存在，就改為顯示首頁。
    $("#view").innerHTML = (renderers[state.page] || renderHome)();

    // 行程頁：還原日期列捲動位置，僅在選取日期不可見時調整。
    if (isItin) {
      const _bar = document.querySelector(".itinerary-date-bar");
      if (_bar) {
        _bar.scrollLeft = savedDateBarScroll;
        const _active = _bar.querySelector(".itinerary-date-tab.active");
        if (_active) {
          const _barRect = _bar.getBoundingClientRect();
          const _tabRect = _active.getBoundingClientRect();
          if (_tabRect.left < _barRect.left || _tabRect.right > _barRect.right) {
            const _targetLeft = _active.offsetLeft - (_bar.clientWidth - _active.offsetWidth) / 2;
            _bar.scrollTo({ left: Math.max(0, _targetLeft), behavior: "smooth" });
          }
        }
      }
    }

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

    // 行程頁：初始化左右滑動切換日期手勢。
    if (state.page === "itinerary") initItinerarySwipe();
    // 行程頁：初始化時間軸拖曳排序。
    if (state.page === "itinerary") initItineraryTimelineDragAndDrop();
  }


  // =========================
  // 16. 切換頁面
  // =========================

  function navigate(page) {

    // 切換至新增支出時，重置品項草稿（編輯模式除外）。
    // 修改日期：2026-11-26
    if (page === "expense-new") {
      if (!state.editingExpenseId) {
        resetExpenseDraft("direct");
      }
    } else {
      // 離開新增/編輯支出頁時，清除編輯狀態。
      state.editingExpenseId = null;
      expenseDraft.loadedExpenseId = null;
    }

    // 確認目標頁面存在，不存在時返回首頁。
    state.page = renderers[page] ? page : "home";

    // 重新產生頁面內容。
    render();

    // 新增支出頁：初始化現金匯率換算。
    if (state.page === "expense-new") {
      setTimeout(() => initExpenseFormFx(), 0);
    }

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

        // 確保該旅程有獨立的旅伴清單。
        // 修改日期：2026-11-24
        if (!state.membersByTrip[selectedTrip.id]) {
          state.membersByTrip[selectedTrip.id] = [
            { id: uid(), name: "我", role: "主要管理者" }
          ];
        }

        // 確保該旅程有獨立的行程資料。
        // 修改日期：2026-11-26
        if (!state.itineraryByTrip[selectedTrip.id]) {
          state.itineraryByTrip[selectedTrip.id] = {};
        }

        state.trip = {
          id: selectedTrip.id,
          name: selectedTrip.name,
          dates: selectedTrip.dates,
          start: selectedTrip.start || selectedTrip.dates?.split(" – ")[0]?.trim() || "",
          end: selectedTrip.end || selectedTrip.dates?.split(" – ")[1]?.trim() || "",
          status: selectedTrip.status || "準備中",
          memberCount: selectedTrip.memberCount || 1,
          totalJPY: selectedTrip.totalJPY || 0,
          totalTWD: selectedTrip.totalTWD || 0,
          timezone: selectedTrip.timezone || "Asia/Taipei"
        };

        // 重置旅程相關狀態，避免前一趟旅程的資料混用。
        state.selectedExpenseId = null;
        state.bookkeepingSort = "desc";
        state.bookkeepingCollapsedDates = [];
        state.selectedItineraryDate = null;

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
        state.editingExpenseId = null;
        expenseDraft.loadedExpenseId = null;
        resetExpenseDraft("direct");
        showDialog(renderExpenseForm());
        setTimeout(() => initExpenseFormFx(), 0);
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

      // 新增旅伴：開啟表單。
      case "add-member": {
        showDialog(
          '<h2>新增旅伴</h2>' +
          '<form id="member-form" class="form" data-mode="add">' +
          '<div class="field"><label>旅伴名稱</label>' +
          '<input name="name" required maxlength="20" placeholder="例如：小明"></div>' +
          '<div class="field"><label>角色</label>' +
          '<select name="role">' +
          '<option value="旅伴">旅伴</option>' +
          '<option value="主要管理者">主要管理者</option>' +
          '</select></div>' +
          '<button class="btn" type="submit">新增</button></form>'
        );
        break;
      }

      // 編輯旅伴：開啟預填表單。
      case "edit-member": {
        const memberId = actionButton.dataset.id;
        const member = (state.membersByTrip[state.trip.id] || []).find((m) => m.id === memberId);
        if (!member) { showToast("找不到該旅伴"); break; }
        const isCreator = (state.membersByTrip[state.trip.id] || []).findIndex((m) => m.id === memberId) === 0;
        showDialog(
          '<h2>編輯旅伴</h2>' +
          '<form id="member-form" class="form" data-mode="edit" data-id="' + escapeHtml(memberId) + '">' +
          '<div class="field"><label>旅伴名稱</label>' +
          '<input name="name" required maxlength="20" value="' + escapeHtml(member.name) + '"></div>' +
          '<div class="field"><label>角色</label>' +
          '<select name="role"' + (isCreator ? ' disabled' : '') + '>' +
          '<option value="旅伴"' + (member.role === "旅伴" ? " selected" : "") + '>旅伴</option>' +
          '<option value="主要管理者"' + (member.role === "主要管理者" ? " selected" : "") + '>主要管理者</option>' +
          '</select>' +
          (isCreator ? '<small class="hint">建立者角色不可變更</small>' : '') +
          '</div>' +
          '<button class="btn" type="submit">儲存</button></form>'
        );
        break;
      }

      // 移除旅伴：軟刪除，保留歷史資料。
      case "remove-member": {
        const memberId = actionButton.dataset.id;
        const fullMembers = state.membersByTrip[state.trip.id] || [];
        const idx = fullMembers.findIndex((m) => m.id === memberId);
        if (idx < 0) { showToast("找不到該旅伴"); break; }
        if (idx === 0) { showToast("建立者不可移除"); break; }
        if (!window.confirm("確定移除這位旅伴？歷史支出資料將保留。")) break;
        fullMembers[idx].removed = true;
        render();
        showToast("旅伴已移除");
        break;
      }

      // 新增景點：開啟表單（日期自動帶入）。
      case "add-itinerary-spot": {
        const date = actionButton.dataset.date;
        const index = actionButton.dataset.index;
        showDialog(
          '<h2>新增景點</h2>' +
          '<form id="itinerary-spot-form" class="form" data-date="' + escapeHtml(date) + '" data-spot-id="" data-index="' + escapeHtml(index || "") + '">' +
          '<div class="field"><label>景點名稱 <span class="required-star">*</span></label>' +
          '<input name="name" required maxlength="80" placeholder="例如：博多運河城"></div>' +
          '<div class="field"><label>地址</label>' +
          '<input name="address" maxlength="200" placeholder="選填"></div>' +
          '<div class="field"><label>交通方式（從上一景點前往）</label>' +
          '<input name="transport" maxlength="40" placeholder="步行、地鐵、計程車..."></div>' +
          '<div class="field"><label>預估移動時間（分鐘）</label>' +
          '<input name="travelTime" type="number" min="0" step="1" placeholder="選填"></div>' +
          '<div class="form-grid">' +
          '<div class="field"><label>預計出發</label>' +
          '<input name="departTime" type="time"></div>' +
          '<div class="field"><label>預計抵達</label>' +
          '<input name="arriveTime" type="time"></div>' +
          '</div>' +
          '<div class="field"><label>備註</label>' +
          '<textarea name="note" maxlength="200" style="width:100%;min-height:60px;padding:12px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical;" placeholder="選填"></textarea></div>' +
          '<button class="btn" type="submit">儲存景點</button></form>'
        );
        break;
      }

      // 刪除景點：軟確認後移除，保留其他景點。
      // 修改日期：2026-11-28
      case "remove-itinerary-spot": {
        const date = actionButton.dataset.date;
        const spotId = actionButton.dataset.id;
        if (!date || !spotId) { showToast("找不到該景點"); break; }
        if (!window.confirm("確定刪除這個景點？")) break;
        const spots = state.itinerary[date];
        if (Array.isArray(spots)) {
          const idx = spots.findIndex((s) => s.id === spotId);
          if (idx >= 0) {
            spots.splice(idx, 1);
            if (spots.length === 0) {
              delete state.itinerary[date];
            }
            showToast("景點已刪除");
          } else {
            showToast("找不到該景點");
          }
        }
        state.page = "itinerary";
        render();
        break;
      }

      // 編輯景點：載入原有資料。
      case "edit-itinerary-spot": {
        const date = actionButton.dataset.date;
        const spotId = actionButton.dataset.id;
        const spots = (state.itinerary && state.itinerary[date]) || [];
        const spot = spots.find((s) => s.id === spotId);
        if (!spot) { showToast("找不到該景點"); break; }
        showDialog(
          '<h2>編輯景點</h2>' +
          '<form id="itinerary-spot-form" class="form" data-date="' + escapeHtml(date) + '" data-spot-id="' + escapeHtml(spotId) + '">' +
          '<div class="field"><label>景點名稱 <span class="required-star">*</span></label>' +
          '<input name="name" required maxlength="80" value="' + escapeHtml(spot.name || "") + '"></div>' +
          '<div class="field"><label>地址</label>' +
          '<input name="address" maxlength="200" value="' + escapeHtml(spot.address || "") + '"></div>' +
          '<div class="field"><label>交通方式（從上一景點前往）</label>' +
          '<input name="transport" maxlength="40" value="' + escapeHtml(spot.transport || "") + '"></div>' +
          '<div class="form-grid">' +
          '<div class="field"><label>預計出發</label>' +
          '<input name="departTime" type="time" value="' + escapeHtml(spot.departTime || "") + '"></div>' +
          '<div class="field"><label>預計抵達</label>' +
          '<input name="arriveTime" type="time" value="' + escapeHtml(spot.arriveTime || "") + '"></div>' +
          '</div>' +
          '<div class="field"><label>備註</label>' +
          '<textarea name="note" maxlength="200" style="width:100%;min-height:60px;padding:12px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical;">' + escapeHtml(spot.note || "") + '</textarea></div>' +
          '<button class="btn" type="submit">儲存景點</button></form>'
        );
        break;
      }

      // 行程日期切換：只顯示該日行程。
      // 修改日期：2026-11-28
      case "select-itinerary-date": {
        const date = actionButton.dataset.date;
        if (date) {
          state.selectedItineraryDate = date;
          render();
        }
        break;
      }

      // 編輯景點間的交通資訊及預估移動時間。
      // 修改日期：2026-11-28
      case "edit-itinerary-transport": {
        const date = actionButton.dataset.date;
        const destIndex = Number(actionButton.dataset.index);
        const spots = (state.itinerary && state.itinerary[date]) || [];
        const spot = spots[destIndex];
        if (!spot) { showToast("找不到該景點"); break; }
        showDialog(
          '<h2>編輯交通資訊</h2>' +
          '<form id="itinerary-transport-form" class="form" data-date="' + escapeHtml(date) + '" data-index="' + destIndex + '">' +
          '<div class="field"><label>交通方式（從上一景點前往）</label>' +
          '<input name="transport" maxlength="40" value="' + escapeHtml(spot.transport || "") + '" placeholder="步行、地鐵、計程車..."></div>' +
          '<div class="field"><label>預估移動時間（分鐘）</label>' +
          '<input name="travelTime" type="number" min="0" step="1" value="' + escapeHtml(spot.travelTime || "") + '" placeholder="選填"></div>' +
          '<button class="btn" type="submit">儲存交通</button></form>'
        );
        break;
      }

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
          note: "",
          allocations: {},
          saved: false,
          savedAllocations: {}
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
      case "edit-expense": {
        const expenseId = actionButton.dataset.id;
        const expense = state.expenses.find((e) => e.id === expenseId && e.tripId === state.trip.id);
        if (!expense) { showToast("找不到該支出"); break; }
        state.editingExpenseId = expenseId;
        state.selectedExpenseId = expenseId;
        loadExpenseIntoDraft(expense);
        navigate("expense-new");
        break;
      }

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
    // 旅伴新增/編輯表單
    // 修改日期：2026-11-24
    // -------------------------
    if (event.target.id === "member-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const mode = event.target.dataset.mode;
      const name = String(form.get("name") || "").trim();
      const role = String(form.get("role") || "旅伴");

      if (!name) {
        showToast("請輸入旅伴名稱");
        return;
      }

      const fullMembers = state.membersByTrip[state.trip.id];
      if (mode === "add") {
        fullMembers.push({ id: uid(), name: name, role: role });
        showToast("旅伴已新增");
      } else if (mode === "edit") {
        const memberId = event.target.dataset.id;
        const member = fullMembers.find((m) => m.id === memberId);
        if (!member) { showToast("找不到該旅伴"); return; }
        const isCreator = fullMembers.findIndex((m) => m.id === memberId) === 0;
        member.name = name;
        if (!isCreator) member.role = role;
        showToast("旅伴已更新");
      }

      $("#dialog").close();
      state.page = "members";
      render();
    }

    // -------------------------
    // 行程景點新增/編輯表單
    // 修改日期：2026-11-27
    // -------------------------
    if (event.target.id === "itinerary-spot-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const date = event.target.dataset.date;
      const spotId = event.target.dataset.spotId || "";
      const name = String(form.get("name") || "").trim();

      if (!name) {
        showToast("請輸入景點名稱");
        return;
      }

      if (!state.itinerary[date]) state.itinerary[date] = [];

      const travelTimeRaw = String(form.get("travelTime") || "").trim();
      let travelTimeValue = null;
      if (travelTimeRaw !== "") {
        if (!/^\d+$/.test(travelTimeRaw)) {
          showToast("預估移動時間請輸入非負整數");
          return;
        }
        travelTimeValue = Number(travelTimeRaw);
      }

      const spotData = {
        id: spotId || uid(),
        name: name,
        address: String(form.get("address") || "").trim(),
        transport: String(form.get("transport") || "").trim() || null,
        travelTime: travelTimeValue,
        departTime: String(form.get("departTime") || "").trim(),
        arriveTime: String(form.get("arriveTime") || "").trim(),
        note: String(form.get("note") || "").trim()
      };

      if (spotId) {
        const idx = state.itinerary[date].findIndex((s) => s.id === spotId);
        if (idx >= 0) {
          state.itinerary[date][idx] = spotData;
        } else {
          state.itinerary[date].push(spotData);
        }
        showToast("景點已更新");
      } else {
        const insertIndex = event.target.dataset.index;
        if (insertIndex !== undefined && insertIndex !== "" && state.itinerary[date].length > 0) {
          const idx = Math.max(0, Math.min(Number(insertIndex), state.itinerary[date].length));
          state.itinerary[date].splice(idx, 0, spotData);
        } else {
          state.itinerary[date].push(spotData);
        }
        showToast("景點已新增");
      }

      $("#dialog").close();
      state.page = "itinerary";
      render();
    }

    // -------------------------
    // 行程交通資訊編輯表單
    // 修改日期：2026-11-28
    // -------------------------
    if (event.target.id === "itinerary-transport-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const date = event.target.dataset.date;
      const idx = Number(event.target.dataset.index);
      const spots = state.itinerary[date];
      if (!Array.isArray(spots) || !spots[idx]) {
        showToast("找不到該景點");
        return;
      }
      spots[idx].transport = String(form.get("transport") || "").trim() || null;
      const travelTimeRaw = String(form.get("travelTime") || "").trim();
      if (travelTimeRaw !== "" && !/^\d+$/.test(travelTimeRaw)) {
        showToast("預估移動時間請輸入非負整數");
        return;
      }
      spots[idx].travelTime = travelTimeRaw === "" ? null : Number(travelTimeRaw);
      showToast("交通資訊已更新");
      $("#dialog").close();
      state.page = "itinerary";
      render();
    }

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
      if (!["equal", "exact", "items", "personal"].includes(split)) {
        showToast("請選擇有效的分攤方式");
        return;
      }

      // 依 2026-11-19 規格：直接輸入總額模式不可使用「依品項分攤」
      if (mode === "direct" && split === "items") {
        showToast("直接輸入總額模式不可使用「依品項分攤」，請切換為逐項記錄或選擇其他分攤方式");
        return;
      }

      // 若選擇「依品項分攤」，驗證各品項之旅伴分配進度與數量
      if (split === "items") {
        for (let i = 0; i < expenseDraft.items.length; i++) {
          const it = expenseDraft.items[i];
          const qty = Number(it.quantity) || 0;
          const allocations = it.allocations || {};
          let allocated = 0;

          // 驗證單一旅伴分配數量規則
          for (const member of state.members) {
            const mVal = Number(allocations[member.id]) || 0;
            if (mVal < 0) {
              showToast(`品項「${it.name || "未命名品項"}」分配數量不可小於 0`);
              expenseDraft.expandedItemId = it.id;
              updateExpenseItemsDOM();
              const targetEl = document.querySelector(`.expense-item-card[data-item-id="${it.id}"]`);
              if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            if (mVal > qty) {
              showToast(`品項「${it.name || "未命名品項"}」中 ${member.name} 的分配數量不可超過購買數量（${qty}）`);
              expenseDraft.expandedItemId = it.id;
              updateExpenseItemsDOM();
              const targetEl = document.querySelector(`.expense-item-card[data-item-id="${it.id}"]`);
              if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            allocated = round1(allocated + mVal);
          }

          const diff = round1(allocated - qty);
          if (diff < -0.0001) {
            showToast(`品項「${it.name || "未命名品項"}」分配未完成（尚缺 ${round1(qty - allocated)}）`);
            expenseDraft.expandedItemId = it.id;
            updateExpenseItemsDOM();
            const targetEl = document.querySelector(`.expense-item-card[data-item-id="${it.id}"]`);
            if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          if (diff > 0.0001) {
            showToast(`品項「${it.name || "未命名品項"}」分配超額（超額 ${diff}）`);
            expenseDraft.expandedItemId = it.id;
            updateExpenseItemsDOM();
            const targetEl = document.querySelector(`.expense-item-card[data-item-id="${it.id}"]`);
            if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
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

      // 將支出資料整理為物件（新增或編輯共用）。
      // 修改日期：2026-11-26
      const newExpenseData = {

        // 產生新的支出 ID（編輯模式保留原 ID）。
        id: state.editingExpenseId || uid(),

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

        // 現金付款時記錄使用的匯率與是否手動覆寫（依 2026-11-21 規格）。
        fxRate: form.get("method") === "現金" ? (Number(form.get("fxRate")) || null) : null,
        fxRateManual: form.get("method") === "現金" ? expenseFxState.isManual : false,

        // 儲存付款方式。
        method: form.get("method"),

        // 儲存付款人。
        payer: form.get("payer"),

        // 儲存分攤方式（平均分攤 equal、自訂金額 exact、依品項分攤 items、個人費用 personal）。
        // 修改日期：2026-11-23
        split: split,

        // 保存支出建立時的旅伴快照，供明細顯示使用，避免後續成員變更造成名稱錯誤。
        // 修改日期：2026-11-24
        members: state.members.map((m) => ({ id: m.id, name: m.name })),

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
              allocations: { ...(item.allocations || {}) },
              gross: getItemCalculations(item).gross,
              net: getItemCalculations(item).net
            }))
          : [],

        // 台幣尚未填寫時標記為待補；
        // 已填寫時標記為待後端確認。
        status: twdValue === null ? "待補" : "待後端確認"
      };

      // 依模式儲存：編輯更新原紀錄，新增建立新紀錄。
      // 修改日期：2026-11-26
      if (state.editingExpenseId) {
        const idx = state.expenses.findIndex((e) => e.id === state.editingExpenseId);
        if (idx >= 0) {
          const original = state.expenses[idx];
          state.expenses[idx] = {
            ...newExpenseData,
            id: original.id,
            tripId: original.tripId,
            recordedAt: original.recordedAt,
            members: original.members
          };
        }
        const editingId = state.editingExpenseId;
        state.editingExpenseId = null;
        expenseDraft.loadedExpenseId = null;
        resetExpenseDraft("direct");
        showToast("支出已更新");
        state.selectedExpenseId = editingId;
        navigate("expense-detail");
      } else {
        state.expenses.unshift(newExpenseData);
        resetExpenseDraft("direct");
        showToast("已加入本機示範紀錄");
        $("#dialog").close();
        navigate("bookkeeping");
      }
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

      // 為新旅程初始化獨立的旅伴清單（建立者為主要管理者）。
      // 修改日期：2026-11-24
      state.membersByTrip[newTripId] = [
        { id: uid(), name: "我", role: "主要管理者" }
      ];

      // 為新旅程初始化獨立的行程資料。
      // 修改日期：2026-11-26
      state.itineraryByTrip[newTripId] = {};

      // 建立完成後直接切換至剛建立的旅程。
      // 修改日期：2026-11-25
      const newTrip = state.trips[0];
      state.trip = {
        id: newTrip.id,
        name: newTrip.name,
        dates: newTrip.dates,
        start: newTrip.start,
        end: newTrip.end,
        status: newTrip.status,
        memberCount: newTrip.memberCount,
        totalJPY: newTrip.totalJPY,
        totalTWD: newTrip.totalTWD,
        timezone: newTrip.timezone
      };
      state.selectedExpenseId = null;
      state.bookkeepingSort = "desc";
      state.bookkeepingCollapsedDates = [];
      state.selectedItineraryDate = null;
      $("#dialog").close();
      navigate("trip");
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

      // 現金/信用卡切換時，控制匯率換算欄位與台幣金額可編輯性。
      // 修改日期：2026-11-24
      const cashFx = document.getElementById("cash-fx-fields");
      const twdInput = document.querySelector('#expense-form input[name="twd"]');
      const twdHint = document.getElementById("twd-hint");
      if (event.target.value === "現金") {
        if (cashFx) cashFx.hidden = false;
        if (twdInput) {
          twdInput.readOnly = true;
          twdInput.classList.add("readonly-calc");
        }
        if (twdHint) twdHint.textContent = "由匯率自動換算";
        const dateInput = document.querySelector('#expense-form input[name="date"]');
        if (dateInput && dateInput.value) {
          expenseFxState.isManual = false;
          loadFxRateForDate(dateInput.value);
        }
      } else {
        if (cashFx) cashFx.hidden = true;
        if (twdInput) {
          twdInput.readOnly = false;
          twdInput.classList.remove("readonly-calc");
        }
        if (twdHint) twdHint.textContent = "以帳單實際請款金額為準";
      }
    }

    // 切換消費記錄模式（直接輸入總額 vs 逐項記錄）
    if (event.target.name === "expense-mode") {
      setExpenseMode(event.target.value);
    }

    // 切換分攤方式
    // 修改日期：2026-11-23
    if (event.target.name === "split") {
      const split = event.target.value;
      expenseDraft.split = split;

      // 更新分攤方式提示文字
      const splitHint = document.getElementById("expense-split-hint");
      if (splitHint) {
        splitHint.textContent =
          split === "personal"
            ? "個人費用由付款人本人負擔，不分攤給其他旅伴。"
            : split === "items"
            ? "依各品項設定旅伴分配數量。"
            : "選擇分攤方式後，設定旅伴如何分配這筆支出。";
      }

      // 直接輸入總額模式選擇「依品項分攤」時，自動切換為逐項記錄，
      // 讓選項保持可用且不使用 disabled 反白樣式。
      if (split === "items" && expenseDraft.mode !== "itemized") {
        const itemizedRadio = document.querySelector('input[name="expense-mode"][value="itemized"]');
        if (itemizedRadio) itemizedRadio.checked = true;
        setExpenseMode("itemized");
      }

      // 旅伴分配數量欄位只在「依品項分攤」時顯示。
      // 修改日期：2026-11-24
      document.querySelectorAll(".item-allocation-card-block").forEach((block) => {
        block.style.display = split === "items" ? "" : "none";
      });
    }

    // 分配數量變更完成（失焦或按 Enter，進行格式整理與上限校驗）
    if (event.target.classList.contains("allocation-quantity-input")) {
      const itemId = event.target.dataset.itemId;
      const memberId = event.target.dataset.memberId;
      const item = expenseDraft.items.find((it) => it.id === itemId);
      if (!item) return;

      const qty = Number(item.quantity) || 0;
      let val = Number(event.target.value) || 0;

      if (val < 0) {
        val = 0;
        event.target.value = "0";
        showToast("分配數量不可小於 0");
      } else if (val > qty) {
        val = qty;
        event.target.value = String(qty);
        showToast(`分配數量不得超過品項購買數量（${qty}）`);
      } else {
        event.target.value = val === 0 && event.target.value.trim() === "" ? "" : String(round1(val));
      }

      if (!item.allocations) item.allocations = {};
      item.allocations[memberId] = round1(val);
      updateItemAllocationStatusInPlace(itemId);
    }
  });

  // 監聽即時輸入事件（品項金額即時小計計算）
  document.addEventListener("input", (event) => {
    // 更新品項分配數量（即時響應，不重新渲染 DOM 以免焦點遺失及光標跳動）
    if (event.target.classList.contains("allocation-quantity-input")) {
      const itemId = event.target.dataset.itemId;
      const memberId = event.target.dataset.memberId;
      const item = expenseDraft.items.find((it) => it.id === itemId);
      if (!item) return;

      let val = event.target.value;

      // 移除非數字與非小數點字符
      val = val.replace(/[^\d.]/g, "");
      const dotIndex = val.indexOf(".");
      if (dotIndex !== -1) {
        // 最多保留一位小數
        val = val.slice(0, dotIndex + 1) + val.slice(dotIndex + 1).replace(/\./g, "").slice(0, 1);
      }
      if (val !== event.target.value) {
        event.target.value = val;
      }

      if (!item.allocations) item.allocations = {};

      const numVal = val === "" || val === "." ? 0 : Number(val);
      item.allocations[memberId] = numVal;

      updateItemAllocationStatusInPlace(itemId);
      return;
    }
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
