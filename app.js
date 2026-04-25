const DEFAULT_WATER_ML = 1500;
const DEFAULT_CALORIE_GOAL = 2000;

const state = {
  token: localStorage.getItem("primeDietToken") || "",
  user: localStorage.getItem("primeDietUserId")
    ? { id: Number(localStorage.getItem("primeDietUserId")) || 0 }
    : null,
  dailyWaterMl: DEFAULT_WATER_ML,
  dailyCalorieGoal: DEFAULT_CALORIE_GOAL,
  meals: [],
  historyMeals: [],
  selectedMealPhoto: "",
  editingMealId: 0,
  activeTab: "area",
  selectedHistoryDate: "",
};

const elements = {
  screenAuth: document.querySelector("#screen-auth"),
  screenHome: document.querySelector("#screen-home"),
  screenMeal: document.querySelector("#screen-meal"),
  showLogin: document.querySelector("#show-login"),
  showRegister: document.querySelector("#show-register"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  authFeedback: document.querySelector("#auth-feedback"),
  logoutButton: document.querySelector("#logout-button"),
  caloriesTotal: document.querySelector("#calories-total"),
  caloriesProgress: document.querySelector("#calories-progress"),
  calorieGoalInput: document.querySelector("#calorie-goal-input"),
  saveGoalButton: document.querySelector("#save-goal-button"),
  waterTotal: document.querySelector("#water-total"),
  waterMlInput: document.querySelector("#water-ml-input"),
  saveWaterButton: document.querySelector("#save-water-button"),
  waterAdd250: document.querySelector("#water-add-250"),
  waterAdd500: document.querySelector("#water-add-500"),
  waterAdd750: document.querySelector("#water-add-750"),
  homeDate: document.querySelector("#home-date"),
  mealChecklist: document.querySelector("#meal-checklist"),
  aiFeedbackButton: document.querySelector("#ai-feedback-button"),
  aiFeedbackOutput: document.querySelector("#ai-feedback-output"),
  goMealButton: document.querySelector("#go-meal-button"),
  mealScreenTitle: document.querySelector("#meal-screen-title"),
  mealForm: document.querySelector("#meal-form"),
  mealId: document.querySelector("#meal-id"),
  mealName: document.querySelector("#meal-name"),
  mealCalories: document.querySelector("#meal-calories"),
  mealType: document.querySelector("#meal-type"),
  mealSubmitButton: document.querySelector("#meal-submit-button"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
  openGalleryButton: document.querySelector("#open-gallery-button"),
  openCameraButton: document.querySelector("#open-camera-button"),
  mealPhotoGallery: document.querySelector("#meal-photo-gallery"),
  mealPhotoCamera: document.querySelector("#meal-photo-camera"),
  mealPhotoPreview: document.querySelector("#meal-photo-preview"),
  mealFeedback: document.querySelector("#meal-feedback"),
  backHomeButton: document.querySelector("#back-home-button"),
  tabArea: document.querySelector("#tab-area"),
  tabActivities: document.querySelector("#tab-activities"),
  areaPanel: document.querySelector("#area-panel"),
  activitiesPanel: document.querySelector("#activities-panel"),
  historyDateInput: document.querySelector("#history-date-input"),
  loadHistoryButton: document.querySelector("#load-history-button"),
  historyTotalCalories: document.querySelector("#history-total-calories"),
  historyGoalBalance: document.querySelector("#history-goal-balance"),
  historyWaterTotal: document.querySelector("#history-water-total"),
  historyMealCount: document.querySelector("#history-meal-count"),
  historyLabel: document.querySelector("#history-label"),
  historyMealList: document.querySelector("#history-meal-list"),
};

boot();

async function boot() {
  await clearLegacyServiceWorkers();
  loadUserPreferences();
  bindEvents();
  setupPhotoPickerByPlatform();
  initializeHistoryControls();
  showScreen(state.token ? "home" : "auth");

  if (state.token) {
    await refreshMeals();
  }
}

async function clearLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {}
}

function bindEvents() {
  elements.showLogin.addEventListener("click", () => showAuthTab("login"));
  elements.showRegister.addEventListener("click", () => showAuthTab("register"));
  elements.loginForm.addEventListener("submit", onLogin);
  elements.registerForm.addEventListener("submit", onRegister);
  elements.logoutButton.addEventListener("click", onLogout);

  elements.saveGoalButton.addEventListener("click", onSaveCalorieGoal);
  elements.saveWaterButton.addEventListener("click", onSaveWaterMl);
  elements.waterAdd250.addEventListener("click", () => onWaterQuickAdd(250));
  elements.waterAdd500.addEventListener("click", () => onWaterQuickAdd(500));
  elements.waterAdd750.addEventListener("click", () => onWaterQuickAdd(750));

  elements.aiFeedbackButton.addEventListener("click", onGenerateAiFeedback);
  elements.goMealButton.addEventListener("click", startCreateMeal);
  elements.mealChecklist.addEventListener("click", onMealListClick);
  elements.backHomeButton.addEventListener("click", () => showScreen("home"));
  elements.mealForm.addEventListener("submit", onCreateMeal);
  elements.cancelEditButton.addEventListener("click", onCancelEditMeal);
  elements.openGalleryButton.addEventListener("click", () => elements.mealPhotoGallery.click());
  elements.openCameraButton.addEventListener("click", () => elements.mealPhotoCamera.click());
  elements.mealPhotoGallery.addEventListener("change", onMealPhotoChange);
  elements.mealPhotoCamera.addEventListener("change", onMealPhotoChange);

  elements.tabArea.addEventListener("click", () => setHomeTab("area"));
  elements.tabActivities.addEventListener("click", () => setHomeTab("activities"));
  elements.loadHistoryButton.addEventListener("click", onLoadHistoryClick);
  elements.historyDateInput.addEventListener("change", onHistoryDateChanged);
}

function initializeHistoryControls() {
  const today = getTodayDateString();
  elements.historyDateInput.max = today;
  elements.historyDateInput.value = today;
  state.selectedHistoryDate = today;
}

function showAuthTab(tab) {
  const isLogin = tab === "login";
  elements.loginForm.classList.toggle("is-hidden", !isLogin);
  elements.registerForm.classList.toggle("is-hidden", isLogin);
  elements.showLogin.classList.toggle("is-active", isLogin);
  elements.showRegister.classList.toggle("is-active", !isLogin);
  setFeedback(elements.authFeedback, "", "");
}

function showScreen(screen) {
  elements.screenAuth.classList.toggle("is-hidden", screen !== "auth");
  elements.screenHome.classList.toggle("is-hidden", screen !== "home");
  elements.screenMeal.classList.toggle("is-hidden", screen !== "meal");
}

function setHomeTab(tab) {
  state.activeTab = tab;
  const isArea = tab === "area";
  elements.tabArea.classList.toggle("is-active", isArea);
  elements.tabActivities.classList.toggle("is-active", !isArea);
  elements.areaPanel.classList.toggle("is-hidden", !isArea);
  elements.activitiesPanel.classList.toggle("is-hidden", isArea);

  if (!isArea) {
    void loadHistoryForDate(state.selectedHistoryDate || getTodayDateString());
  }
}

async function onLogin(event) {
  event.preventDefault();
  const formData = new FormData(elements.loginForm);
  const payload = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const response = await apiRequest("/api/auth/login", "POST", payload, false);
  if (!response.ok) {
    setFeedback(elements.authFeedback, response.error || "Falha no login.", "error");
    return;
  }

  state.token = response.data.token;
  state.user = response.data.user;
  localStorage.setItem("primeDietToken", state.token);
  localStorage.setItem("primeDietUserId", String(response.data.user.id));
  loadUserPreferences();
  setFeedback(elements.authFeedback, "Login realizado.", "success");
  await refreshMeals();
  showScreen("home");
}

async function onRegister(event) {
  event.preventDefault();
  const formData = new FormData(elements.registerForm);
  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const response = await apiRequest("/api/auth/register", "POST", payload, false);
  if (!response.ok) {
    setFeedback(elements.authFeedback, response.error || "Falha no cadastro.", "error");
    return;
  }

  setFeedback(elements.authFeedback, "Conta criada. Faca login.", "success");
  showAuthTab("login");
  elements.loginForm.email.value = payload.email;
}

function onLogout() {
  state.token = "";
  state.user = null;
  state.meals = [];
  state.historyMeals = [];
  state.dailyWaterMl = DEFAULT_WATER_ML;
  state.dailyCalorieGoal = DEFAULT_CALORIE_GOAL;
  localStorage.removeItem("primeDietToken");
  localStorage.removeItem("primeDietUserId");
  showScreen("auth");
}

function onSaveCalorieGoal() {
  const nextGoal = Number(elements.calorieGoalInput.value);
  if (!Number.isInteger(nextGoal) || nextGoal < 800) {
    setFeedback(elements.mealFeedback, "Defina uma meta valida (minimo 800 kcal).", "error");
    return;
  }
  state.dailyCalorieGoal = nextGoal;
  saveUserPreferences();
  saveDailySnapshot(getTodayDateString());
  renderHome();
  setFeedback(elements.mealFeedback, "Meta de calorias atualizada.", "success");
}

function onSaveWaterMl() {
  const nextWater = Number(elements.waterMlInput.value);
  if (!Number.isInteger(nextWater) || nextWater < 0) {
    setFeedback(elements.mealFeedback, "Informe um valor de agua valido em ml.", "error");
    return;
  }
  state.dailyWaterMl = nextWater;
  saveUserPreferences();
  saveDailySnapshot(getTodayDateString());
  renderHome();
  setFeedback(elements.mealFeedback, "Hidratacao atualizada.", "success");
}

function onWaterQuickAdd(amount) {
  state.dailyWaterMl += amount;
  saveUserPreferences();
  saveDailySnapshot(getTodayDateString());
  renderHome();
}

async function onCreateMeal(event) {
  event.preventDefault();
  const formData = new FormData(elements.mealForm);
  const editingId = Number(formData.get("mealId")) || 0;
  const payload = {
    name: formData.get("name"),
    calories: Number(formData.get("calories")),
    mealType: formData.get("mealType"),
    photoDataUrl: state.selectedMealPhoto,
  };

  const path = editingId ? `/api/meals/${editingId}` : "/api/meals";
  const method = editingId ? "PUT" : "POST";
  const response = await apiRequest(path, method, payload, true);
  if (!response.ok) {
    setFeedback(elements.mealFeedback, response.error || "Falha ao salvar refeicao.", "error");
    return;
  }

  resetMealForm();
  setFeedback(elements.mealFeedback, editingId ? "Refeicao editada." : "Refeicao salva.", "success");
  await refreshMeals();
  showScreen("home");
}

function setupPhotoPickerByPlatform() {
  const isAndroid = /android/i.test(navigator.userAgent);
  if (!isAndroid) {
    elements.openCameraButton.classList.add("is-hidden");
    elements.openGalleryButton.textContent = "Escolher foto";
  }
}

async function onMealPhotoChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) {
    clearMealPhotoPreview();
    return;
  }
  if (!file.type.startsWith("image/")) {
    clearMealPhotoPreview();
    setFeedback(elements.mealFeedback, "Selecione um arquivo de imagem valido.", "error");
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    state.selectedMealPhoto = dataUrl;
    elements.mealPhotoPreview.src = dataUrl;
    elements.mealPhotoPreview.classList.remove("is-hidden");
    setFeedback(elements.mealFeedback, "Foto selecionada.", "success");
  } catch {
    clearMealPhotoPreview();
    setFeedback(elements.mealFeedback, "Nao foi possivel carregar a foto.", "error");
  }
}

async function refreshMeals() {
  const response = await apiRequest("/api/meals/today", "GET", null, true);
  if (!response.ok) {
    onLogout();
    return;
  }
  state.meals = response.data.meals || [];
  saveDailySnapshot(getTodayDateString());
  elements.aiFeedbackOutput.textContent =
    'Toque em "Gerar" para receber insights rapidos das refeicoes de hoje.';
  renderHome();
}

async function onGenerateAiFeedback() {
  if (!state.meals.length) {
    elements.aiFeedbackOutput.textContent =
      "Adicione pelo menos uma refeicao para liberar o feedback inteligente.";
    return;
  }

  elements.aiFeedbackButton.disabled = true;
  elements.aiFeedbackButton.textContent = "Gerando...";
  elements.aiFeedbackOutput.textContent = "Analisando sua rotina de hoje...";

  const response = await apiRequest(
    "/api/ai/meal-feedback",
    "POST",
    {
      waterLiters: Number((state.dailyWaterMl / 1000).toFixed(2)),
      calorieGoal: state.dailyCalorieGoal,
    },
    true,
  );

  elements.aiFeedbackButton.disabled = false;
  elements.aiFeedbackButton.textContent = "Gerar";

  if (!response.ok) {
    elements.aiFeedbackOutput.textContent =
      response.error || "Nao foi possivel gerar feedback agora.";
    return;
  }
  elements.aiFeedbackOutput.textContent = response.data.feedback;
}

function renderHome() {
  const totalCalories = state.meals.reduce((sum, meal) => sum + meal.calories, 0);
  elements.caloriesTotal.textContent = `${totalCalories} / ${state.dailyCalorieGoal}`;
  elements.caloriesProgress.max = state.dailyCalorieGoal;
  elements.caloriesProgress.value = Math.min(totalCalories, state.dailyCalorieGoal);
  elements.waterTotal.textContent = `${(state.dailyWaterMl / 1000).toFixed(2)}L`;
  elements.calorieGoalInput.value = String(state.dailyCalorieGoal);
  elements.waterMlInput.value = String(state.dailyWaterMl);
  elements.homeDate.textContent = formatDateLabel(getTodayDateString());
  renderMealChecklist(state.meals);
}

function renderMealChecklist(meals) {
  if (!meals.length) {
    elements.mealChecklist.innerHTML = "<li>Nenhuma refeicao registrada hoje.</li>";
    return;
  }

  elements.mealChecklist.innerHTML = meals
    .map((meal, index) => {
      const photoMarkup = meal.photo_url
        ? `<img class="meal-item-photo" src="${escapeHtml(meal.photo_url)}" alt="Foto de ${escapeHtml(meal.name)}" />`
        : "";
      const toneClass = index % 2 === 0 ? "meal-tone-green" : "meal-tone-orange";
      const mealIcon = getMealIcon(meal.meal_type);

      return `
        <li class="meal-item ${toneClass}" data-id="${meal.id}" style="--i:${index}">
          <div class="meal-item-main">
            <span class="meal-item-icon">${mealIcon}</span>
            <div class="meal-item-copy">
              <strong>${escapeHtml(meal.meal_type)}</strong>
              <p>${escapeHtml(meal.name)} &middot; ${meal.calories} kcal</p>
            </div>
            <span class="meal-item-chevron">&rsaquo;</span>
          </div>
          ${photoMarkup}
          <div class="meal-item-actions">
            <button class="ghost-button small" type="button" data-action="edit" data-id="${meal.id}">Editar</button>
            <button class="ghost-button small danger" type="button" data-action="delete" data-id="${meal.id}">Excluir</button>
          </div>
        </li>
      `;
    })
    .join("");
}

function onHistoryDateChanged() {
  const selectedDate = elements.historyDateInput.value;
  if (!selectedDate) return;
  const today = getTodayDateString();
  if (selectedDate > today) {
    elements.historyDateInput.value = today;
    state.selectedHistoryDate = today;
    return;
  }
  state.selectedHistoryDate = selectedDate;
}

async function onLoadHistoryClick() {
  const selectedDate = elements.historyDateInput.value || getTodayDateString();
  await loadHistoryForDate(selectedDate);
}

async function loadHistoryForDate(dateValue) {
  const today = getTodayDateString();
  const safeDate = dateValue > today ? today : dateValue;
  state.selectedHistoryDate = safeDate;
  elements.historyDateInput.value = safeDate;

  const response = await apiRequest(
    `/api/meals/by-date?date=${encodeURIComponent(safeDate)}`,
    "GET",
    null,
    true,
  );
  if (!response.ok) {
    elements.historyLabel.textContent = response.error || "Nao foi possivel carregar esse dia.";
    elements.historyMealList.innerHTML = "<li>Sem dados para mostrar.</li>";
    return;
  }

  state.historyMeals = response.data.meals || [];
  renderHistoryPanel(safeDate, state.historyMeals);
}

function renderHistoryPanel(dateValue, meals) {
  const totalCalories = meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const snapshot = getDailySnapshot(dateValue);
  const goal = snapshot && snapshot.dailyCalorieGoal ? snapshot.dailyCalorieGoal : state.dailyCalorieGoal;
  const water = snapshot && snapshot.dailyWaterMl >= 0 ? snapshot.dailyWaterMl : 0;
  const balance = totalCalories - goal;
  const balanceText = `${balance >= 0 ? "+" : ""}${balance} kcal`;

  elements.historyTotalCalories.textContent = `${totalCalories} kcal`;
  elements.historyGoalBalance.textContent = balanceText;
  elements.historyWaterTotal.textContent = `${water} ml`;
  elements.historyMealCount.textContent = String(meals.length);
  elements.historyLabel.textContent = `Resumo de ${formatDateLabel(dateValue)}`;

  if (!meals.length) {
    elements.historyMealList.innerHTML = "<li>Nenhuma refeicao registrada nesse dia.</li>";
    return;
  }

  elements.historyMealList.innerHTML = meals
    .map(
      (meal) =>
        `<li><strong>${escapeHtml(meal.meal_type)}</strong>: ${escapeHtml(meal.name)} (${meal.calories} kcal)</li>`,
    )
    .join("");
}

function startCreateMeal() {
  resetMealForm();
  showScreen("meal");
}

function onCancelEditMeal() {
  resetMealForm();
  setFeedback(elements.mealFeedback, "Edicao cancelada.", "");
}

function onMealListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const mealId = Number(button.dataset.id);
  if (!mealId) return;

  if (button.dataset.action === "edit") {
    const meal = state.meals.find((item) => item.id === mealId);
    if (!meal) return;
    state.editingMealId = meal.id;
    elements.mealScreenTitle.textContent = "Editar Refeicao";
    elements.mealId.value = String(meal.id);
    elements.mealName.value = meal.name;
    elements.mealCalories.value = String(meal.calories);
    elements.mealType.value = meal.meal_type;
    elements.mealSubmitButton.textContent = "Atualizar";
    elements.cancelEditButton.classList.remove("is-hidden");
    state.selectedMealPhoto = meal.photo_url || "";
    if (state.selectedMealPhoto) {
      elements.mealPhotoPreview.src = state.selectedMealPhoto;
      elements.mealPhotoPreview.classList.remove("is-hidden");
    } else {
      clearMealPhotoPreview();
    }
    setFeedback(elements.mealFeedback, "Ajuste os dados e toque em atualizar.", "");
    showScreen("meal");
    return;
  }

  if (button.dataset.action === "delete") {
    void deleteMeal(mealId);
  }
}

async function deleteMeal(mealId) {
  const confirmed = window.confirm("Deseja excluir esta refeicao?");
  if (!confirmed) return;
  const response = await apiRequest(`/api/meals/${mealId}`, "DELETE", null, true);
  if (!response.ok) {
    window.alert(response.error || "Falha ao excluir refeicao.");
    return;
  }
  await refreshMeals();
}

async function apiRequest(path, method, body, requiresAuth) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (requiresAuth && state.token) headers.Authorization = `Bearer ${state.token}`;

    const response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error || "Erro inesperado." };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Servidor local indisponivel." };
  }
}

function setFeedback(element, message, stateClass) {
  element.className = `feedback${stateClass ? ` ${stateClass}` : ""}`;
  element.textContent = message;
}

function clearMealPhotoPreview() {
  state.selectedMealPhoto = "";
  elements.mealPhotoGallery.value = "";
  elements.mealPhotoCamera.value = "";
  elements.mealPhotoPreview.src = "";
  elements.mealPhotoPreview.classList.add("is-hidden");
}

function resetMealForm() {
  state.editingMealId = 0;
  elements.mealForm.reset();
  elements.mealId.value = "";
  elements.mealScreenTitle.textContent = "Nova Refeicao";
  elements.mealSubmitButton.textContent = "Salvar";
  elements.cancelEditButton.classList.add("is-hidden");
  clearMealPhotoPreview();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTodayDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDateLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const pretty = formatter.format(date);
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

function getMealIcon(mealType) {
  if (mealType === "Cafe da manha") return "CM";
  if (mealType === "Almoco") return "AL";
  if (mealType === "Jantar") return "JN";
  return "LC";
}

function getCurrentUserId() {
  if (state.user && Number(state.user.id) > 0) return Number(state.user.id);
  const storedId = Number(localStorage.getItem("primeDietUserId") || 0);
  return storedId > 0 ? storedId : 0;
}

function getPreferenceStorageKey() {
  const userId = getCurrentUserId();
  return userId > 0 ? `primeDietPrefs_${userId}` : "primeDietPrefs_default";
}

function loadUserPreferences() {
  const raw = localStorage.getItem(getPreferenceStorageKey());
  if (!raw) {
    state.dailyWaterMl = DEFAULT_WATER_ML;
    state.dailyCalorieGoal = DEFAULT_CALORIE_GOAL;
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const nextWater = Number(parsed.dailyWaterMl);
    const nextGoal = Number(parsed.dailyCalorieGoal);
    state.dailyWaterMl =
      Number.isInteger(nextWater) && nextWater >= 0 ? nextWater : DEFAULT_WATER_ML;
    state.dailyCalorieGoal =
      Number.isInteger(nextGoal) && nextGoal >= 800 ? nextGoal : DEFAULT_CALORIE_GOAL;
  } catch {
    state.dailyWaterMl = DEFAULT_WATER_ML;
    state.dailyCalorieGoal = DEFAULT_CALORIE_GOAL;
  }
}

function saveUserPreferences() {
  localStorage.setItem(
    getPreferenceStorageKey(),
    JSON.stringify({
      dailyWaterMl: state.dailyWaterMl,
      dailyCalorieGoal: state.dailyCalorieGoal,
    }),
  );
}

function getDailyStorageKey() {
  const userId = getCurrentUserId();
  return userId > 0 ? `primeDietDailyStats_${userId}` : "primeDietDailyStats_default";
}

function readDailyStatsMap() {
  const raw = localStorage.getItem(getDailyStorageKey());
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeDailyStatsMap(statsMap) {
  localStorage.setItem(getDailyStorageKey(), JSON.stringify(statsMap));
}

function saveDailySnapshot(dateValue) {
  const statsMap = readDailyStatsMap();
  statsMap[dateValue] = {
    dailyWaterMl: state.dailyWaterMl,
    dailyCalorieGoal: state.dailyCalorieGoal,
  };
  writeDailyStatsMap(statsMap);
}

function getDailySnapshot(dateValue) {
  const statsMap = readDailyStatsMap();
  return statsMap[dateValue] || null;
}
