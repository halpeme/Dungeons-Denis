import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const inputFile = path.join(projectRoot, 'dungeon-denis.jpg');
const outputFile = path.join(projectRoot, 'src', 'tray', 'icon.ico');
const tempPngFile = path.join(projectRoot, 'src', 'tray', 'temp-icon.png');

async function createIcon() {
  try {
    console.log('Converting dungeon-denis.jpg to icon.ico...');

    // Step 1: Create a 32x32 PNG
    await sharp(inputFile)
      .resize(32, 32, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(tempPngFile);

    console.log('✓ Created temporary PNG');

    // Step 2: Convert PNG to proper ICO format
    const icoBuffer = await pngToIco(tempPngFile);
    fs.writeFileSync(outputFile, icoBuffer);

    console.log('✓ Created ICO file');

    // Step 3: Clean up temp file
    fs.unlinkSync(tempPngFile);

    console.log('✓ Icon created successfully at src/tray/icon.ico');
  } catch (error) {
    console.error('Error creating icon:', error);
    // Clean up temp file if it exists
    if (fs.existsSync(tempPngFile)) {
      fs.unlinkSync(tempPngFile);
    }
    process.exit(1);
  }
}

createIcon();
