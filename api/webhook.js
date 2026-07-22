const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS = process.env.ADMIN_PASS;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  // ── Distinction Stripe vs Telegram ──
  if (!sig) {
    // Pas de signature Stripe -> tente Telegram
    let update;
    try {
      update = rawBody.length ? JSON.parse(rawBody.toString()) : null;
    } catch (e) {
      update = null;
    }
    if (update && update.callback_query) {
      return handleTelegramCallback(update, res);
    }
    // Ni Stripe ni Telegram reconnu
    return res.status(200).json({ ok: true });
  }

  // ── Logique Stripe (existante) ──
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
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
        let lienAcces = null;
        const supaRes = await fetch(
          `${SUPABASE_URL}/rest/v1/formations?id=eq.${formationId}&select=lien_acces`,
          { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        const supaData = await supaRes.json();
        if (supaData && supaData.length > 0) {
          lienAcces = supaData[0].lien_acces;
        }
        console.log(`🔗 Lien accès récupéré : ${lienAcces}`);

        await fetch(`${SUPABASE_URL}/rest/v1/commandes`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
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
    <div style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a);padding:40px 30px;text-align:center;border-bottom:2px solid #c9a84c;">
      <h1 style="color:#c9a84c;font-size:28px;margin:0;letter-spacing:2px;">FORMATION<span style="color:#fff">ELITE</span></h1>
      <p style="color:#888;margin:8px 0 0;font-size:13px;">Votre accès exclusif vous attend</p>
    </div>
    <div style="padding:40px 30px;">
      <h2 style="color:#fff;font-size:20px;margin:0 0 16px;">✅ Paiement confirmé !</h2>
      <p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Merci pour votre achat. Votre formation <strong style="color:#c9a84c;">${formationTitre}</strong> 
        est prête. Montant payé : <strong style="color:#fff;">${amountPaid}</strong>
      </p>
      ${lienAcces ? `
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
    <div style="background:#0a0a0a;padding:24px 30px;border-top:1px solid #222;text-align:center;">
      <p style="color:#555;font-size:12px;margin:0;">
        Support : <a href="https://t.me/CreativeagencyFr" style="color:#c9a84c;">@CreativeagencyFr</a> 
        &nbsp;|&nbsp; Communauté : <a href="https://t.me/formation05" style="color:#c9a84c;">@formation05</a>
      </p>
      <p style="color:#333;font-size:11px;margin:8px 0 0;">© 2026 FormationElite — Tous droits réservés</p>
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

// ── Logique Telegram (validation PayPal en un clic) ──
async function telegramCall(method, body) {
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function handleTelegramCallback(update, res) {
  try {
    const callback = update.callback_query;
    const fromId = String(callback.from.id);
    if (fromId !== String(TELEGRAM_CHAT_ID)) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '⛔ Non autorisé' });
      return res.status(200).json({ ok: true });
    }

    const data = callback.data || '';
    if (!data.startsWith('validate:')) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id });
      return res.status(200).json({ ok: true });
    }

    const commandeId = data.replace('validate:', '');

    const cmdRes = await fetch(`${SUPABASE_URL}/rest/v1/commandes?id=eq.${commandeId}&select=*`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const cmdData = await cmdRes.json();
    const commande = Array.isArray(cmdData) ? cmdData[0] : null;

    if (!commande) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '❌ Commande introuvable', show_alert: true });
      return res.status(200).json({ ok: true });
    }

    if (commande.livraison_statut === 'livre' || commande.livraison_statut === 'livré') {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: 'ℹ️ Déjà validé précédemment', show_alert: true });
      return res.status(200).json({ ok: true });
    }

    if (!commande.formation_id || commande.formation_id.includes(',')) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '⚠️ Commande multi-formations, valide depuis le panel admin', show_alert: true });
      return res.status(200).json({ ok: true });
    }

    const formRes = await fetch(`${SUPABASE_URL}/rest/v1/formations?id=eq.${commande.formation_id}&select=lien_acces`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const formData = await formRes.json();
    const lienAcces = formData?.[0]?.lien_acces;

    if (!lienAcces) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: "⚠️ Aucun lien d'accès configuré, valide manuellement", show_alert: true });
      return res.status(200).json({ ok: true });
    }

    const adminToken = Buffer.from(`${ADMIN_EMAIL}:${Date.now()}:${ADMIN_PASS}`).toString('base64');

    const patchRes = await fetch(`https://www.formationelite.vip/api/commandes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: commandeId, statut: 'payé', livraison_statut: 'livré', lien_acces: lienAcces })
    });

    if (!patchRes.ok) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '❌ Erreur lors de la validation', show_alert: true });
      return res.status(200).json({ ok: true });
    }

    // Envoie l'email de livraison (meme etape que le panel admin)
    await fetch(`https://www.formationelite.vip/api/paypal-livraison`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commandeId, email: commande.email, titre: commande.formation_titre, lien_acces: lienAcces })
    });

    await telegramCall('editMessageText', {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      text: `${callback.message.text}\n\n✅ VALIDÉ — accès envoyé à ${commande.email}`,
      parse_mode: 'Markdown'
    });

    await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '✅ Accès envoyé au client !' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('telegram callback error:', err);
    return res.status(200).json({ ok: true });
  }
}

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
