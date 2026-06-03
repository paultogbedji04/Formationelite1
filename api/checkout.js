const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { formation_id, formation_titre, formation_prix, formation_emoji } = req.body;

    if (!formation_id || !formation_titre || !formation_prix) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // Convert price to cents (remove € and convert)
    const priceString = formation_prix.replace('€', '').replace(',', '.').trim();
    const priceInCents = Math.round(parseFloat(priceString) * 100);

    if (isNaN(priceInCents) || priceInCents <= 0) {
      return res.status(400).json({ error: 'Prix invalide' });
    }

    const siteUrl = process.env.SITE_URL || 'https://formationelite.vercel.app';

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${formation_emoji || '📚'} ${formation_titre}`,
              description: `Formation complète — Accès immédiat et à vie`,
              metadata: {
                formation_id: formation_id,
              },
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&formation_id=${formation_id}`,
      cancel_url: `${siteUrl}/formation.html?id=${formation_id}&cancelled=true`,
      customer_email: undefined,
      collect_shipping_address: false,
      metadata: {
        formation_id: formation_id,
        formation_titre: formation_titre,
      },
      payment_intent_data: {
        metadata: {
          formation_id: formation_id,
          formation_titre: formation_titre,
        },
      },
      locale: 'fr',
    });

    return res.status(200).json({ 
      url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la création du paiement',
      details: error.message 
    });
  }
};
