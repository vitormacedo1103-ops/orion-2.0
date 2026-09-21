// Orionnex — interações (sem dependências, performático)
// WhatsApp oficial: https://wa.me/5581999424359

(function () {
  // Menu mobile — acessível
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('menu');
  if (toggle && menu) {
    const close = () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
    };
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // FAQ accordion — um aberto por vez, keyboard-friendly (button nativo)
  const items = document.querySelectorAll('.faq-item');
  items.forEach((item) => {
    const btn = item.querySelector('.faq-q');
    const panel = item.querySelector('.faq-a');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((o) => {
        o.classList.remove('open');
        o.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        o.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  // Reveal on scroll — IntersectionObserver, respeita reduced-motion
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
  }

  // Processo visual — barra preenche com scroll da seção
  const proc = document.getElementById('processo');
  const bar = document.getElementById('processProgress');
  if (proc && bar && !reduced) {
    const onScroll = () => {
      const r = proc.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0.2, 1 - r.top / vh));
      bar.style.width = Math.round(p * 100) + '%';
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (bar) {
    bar.style.width = '100%';
  }

  // Parallax sutil no hero (desktop apenas)
  const hero = document.querySelector('.hero-visual');
  if (hero && !reduced && window.matchMedia('(pointer: fine)').matches) {
    let raf = null;
    document.addEventListener('mousemove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        hero.style.transform = `translate(${x}px, ${y}px)`;
        raf = null;
      });
    }, { passive: true });
  }
})();
