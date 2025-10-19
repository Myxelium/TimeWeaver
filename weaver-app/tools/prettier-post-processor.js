#!/usr/bin/env node

/**
 * Prettier Plugin Wrapper for Property Sorting
 * This file hooks into the formatting pipeline to ensure property sorting
 * happens automatically whenever Prettier runs.
 *
 * Usage: Configure in .prettierrc.json to use this as a post-processor
 */

const fs = require('fs');
const path = require('path');

// Property type detection
function getPropertyType(attrName) {
    if (attrName.match(/^\(/)) return 0;              // (output)="..."
    if (attrName.match(/^\[\(/)) return 1;            // [(twoWay)]="..."
    if (attrName.match(/^\[class\./)) return 2;       // [class.x]="..."
    if (attrName.match(/^\[attr\./)) return 2;        // [attr.x]="..."
    if (attrName.match(/^\[[\w\-]+\]/)) return 2;     // [input]="..."
    if (attrName.match(/^#/)) return 1.5;             // #ref
    return 3;                                          // attributes
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

// Format file
function formatFile(content) {
    // Pattern: match multi-line elements with attributes
    const multiLineAttrRegex = /(<\w+[\w:\-]*)\n((?:\s+[^\s>]+(?:="[^"]*")?\n)*\s+[^\s>]+(?:="[^"]*")?)\n(\s*>)/g;

    return content.replace(multiLineAttrRegex, (match, openTag, attrs, closeTag) => {
        // Get indentation
        const lines = match.split('\n');
        const firstLineIndent = lines[0].match(/^(\s*)</)[1];
        const attrIndent = lines[1].match(/^(\s+)/)[1];

        // Parse attributes
        const attrLines = attrs.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Sort attributes
        const sorted = sortAttributes(attrLines);

        // Rebuild
        return openTag + '\n' + sorted.map(attr => attrIndent + attr).join('\n') + '\n' + closeTag;
    });
}

// Main
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node prettier-plugin-wrapper.js <file>');
        process.exit(1);
    }

    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    const formatted = formatFile(content);

    if (formatted !== content) {
        fs.writeFileSync(filePath, formatted, 'utf-8');
    }

    process.exit(0);
}

module.exports = { formatFile };
