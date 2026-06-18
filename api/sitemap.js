// api/sitemap.js
const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

const STATIC_PAGES = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/formations.html', priority: '0.9', changefreq: 'daily' },
  { url: '/elite-pass.html', priority: '0.9', changefreq: 'weekly' },
  { url: '/preuves.html', priority: '0.7', changefreq: 'weekly' },
  { url: '/faq.html', priority: '0.6', changefreq: 'monthly' },
  { url: '/politique-remboursement.html', priority: '0.4', changefreq: 'monthly' },
];

module.exports = async (req, res) => {
  try {
    // Récupérer toutes les formations actives
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/formations?select=id,updated_at&actif=eq.true`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const formations = await response.json();

    const today = new Date().toISOString().split('T')[0];

    const staticUrls = STATIC_PAGES.map(p => `
  <url>
    <loc>https://formationelite.vip${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('');

    const formationUrls = Array.isArray(formations) ? formations.map(f => `
  <url>
    <loc>https://formationelite.vip/formation.html?id=${f.id}</loc>
    <lastmod>${f.updated_at ? f.updated_at.split('T')[0] : today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('') : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${formationUrls}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).send(xml);

  } catch (err) {
    console.error('sitemap error:', err);
    return res.status(500).send('Error generating sitemap');
  }
};
