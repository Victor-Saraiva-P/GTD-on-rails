import { enqueueCapture, pendingCaptures, removeCapture } from "./offline-store.js";

const API_ROOT = "/mobile-api";
const CACHE_KEY = "gtd-mobile-bootstrap-v1";
const EMPTY_BOOTSTRAP = { contexts: [], nextActions: [], calendar: [] };

const state = {
  bootstrap: EMPTY_BOOTSTRAP,
  contextId: localStorage.getItem("gtd-mobile-context") || "all",
  calendarRange: "today"
};

const elements = {
  status: document.querySelector("#status-banner"),
  contexts: document.querySelector("#context-filters"),
  actions: document.querySelector("#next-actions"),
  nextCount: document.querySelector("#next-count"),
  calendar: document.querySelector("#calendar-items"),
  calendarCount: document.querySelector("#calendar-count"),
  pending: document.querySelector("#pending-captures"),
  captureForm: document.querySelector("#capture-form"),
  captureTitle: document.querySelector("#capture-title"),
  captureCount: document.querySelector("#capture-count")
};

initialize();

async function initialize() {
  bindNavigation();
  bindCapture();
  bindCalendarRange();
  bindRefresh();
  registerServiceWorker();
  await loadBootstrap();
  await flushPendingCaptures();
  await renderPendingCaptures();
}

function bindNavigation() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => activateScreen(button.dataset.screen));
  });
}

function activateScreen(screen) {
  setActive(".screen", `#${screen}-screen`);
  setActive(".nav-button", `[data-screen="${screen}"]`);
  document.body.dataset.screen = screen;
  if (screen === "capture") elements.captureTitle.focus();
}

function setActive(allSelector, activeSelector) {
  document.querySelectorAll(allSelector).forEach((node) => node.classList.remove("active"));
  document.querySelector(activeSelector).classList.add("active");
}

function bindCapture() {
  elements.captureTitle.addEventListener("input", updateCaptureCount);
  elements.captureForm.addEventListener("submit", submitCapture);
}

async function submitCapture(event) {
  event.preventDefault();
  const title = elements.captureTitle.value.trim();
  if (!title) return;
  resetCaptureInput();
  await captureOrQueue(title);
  await renderPendingCaptures();
}

function resetCaptureInput() {
  elements.captureTitle.value = "";
  updateCaptureCount();
}

async function captureOrQueue(title) {
  try {
    await postCapture(title);
    showStatus("Captured.", "success");
    await loadBootstrap();
  } catch {
    await enqueueCapture(title);
    showStatus("Saved locally. Waiting for the sync server.", "warning");
  }
}

async function postCapture(title) {
  const response = await fetch(`${API_ROOT}/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  if (!response.ok) throw new Error(`capture failed with HTTP ${response.status}`);
}

async function flushPendingCaptures() {
  const captures = await pendingCaptures();
  for (const capture of captures) {
    if (!await tryPendingCapture(capture)) break;
  }
}

async function tryPendingCapture(capture) {
  try {
    await postCapture(capture.title);
    await removeCapture(capture.id);
    return true;
  } catch {
    return false;
  }
}

async function renderPendingCaptures() {
  const captures = await pendingCaptures();
  elements.pending.innerHTML = captures.length === 0 ? "" : pendingMarkup(captures);
}

function pendingMarkup(captures) {
  const rows = captures.map((capture) => `
    <div class="pending-item">
      <span class="pending-item__glyph">S</span>
      <span>${escapeHtml(capture.title)}</span>
    </div>
  `).join("");
  return `<h2 class="pending-pane__title">Waiting to sync</h2>${rows}`;
}

async function loadBootstrap() {
  try {
    state.bootstrap = await fetchBootstrap();
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.bootstrap));
    hideStatus();
  } catch {
    state.bootstrap = cachedBootstrap();
    showStatus("Offline view. Showing the last local snapshot.", "warning");
  }
  renderAll();
}

async function fetchBootstrap() {
  const response = await fetch(`${API_ROOT}/bootstrap`, { cache: "no-store" });
  if (!response.ok) throw new Error(`bootstrap failed with HTTP ${response.status}`);
  return response.json();
}

function cachedBootstrap() {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return EMPTY_BOOTSTRAP;
  try {
    return JSON.parse(raw);
  } catch {
    return EMPTY_BOOTSTRAP;
  }
}

function renderAll() {
  renderContexts();
  renderNextActions();
  renderCalendar();
}

function renderContexts() {
  const contexts = [{ id: "all", name: "All" }, ...state.bootstrap.contexts];
  elements.contexts.innerHTML = contexts.map(contextButton).join("");
  elements.contexts.querySelectorAll(".context-button").forEach(bindContextButton);
}

function contextButton(context) {
  const active = context.id === state.contextId ? " active" : "";
  return `<button class="context-button${active}" type="button" data-context-id="${context.id}">${escapeHtml(context.name)}</button>`;
}

function bindContextButton(button) {
  button.addEventListener("click", () => selectContext(button.dataset.contextId));
}

function selectContext(contextId) {
  state.contextId = contextId;
  localStorage.setItem("gtd-mobile-context", contextId);
  renderContexts();
  renderNextActions();
}

function renderNextActions() {
  const actions = state.bootstrap.nextActions.filter(matchesContext);
  elements.nextCount.textContent = itemCount(actions.length);
  elements.actions.innerHTML = actions.length === 0
    ? emptyState("No next actions for this context.")
    : actions.map(actionRow).join("");
}

function matchesContext(action) {
  return state.contextId === "all" || action.contextIds.includes(state.contextId);
}

function actionRow(action) {
  return `
    <div class="tree-entry">
      <span class="tree-entry__glyph" aria-hidden="true">N</span>
      <div class="tree-entry__content">
        ${actionPrimary(action)}
        ${actionSecondary(action)}
      </div>
    </div>
  `;
}

function actionPrimary(action) {
  return `
    <div class="tree-entry__primary">
      <span class="tree-entry__label">${escapeHtml(action.title)}</span>
      ${projectAssociation(action.projectTitle)}
    </div>
  `;
}

function actionSecondary(action) {
  const contextNames = action.contextIds.map(contextName).filter(Boolean);
  return `
    <div class="tree-entry__secondary">
      ${contextMeta(contextNames)}
      ${meta(minutesLabel(action.estimatedTimeMinutes))}
      ${meta(energyLabel(action.energy))}
      ${deadlineMeta(action.deadline)}
    </div>
  `;
}

function contextName(id) {
  return state.bootstrap.contexts.find((context) => context.id === id)?.name;
}

function minutesLabel(minutes) {
  return minutes == null || minutes === 0 ? "" : `${minutes} min`;
}

function energyLabel(energy) {
  return energy == null ? "" : `energy ${energy}`;
}

function contextMeta(names) {
  if (names.length === 0) return "";
  const label = names.map((name) => `@${name}`).join(" ");
  return `<span class="context-meta">${escapeHtml(label)}</span>`;
}

function deadlineMeta(deadline) {
  return deadline ? `<span class="deadline-meta">due ${escapeHtml(deadline)}</span>` : "";
}

function projectAssociation(projectTitle) {
  if (!projectTitle) return "";
  return `
    <span class="project-association">
      <span class="project-association__glyph">P</span>
      <span class="project-association__title">${escapeHtml(projectTitle)}</span>
    </span>
  `;
}

function meta(value) {
  return value ? `<span>${escapeHtml(value)}</span>` : "";
}

function bindCalendarRange() {
  document.querySelectorAll(".range-tab").forEach((button) => {
    button.addEventListener("click", () => selectCalendarRange(button.dataset.range));
  });
}

function selectCalendarRange(range) {
  state.calendarRange = range;
  document.querySelectorAll(".range-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.range === range);
  });
  renderCalendar();
}

function renderCalendar() {
  const items = state.bootstrap.calendar.filter(calendarInRange).sort(compareCalendarItems);
  elements.calendarCount.textContent = itemCount(items.length);
  elements.calendar.innerHTML = items.length === 0
    ? emptyState("Nothing scheduled in this range.")
    : items.map(calendarRow).join("");
}

function calendarInRange(item) {
  if (!item.scheduledDate) return false;
  const itemDate = localDate(item.scheduledDate);
  const today = startOfToday();
  const end = new Date(today);
  end.setDate(end.getDate() + (state.calendarRange === "week" ? 7 : 1));
  return itemDate >= today && itemDate < end;
}

function calendarRow(item) {
  const time = item.scheduledTime ? item.scheduledTime.slice(0, 5) : "All day";
  return `
    <div class="tree-entry">
      <span class="tree-entry__glyph" aria-hidden="true">C</span>
      <div class="tree-entry__content">
        ${calendarPrimary(item)}
        <div class="tree-entry__secondary">
          <span class="calendar-time">⏱ ${escapeHtml(time)}</span>
          <span class="calendar-date">${escapeHtml(formatDate(item.scheduledDate))}</span>
        </div>
      </div>
    </div>
  `;
}

function calendarPrimary(item) {
  return `
    <div class="tree-entry__primary">
      <span class="tree-entry__label">${escapeHtml(item.title)}</span>
      ${projectAssociation(item.projectTitle)}
    </div>
  `;
}

function compareCalendarItems(left, right) {
  return calendarSortKey(left).localeCompare(calendarSortKey(right));
}

function calendarSortKey(item) {
  return `${item.scheduledDate}T${item.scheduledTime || "00:00"}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function localDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  return localDate(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function bindRefresh() {
  document.querySelector("#refresh-button").addEventListener("click", refreshMobile);
}

async function refreshMobile() {
  await loadBootstrap();
  await flushPendingCaptures();
  await renderPendingCaptures();
}

function updateCaptureCount() {
  elements.captureCount.textContent = `${elements.captureTitle.value.length} / 200`;
}

function showStatus(message, tone) {
  elements.status.textContent = message;
  elements.status.className = `status-banner ${tone}`;
}

function hideStatus() {
  elements.status.className = "status-banner hidden";
}

function itemCount(count) {
  return `${count} item${count === 1 ? "" : "s"}`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value ?? "";
  return node.innerHTML;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/mobile/service-worker.js", { scope: "/mobile/" });
}
