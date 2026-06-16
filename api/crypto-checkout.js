// api/crypto-checkout.js
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { formation_id, formation_titre, prix, email, currency = 'EUR' } = req.body;

  // ✅ UUID Élite Pass — remplace 'elite-pass' par le vrai UUID
  const ELITE_PASS_UUID = '43666279-e0c9-46fb-a2b0-81d14a3b0953';
  const realFormationId = formation_id === 'elite-pass' ? ELITE_PASS_UUID : formation_id;

  const amount = prix || req.body.amount;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  const NOWPAYMENTS_API_KEY = process.env.NOWPEMENT_API_KEY;
  if (!NOWPAYMENTS_API_KEY) {
    return res.status(500).json({ error: 'Clé NowPayments non configurée' });
  }

  const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGpmbXJzcnh5ZXBkc3lzZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzY0NTcsImV4cCI6MjA5NTA1MjQ1N30.lmYKrJ_q4F_wWY0eKYR-vrQVgSrbXCNG7XhxPj7J_4E';

  try {
    // 1. Vérifier statut NowPayments
    const statusCheck = await fetch('https://api.nowpayments.io/v1/status', {
      headers: { 'x-api-key': NOWPAYMENTS_API_KEY }
    });
    if (!statusCheck.ok) {
      return res.status(500).json({ error: 'Clé NowPayments invalide ou service indisponible' });
    }

    // ✅ order_description contient email + titre pour le webhook
    const orderDescription = `titre:${formation_titre || 'Formation'}|email:${email || 'inconnu'}`;

    // 2. Créer invoice NowPayments
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: currency.toLowerCase(),
        order_id: `${realFormationId}_${Date.now()}`,
        order_description: orderDescription,
        success_url: `https://www.formationelite.vip/success.html?method=crypto&titre=${encodeURIComponent(formation_titre || '')}`,
        cancel_url: `https://www.formationelite.vip/checkout.html`,
        is_fixed_rate: false,
        is_fee_paid_by_user: false
      })
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch(e) {
      return res.status(500).json({ error: 'Réponse NowPayments invalide' });
    }

    if (!response.ok) {
      return res.status(500).json({ error: data.message || 'Erreur NowPayments', details: data });
    }

    const invoice_url = data.invoice_url || data.payment_url;
    if (!invoice_url) {
      return res.status(500).json({ error: 'URL de paiement introuvable', data });
    }

    // 3. Enregistrer commande en attente dans Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/commandes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: email || null,
        formation_id: realFormationId || null,
        formation_titre: formation_titre || 'Formation',
        montant: `${amount}€`,
        statut: 'crypto_en_attente',
        livraison_statut: 'en_attente'
      })
    });

    return res.status(200).json({ invoice_url });

  } catch (err) {
    console.error('crypto-checkout error:', err);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};