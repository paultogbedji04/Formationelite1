// api/paypal-confirmation.js
const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { nom, email, formation_id, formation_titre, montant, transaction_id, screenshot_url } = req.body;

    // Validation
    if (!nom || !email || !formation_titre || !montant || !transaction_id) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    // Enregistrer dans Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/commandes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        email,
        formation_id: (formation_id && formation_id !== 'null' && formation_id !== 'undefined') ? formation_id : null,
        formation_titre,
        montant: `${montant}€`,
        statut: 'paypal_pending',
        livraison_statut: 'en_attente',
        transaction_id,
        screenshot_url: screenshot_url || null,
        nom_client: nom
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: 'Erreur Supabase', details: data });
    }

    // Email de confirmation au client via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'FormationElite <contact@formationelite.vip>',
        to: [email],
        subject: '⏳ Votre paiement PayPal est en cours de vérification',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #c9a84c;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a);padding:40px 30px;text-align:center;border-bottom:2px solid #c9a84c;">
      <h1 style="color:#c9a84c;font-size:28px;margin:0;letter-spacing:2px;">FORMATION<span style="color:#fff">ELITE</span></h1>
    </div>
    <div style="padding:40px 30px;">
      <h2 style="color:#fff;font-size:20px;margin:0 0 16px;">⏳ Paiement en cours de vérification</h2>
      <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Bonjour <strong style="color:#c9a84c;">${nom}</strong>,<br><br>
        Nous avons bien reçu votre demande pour : <strong style="color:#c9a84c;">${formation_titre}</strong>.
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#888;font-size:13px;">Formation</span>
          <span style="color:#fff;font-size:13px;font-weight:bold;">${formation_titre}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#888;font-size:13px;">Montant</span>
          <span style="color:#c9a84c;font-size:13px;font-weight:bold;">${montant}€</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#888;font-size:13px;">ID Transaction</span>
          <span style="color:#fff;font-size:13px;">${transaction_id}</span>
        </div>
      </div>
      <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:16px;text-align:center;">
        <p style="color:#c9a84c;margin:0;font-size:14px;">
          ✅ Votre paiement a été soumis avec succès.<br>
          Notre système vérifie actuellement votre transaction PayPal.<br>
          <strong>Vous recevrez vos accès par email dans les plus brefs délais.</strong>
        </p>
      </div>
    </div>
    <div style="background:#0a0a0a;padding:24px 30px;border-top:1px solid #222;text-align:center;">
      <p style="color:#555;font-size:12px;margin:0;">
        Support : <a href="https://t.me/CreativeagencyFr" style="color:#c9a84c;">@CreativeagencyFr</a>
      </p>
    </div>
  </div>
</body>
</html>`
      })
    });

    return res.status(200).json({ success: true, id: data[0]?.id });

  } catch (err) {
    console.error('paypal-confirmation error:', err);
    return res.status(500).json({ error: err.message });
  }
};
