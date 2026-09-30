const DATABASE_NAME = "gtd-mobile";
const DATABASE_VERSION = 1;
const CAPTURE_STORE = "pending-captures";

export async function enqueueCapture(title) {
  const database = await openDatabase();
  const capture = { id: crypto.randomUUID(), title, createdAt: new Date().toISOString() };
  await transaction(database, "readwrite", (store) => store.add(capture));
  return capture;
}

export async function pendingCaptures() {
  const database = await openDatabase();
  return transaction(database, "readonly", (store) => store.getAll());
}

export async function removeCapture(id) {
  const database = await openDatabase();
  await transaction(database, "readwrite", (store) => store.delete(id));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => createSchema(request.result);
  });
}

function createSchema(database) {
  if (database.objectStoreNames.contains(CAPTURE_STORE)) return;
  database.createObjectStore(CAPTURE_STORE, { keyPath: "id" });
}

function transaction(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(CAPTURE_STORE, mode);
    const request = operation(tx.objectStore(CAPTURE_STORE));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
