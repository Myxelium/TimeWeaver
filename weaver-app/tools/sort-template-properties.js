#!/usr/bin/env node

/**
 * Angular Template Property Sorter
 * Reorders element properties after Prettier formatting
 * Order: outputs → two-way → inputs → attributes
 */

const fs = require('fs');
const path = require('path');

// Property type detection - lower number = higher priority (comes first)
function getPropertyType(attrName) {
    if (attrName.match(/^\(/)) return 0;              // (output)="..." → outputs first
    if (attrName.match(/^\[\(/)) return 1;            // [(twoWay)]="..." → two-way second
    if (attrName.match(/^\[class\./)) return 2;       // [class.x]="..." → inputs third
    if (attrName.match(/^\[attr\./)) return 2;        // [attr.x]="..." → inputs third
    if (attrName.match(/^\[[\w\-]+\]/)) return 2;     // [input]="..." → inputs third
    if (attrName.match(/^#/)) return 1.5;             // #ref → template reference
    if (attrName.match(/^@/)) return -1;              // @structural → should not appear here
    return 3;                                          // everything else → attributes last
}

// Extract attribute name (before =)
function getAttributeName(attrString) {
    const match = attrString.match(/^([^\s=]+)/);
    return match ? match[1] : attrString;
}

// Sort attributes by type
function sortAttributes(attributes) {
    return attributes.sort((a, b) => {
        const nameA = getAttributeName(a);
        const nameB = getAttributeName(b);
        return getPropertyType(nameA) - getPropertyType(nameB);
    });
}

// Format file - simple approach: parse and rebuild with sorted attrs
function formatFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8');

        // Pattern: match multi-line elements with attributes
        // This is a conservative approach - only reorders complete multi-line attribute blocks
        const multiLineAttrRegex = /(<\w+[\w:\-]*)\n((?:\s+[^\s>]+(?:="[^"]*")?\n)*\s+[^\s>]+(?:="[^"]*")?)\n(\s*>)/g;

        let modified = false;
        const result = content.replace(multiLineAttrRegex, (match, openTag, attrs, closeTag) => {
            // Get the indentation from the first line
            const lines = match.split('\n');
            const firstLineIndent = lines[0].match(/^(\s*)</)[1];
            const attrIndent = lines[1].match(/^(\s+)/)[1];

            // Parse attributes
            const attrLines = attrs.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            // Sort attributes
            const sorted = sortAttributes(attrLines);

            // Check if we changed the order
            if (sorted.join('\n') !== attrLines.join('\n')) {
                modified = true;
            }

            // Rebuild
            return openTag + '\n' + sorted.map(attr => attrIndent + attr).join('\n') + '\n' + closeTag;
        });

        if (modified) {
            fs.writeFileSync(filePath, result, 'utf-8');
            console.log(`✓ Sorted properties: ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`✗ Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Main
const args = process.argv.slice(2);

function walkDir(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory() && !filePath.includes('node_modules')) {
            walkDir(filePath, callback);
        } else if (file.endsWith('.html')) {
            callback(filePath);
        }
    });
}

let processed = 0;
if (args.length > 0) {
    args.forEach(file => {
        const fullPath = path.resolve(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
            if (formatFile(fullPath)) {
                processed++;
            }
        }
    });
} else {
    walkDir(path.join(process.cwd(), 'src/app'), (filePath) => {
        if (formatFile(filePath)) {
            processed++;
        }
    });
    if (processed > 0) {
        console.log(`\nTotal files with properties sorted: ${processed}`);
    }
}

process.exit(0);
