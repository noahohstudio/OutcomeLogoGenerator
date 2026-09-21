// Variant tabs: mini live thumbnail, rename on double-click, close, "+" for a new variant, and a reopen button
// for recently closed ones. The two trailing buttons persist between renders so the reopen button can animate.
import { R } from './geometry.js';
import { logoBody } from './svg.js';

const cache = new Map();
function thumb(v) {
  const key = JSON.stringify([v.params, v.colors]);
  if (!cache.has(key)) {
    if (cache.size > 200) cache.clear();
    const body = logoBody(v.params, v.colors, 40);
    cache.set(key, `<svg viewBox="${-R - 8} ${-R - 8} ${2 * R + 16} ${2 * R + 16}" aria-hidden="true"><rect x="${-R - 8}" y="${-R - 8}" width="${2 * R + 16}" height="${2 * R + 16}" rx="36" fill="${v.colors.bg}"/>${body}</svg>`);
  }
  return cache.get(key);
}

let add, reopen;
function trailingButtons(container) {
  if (!add) {
    add = document.createElement('button');
    add.type = 'button'; add.className = 'tab tab-add'; add.title = 'New random variant'; add.textContent = '+';
    reopen = document.createElement('button');
    reopen.type = 'button'; reopen.className = 'tab tab-add tab-reopen'; reopen.setAttribute('aria-label', 'Reopen closed variant');
    reopen.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v3.1h3.1"/></svg>';
  }
  if (add.parentNode !== container) container.append(add, reopen);
}

export function renderTabs(container, store, h) {
  trailingButtons(container);
  add.onclick = () => h.add();
  reopen.onclick = () => h.reopen();
  container.setAttribute('role', 'tablist');
  container.querySelectorAll('.tab[data-id]').forEach((n) => n.remove());

  for (const v of store.variants) {
    const tab = document.createElement('div');
    tab.className = `tab${v.id === store.activeId ? ' on' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(v.id === store.activeId));
    tab.tabIndex = 0;
    tab.dataset.id = v.id;
    tab.insertAdjacentHTML('beforeend', thumb(v));
    const name = document.createElement('span');
    name.textContent = v.name;
    const x = document.createElement('span');
    x.className = 'x';
    x.title = 'Close variant';
    x.textContent = '×';
    tab.append(name, x);

    tab.addEventListener('click', (e) => { if (e.target === x) h.remove(v.id); else if (!tab.querySelector('input')) h.select(v.id); });
    tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === tab) h.select(v.id); });
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.value = v.name; input.maxLength = 14;
      const done = (ok) => { if (!input.isConnected) return; if (ok && input.value.trim()) h.rename(v.id, input.value.trim()); else renderTabs(container, store, h); };
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
      input.addEventListener('blur', () => done(true));
      name.replaceWith(input);
      input.focus(); input.select();
    });
    container.insertBefore(tab, add);
  }

  const n = store.closed.length;
  reopen.classList.toggle('show', n > 0);
  reopen.disabled = n === 0;
  reopen.title = n ? `Reopen ${store.closed[0].variant.name}${n > 1 ? ` (${n} recently closed)` : ''}` : '';
}
