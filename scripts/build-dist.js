/**
 * Build Distribution Script for Dungeons & Denis
 * Creates a portable Windows distribution with embedded Node.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Configuration
const NODE_VERSION = '20.11.0'; // LTS version
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
const CACHE_DIR = path.join(PROJECT_ROOT, '.cache');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist-release');

async function downloadFile(url, dest) {
    console.log(`Downloading: ${url}`);

    return new Promise((resolve, reject) => {
        const file = createWriteStream(dest);

        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    pipeline(redirectResponse, file).then(resolve).catch(reject);
                }).on('error', reject);
            } else {
                pipeline(response, file).then(resolve).catch(reject);
            }
        }).on('error', reject);
    });
}

async function extractZip(zipPath, destDir) {
    console.log(`Extracting: ${zipPath}`);

    // Use PowerShell to extract (available on all modern Windows)
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
        stdio: 'inherit'
    });
}

async function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function getNodeRuntime() {
    const cacheFile = path.join(CACHE_DIR, `node-v${NODE_VERSION}-win-x64.zip`);
    const extractedDir = path.join(CACHE_DIR, `node-v${NODE_VERSION}-win-x64`);

    // Create cache directory
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    // Download if not cached
    if (!fs.existsSync(cacheFile)) {
        await downloadFile(NODE_URL, cacheFile);
    }

    // Extract if not already done
    if (!fs.existsSync(extractedDir)) {
        await extractZip(cacheFile, CACHE_DIR);
    }

    return extractedDir;
}

function createLauncherBat() {
    // Create a batch file launcher that starts the tray app
    const batContent = `@echo off
cd /d "%~dp0"
start "" /B node\\node.exe app\\dist\\tray\\wrapper.js
`;

    fs.writeFileSync(path.join(DIST_DIR, 'DungeonsDenis.bat'), batContent);

    // Create a VBScript wrapper to hide the console window
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\\DungeonsDenis.bat" & chr(34), 0
Set WshShell = Nothing
`;

    fs.writeFileSync(path.join(DIST_DIR, 'DungeonsDenis.vbs'), vbsContent);

    // Create a shortcut-friendly launcher (rename .vbs to make it clear)
    console.log('Created launcher scripts');
}

function createReadme() {
    const content = `===========================================
         DUNGEONS & DENIS
        Quick Start Guide
===========================================

1. Double-click "DungeonsDenis.vbs" to start

2. Right-click the tray icon (near the clock)
   to access the server controls

3. Click "Start Server" from the menu

4. Open your browser to:
   - GM Controller: http://localhost:3001/gm  
   - Table Display: http://localhost:3001/table

5. To quit, right-click tray icon and select "Exit"

-------------------------------------------
Tip: Create a shortcut to DungeonsDenis.vbs
on your desktop for easy access!
-------------------------------------------
`;

    fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), content);
}

async function main() {
    console.log('🏰 Building Dungeons & Denis Distribution\n');

    // Clean dist directory
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });

    // Step 1: Build TypeScript
    console.log('📦 Building TypeScript...');
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });

    // Step 2: Get Node.js runtime
    console.log('\n📥 Getting Node.js runtime...');
    const nodeDir = await getNodeRuntime();

    // Step 3: Create distribution structure
    console.log('\n📁 Creating distribution structure...');

    // Copy Node.js (just node.exe is enough)
    const nodeDistDir = path.join(DIST_DIR, 'node');
    fs.mkdirSync(nodeDistDir, { recursive: true });
    fs.copyFileSync(path.join(nodeDir, 'node.exe'), path.join(nodeDistDir, 'node.exe'));

    // Create app directory
    const appDir = path.join(DIST_DIR, 'app');
    fs.mkdirSync(appDir, { recursive: true });

    // Copy dist (compiled JS)
    await copyDir(path.join(PROJECT_ROOT, 'dist'), path.join(appDir, 'dist'));

    // Copy tray icon (needed for systray2)
    const iconSrc = path.join(PROJECT_ROOT, 'src', 'tray', 'icon.ico');
    const iconDest = path.join(appDir, 'dist', 'tray', 'icon.ico');
    if (fs.existsSync(iconSrc)) {
        fs.copyFileSync(iconSrc, iconDest);
        console.log('   Copied tray icon');
    }

    // Copy public folder
    await copyDir(path.join(PROJECT_ROOT, 'public'), path.join(appDir, 'public'));

    // Copy poppler (for PDF processing)
    if (fs.existsSync(path.join(PROJECT_ROOT, 'poppler'))) {
        await copyDir(path.join(PROJECT_ROOT, 'poppler'), path.join(appDir, 'poppler'));
    }

    // Copy node_modules (production dependencies only)
    console.log('\n📦 Installing production dependencies...');

    // Create a minimal package.json for production
    const pkgJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
    const prodPkgJson = {
        name: pkgJson.name,
        version: pkgJson.version,
        type: 'module',
        main: 'dist/server.js',
        dependencies: pkgJson.dependencies
    };
    fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(prodPkgJson, null, 2));

    // Install production dependencies
    execSync('npm install --omit=dev', { cwd: appDir, stdio: 'inherit' });

    // Step 4: Create launcher
    console.log('\n🚀 Creating launcher...');
    createLauncherBat();
    createReadme();

    // Step 5: Summary
    const distSize = execSync(`powershell -Command "(Get-ChildItem '${DIST_DIR}' -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB"`)
        .toString().trim();

    console.log('\n✅ Distribution created successfully!');
    console.log(`   Location: ${DIST_DIR}`);
    console.log(`   Size: ~${Math.round(parseFloat(distSize))} MB`);
    console.log('\nTo distribute, zip the dist-release folder and share it.');
}

main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
