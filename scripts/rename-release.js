import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2] || 'FULL'; // LITE or FULL

// Read version from tauri.conf.json to ensure we match the actual build artifact
const tauriConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../src-tauri/tauri.conf.json'), 'utf8'));
const version = tauriConfig.version;
const productName = tauriConfig.productName;

const bundleDir = path.join(__dirname, '../src-tauri/target/release/bundle');
const releaseDir = path.join(__dirname, '../out');

if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir);
}

const flavor = mode === 'LITE' ? 'Lite' : 'Full';
const targetSuffix = `v${version}-win10+11-x64`;

const existingReleaseFiles = fs.readdirSync(releaseDir);
existingReleaseFiles.forEach((entry) => {
    if (entry.startsWith(`HalalDL-${flavor}-`)) {
        const target = path.join(releaseDir, entry);
        fs.rmSync(target, { recursive: true, force: true });
    }
});

const filesToRename = [
    {
        dir: 'msi',
        // Strictly match the current version to avoid copying stale builds (e.g. 0.1.0)
        pattern: new RegExp(`${productName}_${version}_x64_en-US\\.msi$`, 'i'),
        newName: `${productName}-${flavor}-${targetSuffix}.msi`
    },
    {
        dir: 'nsis',
        // Strictly match the current version
        pattern: new RegExp(`${productName}_${version}_x64-setup\\.exe$`, 'i'),
        newName: `${productName}-${flavor}-${targetSuffix}-setup.exe`
    }
];

filesToRename.forEach(({ dir, pattern, newName }) => {
    const fullDir = path.join(bundleDir, dir);
    if (fs.existsSync(fullDir)) {
        const files = fs.readdirSync(fullDir);
        const targetFile = files.find(f => pattern.test(f));
        
        if (targetFile) {
            const oldPath = path.join(fullDir, targetFile);
            const newPath = path.join(releaseDir, newName);
            
            fs.copyFileSync(oldPath, newPath);
            console.log(`✅ Copied & Renamed: ${targetFile} -> out/${newName}`);
        } else {
            console.log(`⚠️ No matching file found in ${dir} for ${mode}`);
        }
    } else {
        console.log(`❌ Directory not found: ${fullDir}`);
    }
});
