/* MIRA TU TERRITORIO — navegación vertical de vidrio.
   Conserva el orden y los controles HTML originales; añade acordeón y transiciones. */
(() => {
  const sidebar = document.querySelector('#mainSidebar .neo-tactile-sidebar');
  const content = sidebar?.querySelector('.sidebar-content');
  if (!sidebar || !content || content.dataset.pmuVerticalReady === '1') return;
  content.dataset.pmuVerticalReady = '1';

  const modules = [...content.querySelectorAll(':scope > details.custom-dropdown')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let busy = false;

  function setState(module, open) {
    module.classList.toggle('pmu-module-active', open);
    const summary = module.querySelector(':scope > summary');
    if (summary) summary.setAttribute('aria-expanded', String(open));
  }

  function animate(element, frames, duration, easing) {
    if (!element || reducedMotion || typeof element.animate !== 'function') return Promise.resolve();
    const animation = element.animate(frames, { duration, easing, fill: 'both' });
    return new Promise(resolve => {
      animation.onfinish = () => { animation.cancel(); resolve(); };
      animation.oncancel = resolve;
    });
  }

  content.addEventListener('click', async event => {
    const summary = event.target.closest(':scope > details.custom-dropdown > summary');
    if (!summary || !content.contains(summary) || busy) return;
    event.preventDefault();
    event.stopPropagation();

    const selected = summary.parentElement;
    const shouldOpen = !selected.open;
    busy = true;
    try {
      for (const module of modules) {
        if (module !== selected && module.open) {
          const body = module.querySelector(':scope > .dropdown-content');
          await animate(body,
            [{opacity:1,transform:'translateY(0)',filter:'blur(0)'},{opacity:0,transform:'translateY(-6px)',filter:'blur(3px)'}],
            145,'ease-in');
          module.open = false;
          setState(module, false);
        }
      }
      if (shouldOpen) {
        selected.open = true;
        setState(selected, true);
        const body = selected.querySelector(':scope > .dropdown-content');
        await animate(body,
          [{opacity:0,transform:'translateY(-8px)',filter:'blur(4px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],
          260,'cubic-bezier(.2,.75,.25,1)');
      } else {
        const body = selected.querySelector(':scope > .dropdown-content');
        await animate(body,
          [{opacity:1,transform:'translateY(0)',filter:'blur(0)'},{opacity:0,transform:'translateY(-5px)',filter:'blur(3px)'}],
          145,'ease-in');
        selected.open = false;
        setState(selected, false);
      }
    } finally {
      busy = false;
    }
  }, true);

  modules.forEach(module => {
    module.open = false;
    setState(module, false);
  });
})();
