import { getThumbnail } from "./commands";

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
