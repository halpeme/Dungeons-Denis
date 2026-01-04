#!/usr/bin/env node
/**
 * Download and convert Splittermond maps from PDF to JPG
 *
 * Prerequisites:
 * - Windows: Download poppler from https://github.com/oschwartz10612/poppler-windows/releases
 *   Extract and add bin folder to PATH
 * - Mac: brew install poppler
 * - Linux: apt install poppler-utils
 *
 * Usage: npm run download-maps
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAPS = [
  // === CITY MAPS (Arakea) ===
  { name: 'askalas-traum', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Askalas_Traum.pdf' },
  { name: 'eisenbrann', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Eisenbrann.pdf' },
  { name: 'fulnia', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Fulnia.pdf' },
  { name: 'gondalis', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Gondalis.pdf' },
  { name: 'nuum', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Nuum.pdf' },
  { name: 'talaberis', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Talaberis.pdf' },
  // === CITY MAPS (Binnenmeere) ===
  { name: 'aldentrutz', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karten_Aldentrutz.pdf' },
  { name: 'garstal', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Garstal.pdf' },
  { name: 'herathis', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Herathis.pdf' },
  { name: 'jaldisruh', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Jaldisruh.pdf' },
  { name: 'kyningswacht', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Kyningswacht.pdf' },
  { name: 'sarnburg', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Sarnburg.pdf' },
  { name: 'suedfang', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Suedfang.pdf' },
  { name: 'sunnafest', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Sunnafest.pdf' },
  // === CITY MAPS (Takasadu) ===
  { name: 'esmoda', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Esmoda.pdf' },
  { name: 'inani', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Inani.pdf' },
  { name: 'palitan', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Palitan.pdf' },
  { name: 'sentatau', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Sentatau.pdf' },
  // === CITY MAPS (Pash-Anar) ===
  { name: 'ezteraad', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Ezteraad.pdf' },
  { name: 'fedir', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Fedir.pdf' },
  { name: 'khanbur', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte-Khanbur.pdf' },
  { name: 'lanrim', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte-Lanrim.pdf' },
  { name: 'ranah', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Ranah.pdf' },
  { name: 'shinshamassu', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Shinshamassu.pdf' },
  { name: 'tar-shalaaf', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Tar_Shalaaf.pdf' },
  { name: 'vaipur', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Vaipur.pdf' },
  { name: 'wuestentrutz', category: 'City', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Wuestentrutz.pdf' },
  // === REGIONAL MAPS ===
  { name: 'arkurien', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2024/04/Karte_Arkurien.pdf' },
  { name: 'badashan', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Badashan.pdf' },
  { name: 'dakardsmyr', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Dakardsmyr.pdf' },
  { name: 'elyrea', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2024/04/Karte_Elyrea.pdf' },
  { name: 'farukan', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte-Farukan.pdf' },
  { name: 'flammensenke', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Flammensenke.pdf' },
  { name: 'mahaluu-archipel', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Mahaluu-Archipel.pdf' },
  { name: 'mertalischer-staedtebund', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Mertalischer-Staedtebund.pdf' },
  { name: 'pangawai', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2024/04/Karte_Pangawai.pdf' },
  { name: 'patalis', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2024/04/Karte_Patalis.pdf' },
  { name: 'sadu', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte_Sadu.pdf' },
  { name: 'selenia', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/12/Selenia-final.pdf' },
  { name: 'suderinseln', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/12/SM_Suderinseln_Suderinseln-Regionalkarte.pdf' },
  { name: 'surmakar', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/12/A3_Karten_Surmakar.pdf' },
  { name: 'tar-kesh', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/12/Karte-Tar-Kesh.pdf' },
  { name: 'turubar', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2024/04/Karte_Turubar.pdf' },
  { name: 'ungebrochen', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/12/Karte-Ungebrochen-.pdf' },
  { name: 'unreich', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/12/Unreich_Karte_final.pdf' },
  { name: 'wandernde-waelder', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2021/11/Karte-Wandernde-Waelder.pdf' },
  { name: 'zhoujiang', category: 'Region', url: 'https://splittermond.de/wp-content/uploads/2017/09/Splittermond_Zhoujiang_Karten.pdf' },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'maps', 'presets');
const TEMP_DIR = path.join(__dirname, '..', 'temp_pdfs');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Download a file from URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Convert PDF to JPG using pdftoppm (part of poppler-utils)
 */
async function convertPdfToJpg(pdfPath, outputPath) {
  const outputBase = outputPath.replace('.jpg', '');

  // Try local poppler first, then system PATH
  const localPoppler = path.join(__dirname, '..', 'poppler', 'poppler-24.08.0', 'Library', 'bin', 'pdftoppm.exe');
  const pdftoppm = fs.existsSync(localPoppler) ? `"${localPoppler}"` : 'pdftoppm';

  // Use pdftoppm to convert first page of PDF to JPG
  // -jpeg: output JPEG format
  // -r 150: 150 DPI (good balance of quality and size)
  // -singlefile: only first page, no page number suffix
  const cmd = `${pdftoppm} -jpeg -r 150 -singlefile "${pdfPath}" "${outputBase}"`;

  try {
    await execAsync(cmd);

    // pdftoppm adds .jpg extension, rename if needed
    const generatedFile = `${outputBase}.jpg`;
    if (generatedFile !== outputPath && fs.existsSync(generatedFile)) {
      fs.renameSync(generatedFile, outputPath);
    }

    return true;
  } catch (error) {
    console.error(`  Error converting PDF: ${error.message}`);
    console.error('  Make sure poppler-utils is installed and pdftoppm is in PATH');
    return false;
  }
}

/**
 * Process a single map
 */
async function processMap(map) {
  const pdfPath = path.join(TEMP_DIR, `${map.name}.pdf`);
  const jpgPath = path.join(OUTPUT_DIR, `${map.name}.jpg`);

  // Skip if already exists
  if (fs.existsSync(jpgPath)) {
    console.log(`  [SKIP] ${map.name}.jpg already exists`);
    return true;
  }

  console.log(`  Downloading ${map.name}...`);
  try {
    await downloadFile(map.url, pdfPath);
  } catch (error) {
    console.error(`  [ERROR] Failed to download ${map.name}: ${error.message}`);
    return false;
  }

  console.log(`  Converting ${map.name} to JPG...`);
  const success = await convertPdfToJpg(pdfPath, jpgPath);

  // Clean up PDF
  if (fs.existsSync(pdfPath)) {
    fs.unlinkSync(pdfPath);
  }

  if (success) {
    console.log(`  [OK] ${map.name}.jpg created`);
  }

  return success;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Splittermond Map Downloader ===\n');
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Check if pdftoppm is available (local or system)
  const localPoppler = path.join(__dirname, '..', 'poppler', 'poppler-24.08.0', 'Library', 'bin', 'pdftoppm.exe');
  const hasLocalPoppler = fs.existsSync(localPoppler);

  if (!hasLocalPoppler) {
    try {
      await execAsync('pdftoppm -v');
    } catch {
      console.error('ERROR: pdftoppm not found!');
      console.error('Please install poppler-utils:');
      console.error('  Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases');
      console.error('  Mac: brew install poppler');
      console.error('  Linux: apt install poppler-utils');
      process.exit(1);
    }
  } else {
    console.log('Using local poppler installation\n');
  }

  let successCount = 0;
  let failCount = 0;

  for (const map of MAPS) {
    console.log(`\nProcessing: ${map.name} (${map.category})`);
    const success = await processMap(map);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // Clean up temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmdirSync(TEMP_DIR, { recursive: true });
  }

  console.log('\n=== Complete ===');
  console.log(`Success: ${successCount}/${MAPS.length}`);
  if (failCount > 0) {
    console.log(`Failed: ${failCount}`);
  }

  // Generate maps.js data file
  console.log('\nGenerating maps data...');
  const mapsData = MAPS.map(m => ({
    id: m.name,
    name: m.name.charAt(0).toUpperCase() + m.name.slice(1),
    category: m.category,
    path: `/maps/presets/${m.name}.jpg`
  }));

  const mapsJsContent = `// Auto-generated preset maps data
const presetMaps = ${JSON.stringify(mapsData, null, 2)};
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'maps-data.js'), mapsJsContent);
  console.log('Created maps-data.js');
}

main().catch(console.error);
