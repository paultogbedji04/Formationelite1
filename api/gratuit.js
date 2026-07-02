const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nom, email, formation_id, formation_titre, formation_emoji, lien_acces } = req.body;

  if (!email || !formation_titre) {
    return res.status(400).json({ error: 'Email et formation requis' });
  }

  try {
    // 1. Enregistrer dans Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/commandes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email,
        nom: nom || null,
        formation_id: formation_id || null,
        formation_titre,
        montant: '0€',
        statut: 'gratuit',
        livraison_statut: lien_acces ? 'livre' : 'en_attente',
        lien_acces: lien_acces || null
      })
    });

    // 2. Envoyer l'email
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
        from: 'FormationElite <no-reply@formationelite.fr>',   // ← Change ici
        to: [email],
        subject: lien_acces ? `🎁 Votre formation gratuite — ${formation_titre}` : `✅ Demande reçue — ${formation_titre}`,
        html: html
      })
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend Error:', resendData);
      return res.status(500).json({ error: 'Erreur envoi email' });
    }

    console.log('Email gratuit envoyé avec succès à', email);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Erreur gratuit.js:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Les deux fonctions email (emailAvecLien et emailSansLien) restent identiques à ce que tu as
// (je ne les recopie pas pour gagner de la place)
