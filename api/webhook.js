const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret && sig) {
      const rawBody = await getRawBody(req);
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      const rawBody = await getRawBody(req);
      event = rawBody.length ? JSON.parse(rawBody.toString()) : null;
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (!event || !event.type) {
    console.error('Webhook: événement vide ou invalide');
    return res.status(400).json({ error: 'Invalid event' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;
    const formationId = session.metadata?.formation_id;
    const formationTitre = session.metadata?.formation_titre || 'Formation';
    const amountPaid = (session.amount_total / 100).toFixed(2) + '€';

    console.log(`✅ Paiement reçu : ${formationTitre} - ${amountPaid} - ${customerEmail}`);

    if (customerEmail && formationId) {
      try {
        // ✅ NOUVEAU — Récupérer lien_acces depuis Supabase
        let lienAcces = null;
        const supaRes = await fetch(
          `${SUPABASE_URL}/rest/v1/formations?id=eq.${formationId}&select=lien_acces`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        const supaData = await supaRes.json();
        if (supaData && supaData.length > 0) {
          lienAcces = supaData[0].lien_acces;
        }
        console.log(`🔗 Lien accès récupéré : ${lienAcces}`);

        // Sauvegarde commande
        await fetch(`${SUPABASE_URL}/rest/v1/commandes`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            email: customerEmail,
            formation_id: formationId,
            formation_titre: formationTitre,
            montant: amountPaid,
            stripe_session_id: session.id,
            statut: 'payé',
            livraison_statut: lienAcces ? 'livré' : 'en_attente'
          })
        });

        // ✅ NOUVEAU — Email avec lien_acces
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'FormationElite <contact@formationelite.vip>',
            to: [customerEmail],
            subject: `✅ Votre accès — ${formationTitre}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #c9a84c;border-radius:12px;overflow:hidden;">
    
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a);padding:40px 30px;text-align:center;border-bottom:2px solid #c9a84c;">
      <h1 style="color:#c9a84c;font-size:28px;margin:0;letter-spacing:2px;">FORMATION<span style="color:#fff">ELITE</span></h1>
      <p style="color:#888;margin:8px 0 0;font-size:13px;">Votre accès exclusif vous attend</p>
    </div>

    <!-- BODY -->
    <div style="padding:40px 30px;">
      <h2 style="color:#fff;font-size:20px;margin:0 0 16px;">✅ Paiement confirmé !</h2>
      <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Merci pour votre achat. Votre formation <strong style="color:#c9a84c;">${formationTitre}</strong> 
        est prête. Montant payé : <strong style="color:#fff;">${amountPaid}</strong>
      </p>

      ${lienAcces ? `
      <!-- BOUTON ACCES -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${lienAcces}" 
           style="background:linear-gradient(135deg,#c9a84c,#f0d080);color:#000;font-weight:bold;
                  font-size:16px;padding:16px 40px;border-radius:8px;text-decoration:none;
                  display:inline-block;letter-spacing:1px;">
          🎓 ACCÉDER À MA FORMATION
        </a>
      </div>
      <p style="color:#888;font-size:12px;text-align:center;">
        Conservez cet email — ce lien est votre accès permanent
      </p>
      ` : `
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;text-align:center;">
        <p style="color:#c9a84c;margin:0;font-size:14px;">
          ⏳ Votre lien d'accès sera envoyé dans les prochaines minutes.<br>
          Contactez-nous si vous ne le recevez pas : <a href="https://t.me/CreativeagencyFr" style="color:#c9a84c;">@CreativeagencyFr</a>
        </p>
      </div>
      `}
    </div>

    <!-- FOOTER -->
    <div style="background:#0a0a0a;padding:24px 30px;border-top:1px solid #222;text-align:center;">
      <p style="color:#555;font-size:12px;margin:0;">
        Support : <a href="https://t.me/CreativeagencyFr" style="color:#c9a84c;">@CreativeagencyFr</a> 
        &nbsp;|&nbsp; Communauté : <a href="https://t.me/formation05" style="color:#c9a84c;">@formation05</a>
      </p>
      <p style="color:#333;font-size:11px;margin:8px 0 0;">© 2025 FormationElite — Tous droits réservés</p>
    </div>

  </div>
</body>
</html>`
          })
        });

        console.log(`📧 Email envoyé à ${customerEmail} avec lien : ${lienAcces}`);

      } catch (err) {
        console.error('Error processing payment:', err);
      }
    }
  }

  return res.status(200).json({ received: true });
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(Buffer.from(data)));
    req.on('error', reject);
  });
}

module.exports.config = {
  api: {
    bodyParser: false
  }
};
