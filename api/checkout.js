const Stripe = require('stripe');

module.exports = async (req, res) => {
  console.log("🚀 API CHECKOUT appelée");

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    console.log("Body reçu:", req.body);
    console.log("STRIPE_SECRET_KEY présente ?", !!process.env.STRIPE_SECRET_KEY);

    const { formation_id, formation_titre, formation_prix } = req.body;

    if (!formation_id || !formation_titre || !formation_prix) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configurée sur Vercel' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const priceString = formation_prix.toString().replace('€', '').replace(',', '.').trim();
    const priceInCents = Math.round(parseFloat(priceString) * 100);

    console.log("Prix converti:", priceInCents, "cents");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { 
            name: formation_titre 
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `https://formationelite1-fmfj.vercel.app/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://formationelite1-fmfj.vercel.app/formations.html`,
    });

    console.log("Session Stripe créée avec succès");
    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("❌ ERREUR STRIPE:", error.message);
    console.error("Stack:", error.stack);
    return res.status(500).json({ 
      error: 'Erreur interne Stripe',
      message: error.message 
    });
  }
};