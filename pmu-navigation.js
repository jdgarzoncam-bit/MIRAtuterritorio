/* MIRA TU TERRITORIO — navegación flotante inspirada en la referencia Pinterest.
   Reorganiza los módulos existentes sin duplicar controles ni reemplazar sus IDs. */
(() => {
  const sidebar = document.querySelector('#mainSidebar .neo-tactile-sidebar');
  const content = sidebar?.querySelector('.sidebar-content');
  if (!sidebar || !content || content.dataset.pmuFloatingReady === '1') return;
  content.dataset.pmuFloatingReady = '1';

  const groups = [
    { id: 'territorio', label: 'Territorio', modules: ['dropdown-infomira', 'dropdown-puestos', 'dropdown-barrios-puestos'] },
    { id: 'operacion', label: 'Operación', modules: ['dropdown-logistica', 'dropdown-testigos'] },
    { id: 'gestion', label: 'Gestión', modules: ['dropdown-actividades', 'dropdown-concejal'] }
  ];

  const sectionTitle = content.querySelector('.section-title');
  if (sectionTitle) sectionTitle.hidden = true;

  const tabs = document.createElement('div');
  tabs.className = 'pmu-floating-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Secciones de navegación');

  const panelsHost = document.createElement('div');
  panelsHost.className = 'pmu-floating-panels';

  groups.forEach((group, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'pmu-floating-tab';
    tab.id = `pmu-tab-${group.id}`;
    tab.dataset.group = group.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `pmu-panel-${group.id}`);
    tab.setAttribute('aria-selected', String(index === 0));
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.textContent = group.label;
    tabs.append(tab);

    const panel = document.createElement('section');
    panel.className = 'pmu-floating-panel';
    panel.id = `pmu-panel-${group.id}`;
    panel.dataset.group = group.id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.hidden = index !== 0;
    panelsHost.append(panel);

    group.modules.forEach(id => {
      const module = content.querySelector(`#${id}`);
      if (module) panel.append(module);
    });

    tab.addEventListener('click', () => activateGroup(group.id));
  });

  content.prepend(panelsHost);
  content.prepend(tabs);

  const allModules = [...panelsHost.querySelectorAll('details.custom-dropdown')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let switching = false;

  function activateGroup(id) {
    if (switching) return;
    const next = panelsHost.querySelector(`.pmu-floating-panel[data-group="${id}"]`);
    if (!next || !next.hidden) return;
    switching = true;

    const current = panelsHost.querySelector('.pmu-floating-panel:not([hidden])');
    const currentTab = tabs.querySelector('[aria-selected="true"]');
    const nextTab = tabs.querySelector(`[data-group="${id}"]`);
    allModules.forEach(module => {
      if (module.open) module.open = false;
      module.classList.remove('pmu-module-active');
    });

    if (currentTab) {
      currentTab.setAttribute('aria-selected', 'false');
      currentTab.tabIndex = -1;
    }
    nextTab.setAttribute('aria-selected', 'true');
    nextTab.tabIndex = 0;

    const finish = () => {
      if (current) current.hidden = true;
      next.hidden = false;
      if (reducedMotion || typeof next.animate !== 'function') {
        switching = false;
        return;
      }
      const animation = next.animate([
        { opacity: 0, transform: 'translateY(9px)', filter: 'blur(5px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
      ], { duration: 260, easing: 'cubic-bezier(.2,.75,.25,1)' });
      animation.onfinish = animation.oncancel = () => { switching = false; };
    };

    if (current && !reducedMotion && typeof current.animate === 'function') {
      const animation = current.animate([
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
        { opacity: 0, transform: 'translateY(-5px)', filter: 'blur(4px)' }
      ], { duration: 135, easing: 'ease-in' });
      animation.onfinish = finish;
      animation.oncancel = finish;
    } else {
      finish();
    }
  }

  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...tabs.querySelectorAll('button')];
    const active = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
      (active + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    activateGroup(buttons[next].dataset.group);
  });

  function setModuleState(module, open) {
    module.classList.toggle('pmu-module-active', open);
    const summary = module.querySelector(':scope > summary');
    if (summary) summary.setAttribute('aria-expanded', String(open));
  }

  panelsHost.addEventListener('click', async event => {
    const summary = event.target.closest('details.custom-dropdown > summary');
    if (!summary || !panelsHost.contains(summary)) return;
    event.preventDefault();
    event.stopPropagation();
    if (switching) return;

    const selected = summary.parentElement;
    const shouldOpen = !selected.open;
    switching = true;
    try {
      for (const module of allModules) {
        if (module !== selected && module.open) {
          const body = module.querySelector(':scope > .dropdown-content');
          setModuleState(module, false);
          if (body && !reducedMotion && typeof body.animate === 'function') {
            const close = body.animate(
              [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-5px)' }],
              { duration: 135, easing: 'ease-in' }
            );
            await new Promise(resolve => { close.onfinish = close.oncancel = resolve; });
          }
          module.open = false;
        }
      }

      if (shouldOpen) {
        selected.open = true;
        setModuleState(selected, true);
        const body = selected.querySelector(':scope > .dropdown-content');
        if (body && !reducedMotion && typeof body.animate === 'function') {
          const opening = body.animate(
            [{ opacity: 0, transform: 'translateY(-7px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }],
            { duration: 235, easing: 'cubic-bezier(.2,.75,.25,1)' }
          );
          await new Promise(resolve => { opening.onfinish = opening.oncancel = resolve; });
        }
      } else {
        setModuleState(selected, false);
        selected.open = false;
      }
    } finally {
      switching = false;
    }
  }, true);

  allModules.forEach(module => {
    module.open = false;
    setModuleState(module, false);
  });
})();
