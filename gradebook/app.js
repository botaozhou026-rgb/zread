'use strict';

const subjects = [
  { key: 'chinese', name: '语文', max: 100 },
  { key: 'math', name: '数学', max: 100 },
  { key: 'english', name: '英语', max: 100 },
];
const storageKey = 'class-gradebook.records.v1';
const get = (id) => document.getElementById(id);
const editor = get('editor');
const deletion = get('deletion');
const editForm = get('edit-form');
const formatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
let records = [];
let editingNumber = null;
let deletingNumber = null;

function append(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(saved) || new Set(saved.map((row) => row.number)).size !== saved.length ||
        !saved.every((row) => typeof row.number === 'string' && row.number.trim() &&
          typeof row.name === 'string' && row.name.trim() && subjects.every(({ key, max }) => {
            const score = row.scores[key];
            return score === null || (Number.isFinite(score) && score >= 0 && score <= max);
          }))) {
      throw new Error('Invalid saved records');
    }
    records = saved;
  } catch {
    get('add').disabled = true;
    get('status').textContent = '无法读取已保存的成绩。请检查浏览器的本地存储设置。';
    get('status').hidden = false;
  }
}

function saveRecords(next, error, message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    error.textContent = '保存失败。请检查浏览器的本地存储设置后重试。';
    return false;
  }
  records = next;
  render();
  get('status').textContent = message;
  get('status').hidden = false;
  return true;
}

function render() {
  const summary = get('summary');
  summary.replaceChildren();
  for (const subject of subjects) {
    const scores = records.map((row) => row.scores[subject.key]).filter((score) => score !== null);
    const count = scores.length;
    const total = scores.reduce((sum, score) => sum + score, 0);
    const highest = scores.reduce((best, score) => Math.max(best, score), 0);
    const lowest = scores.reduce((best, score) => Math.min(best, score), subject.max);
    const card = append(summary, 'article', '');
    append(card, 'h3', subject.name);
    const stats = append(card, 'dl', '');
    for (const [label, value] of [
      ['已录入人数', count], ['平均分', count ? formatter.format(total / count) : '—'],
      ['最高分', count ? highest : '—'], ['最低分', count ? lowest : '—'],
    ]) {
      const item = append(stats, 'div', '');
      append(item, 'dt', label);
      append(item, 'dd', value);
    }
  }

  const rows = get('rows');
  rows.replaceChildren();
  if (!records.length) {
    const cell = append(append(rows, 'tr', ''), 'td', '暂无成绩。点击“录入成绩”添加学生。');
    cell.colSpan = subjects.length + 3;
    cell.className = 'empty';
  }
  for (const record of records) {
    const row = append(rows, 'tr', '');
    append(row, 'td', record.number);
    append(row, 'td', record.name);
    for (const { key } of subjects) append(row, 'td', record.scores[key] ?? '—');
    const actions = append(row, 'td', '');
    actions.className = 'row-actions';
    append(actions, 'button', '编辑').addEventListener('click', () => openEditor(record));
    append(actions, 'button', '删除').addEventListener('click', () => {
      deletingNumber = record.number;
      get('delete-error').textContent = '';
      get('delete-details').textContent = `确定删除 ${record.name}（${record.number}）本次考试的整条成绩记录吗？`;
      deletion.showModal();
    });
  }
}

function openEditor(record) {
  editingNumber = record?.number ?? null;
  get('edit-title').textContent = record ? '编辑成绩' : '录入成绩';
  get('edit-error').textContent = '';
  editForm.elements.number.value = record?.number ?? '';
  editForm.elements.name.value = record?.name ?? '';
  for (const { key } of subjects) editForm.elements[key].value = record?.scores[key] ?? '';
  editor.showModal();
}

for (const title of ['学号', '姓名', ...subjects.map(({ name }) => name), '操作']) {
  append(get('columns'), 'th', title).scope = 'col';
}
for (const { key, name, max } of subjects) {
  const label = append(get('scores'), 'label', `${name}（满分 ${max}）`);
  const input = append(label, 'input', '');
  input.name = key;
  input.type = 'number';
  input.min = '0';
  input.max = String(max);
  input.step = 'any';
}

get('add').addEventListener('click', () => openEditor());
get('cancel-edit').addEventListener('click', () => editor.close());
get('cancel-delete').addEventListener('click', () => deletion.close());
editForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const number = editForm.elements.number.value.trim();
  const name = editForm.elements.name.value.trim();
  const error = get('edit-error');
  if (!number || !name) {
    error.textContent = '请填写学号和姓名。';
    return;
  }
  if (records.some((row) => row.number === number && row.number !== editingNumber)) {
    error.textContent = '该学号已存在，请填写其他学号。';
    editForm.elements.number.focus();
    return;
  }
  const scores = Object.fromEntries(subjects.map(({ key }) => {
    const input = editForm.elements[key];
    return [key, input.value === '' ? null : input.valueAsNumber];
  }));
  const record = { number, name, scores };
  const next = editingNumber === null ? [...records, record] :
    records.map((row) => row.number === editingNumber ? record : row);
  if (saveRecords(next, error, `已保存 ${name} 的成绩。`)) {
    editor.close();
    get('add').focus();
  }
});
get('delete-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const next = records.filter((row) => row.number !== deletingNumber);
  if (saveRecords(next, get('delete-error'), '已删除该条成绩记录。')) {
    deletion.close();
    get('add').focus();
  }
});

loadRecords();
render();
