export function getPixelRatio(): number {
  return Math.min(2, window.devicePixelRatio);
}

export function haveSameValues<T>(a: T, b: T): boolean {
  if (a === b) return true;
  
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => haveSameValues(val, b[i]));
  }

  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => haveSameValues(a[key], b[key]));
  }

  return false;
}

export function isEmptySize({ height, width }: { height: number; width: number }): boolean {
  return height === 0 || width === 0;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  // Check if we've already loaded this image
  const cached = loadImage.cache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      loadImage.cache.set(url, img);
      resolve(img);
    };
    img.onerror = (err) => {
      loadImage.cache.delete(url);
      reject(err);
    };
    img.src = url;
  });
}

// Image cache
loadImage.cache = new Map<string, HTMLImageElement>();