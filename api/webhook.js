const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Supabase config
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
    // Verify webhook signature if secret is set
    if (webhookSecret && sig) {
      const rawBody = await getRawBody(req);
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle payment success
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const customerEmail = session.customer_details?.email;
    const formationId = session.metadata?.formation_id;
    const formationTitre = session.metadata?.formation_titre;
    const amountPaid = (session.amount_total / 100).toFixed(2) + '€';

    console.log(`✅ Paiement reçu: ${formationTitre} - ${amountPaid} - ${customerEmail}`);

    if (customerEmail && formationId) {
      try {
        // 1. Get formation details from Supabase
        const formationRes = await fetch(
          `${SUPABASE_URL}/rest/v1/formations?id=eq.${formationId}&select=*`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const formations = await formationRes.json();
        const formation = formations[0];

        // 2. Save order to Supabase
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
            livraison_statut: 'en_attente'
          })
        });

        // 3. Send confirmation email via Resend
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'FormationElite <contact@formationelite.fr>',
            to: [customerEmail],
            subject: `✅ Votre commande est confirmée — ${formationTitre}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#080808;color:#f0ece0;margin:0;padding:0">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    
    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px">
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:600;color:#e8c97a;letter-spacing:1px">
        FormationElite.fr
      </div>
      <div style="height:1px;background:rgba(201,168,76,0.3);margin:16px 0"></div>
    </div>

    <!-- Success icon -->
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:rgba(46,204,113,0.15);border:2px solid #2ecc71;line-height:64px;font-size:28px">✅</div>
    </div>

    <!-- Title -->
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:300;text-align:center;margin-bottom:8px;color:#f0ece0">
      Paiement confirmé !
    </h1>
    <p style="text-align:center;color:#888;font-size:15px;margin-bottom:40px">
      Merci pour votre achat. Votre accès est en cours de préparation.
    </p>

    <!-- Order details -->
    <div style="background:#0f0f0f;border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:24px;margin-bottom:32px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;margin-bottom:16px">
        Détails de la commande
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="color:#888;font-size:14px">Formation</span>
        <span style="color:#f0ece0;font-size:14px;font-weight:600">${formationTitre}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="color:#888;font-size:14px">Montant payé</span>
        <span style="color:#e8c97a;font-size:16px;font-weight:600">${amountPaid}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0">
        <span style="color:#888;font-size:14px">Statut</span>
        <span style="color:#2ecc71;font-size:14px;font-weight:600">✓ Payé</span>
      </div>
    </div>

    <!-- Delivery info -->
    <div style="background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:20px;margin-bottom:32px">
      <div style="font-size:14px;color:#e8c97a;font-weight:600;margin-bottom:8px">⚡ Livraison de votre accès</div>
      <p style="font-size:13px;color:#888;line-height:1.7;margin:0">
        Votre accès complet à la formation vous sera envoyé dans un délai maximum de <strong style="color:#f0ece0">24 heures</strong>. 
        La plupart des livraisons sont effectuées dans les <strong style="color:#f0ece0">2 heures</strong> suivant votre paiement.
      </p>
    </div>

    <!-- Contact -->
    <div style="text-align:center;margin-bottom:32px">
      <p style="font-size:14px;color:#888;margin-bottom:16px">
        Pour suivre votre commande ou en cas de question :
      </p>
      <a href="https://t.me/CreativeagencyFr" style="display:inline-block;background:#229ED9;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:14px">
        📲 Nous contacter sur Telegram
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;text-align:center">
      <p style="font-size:12px;color:#444;line-height:1.6">
        FormationElite.fr — Les meilleures formations à prix imbattables<br>
        Cet email confirme votre achat. Conservez-le comme preuve de paiement.
      </p>
    </div>

  </div>
</body>
</html>
            `
          })
        });

        console.log(`📧 Email envoyé à ${customerEmail}`);

      } catch (err) {
        console.error('Error processing payment:', err);
      }
    }
  }

  return res.status(200).json({ received: true });
};

// Helper to get raw body for Stripe signature verification
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(Buffer.from(data)));
    req.on('error', reject);
  });
}
