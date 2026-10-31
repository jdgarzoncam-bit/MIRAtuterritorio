/* PMU Navigation — compact exclusive accordion with smooth module transitions */
(() => {
  const root = document.getElementById('mainSidebar');
  if (!root || root.dataset.pmuMotionReady === '1') return;
  root.dataset.pmuMotionReady = '1';

  const panels = [...root.querySelectorAll('.neo-tactile-sidebar details.custom-dropdown')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let busy = false;

  const contentOf = panel => panel.querySelector(':scope > .dropdown-content');
  const setExpanded = (panel, value) => {
    const summary = panel.querySelector(':scope > summary');
    if (summary) summary.setAttribute('aria-expanded', String(value));
    panel.classList.toggle('pmu-module-active', value);
  };

  const animatePanel = (panel, opening) => new Promise(resolve => {
    const content = contentOf(panel);
    if (!content || reducedMotion || typeof content.animate !== 'function') {
      panel.open = opening;
      setExpanded(panel, opening);
      resolve();
      return;
    }

    if (opening) {
      panel.open = true;
      setExpanded(panel, true);
      content.style.overflow = 'hidden';
      const targetHeight = Math.min(content.scrollHeight, 360);
      const animation = content.animate([
        { opacity: 0, transform: 'translateY(-8px)', clipPath: 'inset(0 0 12% 0)' },
        { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }
      ], { duration: 245, easing: 'cubic-bezier(.2,.75,.25,1)' });
      content.style.maxHeight = `${targetHeight}px`;
      animation.onfinish = () => {
        content.style.overflow = '';
        content.style.maxHeight = '';
        resolve();
      };
      animation.oncancel = resolve;
    } else {
      setExpanded(panel, false);
      const animation = content.animate([
        { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
        { opacity: 0, transform: 'translateY(-5px)', clipPath: 'inset(0 0 12% 0)' }
      ], { duration: 165, easing: 'cubic-bezier(.4,0,1,1)' });
      animation.onfinish = () => {
        panel.open = false;
        content.style.maxHeight = '';
        content.style.overflow = '';
        resolve();
      };
      animation.oncancel = resolve;
    }
  });

  root.addEventListener('click', async event => {
    const summary = event.target.closest('.neo-tactile-sidebar details.custom-dropdown > summary');
    if (!summary || !root.contains(summary)) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const selected = summary.parentElement;
    const wasOpen = selected.open;
    busy = true;
    try {
      for (const panel of panels) {
        if (panel !== selected && panel.open) await animatePanel(panel, false);
      }
      if (wasOpen && selected.open) {
        await animatePanel(selected, false);
      } else if (!selected.open) {
        await animatePanel(selected, true);
      }
    } finally {
      busy = false;
    }
  }, true);

  // Normaliza el estado inicial: solo un módulo puede permanecer desplegado.
  const initiallyOpen = panels.filter(panel => panel.open);
  initiallyOpen.slice(1).forEach(panel => { panel.open = false; });
  panels.forEach(panel => setExpanded(panel, panel.open));
})();
