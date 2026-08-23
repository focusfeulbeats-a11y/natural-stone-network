// Natural Stone Network — shared front-end behaviour (no build step required)

document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  // Filter chips (project gallery / directory)
  document.querySelectorAll('.filter-bar').forEach((bar) => {
    bar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      bar.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.filter || 'all';
      const grid = document.querySelector(bar.dataset.target || '.project-grid, .pro-grid');
      if (!grid) return;
      grid.querySelectorAll('[data-tags]').forEach((card) => {
        const tags = (card.dataset.tags || '').split(',');
        card.style.display = (filter === 'all' || tags.includes(filter)) ? '' : 'none';
      });
    });
  });

  // Animated stat counters
  const stats = document.querySelectorAll('.stat .num[data-count]');
  if (stats.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        const duration = 1200;
        const start = performance.now();
        function tick(now) {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(eased * target).toLocaleString() + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.4 });
    stats.forEach((s) => observer.observe(s));
  }

  // Role toggle on signup / enquiry forms
  document.querySelectorAll('.role-toggle').forEach((group) => {
    group.addEventListener('click', (e) => {
      const opt = e.target.closest('.role-opt');
      if (!opt) return;
      group.querySelectorAll('.role-opt').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      const hidden = group.parentElement.querySelector('input[name="role"]');
      if (hidden) hidden.value = opt.dataset.role;
    });
  });

  // Demo forms: prevent real submission, show a confirmation state
  document.querySelectorAll('form[data-demo]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.textContent = 'Submitted — thank you';
        btn.disabled = true;
      }
    });
  });
});
