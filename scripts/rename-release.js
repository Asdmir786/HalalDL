import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2] || 'FULL'; // LITE or FULL
const version = '0.1.0'; // We could read this from tauri.conf.json but keeping it simple for now

const bundleDir = path.join(__dirname, '../src-tauri/target/release/bundle');
const releaseDir = path.join(__dirname, '../out');

if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir);
}

const filesToRename = [
    {
        dir: 'msi',
        pattern: /halaldl_.*_x64_en-US\.msi$/,
        newName: `HalalDL_${version}_x64_${mode}.msi`
    },
    {
        dir: 'nsis',
        pattern: /halaldl_.*_x64-setup\.exe$/,
        newName: `HalalDL_${version}_x64_${mode}_Setup.exe`
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
