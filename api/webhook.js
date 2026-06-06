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
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // === PAIEMENT RÉUSSI ===
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;
    const formationId = session.metadata?.formation_id;
    const formationTitre = session.metadata?.formation_titre || 'Formation';
    const amountPaid = (session.amount_total / 100).toFixed(2) + '€';

    console.log(`✅ Paiement reçu : ${formationTitre} - ${amountPaid} - ${customerEmail}`);

    if (customerEmail && formationId) {
      try {
        // Sauvegarde de la commande
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

        // Envoi email de confirmation
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
            html: `...` // (ton email HTML reste le même)
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

// Helper pour récupérer le body brut (important pour Stripe)
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(Buffer.from(data)));
    req.on('error', reject);
  });
}