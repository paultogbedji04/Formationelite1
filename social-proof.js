// social-proof.js - Notification flottante des achats recents (preuve sociale)
(function() {
  const TEMPS_ECOULE = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h}h`;
    const j = Math.floor(h / 24);
    return `il y a ${j}j`;
  };

  function injectStyles() {
    if (document.getElementById('socialProofStyles')) return;
    const style = document.createElement('style');
    style.id = 'socialProofStyles';
    style.textContent = `
      #socialProofToast{position:fixed;bottom:24px;left:24px;z-index:400;background:#0f0f0f;border:1px solid rgba(201,168,76,0.25);border-radius:10px;padding:14px 18px;max-width:300px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 30px rgba(0,0,0,0.5);opacity:0;transform:translateY(20px);transition:opacity .4s ease,transform .4s ease;pointer-events:none}
      #socialProofToast.show{opacity:1;transform:translateY(0)}
      #socialProofToast .sp-icon{font-size:22px;flex-shrink:0}
      #socialProofToast .sp-text{font-size:12.5px;color:#ccc;line-height:1.5}
      #socialProofToast .sp-text strong{color:#e8c97a;font-weight:600}
      #socialProofToast .sp-time{font-size:10.5px;color:#555;margin-top:2px}
      @media(max-width:600px){#socialProofToast{left:12px;right:12px;bottom:16px;max-width:none}}
    `;
    document.head.appendChild(style);
  }

  function buildToast() {
    if (document.getElementById('socialProofToast')) return;
    const el = document.createElement('div');
    el.id = 'socialProofToast';
    el.innerHTML = `<span class="sp-icon">🎉</span><div><div class="sp-text"></div><div class="sp-time"></div></div>`;
    document.body.appendChild(el);
  }

  async function fetchAchats() {
    try {
      const res = await fetch('/api/sitemap?type=social');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function showToast(achat) {
    const el = document.getElementById('socialProofToast');
    if (!el) return;
    el.querySelector('.sp-text').innerHTML = `Un client vient d'acheter <strong>${achat.formation_titre}</strong>`;
    el.querySelector('.sp-time').textContent = TEMPS_ECOULE(achat.created_at);
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  async function initSocialProof() {
    injectStyles();
    buildToast();
    const achats = await fetchAchats();
    if (achats.length === 0) return;

    let index = 0;
    setTimeout(() => showToast(achats[index]), 3000);
    setInterval(() => {
      index = (index + 1) % achats.length;
      showToast(achats[index]);
    }, 18000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSocialProof);
  } else {
    initSocialProof();
  }
})();
