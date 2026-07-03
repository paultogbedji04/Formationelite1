const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nom, email, formation_id, formation_titre, formation_emoji, lien_acces } = req.body || {};

  if (!email || !formation_titre) {
    return res.status(400).json({ error: 'Email et formation requis' });
  }

  try {
    // Enregistrer dans Supabase
    const supaInsertRes = await fetch(`${SUPABASE_URL}/rest/v1/commandes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email,
        formation_id: formation_id || null,
        formation_titre,
        montant: '0€',
        statut: 'gratuit',
        livraison_statut: lien_acces ? 'livre' : 'en_attente',
        lien_acces: lien_acces || null,
        created_at: new Date().toISOString()
      })
    });

    if (!supaInsertRes.ok) {
      const supaErrText = await supaInsertRes.text();
      console.error('❌ Erreur insertion Supabase (commandes):', supaInsertRes.status, supaErrText);
    } else {
      console.log('✅ Commande gratuite enregistrée dans Supabase');
    }

    // Envoyer email
    const html = lien_acces 
      ? emailAvecLien({ nom, email, formation_titre, formation_emoji, lien_acces })
      : emailSansLien({ nom, email, formation_titre, formation_emoji });

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'FormationElite <contact@formationelite.vip>',
        to: [email],
        subject: lien_acces ? `🎁 Votre formation gratuite — ${formation_titre}` : `✅ Demande reçue — ${formation_titre}`,
        html: html
      })
    });

    if (!resendRes.ok) {
      const errData = await resendRes.text();
      console.error('Resend Error:', errData);
    }

    return res.status(200).json({ success: true, message: 'Email envoyé' });

  } catch (err) {
    console.error('Erreur gratuit.js:', err);
    return res.status(500).json({ error: 'Erreur serveur - ' + err.message });
  }
};

// === Fonctions email (copie-colle ça aussi) ===
function emailAvecLien({ nom, email, formation_titre, formation_emoji, lien_acces }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body style="margin:0;padding:40px;background:#080808;font-family:sans-serif">
<div style="max-width:500px;margin:auto;background:#0f0f0f;padding:30px;border-radius:12px;border:1px solid #c9a84c">
<h2 style="color:#e8c97a">🎁 Votre formation est prête !</h2>
<p>Bonjour ${nom || ''},</p>
<p>Voici votre formation gratuite :</p>
<h3 style="color:#f0ece0">${formation_emoji || ''} ${formation_titre}</h3>
<a href="${lien_acces}" style="display:inline-block;background:#2ecc71;color:#000;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:20px 0">Accéder à ma formation</a>
</div></body></html>`;
}

function emailSansLien({ nom, email, formation_titre, formation_emoji }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body style="margin:0;padding:40px;background:#080808;font-family:sans-serif">
<div style="max-width:500px;margin:auto;background:#0f0f0f;padding:30px;border-radius:12px;border:1px solid #c9a84c">
<h2 style="color:#e8c97a">✅ Demande reçue</h2>
<p>Bonjour ${nom || ''},</p>
<p>Votre demande pour <strong>${formation_titre}</strong> a bien été reçue.</p>
<p>Notre équipe vous enverra le lien d'accès très bientôt.</p>
</div></body></html>`;
}
