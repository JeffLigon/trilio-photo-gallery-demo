(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const FALLBACK_SVG_DATA_URL =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'>" +
        "<rect width='100%' height='100%' fill='lightgray'/>" +
        "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' " +
          "font-family='Arial' font-size='16'>Image</text>" +
      '</svg>'
    );

  function showFlash(msg) {
    const f = document.getElementById('flash');
    if (!f) return;
    f.textContent = msg;
    f.style.display = 'block';
    setTimeout(() => (f.style.display = 'none'), 2000);
  }

  function fmtMB(n) { return (n / 1024 / 1024).toFixed(2); }

  async function fetchJSON(url, opts) {
    const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...(opts||{}) });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    return res.json();
  }

  async function refresh() {
    try {
      const items = await fetchJSON('/api/photos?_=' + Date.now());
      const grid = $('#grid'); grid.innerHTML = '';
      let total = 0;

      items.forEach((it) => {
        total += it.size_bytes || 0;
        const card = document.createElement('div');
        card.className = 'tile';

        const img = document.createElement('img');
        img.src = it.url;
        img.alt = it.title || 'Untitled';
        img.onerror = () => { img.src = FALLBACK_SVG_DATA_URL; };

        const body = document.createElement('div');
        body.style.padding = '12px';
        body.innerHTML =
          "<div style='font-weight:600'>" + (it.title || 'Untitled') + "</div>" +
          "<div class='muted'>" + (it.caption || '') + "</div>" +
          "<div class='row muted'><span>" + fmtMB(it.size_bytes || 0) + " MB</span>" +
          "<button data-id='" + it.id + "'>Delete</button></div>";

        card.appendChild(img);
        card.appendChild(body);
        grid.appendChild(card);

        body.querySelector('button').addEventListener('click', async () => {
          await fetch('/api/photos/' + it.id, { method: 'DELETE' });
          showFlash('Deleted'); refresh();
        });
      });

      const rows = $('#dbrows'); if (rows) rows.textContent = items.length;
      const disk = $('#diskmb'); if (disk) disk.textContent = fmtMB(total);
      const lb = $('#lastbackup'); if (lb) lb.textContent = window.__lastBackup ? (window.__lastBackup.length + ' items') : '—';
    } catch (e) {
      console.error('refresh()', e);
      showFlash('Failed to load photos: ' + e.message);
    }
  }

  function bindActions() {
    const form = document.getElementById('upload-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        if (r.ok) { showFlash('Uploaded'); refresh(); form.reset(); }
        else { showFlash('Upload failed'); }
      });
    }

    const b1 = document.getElementById('btn-backup');
    if (b1) b1.addEventListener('click', async () => {
      window.__lastBackup = await fetchJSON('/api/photos');
      showFlash('Backup completed');
      const lb = document.getElementById('lastbackup');
      if (lb) lb.textContent = window.__lastBackup.length + ' items';
    });

    const b2 = document.getElementById('btn-disaster');
    if (b2) b2.addEventListener('click', async () => {
      const items = await fetchJSON('/api/photos');
      for (const it of items) {
        await fetch('/api/photos/' + it.id, { method: 'DELETE' });
      }
      showFlash('Disaster simulated'); refresh();
    });

    const b3 = document.getElementById('btn-restore');
    if (b3) b3.addEventListener('click', () => {
      if (!window.__lastBackup) { showFlash('No backup available'); return; }
      showFlash('Assume restore completed (use Trilio for real restore)'); refresh();
    });
  }

  document.addEventListener('DOMContentLoaded', () => { bindActions(); refresh(); });
})();
