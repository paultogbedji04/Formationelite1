const Stripe = require('stripe');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
      // ✅ Metadata ajoutées — webhook.js peut récupérer formation_id
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