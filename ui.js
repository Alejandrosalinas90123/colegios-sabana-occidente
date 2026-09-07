/* UI primitives shared by filters, lists and dialogs. Calculation stays in engine.js. */
const DashboardUI = (() => {
  const byId = (id) => document.getElementById(id);

  // Do not silently clamp an invalid input: preserve the last valid result instead.
  function validateMinimum(value) {
    if (String(value).trim() === '') return 'Escribe un número; usa 0 para no exigir un mínimo.';
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 100000) {
      return 'Escribe un número entero entre 0 y 100.000.';
    }
    return '';
  }

  function fieldError(controlId, messageId, message) {
    const control = byId(controlId),
      output = byId(messageId);
    control.setAttribute('aria-invalid', String(Boolean(message)));
    output.textContent = message ? '⚠ ' + message : '';
    output.hidden = !message;
  }

  // DOM updates must not send keyboard users back to the document body.
  function captureFocus() {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    const region = element.closest('[id]')?.id;
    if (element.id) return { element, selector: '#' + CSS.escape(element.id) };
    for (const attribute of [
      'data-add',
      'data-remove',
      'data-detail',
      'data-year',
      'data-place',
      'data-department',
      'data-pick',
      'data-remove-place',
      'data-route',
      'data-goto',
    ]) {
      if (element.hasAttribute(attribute)) {
        const selector = `[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
        return { element, selector, region };
      }
    }
    return { element };
  }

  function restoreFocus(snapshot, fallbackId = 'compare-tab') {
    if (!snapshot || (snapshot.element.isConnected && !snapshot.element.disabled)) return;
    const region = snapshot.region && byId(snapshot.region);
    const replacement =
      snapshot.selector &&
      (region?.querySelector(snapshot.selector) || document.querySelector(snapshot.selector));
    let target = replacement && !replacement.closest('[hidden]') ? replacement : byId(fallbackId);
    // A result tab may be hidden while the user is editing a wizard step.
    if (!target || target.closest('[hidden]'))
      target = document.querySelector('[aria-current="step"]');
    target?.focus({ preventScroll: true });
  }

  function tabs(view) {
    for (const name of ['explore', 'compare']) {
      const selected = name === view,
        tab = byId(name + '-tab');
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      byId(name + '-view').hidden = !selected;
    }
  }

  function tabDestination(key, index) {
    return { ArrowRight: (index + 1) % 2, ArrowLeft: (index + 1) % 2, Home: 0, End: 1 }[key];
  }

  // Native dialog supplies Escape handling and a modal focus boundary.
  let dialogOpener = null;
  function openDialog() {
    const dialog = byId('school-dialog');
    if (dialog.open) return;
    dialogOpener = captureFocus();
    dialog.showModal();
    dialog.querySelector('.close').focus();
  }
  function bindDialog() {
    byId('school-dialog').addEventListener('close', () => {
      if (dialogOpener?.element.isConnected) dialogOpener.element.focus({ preventScroll: true });
      else restoreFocus(dialogOpener, 'explore-tab');
    });
  }

  async function busy(button, label, operation) {
    const original = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = label;
    try {
      // Yield one paint so loading feedback is visible before synchronous CSV work.
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      return await operation();
    } finally {
      button.textContent = original;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function labelTables(root = document) {
    root.querySelectorAll('.table-wrap').forEach((region, index) => {
      region.tabIndex = 0;
      region.setAttribute('role', 'region');
      region.setAttribute(
        'aria-label',
        region.dataset.label || 'Tabla de resultados; desplaza horizontalmente si es necesario'
      );
      region.querySelectorAll('thead th').forEach((th) => (th.scope = 'col'));
      region.querySelectorAll('tbody th').forEach((th) => (th.scope = 'row'));
      region.querySelectorAll('table').forEach((table) => {
        const headings = [...table.querySelectorAll('thead th')].map((th) => th.textContent);
        table.querySelectorAll('tbody tr').forEach((row) =>
          [...row.children].forEach((cell, i) => {
            if (cell.tagName === 'TD') cell.dataset.column = headings[i] || '';
          })
        );
      });
    });
  }
  return {
    validateMinimum,
    fieldError,
    captureFocus,
    restoreFocus,
    tabs,
    tabDestination,
    openDialog,
    bindDialog,
    busy,
    labelTables,
  };
})();
if (typeof module !== 'undefined') module.exports = DashboardUI;
