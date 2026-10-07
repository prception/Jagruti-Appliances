// Injects shared HTML partials (navbar.html, footer.html) into every page's marker blocks.
// Run after editing navbar.html or footer.html:   node assets/js/build-partials.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SKIP_DIRS = new Set(['.git', 'node_modules']);

const ACTIVE_TOKENS = {
  index: '__ACTIVE_HOME__',
  about: '__ACTIVE_ABOUT__',
  compare: '__ACTIVE_COMPARE__',
  contact: '__ACTIVE_CONTACT__',
  support: '__ACTIVE_SUPPORT__',
  'why-jagruti': '__ACTIVE_WHY_JAGRUTI__',
};

// ---------------------------------------------------------------------------
// Nav mode: every page carries data-nav on <body>, so the transparent header
// is driven by one declared value per page instead of a growing :has() chain
// of hero class names in the stylesheet.
//
//   over-dark   the page opens on a dark hero that runs up under the bar.
//               Header sits over it: page padding drops to 0, a scrim fades
//               down across the header band so the logo reads against the
//               photo, and the MENU affordance inverts to white.
//   over-light  the page opens on a light section that also runs up under the
//               bar. Header still sits over it with no padding and no scrim;
//               MENU stays dark ink, which is what carries on white.
//   flow        default. Header floats transparent over a page that reserves
//               header-height of padding, so content starts below the bar.
//
// A page can opt out of the inferred value by writing data-nav by hand; this
// pass only fills in bodies that have no data-nav yet, and rewrites the ones
// it stamped before (marked data-nav-auto).
const NAV_MODES = {
  'over-dark': [
    'hero', 'cat-hero', 'wj-hero', 'contact-hero', 'page-hero',
  ],
  'over-light': [],
};

function inferNavMode(content) {
  const mainIdx = content.indexOf('<main');
  if (mainIdx === -1) return 'flow';
  // First element inside <main> — that is what the header would sit over.
  const openTag = /<(?:section|div|header|article)\b[^>]*\bclass="([^"]*)"/i.exec(
    content.slice(mainIdx)
  );
  if (!openTag) return 'flow';
  const classes = openTag[1].split(/\s+/);
  for (const [mode, names] of Object.entries(NAV_MODES)) {
    if (classes.some((c) => names.includes(c))) return mode;
  }
  return 'flow';
}

function applyNavMode(content) {
  const bodyTag = /<body\b[^>]*>/i.exec(content);
  if (!bodyTag) return { changed: false };
  const tag = bodyTag[0];
  // Respect a hand-written data-nav; only manage the ones this script stamped.
  if (/\bdata-nav\b/.test(tag) && !/\bdata-nav-auto\b/.test(tag)) return { changed: false };

  const mode = inferNavMode(content);
  const stripped = tag
    .replace(/\s*data-nav="[^"]*"/i, '')
    .replace(/\s*data-nav-auto/i, '');
  const newTag = stripped.replace(/>$/, ` data-nav="${mode}" data-nav-auto>`);
  if (newTag === tag) return { changed: false };

  return {
    changed: true,
    content: content.slice(0, bodyTag.index) + newTag + content.slice(bodyTag.index + tag.length),
  };
}

const PARTIALS = [
  {
    name: 'navbar',
    templatePath: path.join(ROOT, 'navbar.html'),
    startMarker: '<!-- NAVBAR:START -->',
    endMarker: '<!-- NAVBAR:END -->',
    terminalTag: '<main',
    findFreshStart: (content) => content.indexOf('<header class="site-header">'),
    findFreshEnd: (content, blockStart) => {
      const mobStart = content.indexOf('<div class="menu-side-bar"', blockStart);
      return mobStart === -1 ? -1 : content.indexOf('<main', mobStart);
    },
    useActiveTokens: true,
  },
  {
    name: 'footer',
    templatePath: path.join(ROOT, 'footer.html'),
    startMarker: '<!-- FOOTER:START -->',
    endMarker: '<!-- FOOTER:END -->',
    terminalTag: '<script',
    findFreshStart: (content) => content.indexOf('<footer class="site-footer">'),
    findFreshEnd: (content, blockStart) => content.indexOf('<script', blockStart),
    useActiveTokens: false,
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
      continue;
    }
    if (entry.name.toLowerCase().endsWith('.html')) out.push(path.join(dir, entry.name));
  }
  return out;
}

function loadTemplate(templatePath) {
  const raw = fs.readFileSync(templatePath, 'utf8');
  // Strip the leading instructional HTML comment before injecting into pages.
  return raw.replace(/^﻿?<!--[\s\S]*?-->\s*/, '').trim();
}

function render(template, rootPrefix, activePage, useActiveTokens) {
  let out = template.split('__ROOT__').join(rootPrefix);
  if (useActiveTokens) {
    for (const [page, token] of Object.entries(ACTIVE_TOKENS)) {
      out = out.split(token).join(page === activePage ? ' active' : '');
    }
  }
  return out;
}

function applyPartial(file, original, partial, template, rootPrefix, activePage) {
  const { startMarker, endMarker, terminalTag, findFreshStart, findFreshEnd, useActiveTokens } = partial;
  const usesCRLF = original.includes('\r\n');

  let blockStart, blockEnd;
  const startIdx = original.indexOf(startMarker);
  if (startIdx !== -1) {
    blockStart = startIdx;
    const endMarkerIdx = original.indexOf(endMarker, startIdx);
    if (endMarkerIdx === -1) return { changed: false, warn: `found ${startMarker} without ${endMarker}` };
    blockEnd = original.indexOf(terminalTag, endMarkerIdx);
  } else {
    blockStart = findFreshStart(original);
    if (blockStart === -1) return { changed: false, skip: true };
    blockEnd = findFreshEnd(original, blockStart);
  }

  if (blockEnd === -1) return { changed: false, warn: `could not find end of ${partial.name} block` };

  const rendered = render(template, rootPrefix, activePage, useActiveTokens);
  let newBlock = `${startMarker}\n${rendered}\n${endMarker}\n\n`;
  if (usesCRLF) newBlock = newBlock.replace(/\n/g, '\r\n');

  const newContent = original.slice(0, blockStart) + newBlock + original.slice(blockEnd);
  return { changed: newContent !== original, content: newContent };
}

function processFile(file, templates) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const depth = rel.split('/').length - 1;
  if (depth > 1) {
    console.warn(`SKIP ${rel}: nested more than one folder deep (script assumes max depth 1)`);
    return false;
  }
  const rootPrefix = depth === 0 ? '' : '../'.repeat(depth);
  const activePage = path.basename(file, '.html');

  let content = fs.readFileSync(file, 'utf8');
  let anyChanged = false;

  for (const partial of PARTIALS) {
    const result = applyPartial(file, content, partial, templates[partial.name], rootPrefix, activePage);
    if (result.warn) console.warn(`SKIP ${rel} (${partial.name}): ${result.warn}`);
    if (result.skip) continue; // page doesn't include this partial at all
    if (result.changed) {
      content = result.content;
      anyChanged = true;
    }
  }

  const navResult = applyNavMode(content);
  if (navResult.changed) {
    content = navResult.content;
    anyChanged = true;
  }

  if (anyChanged) fs.writeFileSync(file, content, 'utf8');
  return anyChanged;
}

function main() {
  const templates = {};
  for (const partial of PARTIALS) templates[partial.name] = loadTemplate(partial.templatePath);

  const templatePaths = new Set(PARTIALS.map((p) => p.templatePath));
  const files = walk(ROOT).filter((f) => !templatePaths.has(f));

  let changed = 0;
  for (const file of files) {
    if (processFile(file, templates)) {
      changed++;
      console.log(`updated ${path.relative(ROOT, file).split(path.sep).join('/')}`);
    }
  }
  console.log(`\nDone: ${changed}/${files.length} page(s) updated.`);
}

main();
