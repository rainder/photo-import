import { getThumbnail, getThumbnailHq } from "./commands";

const MAX_CONCURRENT = 4;
let active = 0;
const queue: Array<{
  path: string;
  resolve: (src: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!;
    active++;
    getThumbnail(item.path)
      .then((b64) => {
        item.resolve(`data:image/jpeg;base64,${b64}`);
      })
      .catch((err) => {
        item.reject(err);
      })
      .finally(() => {
        active--;
        processQueue();
      });
  }
}

export function queueThumbnail(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ path, resolve, reject });
    processQueue();
  });
}

/** Remove pending requests for paths no longer visible */
export function cancelPending(path: string) {
  const idx = queue.findIndex((item) => item.path === path);
  if (idx !== -1) {
    queue.splice(idx, 1);
  }
}

// --- HQ thumbnail queue (lower concurrency, separate from first-pass) ---

const HQ_MAX_CONCURRENT = 2;
let hqActive = 0;
const hqQueue: Array<{
  path: string;
  width: number;
  resolve: (src: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processHqQueue() {
  while (hqActive < HQ_MAX_CONCURRENT && hqQueue.length > 0) {
    const item = hqQueue.shift()!;
    hqActive++;
    getThumbnailHq(item.path, item.width)
      .then((b64) => {
        item.resolve(`data:image/jpeg;base64,${b64}`);
      })
      .catch((err) => {
        item.reject(err);
      })
      .finally(() => {
        hqActive--;
        processHqQueue();
      });
  }
}

export function queueThumbnailHq(path: string, width: number): Promise<string> {
  return new Promise((resolve, reject) => {
    hqQueue.push({ path, width, resolve, reject });
    processHqQueue();
  });
}

export function cancelPendingHq(path: string) {
  const idx = hqQueue.findIndex((item) => item.path === path);
  if (idx !== -1) {
    hqQueue.splice(idx, 1);
  }
}
