import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const iconSizes = [192, 512];
const publicDir = join(__dirname, '..', 'public');
const iconSvg = join(publicDir, 'icon.svg');

const svgBuffer = readFileSync(iconSvg);

for (const size of iconSizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, `icon-${size}x${size}.png`));
  
  console.log(`Generated icon-${size}x${size}.png`);
}

console.log('All icons generated successfully!');






