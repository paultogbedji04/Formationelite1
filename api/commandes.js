// API pour gérer les commandes
const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — fetch all orders
  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/commandes?select=*&order=created_at.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — update order (mark as delivered + send access email)
  if (req.method === 'PATCH') {
    try {
      const { id, livraison_statut, lien_acces } = req.body;
      if (!id) return res.status(400).json({ error: 'ID manquant' });

      const updateData = { livraison_statut };
      if (lien_acces) updateData.lien_acces = lien_acces;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/commandes?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        }
      );
      const data = await response.json();

      // Send access email if marked as delivered
      if (livraison_statut === 'livre' && lien_acces && data[0]?.email) {
        await sendAccessEmail(data[0], lien_acces);
      }

      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function sendAccessEmail(commande, lienAcces) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'FormationElite <contact@formationelite.fr>',
        to: [commande.email],
        subject: `Votre acces a "${commande.formation_titre}" est pret !`,
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#080808;color:#f0ece0;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:32px">
    <div style="font-family:Georgia,serif;font-size:26px;color:#e8c97a">FormationElite.fr</div>
    <div style="height:1px;background:rgba(201,168,76,0.3);margin:14px 0"></div>
  </div>
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:rgba(201,168,76,0.12);border:2px solid #c9a84c;line-height:64px;font-size:28px">🎓</div>
  </div>
  <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;text-align:center;margin-bottom:8px">Votre acces est pret !</h1>
  <p style="text-align:center;color:#888;font-size:14px;margin-bottom:32px">Votre formation est maintenant accessible.</p>
  <div style="background:#0f0f0f;border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:24px;margin-bottom:24px">
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;margin-bottom:12px">Votre formation</div>
    <div style="font-size:16px;font-weight:600;color:#f0ece0;margin-bottom:16px">${commande.formation_titre}</div>
    <div style="background:#080808;border-radius:6px;padding:12px;margin-bottom:14px">
      <div style="font-size:10px;color:#666;margin-bottom:6px">LIEN D'ACCES</div>
      <a href="${lienAcces}" style="color:#e8c97a;font-size:13px;word-break:break-all">${lienAcces}</a>
    </div>
    <a href="${lienAcces}" style="display:block;text-align:center;background:#c9a84c;color:#080808;text-decoration:none;padding:13px;border-radius:6px;font-weight:700;font-size:14px">Acceder a ma formation</a>
  </div>
  <div style="background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="font-size:13px;color:#888;line-height:1.7;margin:0">Acces permanent - vous pouvez y retourner a tout moment. Conservez cet email.</p>
  </div>
  <div style="text-align:center;margin-bottom:24px">
    <a href="https://t.me/CreativeagencyFr" style="display:inline-block;background:#229ED9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:13px">Support Telegram @CreativeagencyFr</a>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;text-align:center">
    <p style="font-size:11px;color:#444">FormationElite.fr - Montant paye : ${commande.montant}</p>
  </div>
</div>
</body></html>`
      })
    });
    console.log(`Email sent to ${commande.email}`);
  } catch (err) {
    console.error('Email error:', err);
  }
}
