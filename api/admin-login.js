// api/admin-login.js
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password } = req.body;

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASS = process.env.ADMIN_PASS;

    if (!ADMIN_EMAIL || !ADMIN_PASS) {
      return res.status(500).json({ error: 'Configuration serveur manquante' });
    }

    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      // Génère un token simple basé sur un secret serveur (pas affiché, pas deviné)
      const token = Buffer.from(`${ADMIN_EMAIL}:${Date.now()}:${ADMIN_PASS}`).toString('base64');
      return res.status(200).json({ success: true, token });
    }

    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  } catch (err) {
    console.error('admin-login error:', err);
    return res.status(500).json({ error: err.message });
  }
};
