#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function fail(message) {
  console.error(JSON.stringify({ ok: false, message }, null, 2));
  process.exit(1);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function renderInline(value) {
  return String(value == null ? '' : value)
    .split(/(`[^`]*`)/g)
    .map(function (part) {
      if (part.startsWith('`') && part.endsWith('`')) {
        return '<code>' + escapeHtml(part.slice(1, -1)) + '</code>';
      }

      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(function (cell) { return cell.trim(); });
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function normalizeStatus(value) {
  return String(value || '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase();
}

function statusClass(value) {
  const status = normalizeStatus(value);
  const statuses = {
    done: 'done',
    pass: 'done',
    tested: 'done',
    ready: 'ready',
    verifying: 'verifying',
    in_progress: 'progress',
    discovery: 'progress',
    docs_prd: 'progress',
    pending: 'pending',
    blocked: 'blocked',
    fail: 'blocked',
    open: 'blocked',
    'not run': 'muted',
    'pass with warning': 'warning'
  };

  return statuses[status] || '';
}

function taskStatusKey(value) {
  const status = normalizeStatus(value);
  return status || 'pending';
}

function renderCell(value, tag) {
  const status = statusClass(value);
  const percentMatch = String(value || '').trim().match(/^(\d{1,3})%$/);
  const className = status ? ' class="status-cell status-' + status + '"' : '';

  if (percentMatch) {
    const percent = Math.max(0, Math.min(100, Number(percentMatch[1])));
    return '<' + tag + ' class="progress-cell"><span class="progress-number">' +
      percent + '%</span><span class="progress-meter"><span style="width: ' +
      percent + '%"></span></span></' + tag + '>';
  }

  if (status) {
    return '<' + tag + className + '><span>' + renderInline(value) + '</span></' + tag + '>';
  }

  return '<' + tag + '>' + renderInline(value) + '</' + tag + '>';
}

function renderTable(lines) {
  const rows = lines.filter(function (line) { return !isTableSeparator(line); }).map(splitTableRow);
  if (rows.length === 0) return '';

  const header = rows[0];
  const bodyRows = rows.slice(1);

  return [
    '<div class="table-wrap">',
    '<table>',
    '<thead><tr>' + header.map(function (cell) { return renderCell(cell, 'th'); }).join('') + '</tr></thead>',
    '<tbody>',
    bodyRows.map(function (row) {
      return '<tr>' + row.map(function (cell) { return renderCell(cell, 'td'); }).join('') + '</tr>';
    }).join('\n'),
    '</tbody>',
    '</table>',
    '</div>'
  ].join('\n');
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];
  const headingIds = {};

  function uniqueHeadingId(title) {
    const base = slugify(title);
    headingIds[base] = (headingIds[base] || 0) + 1;
    return headingIds[base] === 1 ? base : base + '-' + headingIds[base];
  }

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push('<p>' + renderInline(paragraph.join(' ')) + '</p>');
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push('<ul>' + list.map(function (item) {
      return '<li>' + renderInline(item) + '</li>';
    }).join('') + '</ul>');
    list = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const title = heading[2].trim();
      html.push('<h' + level + ' id="' + uniqueHeadingId(title) + '">' + renderInline(title) + '</h' + level + '>');
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(/^-\s+/, ''));
      continue;
    }

    if (isTableLine(line)) {
      flushParagraph();
      flushList();
      const table = [];
      while (index < lines.length && isTableLine(lines[index])) {
        table.push(lines[index]);
        index += 1;
      }
      index -= 1;
      html.push(renderTable(table));
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return html.join('\n');
}

function extractTitle(markdown) {
  const match = String(markdown || '').match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Tasklist Progress';
}

function headerIndex(headers, names) {
  const normalizedNames = names.map(function (name) {
    return String(name).toLowerCase();
  });
  return headers.findIndex(function (header) {
    return normalizedNames.includes(String(header || '').trim().toLowerCase());
  });
}

function cellByName(headers, row, names) {
  const index = headerIndex(headers, names);
  return index === -1 ? '' : (row[index] || '');
}

function extractTaskRows(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  let inTaskSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const heading = trimmed.match(/^##\s+(.+)$/);

    if (heading) {
      inTaskSection = /active tasklist|tasks/i.test(heading[1]);
      continue;
    }

    if (!inTaskSection || !isTableLine(lines[index])) continue;

    const table = [];
    while (index < lines.length && isTableLine(lines[index])) {
      table.push(lines[index]);
      index += 1;
    }

    const rows = table.filter(function (line) { return !isTableSeparator(line); }).map(splitTableRow);
    if (rows.length < 2) continue;

    const headers = rows[0];
    const hasTaskId = headerIndex(headers, ['id', 'task id']) !== -1;
    const hasTask = headerIndex(headers, ['task']) !== -1;
    const hasStatus = headerIndex(headers, ['status']) !== -1;
    const hasProgress = headerIndex(headers, ['progress %', 'progress']) !== -1;

    if (!hasTaskId || !hasTask || !hasStatus || !hasProgress) continue;

    return rows.slice(1).map(function (row) {
      const blocker = cellByName(headers, row, ['blocker']);
      const status = cellByName(headers, row, ['status']) || 'pending';
      return {
        id: cellByName(headers, row, ['id', 'task id']),
        task: cellByName(headers, row, ['task']),
        agent: cellByName(headers, row, ['agent']) || cellByName(headers, row, ['owner']) || '',
        status,
        progress: cellByName(headers, row, ['progress %', 'progress']),
        blocker,
        nextAction: cellByName(headers, row, ['next action']),
        output: cellByName(headers, row, ['output']) || cellByName(headers, row, ['tests evidence']) || ''
      };
    });
  }

  return [];
}

function countActiveTaskStatuses(markdown) {
  const counts = { done: 0, blocked: 0, verifying: 0, progress: 0, pending: 0 };

  extractTaskRows(markdown).forEach(function (task) {
    const status = normalizeStatus(task.status);
    if (status === 'done') counts.done += 1;
    if (status === 'blocked' || hasBlocker(task.blocker)) counts.blocked += 1;
    if (status === 'verifying') counts.verifying += 1;
    if (status === 'in_progress' || status === 'discovery' || status === 'docs_prd') counts.progress += 1;
    if (status === 'pending') counts.pending += 1;
  });

  return counts;
}

function firstPercent(value) {
  const match = String(value || '').match(/(\d{1,3})\s*%?/);
  return match ? Math.max(0, Math.min(100, Number(match[1]))) : null;
}

function hasBlocker(value) {
  const text = normalizeStatus(value);
  return !!text && text !== 'none' && text !== '-';
}

function renderTaskProgress(value) {
  const percent = firstPercent(value);
  if (percent == null) return renderInline(value || '');

  return [
    '<div class="small-progress">',
    '<strong>' + percent + '%</strong>',
    '<div class="track"><div class="fill" style="width:' + percent + '%"></div></div>',
    '</div>'
  ].join('');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractRenderedH2Sections(html) {
  const content = String(html || '');
  const headingRegex = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const titleText = stripHtml(match[2]).trim();
    const sectionMatch = titleText.match(/^T(\d+)\.\s*(.+)$/i);
    headings.push({
      id: match[1],
      titleHtml: match[2],
      titleText,
      number: sectionMatch ? Number(sectionMatch[1]) : null,
      start: match.index,
      bodyStart: match.index + match[0].length,
      end: content.length
    });
  }

  return headings.map(function (heading, index) {
    const end = headings[index + 1] ? headings[index + 1].start : content.length;
    return Object.assign({}, heading, {
      end,
      bodyHtml: content.slice(heading.bodyStart, end).trim(),
      fullHtml: content.slice(heading.start, end).trim()
    });
  });
}

function sectionsByNumber(sections) {
  return sections.reduce(function (index, section) {
    if (section.number != null) index[section.number] = section;
    return index;
  }, {});
}

function removeRenderedSections(html, numbers) {
  const content = String(html || '');
  const numberSet = new Set(numbers);
  const sections = extractRenderedH2Sections(content);
  let output = '';
  let cursor = 0;

  sections.forEach(function (section) {
    if (!numberSet.has(section.number)) return;
    output += content.slice(cursor, section.start);
    cursor = section.end;
  });

  output += content.slice(cursor);
  return output.trim() ? output : '';
}

function renderSectionPanel(section, fallbackTitle) {
  const title = section ? section.titleHtml : fallbackTitle;
  const body = section && section.bodyHtml
    ? section.bodyHtml
    : '<p class="subcopy">No data is available for this section yet.</p>';

  return [
    '        <div class="board-section-title">',
    '          <h3>' + title + '</h3>',
    '        </div>',
    body
  ].join('\n');
}

function renderTaskPanel(tasks) {
  if (!tasks.length) return '';

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'done', label: 'Done' },
    { key: 'verifying', label: 'Verifying' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'pending', label: 'Pending' },
    { key: 'blocked', label: 'Tasks with blocker' }
  ];

  return [
    '        <div class="board-section-title">',
    '          <h3>T3. Active Tasklist</h3>',
    '          <p class="subcopy">' + tasks.length + ' task rows. Use task filters for task status; blocker details are in the T5 tab.</p>',
    '        </div>',
    '      <div class="toolbar">',
    '        <div class="filters task-filters" aria-label="Task filters">',
    filters.map(function (filter, index) {
      return '          <button type="button"' + (index === 0 ? ' class="active"' : '') +
        ' data-task-filter="' + filter.key + '">' + filter.label + '</button>';
    }).join('\n'),
    '        </div>',
    '        <span id="visible-count">Showing ' + tasks.length + ' tasks</span>',
    '      </div>',
    '      <div class="table-wrap">',
    '        <table class="task-table">',
    '          <thead><tr><th>Task ID</th><th>Task</th><th>Agent / Owner</th><th>Status</th><th>Progress</th><th>Blocker</th><th>Next Action</th><th>Output / Evidence</th></tr></thead>',
    '          <tbody id="task-body">',
    tasks.map(function (task) {
      const status = taskStatusKey(task.status);
      const blocked = hasBlocker(task.blocker);
      const badgeClass = statusClass(task.status) || status;
      const blockerHtml = blocked
        ? '<span class="badge blocker">' + renderInline(task.blocker) + '</span>'
        : renderInline(task.blocker || 'none');

      return '            <tr data-status="' + escapeHtml(status) + '" data-blocked="' + String(blocked) + '">' +
        '<td>' + renderInline(task.id) + '</td>' +
        '<td>' + renderInline(task.task) + '</td>' +
        '<td>' + renderInline(task.agent || '-') + '</td>' +
        '<td><span class="badge ' + escapeHtml(badgeClass) + '">' + renderInline(task.status) + '</span></td>' +
        '<td>' + renderTaskProgress(task.progress) + '</td>' +
        '<td>' + blockerHtml + '</td>' +
        '<td>' + renderInline(task.nextAction || '-') + '</td>' +
        '<td>' + renderInline(task.output || '-') + '</td>' +
        '</tr>';
    }).join('\n'),
    '          </tbody>',
    '        </table>',
    '      </div>'
  ].join('\n');
}

function renderTaskBoard(tasks, sections) {
  if (!tasks.length && !sections.length) return '';

  const byNumber = sectionsByNumber(sections);
  const boardTabs = [
    { key: 't1', number: 1, label: 'T1 Evidence', fallbackTitle: 'T1. Source Evidence' },
    { key: 't2', number: 2, label: 'T2 Progress', fallbackTitle: 'T2. Progress Calculation' },
    { key: 't3', number: 3, label: 'T3 Tasks', fallbackTitle: 'T3. Active Tasklist' },
    { key: 't4', number: 4, label: 'T4 Verification', fallbackTitle: 'T4. Verification Log' },
    { key: 't5', number: 5, label: 'T5 Blockers/Risks', fallbackTitle: 'T5. Blockers And Risks' }
  ];

  return [
    '    <section class="task-board" aria-label="Task Board">',
    '      <div class="section-head">',
    '        <div>',
    '          <h2>Task Board</h2>',
    '          <p class="subcopy">T1-T5 data is rendered inside this board. T3 keeps task filters; T5 keeps the blocker and risk register.</p>',
    '        </div>',
    '      </div>',
    '      <div class="board-tabs" aria-label="Task Board sections">',
    boardTabs.map(function (tab) {
      const active = tab.key === 't3' ? ' class="active"' : '';
      return '        <button type="button"' + active + ' data-board-tab="' + tab.key + '">' + tab.label + '</button>';
    }).join('\n'),
    '      </div>',
    boardTabs.map(function (tab) {
      const active = tab.key === 't3' ? ' active' : '';
      const content = tab.key === 't3'
        ? renderTaskPanel(tasks)
        : renderSectionPanel(byNumber[tab.number], tab.fallbackTitle);
      return [
        '      <div class="board-panel' + active + '" data-board-panel="' + tab.key + '">',
        content,
        '      </div>'
      ].join('\n');
    }).join('\n'),
    '    </section>'
  ].join('\n');
}

function splitLeadingSummaryTable(html) {
  const content = String(html || '').replace(/^<h1[^>]*>.*?<\/h1>\n?/s, '');
  const match = content.match(/^(\s*<div class="table-wrap">[\s\S]*?<\/div>\s*)/);

  if (!match) {
    return {
      summaryHtml: '',
      remainingHtml: content
    };
  }

  return {
    summaryHtml: [
      '    <section class="summary-board" aria-label="Summary">',
      match[1].trim(),
      '    </section>'
    ].join('\n'),
    remainingHtml: content.slice(match[1].length)
  };
}

function renderPage(markdown) {
  const title = extractTitle(markdown);
  const tasks = extractTaskRows(markdown);
  const statusCounts = countActiveTaskStatuses(markdown);
  const body = renderMarkdown(markdown);
  const splitBody = splitLeadingSummaryTable(body);
  const renderedSections = extractRenderedH2Sections(splitBody.remainingHtml);
  const taskBoard = renderTaskBoard(tasks, renderedSections.filter(function (section) {
    return section.number >= 1 && section.number <= 5;
  }));
  const contentBody = removeRenderedSections(splitBody.remainingHtml, [1, 2, 3, 4, 5]);

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>' + escapeHtml(title) + '</title>',
    '  <style>',
    '    :root { color-scheme: light; --bg: #f5f1e8; --surface: rgba(255, 252, 244, 0.92); --text: #18211f; --muted: #66746f; --line: rgba(29, 48, 42, 0.16); --accent: #153d35; --accent-2: #61764b; --accent-3: #b76545; --done: #0f7b46; --ready: #1f6feb; --progress: #946200; --blocked: #b42318; --pending: #6b7280; --warning: #a15c00; --shadow: 0 18px 48px rgba(24, 33, 31, 0.12); }',
    '    * { box-sizing: border-box; }',
    '    body { margin: 0; background: linear-gradient(135deg, #f8f3e6 0%, #ece3d0 52%, #e8dac3 100%); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; min-height: 100vh; }',
    '    main { width: min(1440px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }',
    '    .hero { border: 1px solid rgba(21, 61, 53, 0.18); background: linear-gradient(110deg, rgba(21, 61, 53, 0.97), rgba(39, 76, 66, 0.92) 56%, rgba(183, 101, 69, 0.9)); border-radius: 14px; color: #fffaf0; box-shadow: var(--shadow); padding: clamp(10px, 1.7vw, 18px); margin-bottom: 10px; }',
    '    .eyebrow { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 6px; padding: 3px 8px; border: 1px solid rgba(255, 250, 240, 0.24); border-radius: 999px; background: rgba(255, 250, 240, 0.08); color: #f7dfaf; font-size: 10px; text-transform: uppercase; }',
    '    h1 { max-width: 940px; margin: 0; font-size: clamp(20px, 2.4vw, 30px); line-height: 1.08; letter-spacing: 0; }',
    '    .metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }',
    '    .metric { min-height: 108px; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: 0 14px 36px rgba(24, 33, 31, 0.08); }',
    '    .metric .label { color: var(--muted); font-size: 12px; text-transform: uppercase; }',
    '    .metric .value { margin-top: 12px; font-size: clamp(28px, 4vw, 48px); line-height: 1; color: var(--accent); }',
    '    .metric .note { margin-top: 10px; color: var(--muted); font-size: 13px; }',
    '    .content { display: grid; gap: 18px; }',
    '    .summary-board { margin: 18px 0; }',
    '    .summary-board .table-wrap { margin-bottom: 0; }',
    '    .task-board { margin: 18px 0; padding: clamp(18px, 3vw, 28px); border: 1px solid var(--line); border-radius: 16px; background: var(--surface); box-shadow: 0 14px 36px rgba(24, 33, 31, 0.08); }',
    '    .section-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-end; margin-bottom: 16px; }',
    '    .subcopy { margin: 8px 0 0; color: var(--muted); line-height: 1.55; }',
    '    .board-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }',
    '    .board-panel { display: none; }',
    '    .board-panel.active { display: block; }',
    '    .board-section-title { margin: 2px 0 12px; }',
    '    .board-section-title h3 { margin-top: 0; }',
    '    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 16px; }',
    '    .filters { display: flex; flex-wrap: wrap; gap: 8px; }',
    '    button { display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(21, 61, 53, 0.18); border-radius: 999px; padding: 9px 13px; background: rgba(255, 252, 244, 0.9); color: var(--accent); cursor: pointer; font: 800 13px Inter, ui-sans-serif, system-ui, sans-serif; transition: background 160ms ease, color 160ms ease, transform 160ms ease; }',
    '    button:hover, button.active { transform: translateY(-1px); background: var(--accent); color: #fffaf0; }',
    '    #visible-count { color: var(--muted); font-size: 14px; }',
    '    h2 { margin: 22px 0 10px; color: var(--accent); font-size: clamp(24px, 3vw, 38px); line-height: 1.1; letter-spacing: 0; }',
    '    h3 { margin: 18px 0 8px; color: var(--accent); font-size: 18px; letter-spacing: 0; }',
    '    p { margin: 10px 0 14px; color: var(--text); }',
    '    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; background: rgba(21, 61, 53, 0.08); border: 1px solid rgba(21, 61, 53, 0.12); border-radius: 5px; padding: 1px 5px; }',
    '    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); box-shadow: 0 14px 36px rgba(24, 33, 31, 0.06); margin: 10px 0 20px; }',
    '    table { width: 100%; border-collapse: collapse; min-width: 920px; }',
    '    .task-table { min-width: 1060px; }',
    '    .task-table th:first-child, .task-table td:first-child { width: 150px; min-width: 150px; white-space: nowrap; }',
    '    th, td { padding: 11px 13px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 14px; }',
    '    th { position: sticky; top: 0; z-index: 1; background: #efe5d0; color: var(--accent); font-weight: 800; white-space: nowrap; text-transform: uppercase; font-size: 11px; }',
    '    tr:last-child td { border-bottom: 0; }',
    '    tr:hover td { background: rgba(217, 155, 53, 0.07); }',
    '    td.progress-cell { min-width: 132px; }',
    '    .progress-number { display: inline-block; min-width: 42px; font-weight: 800; color: var(--accent); }',
    '    .progress-meter { display: inline-block; width: 76px; height: 8px; border-radius: 999px; overflow: hidden; background: rgba(21, 61, 53, 0.12); vertical-align: middle; margin-left: 8px; }',
    '    .progress-meter span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2), #d99b35); }',
    '    .status-cell span, .status-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 9px; border-radius: 999px; font-weight: 800; font-size: 12px; border: 1px solid currentColor; }',
    '    .status-done span { color: var(--done); background: #e9f7ef; }',
    '    .status-ready span { color: var(--ready); background: #eef5ff; }',
    '    .status-progress span { color: var(--progress); background: #fff7e6; }',
    '    .status-blocked span { color: var(--blocked); background: #fff0ed; }',
    '    .status-pending span, .status-muted span { color: var(--pending); background: #f3f4f6; }',
    '    .status-warning span { color: var(--warning); background: #fff4e5; }',
    '    .status-badge.status-blocked { color: var(--blocked); background: #fff0ed; }',
    '    .status-badge.status-done { color: var(--done); background: #e9f7ef; }',
    '    .status-badge.status-progress { color: var(--progress); background: #fff7e6; }',
    '    .status-badge.status-pending { color: var(--pending); background: #f3f4f6; }',
    '    .badge { display: inline-flex; align-items: center; justify-content: center; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 800; white-space: nowrap; }',
    '    .badge.done { color: var(--done); background: #e9f7ef; }',
    '    .badge.verifying { color: #5b4b00; background: #fff6cc; }',
    '    .badge.progress, .badge.discovery, .badge.in_progress, .badge.docs_prd { color: var(--progress); background: #fff7e6; }',
    '    .badge.pending { color: var(--pending); background: #f3f4f6; }',
    '    .badge.blocked, .badge.blocker { color: var(--blocked); background: #fff0ed; }',
    '    .small-progress { display: grid; gap: 6px; min-width: 86px; }',
    '    .small-progress strong { color: var(--accent); }',
    '    .track { position: relative; overflow: hidden; height: 8px; border-radius: 999px; background: rgba(21, 61, 53, 0.12); }',
    '    .fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--accent-2), #d99b35); }',
    '    ul { margin: 8px 0 16px 22px; padding: 0; }',
    '    li { margin: 5px 0; }',
    '    @media (max-width: 980px) { .metrics { grid-template-columns: 1fr 1fr; } }',
    '    @media (max-width: 720px) { main { width: min(100% - 20px, 1440px); padding: 14px 0 28px; } .hero, .metric, .table-wrap { border-radius: 12px; } .hero { padding: 12px; } .metrics { grid-template-columns: 1fr; } h1 { font-size: 22px; } table { min-width: 760px; } th, td { font-size: 13px; padding: 9px 10px; } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <section class="hero">',
    '      <div class="eyebrow">Progress Dashboard</div>',
    '      <h1>' + renderInline(title) + '</h1>',
    '    </section>',
    '    <section class="metrics">',
    '      <div class="metric"><div class="label">Done</div><div class="value">' + statusCounts.done + '</div><div class="note">Completed task rows</div></div>',
    '      <div class="metric"><div class="label">Blocked</div><div class="value">' + statusCounts.blocked + '</div><div class="note">Rows needing action</div></div>',
    '      <div class="metric"><div class="label">Verifying</div><div class="value">' + statusCounts.verifying + '</div><div class="note">Rows under validation</div></div>',
    '      <div class="metric"><div class="label">In Progress</div><div class="value">' + statusCounts.progress + '</div><div class="note">Discovery or active work</div></div>',
    '      <div class="metric"><div class="label">Pending</div><div class="value">' + statusCounts.pending + '</div><div class="note">Not started rows</div></div>',
    '    </section>',
    splitBody.summaryHtml,
    taskBoard,
    '    <section class="content">',
    contentBody,
    '    </section>',
    '  </main>',
    '  <script>',
    '    const boardButtons = Array.from(document.querySelectorAll("[data-board-tab]"));',
    '    const boardPanels = Array.from(document.querySelectorAll("[data-board-panel]"));',
    '    const taskButtons = Array.from(document.querySelectorAll("[data-task-filter]"));',
    '    const rows = Array.from(document.querySelectorAll("#task-body tr"));',
    '    const visibleCount = document.getElementById("visible-count");',
    '    function activateBoardTab(tab) {',
    '      boardButtons.forEach(function (button) { button.classList.toggle("active", button.dataset.boardTab === tab); });',
    '      boardPanels.forEach(function (panel) { panel.classList.toggle("active", panel.dataset.boardPanel === tab); });',
    '    }',
    '    function applyFilter(filter) {',
    '      let visible = 0;',
    '      rows.forEach(function (row) {',
    '        const status = row.dataset.status;',
    '        const blocked = row.dataset.blocked === "true";',
    '        const show = filter === "all" || status === filter || (filter === "blocked" && blocked);',
    '        row.style.display = show ? "" : "none";',
    '        if (show) visible += 1;',
    '      });',
    '      if (visibleCount) visibleCount.textContent = "Showing " + visible + " task" + (visible === 1 ? "" : "s");',
    '    }',
    '    boardButtons.forEach(function (button) {',
    '      button.addEventListener("click", function () {',
    '        activateBoardTab(button.dataset.boardTab);',
    '      });',
    '    });',
    '    taskButtons.forEach(function (button) {',
    '      button.addEventListener("click", function () {',
    '        taskButtons.forEach(function (item) { item.classList.remove("active"); });',
    '        button.classList.add("active");',
    '        applyFilter(button.dataset.taskFilter);',
    '      });',
    '    });',
    '  </script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function resolvePaths(argument, outputArgument) {
  const input = path.resolve(argument || process.cwd());
  const isMarkdownFile = path.basename(input) === 'tasklist-progress.md' || input.endsWith('.md');
  const markdownPath = isMarkdownFile
    ? input
    : path.join(input, 'docs/tasks/tasklist-progress.md');
  const outputPath = outputArgument
    ? path.resolve(outputArgument)
    : markdownPath.replace(/\.md$/, '.html');
  const projectRoot = isMarkdownFile
    ? path.resolve(path.dirname(markdownPath), '../..')
    : input;

  return { markdownPath, outputPath, projectRoot };
}

function main() {
  const paths = resolvePaths(process.argv[2], process.argv[3]);

  if (!fs.existsSync(paths.markdownPath)) {
    fail('tasklist progress markdown not found: ' + paths.markdownPath);
  }

  const markdown = fs.readFileSync(paths.markdownPath, 'utf8');
  const html = renderPage(markdown);

  fs.mkdirSync(path.dirname(paths.outputPath), { recursive: true });
  fs.writeFileSync(paths.outputPath, html, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    source: paths.markdownPath,
    output: paths.outputPath,
    outputFileUrl: pathToFileURL(paths.outputPath).href
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  renderMarkdown,
  renderPage
};
