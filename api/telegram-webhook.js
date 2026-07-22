// api/telegram-webhook.js - Reçoit les clics sur le bouton "Valider" envoyé par Telegram
const SUPABASE_URL = 'https://xrljfmrsrxyepdsysfan.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function telegramCall(method, body) {
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const update = req.body;
    const callback = update.callback_query;
    if (!callback) return res.status(200).json({ ok: true });

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

    // Récupère la commande
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

    // Récupère le lien d'accès de la formation
    const formRes = await fetch(`${SUPABASE_URL}/rest/v1/formations?id=eq.${commande.formation_id}&select=lien_acces`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const formData = await formRes.json();
    const lienAcces = formData?.[0]?.lien_acces;

    if (!lienAcces) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '⚠️ Aucun lien d\\'accès configuré pour cette formation, valide manuellement', show_alert: true });
      return res.status(200).json({ ok: true });
    }

    // Génère un token admin et PATCH via l'API existante (réutilise la logique d'envoi d'email)
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASS = process.env.ADMIN_PASS;
    const adminToken = Buffer.from(`${ADMIN_EMAIL}:${Date.now()}:${ADMIN_PASS}`).toString('base64');

    const patchRes = await fetch(`https://www.formationelite.vip/api/commandes`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ id: commandeId, livraison_statut: 'livre', lien_acces: lienAcces })
    });

    if (!patchRes.ok) {
      await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '❌ Erreur lors de la validation, réessaie ou passe par le panel admin', show_alert: true });
      return res.status(200).json({ ok: true });
    }

    // Edite le message original pour montrer que c'est fait
    await telegramCall('editMessageText', {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      text: `${callback.message.text}\\n\\n✅ *VALIDÉ — accès envoyé à ${commande.email}*`,
      parse_mode: 'Markdown'
    });

    await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: '✅ Accès envoyé au client !' });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('telegram-webhook error:', err);
    return res.status(200).json({ ok: true });
  }
};
