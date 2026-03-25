const WATERMARK_TEXT = 'solaire.pics';
const ANGLE_DEG = -25;
const OPACITY = 0.13;
const GAP_FACTOR = 0.35;

export async function applyWatermark(blob: Blob): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const { width, height } = img;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0);
  img.close();

  const fontSize = Math.max(14, Math.round(width * 0.035));
  ctx.font = `600 ${fontSize}px 'Satoshi', system-ui, sans-serif`;
  ctx.fillStyle = `rgba(255, 255, 255, ${OPACITY})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const measured = ctx.measureText(WATERMARK_TEXT);
  const textW = measured.width;
  const spacingX = textW * (1 + GAP_FACTOR);
  const spacingY = fontSize * 3.2;

  const angleRad = ANGLE_DEG * Math.PI / 180;
  const diagonal = Math.sqrt(width * width + height * height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angleRad);

  const cols = Math.ceil(diagonal / spacingX) + 2;
  const rows = Math.ceil(diagonal / spacingY) + 2;

  for (let r = -rows; r <= rows; r++) {
    const offsetX = (r % 2 !== 0) ? spacingX * 0.5 : 0;
    for (let c = -cols; c <= cols; c++) {
      ctx.fillText(WATERMARK_TEXT, c * spacingX + offsetX, r * spacingY);
    }
  }

  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
  });
}
