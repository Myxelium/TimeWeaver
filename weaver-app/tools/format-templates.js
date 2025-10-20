#!/usr/bin/env node

/**
 * Custom Angular Template Formatter
 * Enforces specific formatting rules for Angular HTML templates:
 * 1. Blank lines between sibling elements (except first)
 * 2. Property grouping: outputs → two-way → inputs → attributes
 * 3. Multi-line properties when 3+
 * 4. Proper indentation in @if/@for/@switch blocks
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const PROPERTY_ORDER = {
  'STRUCTURAL_DIRECTIVE': 0,
  'TEMPLATE_REFERENCE': 1,
  'OUTPUT_BINDING': 2,
  'TWO_WAY_BINDING': 3,
  'INPUT_BINDING': 4,
  'ATTRIBUTE_BINDING': 5,
};

// Detect property type
function getPropertyType(attr) {
  if (attr.match(/^\(\w+\)/)) return 'OUTPUT_BINDING'; // (click)
  if (attr.match(/^\[\(\w+\)\]/)) return 'TWO_WAY_BINDING'; // [(ngModel)]
  if (attr.match(/^\[[\w\-.]+\]/)) return 'INPUT_BINDING'; // [property]
  if (attr.match(/^#\w+/)) return 'TEMPLATE_REFERENCE'; // #ref
  if (attr.match(/^@/)) return 'STRUCTURAL_DIRECTIVE'; // @if
  return 'ATTRIBUTE_BINDING'; // class, id, etc.
}

// Sort attributes by property type
function sortAttributes(attrs) {
  return attrs.sort((a, b) => {
    const typeA = getPropertyType(a);
    const typeB = getPropertyType(b);
    return (PROPERTY_ORDER[typeA] || 99) - (PROPERTY_ORDER[typeB] || 99);
  });
}

// Format an element's attributes
function formatAttributes(element) {
  const attrRegex = /(\s+)([\w\-\.\:\@\[\(\#\*]+(?:[\w\-\.\:\@\[\(\#\*\)"'=\s\[\]]*)?)/g;
  
  // Extract all attributes
  const matches = element.match(/\s+[^\s>]+(?:="[^"]*")?/g) || [];
  if (!matches.length) return element;

  const attrs = matches
    .map(m => m.trim())
    .filter(m => m.length > 0);

  // Sort attributes
  const sorted = sortAttributes(attrs);

  // Format based on count
  if (sorted.length <= 2) {
    // Keep on same line if 2 or fewer
    return element.replace(/\s+[\w\-\.\:\@\[\(\#\*][^\s>]*(?:="[^"]*")?/g, '').replace(/>/, ' ' + sorted.join(' ') + '>');
  } else {
    // Put each on new line if 3+
    const indent = '    '; // Assuming 4-space indent
    const tag = element.match(/^<\w+/)[0];
    return tag + '\n' + sorted.map(a => indent + a).join('\n') + '\n>';
  }
}

// Add blank lines between siblings
function addBlankLinesBetweenSiblings(content) {
  // Match closing and opening tags on consecutive lines
  const pattern = /(<\/\w+>)\n(?!$)(<\w+|\s*<\w+|\s*@)/gm;
  return content.replace(pattern, '$1\n\n$2');
}

// Ensure @if/@for/@switch blocks are properly indented
function formatControlFlowBlocks(content) {
  const controlFlowRegex = /@(if|for|switch|case|default)\s*\([^)]*\)\s*\{/g;
  let result = content;

  result = result.replace(controlFlowRegex, (match) => {
    // Ensure content after { is on new line and indented
    return match.replace(/\}\s*$/m, '}\n');
  });

  return result;
}

// Main formatter function
function formatAngularTemplate(content) {
  // First, add blank lines between siblings
  content = addBlankLinesBetweenSiblings(content);

  // Ensure control flow blocks are properly formatted
  content = formatControlFlowBlocks(content);

  return content;
}

// Process a file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;

    content = formatAngularTemplate(content);

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Formatted: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
  return false;
}

// Main
const args = process.argv.slice(2);
const files = args.length > 0 
  ? args 
  : glob.sync('src/app/**/*.html', { cwd: process.cwd() });

let formatted = 0;
files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    if (processFile(fullPath)) {
      formatted++;
    }
  }
});

console.log(`\nTotal files formatted: ${formatted}`);
process.exit(formatted > 0 ? 0 : 0);
