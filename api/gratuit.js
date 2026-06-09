const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nom, email, formation_id, formation_titre, formation_emoji, lien_acces } = req.body;

  // Validation basique
  if (!email || !formation_titre) {
    return res.status(400).json({ error: 'Email et formation requis' });
  }

  try {
    // 1. Enregistrer la demande dans Supabase (table commandes)
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
        formation_id: formation_id || null,
        formation_titre,
        montant: '0€',
        statut: 'gratuit',
        livraison_statut: lien_acces ? 'livre' : 'en_attente',
        lien_acces: lien_acces || null
      })
    });

    // 2. Envoyer email via Resend
    const emailHtml = lien_acces
      ? emailAvecLien({ nom, email, formation_titre, formation_emoji, lien_acces })
      : emailSansLien({ nom, email, formation_titre, formation_emoji });

    const sujet = lien_acces
      ? `🎁 Votre formation gratuite — ${formation_titre}`
      : `✅ Demande reçue — ${formation_titre}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'FormationElite <contact@formationelite.fr>',
        to: [email],
        subject: sujet,
        html: emailHtml
      })
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Erreur gratuit.js:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Email quand un lien d'accès est déjà configuré sur la formation
function emailAvecLien({ nom, email, formation_titre, formation_emoji, lien_acces }) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080808;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:36px">
      <div style="font-family:Georgia,serif;font-size:26px;color:#e8c97a;letter-spacing:1px">FormationElite.fr</div>
      <div style="font-size:11px;color:#555;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Formation Gratuite</div>
    </div>

    <!-- Card principale -->
    <div style="background:#0f0f0f;border:1px solid rgba(201,168,76,0.2);border-radius:12px;overflow:hidden;margin-bottom:24px">
      
      <!-- Banner verte -->
      <div style="background:linear-gradient(135deg,#0a1a0f,#0f2a18);padding:28px;text-align:center;border-bottom:1px solid rgba(46,204,113,0.2)">
        <div style="font-size:48px;margin-bottom:12px">${formation_emoji || '🎁'}</div>
        <div style="font-size:13px;color:#2ecc71;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Formation gratuite débloquée</div>
        <div style="font-family:Georgia,serif;font-size:22px;color:#f0ece0;line-height:1.3">${formation_titre}</div>
      </div>

      <div style="padding:32px">
        <p style="font-size:15px;color:#888;line-height:1.7;margin:0 0 24px">
          Bonjour${nom ? ' <strong style="color:#f0ece0">' + nom + '</strong>' : ''} 👋<br><br>
          Votre formation gratuite est prête ! Cliquez sur le bouton ci-dessous pour y accéder immédiatement.
        </p>

        <!-- CTA -->
        <div style="text-align:center;margin:28px 0">
          <a href="${lien_acces}" style="display:inline-block;background:#2ecc71;color:#080808;text-decoration:none;padding:16px 40px;border-radius:4px;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase">
            🎁 Accéder à ma formation
          </a>
        </div>

        <p style="font-size:12px;color:#444;text-align:center;margin:0">
          Lien direct : <a href="${lien_acces}" style="color:#c9a84c">${lien_acces}</a>
        </p>
      </div>
    </div>

    <!-- Info Telegram -->
    <div style="background:#0a1218;border:1px solid rgba(34,158,217,0.2);border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
      <div style="font-size:13px;color:#888;margin-bottom:10px">Rejoignez notre canal pour plus de formations gratuites</div>
      <a href="https://t.me/formation05" style="display:inline-flex;align-items:center;gap:8px;background:#229ED9;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:13px">
        📲 Canal Telegram FormationElite
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#333;line-height:1.7">
      <div>© 2026 FormationElite.fr — Tous droits réservés</div>
      <div style="margin-top:4px">Vous recevez cet email car vous avez demandé une formation gratuite sur notre site.</div>
    </div>
  </div>
</body>
</html>`;
}

// Email quand pas de lien configuré → l'admin livrera manuellement
function emailSansLien({ nom, email, formation_titre, formation_emoji }) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080808;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">

    <div style="text-align:center;margin-bottom:36px">
      <div style="font-family:Georgia,serif;font-size:26px;color:#e8c97a;letter-spacing:1px">FormationElite.fr</div>
      <div style="font-size:11px;color:#555;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Demande reçue</div>
    </div>

    <div style="background:#0f0f0f;border:1px solid rgba(201,168,76,0.2);border-radius:12px;overflow:hidden;margin-bottom:24px">
      <div style="background:linear-gradient(135deg,#0a1a0f,#0f2a18);padding:28px;text-align:center;border-bottom:1px solid rgba(46,204,113,0.2)">
        <div style="font-size:48px;margin-bottom:12px">${formation_emoji || '🎁'}</div>
        <div style="font-size:13px;color:#2ecc71;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Demande confirmée ✅</div>
        <div style="font-family:Georgia,serif;font-size:22px;color:#f0ece0;line-height:1.3">${formation_titre}</div>
      </div>

      <div style="padding:32px">
        <p style="font-size:15px;color:#888;line-height:1.7;margin:0 0 20px">
          Bonjour${nom ? ' <strong style="color:#f0ece0">' + nom + '</strong>' : ''} 👋<br><br>
          Votre demande a bien été reçue ! Notre équipe va vous envoyer le lien d'accès à votre formation <strong style="color:#f0ece0">${formation_titre}</strong> dans les <strong style="color:#e8c97a">prochaines heures</strong>.
        </p>

        <div style="background:#151515;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:0 0 24px">
          <div style="font-size:11px;color:#555;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Votre demande</div>
          <div style="font-size:14px;color:#f0ece0;font-weight:600">${formation_titre}</div>
          <div style="font-size:12px;color:#2ecc71;margin-top:4px">Gratuite — 0€</div>
        </div>

        <p style="font-size:13px;color:#555;margin:0">
          En attendant, rejoignez notre canal Telegram pour être notifié dès que votre accès est envoyé.
        </p>
      </div>
    </div>

    <div style="background:#0a1218;border:1px solid rgba(34,158,217,0.2);border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
      <div style="font-size:13px;color:#888;margin-bottom:10px">Rejoignez notre canal Telegram</div>
      <a href="https://t.me/formation05" style="display:inline-flex;align-items:center;gap:8px;background:#229ED9;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:13px">
        📲 Canal Telegram FormationElite
      </a>
    </div>

    <div style="text-align:center;font-size:11px;color:#333;line-height:1.7">
      <div>© 2026 FormationElite.fr — Tous droits réservés</div>
    </div>
  </div>
</body>
</html>`;
}
