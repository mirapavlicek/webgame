// Tiny hyperscript-style DOM builder. No framework, just composable helpers.

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class')       el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
    else if (k === 'html')   el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  const cs = Array.isArray(children) ? children : [children];
  for (const c of cs) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

export function q(sel, root = document) { return root.querySelector(sel); }
export function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
