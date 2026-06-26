#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(JSON.stringify({ ok: false, message }, null, 2));
  process.exit(1);
}

function listMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter(function (entry) {
      return fs.statSync(path.join(directory, entry)).isFile() && entry.endsWith('.md');
    })
    .sort();
}

const projectRoot = path.resolve(process.argv[2] || process.cwd());
const docsDir = path.join(projectRoot, 'docs');
const tasksDir = path.join(docsDir, 'tasks');
const progressPath = path.join(tasksDir, 'tasklist-progress.md');
const progressHtmlPath = path.join(tasksDir, 'tasklist-progress.html');

if (!fs.existsSync(docsDir)) {
  fail('docs directory not found: ' + docsDir);
}

if (!fs.existsSync(progressPath)) {
  fail('canonical progress file missing: docs/tasks/tasklist-progress.md');
}

if (!fs.existsSync(progressHtmlPath)) {
  fail('canonical progress HTML view missing: docs/tasks/tasklist-progress.html');
}

const rootTaskFiles = listMarkdownFiles(tasksDir);
const datedSystemProgressFiles = rootTaskFiles.filter(function (file) {
  return /^\d{4}-\d{2}-\d{2}-.+-system-progress\.md$/.test(file);
});

if (datedSystemProgressFiles.length > 0) {
  fail('dated system progress files must be archived or replaced by docs/tasks/tasklist-progress.md: ' + datedSystemProgressFiles.join(', '));
}

console.log(JSON.stringify({
  ok: true,
  projectRoot,
  progressFile: path.relative(projectRoot, progressPath),
  progressHtmlFile: path.relative(projectRoot, progressHtmlPath),
  rootTaskFiles
}, null, 2));
