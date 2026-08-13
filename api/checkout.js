const Stripe = require('stripe');
const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── CRON: envoi des relances paniers abandonnes (declenche par cron-job.org) ──
  if (req.method === 'GET') {
    const token = req.query?.token || (req.url.includes('token=') ? req.url.split('token=')[1].split('&')[0] : '');
    if (!CRON_SECRET || token !== CRON_SECRET) {
      return res.status(401).json({ error: 'Non autorise' });
    }
    return await envoyerRelances(res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── SAUVEGARDE PANIER ABANDONNE (capture email avant paiement) ──
  if (req.body && req.body.type === 'save_cart') {
    try {
      const { email, formation_titre, montant, query_string } = req.body;
      if (!email || !email.includes('@') || !formation_titre || !montant) {
        return res.status(400).json({ error: 'Champs manquants' });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/paniers_abandonnes`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ email, formation_titre, montant: parseFloat(montant), query_string: query_string || null, statut: 'en_attente' })
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── STRIPE (existant, inchange) ──
  try {
    const { formation_id, formation_titre, formation_prix } = req.body;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "STRIPE_SECRET_KEY manquante" });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceInCents = Math.round(parseFloat(formation_prix.toString().replace('€', '').replace(',', '.')) * 100);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: formation_titre },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: {
        formation_id: formation_id || '',
        formation_titre: formation_titre || ''
      },
      success_url: `https://www.formationelite.vip/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://www.formationelite.vip/formations.html`,
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Checkout Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

async function envoyerRelances(res) {
  try {
    const seuil = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/paniers_abandonnes?statut=eq.en_attente&created_at=lte.${seuil}&select=*`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const paniers = await response.json();
    if (!Array.isArray(paniers) || paniers.length === 0) {
      return res.status(200).json({ sent: 0 });
    }

    let sent = 0;
    for (const p of paniers) {
      const montantReduit = (p.montant * 0.9).toFixed(2);
      let lienDirect = 'https://www.formationelite.vip/formations.html';
      if (p.query_string) {
        try {
          const sp = new URLSearchParams(p.query_string);
          sp.set('prix', montantReduit + '€');
          sp.set('email', encodeURIComponent(p.email));
          lienDirect = `https://www.formationelite.vip/checkout.html?${sp.toString()}`;
        } catch (e) {}
      }
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'FormationElite <contact@formationelite.vip>',
            to: [p.email],
            subject: `Il vous reste -10% sur "${p.formation_titre}"`,
            html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #c9a84c;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a);padding:40px 30px;text-align:center;border-bottom:2px solid #c9a84c;">
      <h1 style="color:#c9a84c;font-size:28px;margin:0;letter-spacing:2px;">FORMATION<span style="color:#fff">ELITE</span></h1>
    </div>
    <div style="padding:40px 30px;">
      <h2 style="color:#fff;font-size:20px;margin:0 0 16px;">Vous avez laisse quelque chose derriere vous</h2>
      <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Votre formation <strong style="color:#c9a84c;">${p.formation_titre}</strong> vous attend encore.
        Finalisez maintenant et beneficiez de <strong style="color:#2ecc71;">-10%</strong> :
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
        <div style="color:#888;font-size:13px;text-decoration:line-through;">${p.montant}€</div>
        <div style="color:#2ecc71;font-size:28px;font-weight:bold;">${montantReduit}€</div>
      </div>
      <div style="text-align:center;margin-bottom:14px;">
        <a href="${lienDirect}" style="background:linear-gradient(135deg,#c9a84c,#f0d080);color:#000;font-weight:bold;font-size:16px;padding:16px 40px;border-radius:8px;text-decoration:none;display:inline-block;">
          Profiter de la reduction maintenant
        </a>
      </div>
      <div style="text-align:center;">
        <a href="https://t.me/CreativeagencyFr" style="color:#888;font-size:12px;text-decoration:underline;">
          Une question ? Contactez-nous sur Telegram
        </a>
      </div>
    </div>
    <div style="background:#0a0a0a;padding:24px 30px;border-top:1px solid #222;text-align:center;">
      <p style="color:#555;font-size:12px;margin:0;">Support : <a href="https://t.me/CreativeagencyFr" style="color:#c9a84c;">@CreativeagencyFr</a></p>
    </div>
  </div>
</body></html>`
          })
        });

        await fetch(`${SUPABASE_URL}/rest/v1/paniers_abandonnes?id=eq.${p.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ statut: 'relance_envoyee' })
        });
        sent++;
      } catch (e) {
        console.error('Erreur envoi relance:', e);
      }
    }
    return res.status(200).json({ sent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
