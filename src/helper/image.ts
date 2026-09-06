/** 图片文件扩展名缩写 */
export const fileType = {
  j: 'jpg',
  p: 'png',
  g: 'gif',
  w: 'webp',
  b: 'bmp',
} as const;

/** 等待指定的图片元素加载完成 */
export const waitImgLoad = (
  target: HTMLImageElement | string,
  timeout?: number,
) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = typeof target === 'string' ? new Image() : target;
    if (img.complete && img.naturalHeight) resolve(img);

    const id = timeout
      ? window.setTimeout(() => reject(new Error('timeout')), timeout)
      : undefined;

    const handleError = (e: ErrorEvent) => {
      window.clearTimeout(id);
      reject(new Error(e.message));
    };
    const handleLoad = () => {
      window.clearTimeout(id);
      img.removeEventListener('error', handleError);
      resolve(img);
    };

    img.addEventListener('load', handleLoad, { once: true });
    img.addEventListener('error', handleError, { once: true });

    if (typeof target === 'string') img.src = target;
  });

/** 测试图片 url 能否正确加载 */
export const testImgUrl = (url: string) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

export const canvasToBlob = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type?: string,
  quality = 1,
) => {
  if (canvas instanceof OffscreenCanvas)
    return canvas.convertToBlob({ type, quality });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      type,
      quality,
    );
  });
};

export const canvasToBlobUrl = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type?: string,
  quality = 1,
) => {
  const blob = await canvasToBlob(canvas, type, quality);
  return URL.createObjectURL(blob);
};

/**
 * 获取图片像素数据
 *
 * 传入 maxSize 时按最长边缩放到该尺寸内
 */
export const getImageData = (img: HTMLImageElement, maxSize?: number) => {
  const { naturalWidth: width, naturalHeight: height } = img;
  if (!width || !height) throw new Error(`图片未加载完成: ${img.src}`);

  const scale =
    maxSize && maxSize > 0 ? Math.min(maxSize / width, maxSize / height) : 1;
  const w = Math.max(1, Math.floor(width * scale));
  const h = Math.max(1, Math.floor(height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // 禁止缩放平滑，确保不会出现渐变颜色干扰图像识别时的判断
  if (scale !== 1) ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
};
