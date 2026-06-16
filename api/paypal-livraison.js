// api/paypal-livraison.js
const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, email, titre, lien_acces } = req.body;
    if (!email || !lien_acces) {
      return res.status(400).json({ error: 'Email ou lien manquant' });
    }

    // Envoyer email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'FormationElite <contact@formationelite.vip>',
        to: [email],
        subject: `✅ Votre accès — ${titre}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #c9a84c;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a);padding:40px 30px;text-align:center;border-bottom:2px solid #c9a84c;">
      <h1 style="color:#c9a84c;font-size:28px;margin:0;letter-spacing:2px;">FORMATION<span style="color:#fff">ELITE</span></h1>
      <p style="color:#888;margin:8px 0 0;font-size:13px;">Votre accès exclusif vous attend</p>
    </div>
    <div style="padding:40px 30px;">
      <h2 style="color:#fff;font-size:20px;margin:0 0 16px;">✅ Paiement PayPal validé !</h2>
      <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Votre paiement PayPal a été vérifié et validé par notre équipe.<br>
        Votre formation <strong style="color:#c9a84c;">${titre}</strong> est prête.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${lien_acces}" 
           style="background:linear-gradient(135deg,#c9a84c,#f0d080);color:#000;font-weight:bold;
                  font-size:16px;padding:16px 40px;border-radius:8px;text-decoration:none;
                  display:inline-block;letter-spacing:1px;">
          🎓 ACCÉDER À MA FORMATION
        </a>
      </div>
      <p style="color:#888;font-size:12px;text-align:center;">
        Conservez cet email — ce lien est votre accès permanent
      </p>
    </div>
    <div style="background:#0a0a0a;padding:24px 30px;border-top:1px solid #222;text-align:center;">
      <p style="color:#555;font-size:12px;margin:0;">
        Support : <a href="https://t.me/CreativeagencyFr" style="color:#c9a84c;">@CreativeagencyFr</a>
        &nbsp;|&nbsp; Communauté : <a href="https://t.me/formation05" style="color:#c9a84c;">@formation05</a>
      </p>
    </div>
  </div>
</body>
</html>`
      })
    });

    return res.status(200).json({ success: true });

  } catch(err) {
    console.error('paypal-livraison error:', err);
    return res.status(500).json({ error: err.message });
  }
};