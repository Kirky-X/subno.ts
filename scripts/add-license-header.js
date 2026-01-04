const fs = require('fs');

const HEADER = `// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

`;

const files = process.argv.slice(2);
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('Copyright') && !content.includes('SPDX-License-Identifier')) {
        fs.writeFileSync(file, HEADER + content);
    }
});