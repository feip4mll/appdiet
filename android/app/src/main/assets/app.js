const STORAGE_KEY = "vale-verde-stock-v1";
const DEFAULT_COMPANY = "Vale Verde";

const storageAdapter = createStorageAdapter();
const state = loadState();

const elements = {
  todayLabel: document.querySelector("#today-label"),
  monthInfoLabel: document.querySelector("#month-info-label"),
  remainingDaysLabel: document.querySelector("#remaining-days-label"),
  selectedDateLabel: document.querySelector("#selected-date-label"),
  monthPill: document.querySelector("#month-pill"),
  daysInMonthPill: document.querySelector("#days-in-month-pill"),
  monthProgressPill: document.querySelector("#month-progress-pill"),
  calendarStrip: document.querySelector("#calendar-strip"),
  todayProductsCount: document.querySelector("#today-products-count"),
  todayTotalQuantity: document.querySelector("#today-total-quantity"),
  monthFilledDays: document.querySelector("#month-filled-days"),
  topCategory: document.querySelector("#top-category"),
  monthOverview: document.querySelector("#month-overview"),
  dayStockList: document.querySelector("#day-stock-list"),
  dayListTitle: document.querySelector("#day-list-title"),
  stockForm: document.querySelector("#stock-form"),
  quickEntryForm: document.querySelector("#quick-entry-form"),
  quickEntryText: document.querySelector("#quick-entry-text"),
  previousMonthButton: document.querySelector("#previous-month-button"),
  nextMonthButton: document.querySelector("#next-month-button"),
  copyYesterdayButton: document.querySelector("#copy-yesterday-button"),
  exportButton: document.querySelector("#export-button"),
};

const formatLongDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatMonthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const formatWeekday = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

wireEvents();
render();
registerServiceWorker();

function loadState() {
  return storageAdapter.loadState();
}

function createDefaultState() {
  return {
    companyName: DEFAULT_COMPANY,
    selectedDate: todayKey(),
    days: {},
  };
}

function saveState() {
  storageAdapter.saveState(state);
}

function createStorageAdapter() {
  const androidDatabase = window.AndroidDatabase;
  const supportsAndroidDatabase =
    androidDatabase &&
    typeof androidDatabase.loadState === "function" &&
    typeof androidDatabase.saveState === "function";

  if (supportsAndroidDatabase) {
    return {
      loadState() {
        try {
          const stored = androidDatabase.loadState();
          if (!stored) {
            return createDefaultState();
          }

          return normalizeState(JSON.parse(stored));
        } catch (error) {
          console.error("Falha ao carregar dados do banco Android.", error);
          return createDefaultState();
        }
      },
      saveState(nextState) {
        try {
          androidDatabase.saveState(JSON.stringify(nextState));
        } catch (error) {
          console.error("Falha ao salvar dados no banco Android.", error);
        }
      },
    };
  }

  return {
    loadState() {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return createDefaultState();
        }

        return normalizeState(JSON.parse(stored));
      } catch (error) {
        console.error("Falha ao carregar dados locais.", error);
        return createDefaultState();
      }
    },
    saveState(nextState) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    },
  };
}

function normalizeState(rawState) {
  const safeDays = {};

  if (rawState?.days && typeof rawState.days === "object") {
    for (const [dateKey, record] of Object.entries(rawState.days)) {
      const items = Array.isArray(record?.items)
        ? record.items.map(normalizeItem).filter(Boolean)
        : [];

      safeDays[dateKey] = { items };
    }
  }

  return {
    companyName: rawState?.companyName || DEFAULT_COMPANY,
    selectedDate: rawState?.selectedDate || todayKey(),
    days: safeDays,
  };
}

function normalizeItem(rawItem) {
  if (!rawItem || typeof rawItem !== "object") {
    return null;
  }

  const product = String(rawItem.product || "").trim();
  const quantity = Number(rawItem.quantity || 0);

  if (!product || Number.isNaN(quantity) || quantity < 0) {
    return null;
  }

  return {
    id: String(rawItem.id || createId()),
    product,
    category: String(rawItem.category || "Outros"),
    quantity,
    unit: String(rawItem.unit || "kg"),
    operator: String(rawItem.operator || "Equipe"),
    updatedAt: String(rawItem.updatedAt || formatCurrentTime()),
  };
}

function wireEvents() {
  elements.stockForm.addEventListener("submit", handleStockSubmit);
  elements.quickEntryForm.addEventListener("submit", handleQuickEntrySubmit);
  elements.previousMonthButton.addEventListener("click", () => shiftMonth(-1));
  elements.nextMonthButton.addEventListener("click", () => shiftMonth(1));
  elements.copyYesterdayButton.addEventListener("click", copyYesterday);
  elements.exportButton.addEventListener("click", exportData);
}

function render() {
  renderHero();
  renderCalendar();
  renderDayStock();
  renderStats();
  renderMonthOverview();
}

function renderHero() {
  const actualToday = new Date();
  const selectedDate = parseDateKey(state.selectedDate);
  const daysInMonth = getDaysInMonth(selectedDate);
  const currentDay = selectedDate.getDate();
  const remainingDays = Math.max(daysInMonth - currentDay, 0);

  elements.todayLabel.textContent = capitalize(
    formatLongDate.format(actualToday),
  );
  elements.monthInfoLabel.textContent = `${capitalize(formatMonthYear.format(selectedDate))} | ${daysInMonth} dias`;
  elements.remainingDaysLabel.textContent = `${remainingDays} dia${remainingDays === 1 ? "" : "s"}`;
  elements.selectedDateLabel.textContent = capitalize(
    formatLongDate.format(selectedDate),
  );
  elements.monthPill.textContent = capitalize(formatMonthYear.format(selectedDate));
  elements.daysInMonthPill.textContent = `${daysInMonth} dias no mes`;
  elements.monthProgressPill.textContent = `Dia ${currentDay} de ${daysInMonth}`;
}

function renderCalendar() {
  const selectedDate = parseDateKey(state.selectedDate);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const daysInMonth = getDaysInMonth(selectedDate);

  elements.calendarStrip.innerHTML = "";

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const record = getDayRecord(key);
    const button = document.createElement("button");

    button.type = "button";
    button.className = "calendar-day";

    if (key === state.selectedDate) {
      button.classList.add("is-selected");
    }

    if (key === todayKey()) {
      button.classList.add("is-today");
    }

    if (record.items.length > 0) {
      button.classList.add("has-items");
    }

    button.innerHTML = `
      <span class="calendar-day-weekday">${capitalizeShortWeekday(formatWeekday.format(date))}</span>
      <span class="calendar-day-number">${day}</span>
    `;

    button.addEventListener("click", () => {
      state.selectedDate = key;
      saveState();
      render();
    });

    elements.calendarStrip.appendChild(button);
  }
}

function renderDayStock() {
  const record = getDayRecord(state.selectedDate);
  const totalItems = record.items.length;
  const dateLabel = capitalize(formatLongDate.format(parseDateKey(state.selectedDate)));

  elements.dayListTitle.textContent = `Produtos registrados em ${dateLabel}`;

  if (totalItems === 0) {
    elements.dayStockList.innerHTML = `
      <article class="empty-state">
        <strong>Nenhum item registrado neste dia.</strong>
        <p>Adicione o estoque manualmente ou use a entrada rapida para preencher mais depressa.</p>
      </article>
    `;
    return;
  }

  const sortedItems = [...record.items].sort((a, b) =>
    a.product.localeCompare(b.product, "pt-BR"),
  );

  elements.dayStockList.innerHTML = "";

  for (const item of sortedItems) {
    const article = document.createElement("article");
    article.className = "stock-item";
    article.innerHTML = `
      <div>
        <strong>${escapeHtml(item.product)}</strong>
        <p class="stock-item-meta">
          ${escapeHtml(item.category)} | Atualizado por ${escapeHtml(item.operator || "Equipe")} | ${escapeHtml(item.updatedAt)}
        </p>
      </div>
      <div>
        <div class="stock-item-quantity">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</div>
        <button type="button" class="remove-button" data-item-id="${item.id}">
          Remover
        </button>
      </div>
    `;

    const removeButton = article.querySelector(".remove-button");
    removeButton.addEventListener("click", () => removeItem(item.id));

    elements.dayStockList.appendChild(article);
  }
}

function renderStats() {
  const selectedRecord = getDayRecord(state.selectedDate);
  const selectedDate = parseDateKey(state.selectedDate);
  const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`;

  const monthRecords = Object.entries(state.days)
    .filter(([dateKey, record]) => dateKey.startsWith(monthKey) && record.items.length > 0)
    .map(([, record]) => record);

  const totalQuantity = selectedRecord.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const categoryCounts = countCategories(monthRecords.flatMap((record) => record.items));

  elements.todayProductsCount.textContent = String(selectedRecord.items.length);
  elements.todayTotalQuantity.textContent = numberFormatter.format(totalQuantity);
  elements.monthFilledDays.textContent = String(monthRecords.length);
  elements.topCategory.textContent = categoryCounts[0]?.name || "--";
}

function renderMonthOverview() {
  const selectedDate = parseDateKey(state.selectedDate);
  const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`;

  const monthEntries = Object.entries(state.days)
    .filter(([dateKey, record]) => dateKey.startsWith(monthKey) && record.items.length > 0)
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate));

  if (monthEntries.length === 0) {
    elements.monthOverview.innerHTML = `
      <article class="empty-state">
        <strong>Este mes ainda nao tem movimentacao salva.</strong>
        <p>Assim que voce preencher o estoque diario, o resumo mensal aparece aqui automaticamente.</p>
      </article>
    `;
    return;
  }

  const topProducts = aggregateProducts(monthEntries);

  elements.monthOverview.innerHTML = `
    <article class="overview-card">
      <strong>Dias com estoque registrado</strong>
      <p>${monthEntries.map(([dateKey]) => humanShortDate(dateKey)).join(" | ")}</p>
    </article>
    <article class="overview-card">
      <strong>Produtos mais movimentados no mes</strong>
      <p>${topProducts.join(" | ")}</p>
    </article>
  `;
}

function handleStockSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.stockForm);
  const product = String(formData.get("productName") || "").trim();
  const category = String(formData.get("productCategory") || "Outros");
  const quantityValue = Number(String(formData.get("productQuantity") || "0").replace(",", "."));
  const unit = String(formData.get("productUnit") || "kg");
  const operator = String(formData.get("operatorName") || "").trim();

  if (!product || quantityValue <= 0) {
    return;
  }

  const record = getDayRecord(state.selectedDate);
  record.items.push(createItem({ product, category, quantity: quantityValue, unit, operator }));
  state.days[state.selectedDate] = record;

  saveState();
  elements.stockForm.reset();
  document.querySelector("#product-category").value = "Legume";
  document.querySelector("#product-unit").value = "kg";
  render();
}

function handleQuickEntrySubmit(event) {
  event.preventDefault();

  const quickText = elements.quickEntryText.value.trim();
  if (!quickText) {
    return;
  }

  const parsedItems = parseQuickEntry(quickText);
  if (parsedItems.length === 0) {
    window.alert("Nao consegui interpretar a lista. Tente no formato: tomate 40 kg");
    return;
  }

  const operatorValue = String(document.querySelector("#operator-name").value || "").trim();
  const record = getDayRecord(state.selectedDate);

  for (const item of parsedItems) {
    record.items.push(createItem({ ...item, operator: operatorValue }));
  }

  state.days[state.selectedDate] = record;
  saveState();
  elements.quickEntryForm.reset();
  render();
}

function createItem({ product, category, quantity, unit, operator }) {
  return {
    id: createId(),
    product,
    category,
    quantity,
    unit,
    operator: operator || "Equipe",
    updatedAt: formatCurrentTime(),
  };
}

function removeItem(itemId) {
  const record = getDayRecord(state.selectedDate);
  record.items = record.items.filter((item) => item.id !== itemId);
  state.days[state.selectedDate] = record;
  saveState();
  render();
}

function copyYesterday() {
  const yesterday = parseDateKey(state.selectedDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);
  const sourceRecord = getDayRecord(yesterdayKey);

  if (sourceRecord.items.length === 0) {
    window.alert("Nao existe estoque salvo no dia anterior.");
    return;
  }

  const shouldCopy = window.confirm(
    "Deseja copiar todos os itens de ontem para o dia selecionado?",
  );
  if (!shouldCopy) {
    return;
  }

  const destinationRecord = getDayRecord(state.selectedDate);

  for (const item of sourceRecord.items) {
    destinationRecord.items.push(
      createItem({
        product: item.product,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        operator: item.operator,
      }),
    );
  }

  state.days[state.selectedDate] = destinationRecord;
  saveState();
  render();
}

function exportData() {
  const payload = {
    companyName: state.companyName,
    exportedAt: new Date().toISOString(),
    days: state.days,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `vale-verde-estoque-${state.selectedDate}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function shiftMonth(offset) {
  const currentDate = parseDateKey(state.selectedDate);
  const targetYear = currentDate.getFullYear();
  const targetMonth = currentDate.getMonth() + offset;
  const targetDay = currentDate.getDate();
  const nextDate = new Date(targetYear, targetMonth, 1);
  const nextMonthDays = getDaysInMonth(nextDate);

  nextDate.setDate(Math.min(targetDay, nextMonthDays));
  state.selectedDate = toDateKey(nextDate);
  saveState();
  render();
}

function parseQuickEntry(text) {
  const lines = text
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const normalizedLine = line.replace(/\s*[-:]\s*/g, " ").replace(",", ".");
      const match = normalizedLine.match(
        /^(?<product>[A-Za-zÀ-ÿ\s]+?)\s+(?<quantity>\d+(?:\.\d+)?)\s*(?<unit>[A-Za-zÀ-ÿ]+)?$/u,
      );

      if (!match?.groups) {
        return null;
      }

      const product = capitalize(match.groups.product.trim());
      const quantity = Number(match.groups.quantity);
      const unit = normalizeUnit(match.groups.unit);

      if (!product || Number.isNaN(quantity) || quantity <= 0) {
        return null;
      }

      return {
        product,
        quantity,
        unit,
        category: guessCategory(product),
      };
    })
    .filter(Boolean);
}

function guessCategory(productName) {
  const product = productName.toLowerCase();
  const verduras = ["alface", "couve", "rucula", "agriao", "repolho", "espinafre"];
  const frutas = ["banana", "melao", "melancia", "mamao", "abacaxi", "manga"];
  const legumes = ["tomate", "cenoura", "batata", "pepino", "abobrinha", "berinjela", "cebola", "beterraba"];

  if (verduras.some((item) => product.includes(item))) {
    return "Verdura";
  }

  if (frutas.some((item) => product.includes(item))) {
    return "Fruta";
  }

  if (legumes.some((item) => product.includes(item))) {
    return "Legume";
  }

  return "Outros";
}

function aggregateProducts(monthEntries) {
  const productsMap = new Map();

  for (const [, record] of monthEntries) {
    for (const item of record.items) {
      const key = `${item.product}__${item.unit}`;
      const current = productsMap.get(key) || {
        product: item.product,
        unit: item.unit,
        total: 0,
      };

      current.total += Number(item.quantity || 0);
      productsMap.set(key, current);
    }
  }

  return [...productsMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((item) => `${item.product}: ${formatQuantity(item.total)} ${item.unit}`);
}

function countCategories(items) {
  const counts = new Map();

  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

function getDayRecord(dateKey) {
  return state.days[dateKey] || {
    items: [],
  };
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return toDateKey(new Date());
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function humanShortDate(dateKey) {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatQuantity(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatCurrentTime() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function normalizeUnit(unit) {
  const safeUnit = String(unit || "kg").trim().toLowerCase();

  if (!safeUnit) {
    return "kg";
  }

  if (safeUnit.startsWith("quil") || safeUnit === "k" || safeUnit === "kg") {
    return "kg";
  }

  if (safeUnit.startsWith("caix")) {
    return "caixa";
  }

  if (safeUnit.startsWith("mac")) {
    return "maco";
  }

  if (safeUnit.startsWith("band")) {
    return "bandeja";
  }

  if (safeUnit.startsWith("uni")) {
    return "unidade";
  }

  return safeUnit;
}

function capitalize(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function capitalizeShortWeekday(value) {
  return capitalize(value.replace(".", ""));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (!window.location.protocol.startsWith("http")) {
    return;
  }

  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
