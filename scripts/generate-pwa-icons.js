const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const srcImage = path.join(
    'C:', 'Users', 'cxc', '.gemini', 'antigravity-ide', 'brain',
    '8c9449cf-7158-4bb3-b031-8954370dfafb',
    'shiine_pwa_icon_1790270846549.jpg'
  );

  const publicDir = path.join(__dirname, '..', 'public');

  console.log('Generating PWA icons from:', srcImage);

  // 1. Standard 192x192
  await sharp(srcImage)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192x192.png'));
  console.log('Generated icon-192x192.png');

  // 2. Standard 512x512
  await sharp(srcImage)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512x512.png'));
  console.log('Generated icon-512x512.png');

  // 3. Apple touch icon 180x180
  await sharp(srcImage)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 4. Maskable 192x192 (safe area 80% padded on #0f172a)
  const inner192 = await sharp(srcImage)
    .resize(154, 154)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    }
  })
    .composite([{ input: inner192, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192x192.png'));
  console.log('Generated icon-maskable-192x192.png');

  // 5. Maskable 512x512 (safe area 80% padded on #0f172a)
  const inner512 = await sharp(srcImage)
    .resize(410, 410)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    }
  })
    .composite([{ input: inner512, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512x512.png'));
  console.log('Generated icon-maskable-512x512.png');

  // 6. Favicon 32x32 & 48x48
  await sharp(srcImage)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  await sharp(srcImage)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  // Also copy to favicon.ico
  fs.copyFileSync(path.join(publicDir, 'favicon-32x32.png'), path.join(publicDir, 'favicon.ico'));
  console.log('Generated favicon files');

  console.log('PWA icon generation complete!');
}

generateIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
