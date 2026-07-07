// API pour gérer les commandes (SÉCURISÉ - clé service_role + vérification admin)
const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function isValidAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [email, , pass] = parts;
    return email === process.env.ADMIN_EMAIL && pass === process.env.ADMIN_PASS;
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vérification admin obligatoire (emails + montants clients = données sensibles)
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!isValidAdminToken(token)) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // GET — fetch orders (avec filtres optionnels transmis tels quels à Supabase)
  if (req.method === 'GET') {
    try {
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : 'select=*&order=created_at.desc';
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/commandes?${queryString}`,
        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — update order (livraison, validation/refus PayPal, etc.)
  if (req.method === 'PATCH') {
    try {
      const { id, statut, livraison_statut, lien_acces } = req.body;
      if (!id) return res.status(400).json({ error: 'ID manquant' });

      const updateData = {};
      if (statut) updateData.statut = statut;
      if (livraison_statut) updateData.livraison_statut = livraison_statut;
      if (lien_acces) updateData.lien_acces = lien_acces;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/commandes?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        }
      );
      const data = await response.json();

      const isLivre = livraison_statut === 'livre' || livraison_statut === 'livré';
      if (isLivre && lien_acces && data[0]?.email) {
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
    <div style="font-family:Georgia,serif;font-size:26px;color:#e8c97a">FormationElite.vip</div>
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
    <p style="font-size:11px;color:#444">FormationElite.vip - Montant paye : ${commande.montant}</p>
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
