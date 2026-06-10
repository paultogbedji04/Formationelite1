// api/crypto-checkout.js
// Crée un paiement NowPayments et retourne l'URL de paiement

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { formation_id, formation_titre, amount, currency = 'EUR' } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  const NOWPAYMENTS_API_KEY = process.env.NOWPEMENT_API_KEY;
  if (!NOWPAYMENTS_API_KEY) {
    return res.status(500).json({ error: 'Clé NowPayments non configurée' });
  }

  try {
    // 0. Vérifier que la clé API NowPayments fonctionne
    const statusCheck = await fetch('https://api.nowpayments.io/v1/status', {
      headers: { 'x-api-key': NOWPAYMENTS_API_KEY }
    });
    if (!statusCheck.ok) {
      return res.status(500).json({ error: 'Clé NowPayments invalide ou service indisponible' });
    }

    // 1. Créer le paiement NowPayments
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount:    amount,
        price_currency:  currency.toLowerCase(), // 'eur'
        pay_currency:    'btc',                  // crypto par défaut (client peut changer sur la page NowPayments)
        order_id:        formation_id || `order_${Date.now()}`,
        order_description: formation_titre || 'Formation FormationElite',
        success_url:     `${process.env.SITE_URL || 'https://formationelite.store'}/success.html?method=crypto&titre=${encodeURIComponent(formation_titre || '')}`,
        cancel_url:      `${process.env.SITE_URL || 'https://formationelite.store'}/checkout.html`,
        is_fixed_rate:   false,
        is_fee_paid_by_user: false
      })
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch(e) {
      console.error('NowPayments non-JSON response:', responseText.slice(0, 200));
      return res.status(500).json({ error: 'Réponse NowPayments invalide : ' + responseText.slice(0, 100) });
    }

    if (!response.ok) {
      console.error('NowPayments error:', data);
      return res.status(500).json({
        error: data.message || 'Erreur NowPayments',
        details: data
      });
    }

    // NowPayments retourne invoice_url pour la page de paiement
    const payment_url = data.invoice_url || data.payment_url;

    if (!payment_url) {
      return res.status(500).json({
        error: 'URL de paiement introuvable dans la réponse NowPayments',
        data
      });
    }

    // 2. Enregistrer la commande en attente dans Supabase
    const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

    await fetch(`${SUPABASE_URL}/rest/v1/commandes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        formation_id:     formation_id || null,
        formation_titre:  formation_titre || 'Formation',
        montant:          `${amount}€`,
        statut:           'crypto_en_attente',
        livraison_statut: 'en_attente'
      })
    });

    return res.status(200).json({ payment_url });

  } catch (err) {
    console.error('crypto-checkout error:', err);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
