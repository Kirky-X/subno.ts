// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import fs from 'fs';
import path from 'path';

const HEADER = `// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

`;

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

function scanDirectory(dir) {
    const files = [];
    
    function traverse(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            
            if (entry.isDirectory()) {
                // Skip node_modules, .git, .next, build, out
                if (!['node_modules', '.git', '.next', 'build', 'out', '.husky'].includes(entry.name)) {
                    traverse(fullPath);
                }
            } else if (entry.isFile() && EXTENSIONS.includes(path.extname(entry.name))) {
                files.push(fullPath);
            }
        }
    }
    
    traverse(dir);
    return files;
}

function addHeader(file) {
    const content = fs.readFileSync(file, 'utf8');
    const ext = path.extname(file);
    
    // Check if file already has header
    if (content.includes('SPDX-License-Identifier') && content.includes('Copyright')) {
        return false;
    }
    
    // Skip .d.ts files and node_modules
    if (file.includes('node_modules') || file.endsWith('.d.ts')) {
        return false;
    }
    
    let newContent = content;
    
    // Add empty line before imports for TypeScript/JavaScript
    if (content.trim().startsWith('import') || content.trim().startsWith('export')) {
        newContent = HEADER + content;
    } else {
        newContent = HEADER + content;
    }
    
    fs.writeFileSync(file, newContent);
    return true;
}

const files = scanDirectory('./');
let count = 0;

for (const file of files) {
    if (addHeader(file)) {
        console.log(`Added header to: ${file}`);
        count++;
    }
}

console.log(`\nProcessed ${files.length} files, added headers to ${count} files.`);
