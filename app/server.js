// Trilio Photo Gallery - Express server (OpenShift-ready, CSP-safe, no-cache for HTML/JS)
const express = require('express');
const fileUpload = require('express-fileupload');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// PVC-backed media directory
const MEDIA_DIR = process.env.MEDIA_DIR || '/data/media';
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// DB env
const DB_HOST = process.env.DB_HOST || 'trilio-gallery-mysql';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'trilio123';
const DB_NAME = process.env.DB_NAME || 'triliogallery';

// Basic no-cache headers for HTML/JS so demos always show fresh UI
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path.endsWith('.js')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.json());
app.use(fileUpload());

// Serve media from PVC
app.use('/media', express.static(MEDIA_DIR, {
  etag: false, lastModified: false, cacheControl: true, maxAge: 0, fallthrough: true
}));

// Serve static UI
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false, lastModified: false, cacheControl: true, maxAge: 0
}));

// Connection pool helper
async function getPool() {
  if (!app.locals.pool) {
    app.locals.pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return app.locals.pool;
}

app.get('/healthz', (req, res) => res.json({ ok: true }));

// List photos
app.get('/api/photos', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT id, title, caption, filename, size_bytes, created_at FROM photos ORDER BY id DESC'
    );
    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      caption: r.caption,
      url: `/media/${r.filename}`,
      size_bytes: r.size_bytes,
      created_at: r.created_at
    })));
  } catch (e) {
    console.error('GET /api/photos error:', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});

// Upload a new photo
app.post('/api/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.file) return res.status(400).json({ error: 'No file uploaded' });
    const file = req.files.file;
    const safeName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dest = path.join(MEDIA_DIR, safeName);
    await file.mv(dest);
    const size = fs.statSync(dest).size;

    const title = (req.body.title || 'New Upload').toString().slice(0, 120);
    const caption = (req.body.caption || 'Uploaded during demo').toString().slice(0, 240);

    const pool = await getPool();
    await pool.execute(
      'INSERT INTO photos (title, caption, filename, size_bytes) VALUES (?, ?, ?, ?)',
      [title, caption, safeName, size]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/upload error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Simulate Disaster (DB-only): delete all rows, keep media PVC intact.
// Safety guard: requires ?confirm=DELETE
app.post('/api/disaster', async (req, res) => {
  if (req.query.confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Add ?confirm=DELETE to run disaster' });
  }
  try {
    await pool.query('DELETE FROM photos');
    console.log('[disaster] deleted all rows from photos table');
    res.json({ ok: true, mode: 'db-only' });
  } catch (err) {
    console.error('[disaster] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete a photo
app.delete('/api/photos/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const [[row]] = await pool.query('SELECT filename FROM photos WHERE id=?', [id]);
    await pool.query('DELETE FROM photos WHERE id=?', [id]);
    if (row && row.filename) {
      try { fs.unlinkSync(path.join(MEDIA_DIR, row.filename)); } catch {}
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/photos/:id error:', e.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.listen(PORT, () => console.log(`Trilio Photo Gallery listening on :${PORT}`));
