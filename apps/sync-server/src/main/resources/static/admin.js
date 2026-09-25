const TOKEN_KEY = "gtd-sync-server-admin-token";

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  overview: null,
  objects: [],
  changes: [],
  files: [],
  backups: [],
  clientUpdate: null
};

const elements = {
  authCard: document.querySelector("#auth-card"),
  tokenInput: document.querySelector("#token-input"),
  connection: document.querySelector("#connection-pill"),
  overview: document.querySelector("#overview-section"),
  objectType: document.querySelector("#object-type-filter"),
  showDeleted: document.querySelector("#show-deleted"),
  objects: document.querySelector("#objects-table"),
  changes: document.querySelector("#changes-table"),
  files: document.querySelector("#files-table"),
  backups: document.querySelector("#backups-table"),
  clientUpdate: document.querySelector("#client-update-status"),
  detail: document.querySelector("#object-detail"),
  detailContent: document.querySelector("#object-detail-content"),
  toast: document.querySelector("#toast")
};

document.querySelector("#refresh-button").addEventListener("click", function () { void refreshAll(); });
document.querySelector("#save-token-button").addEventListener("click", saveToken);
document.querySelector("#create-backup-button").addEventListener("click", function () { void createBackup(); });
document.querySelector("#check-update-button").addEventListener("click", function () { void checkClientUpdate(); });
document.querySelector("#install-update-button").addEventListener("click", function () { void installClientUpdate(); });
document.querySelector("#close-detail-button").addEventListener("click", closeDetail);
elements.objectType.addEventListener("change", function () { void loadObjects(); });
elements.showDeleted.addEventListener("change", function () { void loadObjects(); });

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", function () { activateTab(tab.dataset.tab); });
}

void refreshAll();

async function refreshAll() {
  setConnection("Checking…", "unknown");
  try {
    state.overview = await api("/v1/admin/overview");
    hideAuth();
    setConnection("Online", "ok");
    renderOverview();
    updateObjectTypes();
    await Promise.all([loadObjects(), loadChanges(), loadFiles(), loadBackups(), loadClientUpdate()]);
  } catch (error) {
    handleRequestError(error);
  }
}

async function loadObjects() {
  const params = new URLSearchParams({ limit: "200" });
  if (elements.objectType.value) params.set("type", elements.objectType.value);
  if (elements.showDeleted.checked) params.set("includeDeleted", "true");
  try {
    state.objects = await api("/v1/admin/objects?" + params.toString());
    renderObjects();
  } catch (error) {
    handleRequestError(error);
  }
}

async function loadChanges() {
  try {
    state.changes = await api("/v1/admin/changes?limit=200");
    renderChanges();
  } catch (error) {
    handleRequestError(error);
  }
}

async function loadFiles() {
  try {
    state.files = await api("/v1/admin/files?limit=300");
    renderFiles();
  } catch (error) {
    handleRequestError(error);
  }
}

async function loadBackups() {
  try {
    state.backups = await api("/v1/admin/backups");
    renderBackups();
  } catch (error) {
    handleRequestError(error);
  }
}

async function loadClientUpdate() {
  try {
    state.clientUpdate = await api("/v1/admin/update");
    renderClientUpdate();
  } catch (error) {
    handleRequestError(error);
  }
}

async function checkClientUpdate() {
  await runUpdateAction("/v1/admin/update/check", "Update check completed.");
}

async function installClientUpdate() {
  if (!state.clientUpdate || !state.clientUpdate.updateAvailable) return;
  if (!window.confirm("Install the client update now? The service will restart.")) return;
  await runUpdateAction("/v1/admin/update/install", "Installing update; the client will restart.");
}

async function runUpdateAction(path, message) {
  try {
    state.clientUpdate = await api(path, { method: "POST" });
    renderClientUpdate();
    toast(message);
  } catch (error) {
    handleRequestError(error);
  }
}

async function createBackup() {
  const button = document.querySelector("#create-backup-button");
  button.disabled = true;
  try {
    const result = await api("/v1/backups", { method: "POST" });
    toast("Created " + result.fileName);
    await refreshAll();
  } catch (error) {
    handleRequestError(error);
  } finally {
    button.disabled = false;
  }
}

async function restoreBackup(fileName) {
  const confirmation = window.prompt(
    "Restore " + fileName + "?\\n\\nThis replaces the canonical dataset and rotates datasetEpoch.\\nType the snapshot file name to continue."
  );
  if (confirmation !== fileName) return;
  try {
    const result = await api("/v1/backups/restore", {
      method: "POST",
      body: JSON.stringify({ fileName: fileName })
    });
    toast("Restored snapshot. New epoch: " + result.datasetEpoch);
    await refreshAll();
  } catch (error) {
    handleRequestError(error);
  }
}

async function deleteBackup(fileName) {
  if (!window.confirm("Delete backup " + fileName + "? This cannot be undone.")) return;
  try {
    await api("/v1/admin/backups/" + encodeURIComponent(fileName), { method: "DELETE" });
    toast("Deleted " + fileName);
    await loadBackups();
    state.overview = await api("/v1/admin/overview");
    renderOverview();
  } catch (error) {
    handleRequestError(error);
  }
}

function renderOverview() {
  const overview = state.overview;
  if (!overview) return;
  const types = Object.entries(overview.objectTypes || {})
    .map(function (entry) { return entry[0] + ": " + entry[1]; })
    .join(" · ");
  elements.overview.replaceChildren(
    statCard("Cursor", formatNumber(overview.cursor), "Latest canonical change"),
    statCard("Objects", formatNumber(overview.objectCount), formatNumber(overview.deletedCount) + " tombstones"),
    statCard("Changes", formatNumber(overview.changeCount), formatNumber(overview.operationCount) + " operations"),
    statCard("Files", formatNumber(overview.fileCount), formatBytes(overview.fileBytes)),
    statCard("Backups", formatNumber(overview.backupCount), "Immutable snapshots"),
    statCard("Dataset epoch", shortId(overview.datasetEpoch), types || "No canonical objects")
  );
}

function updateObjectTypes() {
  const current = elements.objectType.value;
  const types = Object.keys((state.overview && state.overview.objectTypes) || {})
    .sort(function (left, right) { return left.localeCompare(right); });
  elements.objectType.replaceChildren(option("", "All types"));
  for (const type of types) elements.objectType.append(option(type, type));
  elements.objectType.value = types.includes(current) ? current : "";
}

function renderObjects() {
  const rows = state.objects.map(function (object, index) {
    const button = document.createElement("button");
    button.className = "link-button";
    button.type = "button";
    button.textContent = object.objectType;
    button.addEventListener("click", function () { showObject(index); });
    return [
      button,
      object.objectId,
      formatNumber(object.revision),
      badge(object.deleted ? "deleted" : "active", object.deleted),
      object.mediaType || "—",
      formatDate(object.updatedAt)
    ];
  });
  elements.objects.replaceChildren(table(
    ["Type", "Object ID", "Revision", "State", "Media", "Updated"],
    rows,
    "No objects match the selected filter."
  ));
}

function renderChanges() {
  const rows = state.changes.map(function (change) {
    return [
      formatNumber(change.cursor),
      change.objectType,
      change.objectId,
      formatNumber(change.revision),
      badge(change.operation, change.operation === "DELETE"),
      formatDate(change.changedAt)
    ];
  });
  elements.changes.replaceChildren(table(
    ["Cursor", "Type", "Object ID", "Revision", "Operation", "Changed"],
    rows,
    "No changes have been recorded."
  ));
}

function renderFiles() {
  const rows = state.files.map(function (file) {
    return [
      textElement("span", file.path, "mono"),
      formatBytes(file.bytes),
      formatDate(file.modifiedAt)
    ];
  });
  elements.files.replaceChildren(table(["Path", "Size", "Modified"], rows, "No physical files are stored."));
}

function renderClientUpdate() {
  const update = state.clientUpdate;
  if (!update) return;
  const rows = [
    ["Current version", update.currentVersion || "—"],
    ["Latest version", update.latestVersion || "Not checked"],
    ["Managed install", update.managedInstallation ? "yes" : "no"],
    ["Auto update", update.autoUpdateEnabled ? "enabled" : "disabled"],
    ["State", update.state || "—"],
    ["Last check", formatDate(update.lastCheckedAt)],
    ["Last error", update.lastError || "—"]
  ];
  elements.clientUpdate.replaceChildren(table(["Property", "Value"], rows, "Update status unavailable."));
  const installButton = document.querySelector("#install-update-button");
  installButton.disabled = !update.managedInstallation || !update.updateAvailable || update.running;
}

function renderBackups() {
  const rows = state.backups.map(function (backup) {
    return [
      textElement("span", backup.fileName, "mono"),
      formatBytes(backup.bytes),
      formatDate(backup.modifiedAt),
      backupActions(backup.fileName)
    ];
  });
  elements.backups.replaceChildren(table(["Snapshot", "Size", "Created", "Actions"], rows, "No backup snapshots yet."));
}

function showObject(index) {
  const object = state.objects[index];
  if (!object) return;
  elements.detailContent.textContent = JSON.stringify(object, null, 2);
  elements.detail.classList.remove("hidden");
}

function closeDetail() {
  elements.detail.classList.add("hidden");
}

function activateTab(name) {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("is-active", tab.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll(".tab-panel")) {
    panel.classList.toggle("hidden", panel.id !== name + "-tab");
  }
}

async function api(path, options) {
  const request = options || {};
  const headers = new Headers(request.headers || {});
  if (state.token) headers.set("Authorization", "Bearer " + state.token);
  if (request.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, Object.assign({}, request, { headers: headers }));
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(body || "HTTP " + response.status);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("Content-Type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function saveToken() {
  state.token = elements.tokenInput.value.trim();
  if (state.token) localStorage.setItem(TOKEN_KEY, state.token);
  else localStorage.removeItem(TOKEN_KEY);
  void refreshAll();
}

function handleRequestError(error) {
  if (error && error.status === 401) {
    showAuth();
    setConnection("Authentication required", "error");
    return;
  }
  setConnection("Unavailable", "error");
  toast(error instanceof Error ? error.message : String(error));
}

function showAuth() {
  elements.authCard.classList.remove("hidden");
  elements.tokenInput.value = state.token;
}

function hideAuth() {
  elements.authCard.classList.add("hidden");
}

function setConnection(label, tone) {
  elements.connection.textContent = label;
  elements.connection.className = "pill pill--" + tone;
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(function () { elements.toast.classList.add("hidden"); }, 3500);
}

function statCard(label, value, detail) {
  const article = document.createElement("article");
  article.className = "stat";
  article.append(
    statText("stat__label", label),
    statText("stat__value", String(value)),
    statText("stat__detail", detail)
  );
  return article;
}

function statText(className, value) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = value;
  return element;
}

function table(headers, rows, emptyMessage) {
  if (rows.length === 0) return textElement("div", emptyMessage, "empty");
  const wrapper = document.createElement("div");
  wrapper.className = "table-wrap";
  const tableElement = document.createElement("table");
  const heading = document.createElement("thead");
  const headingRow = document.createElement("tr");
  for (const header of headers) headingRow.append(tableCell("th", header));
  heading.append(headingRow);

  const body = document.createElement("tbody");
  for (const row of rows) {
    const rowElement = document.createElement("tr");
    for (const cell of row) rowElement.append(tableCell("td", cell));
    body.append(rowElement);
  }

  tableElement.append(heading, body);
  wrapper.append(tableElement);
  return wrapper;
}

function tableCell(tagName, value) {
  const cell = document.createElement(tagName);
  if (value instanceof Node) cell.append(value);
  else cell.textContent = String(value);
  return cell;
}

function textElement(tagName, value, className) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = String(value);
  return element;
}

function badge(label, danger) {
  return textElement("span", label, danger ? "badge badge--delete" : "badge");
}

function backupActions(fileName) {
  const row = document.createElement("div");
  row.className = "action-row";
  const restore = document.createElement("button");
  restore.type = "button";
  restore.className = "restore";
  restore.textContent = "Restore";
  restore.addEventListener("click", function () { void restoreBackup(fileName); });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger";
  remove.textContent = "Delete";
  remove.addEventListener("click", function () { void deleteBackup(fileName); });
  row.append(restore, remove);
  return row;
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function shortId(value) {
  if (!value) return "—";
  return value.length > 16 ? value.slice(0, 8) + "…" + value.slice(-6) : value;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KiB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MiB";
  return (bytes / 1024 ** 3).toFixed(1) + " GiB";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

