// Persistent Image Storage using IndexedDB (persists Gigabytes across browser refreshes)
// and optional Supabase Storage sync for authenticated users.

const DB_NAME = "NetraScanStorage";
const DB_VERSION = 2;
const STORE_NAME = "scan_images";

export interface StoredScanImage {
  id: string;
  patientId?: string;
  rawBase64?: string;
  gradcamBase64?: string;
  bounding_boxes?: Array<{ x: number; y: number; width: number; height: number }>;
  timestamp: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Convert File / Blob to Base64 data URL
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Save scan images (raw fundus scan + gradcam heatmap + bounding boxes) to IndexedDB
export async function saveScanImagesToStorage(
  id: string,
  rawBase64?: string,
  gradcamBase64?: string,
  patientId?: string,
  bounding_boxes?: Array<{ x: number; y: number; width: number; height: number }>
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const record: StoredScanImage = {
        id,
        patientId,
        rawBase64,
        gradcamBase64,
        bounding_boxes,
        timestamp: Date.now(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to persist scan images to IndexedDB:", err);
  }
}

// Retrieve scan images by ID or patientId from IndexedDB
export async function getScanImagesFromStorage(
  id: string
): Promise<StoredScanImage | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("IndexedDB read error:", err);
    return null;
  }
}
