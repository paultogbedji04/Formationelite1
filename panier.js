/**
 * panier.js — Système de panier FormationElite
 * À inclure dans toutes les pages via <script src="panier.js"></script>
 */

// ── ÉTAT DU PANIER (localStorage) ──
const PANIER_KEY = 'fe_panier';

function getPanier() {
  try { return JSON.parse(localStorage.getItem(PANIER_KEY)) || []; }
  catch(e) { return []; }
}

function savePanier(items) {
  localStorage.setItem(PANIER_KEY, JSON.stringify(items));
  updatePanierBadge();
  if (document.getElementById('panierDrawer')) renderPanierDrawer();
}

function ajouterAuPanier(formation) {
  const panier = getPanier();
  const existe = panier.find(f => f.id === formation.id);
  if (existe) {
    showPanierToast('📚 Déjà dans votre panier !', 'info');
    ouvrirPanier();
    return;
  }
  panier.push({
    id:          formation.id,
    titre:       formation.titre,
    prix:        formation.prix,
    prixNum:     parseFloat((formation.prix || '0').replace('€','').replace(',','.').trim()) || 0,
    emoji:       formation.emoji || '📚',
    auteur:      formation.auteur || '',
    categorie:   formation.categorie || ''
  });
  savePanier(panier);
  showPanierToast(`🛒 "${formation.titre.slice(0,30)}..." ajouté !`, 'success');
  updatePanierBadge();
}

function retirerDuPanier(id) {
  const panier = getPanier().filter(f => f.id !== id);
  savePanier(panier);
}

function viderPanier() {
  savePanier([]);
}

function getTotalPanier() {
  return getPanier().reduce((sum, f) => sum + (f.prixNum || 0), 0);
}

// ── BADGE COMPTEUR ──
function updatePanierBadge() {
  const count = getPanier().length;
  document.querySelectorAll('.panier-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
  document.querySelectorAll('.panier-nav-btn').forEach(el => {
    el.classList.toggle('has-items', count > 0);
  });
}

// ── TOAST NOTIFICATION ──
function showPanierToast(msg, type = 'success') {
  let toast = document.getElementById('panierToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'panierToast';
    toast.style.cssText = `
      position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);
      background:#0f0f0f;border:1px solid rgba(201,168,76,0.3);border-radius:100px;
      padding:12px 22px;font-family:'DM Sans',sans-serif;font-size:13px;color:#f0ece0;
      z-index:500;opacity:0;transition:all .3s ease;white-space:nowrap;
      box-shadow:0 8px 32px rgba(0,0,0,0.6);pointer-events:none
    `;
    document.body.appendChild(toast);
  }
  if (type === 'info') toast.style.borderColor = 'rgba(41,182,246,0.4)';
  else toast.style.borderColor = 'rgba(46,204,113,0.4)';
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2800);
}

// ── DRAWER PANIER ──
function injectPanierDrawer() {
  if (document.getElementById('panierDrawer')) return;

  const drawer = document.createElement('div');
  drawer.id = 'panierDrawer';
  drawer.style.cssText = `
    position:fixed;inset:0;z-index:300;display:none;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(6px)
  `;
  drawer.innerHTML = `
    <div id="panierPanel" style="
      position:absolute;top:0;right:0;bottom:0;width:100%;max-width:420px;
      background:#0f0f0f;border-left:1px solid rgba(201,168,76,0.2);
      display:flex;flex-direction:column;transform:translateX(100%);
      transition:transform .35s cubic-bezier(.4,0,.2,1);overflow:hidden
    ">
      <!-- Header -->
      <div style="padding:20px 24px;border-bottom:1px solid rgba(201,168,76,0.12);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#f0ece0">Mon Panier</div>
          <div style="font-size:12px;color:#555;margin-top:2px" id="panierCount">0 formation</div>
        </div>
        <button onclick="fermerPanier()" style="background:none;border:1px solid #1a1a1a;color:#666;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s" onmouseover="this.style.borderColor='#e74c3c';this.style.color='#e74c3c'" onmouseout="this.style.borderColor='#1a1a1a';this.style.color='#666'">✕</button>
      </div>

      <!-- Items -->
      <div id="panierItems" style="flex:1;overflow-y:auto;padding:16px 20px"></div>

      <!-- Footer -->
      <div id="panierFooter" style="padding:20px 24px;border-top:1px solid rgba(201,168,76,0.12);flex-shrink:0"></div>
    </div>
  `;
  document.body.appendChild(drawer);

  // Fermer en cliquant sur l'overlay
  drawer.addEventListener('click', e => { if (e.target === drawer) fermerPanier(); });

  renderPanierDrawer();
}

function renderPanierDrawer() {
  const panier = getPanier();
  const total  = getTotalPanier();
  const count  = panier.length;

  // Count label
  const countEl = document.getElementById('panierCount');
  if (countEl) countEl.textContent = `${count} formation${count > 1 ? 's' : ''}`;

  // Items
  const itemsEl = document.getElementById('panierItems');
  if (itemsEl) {
    if (count === 0) {
      itemsEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#444">
          <div style="font-size:48px;margin-bottom:16px">🛒</div>
          <div style="font-size:15px;margin-bottom:8px;color:#666">Votre panier est vide</div>
          <div style="font-size:13px;color:#333">Ajoutez des formations pour commencer</div>
          <a href="formations.html" onclick="fermerPanier()" style="display:inline-block;margin-top:20px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:10px 24px;border-radius:4px;text-decoration:none;font-size:13px">Voir les formations →</a>
        </div>`;
    } else {
      itemsEl.innerHTML = panier.map(f => `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04)" id="item_${f.id}">
          <div style="font-size:28px;flex-shrink:0;width:40px;text-align:center">${f.emoji}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:#f0ece0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.titre}</div>
            <div style="font-size:11px;color:#555;margin-top:2px">${f.categorie}</div>
          </div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:18px;color:#e8c97a;flex-shrink:0">${f.prix}</div>
          <button onclick="retirerDuPanier('${f.id}')" style="background:none;border:none;color:#333;cursor:pointer;font-size:16px;padding:4px;flex-shrink:0;transition:color .2s;line-height:1" onmouseover="this.style.color='#e74c3c'" onmouseout="this.style.color='#333'">✕</button>
        </div>`).join('');
    }
  }

  // Footer
  const footerEl = document.getElementById('panierFooter');
  if (footerEl) {
    if (count === 0) {
      footerEl.innerHTML = '';
    } else {
      footerEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <span style="font-size:14px;color:#888">Total</span>
          <span style="font-family:'Cormorant Garamond',serif;font-size:28px;color:#e8c97a;font-weight:600">${total.toFixed(2)}€</span>
        </div>
        <button onclick="commanderPanier()" style="width:100%;background:#c9a84c;color:#080808;border:none;border-radius:6px;padding:15px;font-family:inherit;font-weight:700;font-size:15px;cursor:pointer;transition:all .3s;margin-bottom:10px;letter-spacing:.3px" onmouseover="this.style.background='#e8c97a'" onmouseout="this.style.background='#c9a84c'">
          🛒 Commander (${total.toFixed(2)}€)
        </button>
        <button onclick="viderPanier()" style="width:100%;background:none;border:1px solid #1a1a1a;color:#555;padding:11px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;transition:all .2s" onmouseover="this.style.borderColor='#e74c3c';this.style.color='#e74c3c'" onmouseout="this.style.borderColor='#1a1a1a';this.style.color='#555'">
          Vider le panier
        </button>`;
    }
  }
}

function ouvrirPanier() {
  const drawer = document.getElementById('panierDrawer');
  const panel  = document.getElementById('panierPanel');
  if (!drawer) return;
  drawer.style.display = 'block';
  requestAnimationFrame(() => {
    panel.style.transform = 'translateX(0)';
  });
  document.body.style.overflow = 'hidden';
}

function fermerPanier() {
  const drawer = document.getElementById('panierDrawer');
  const panel  = document.getElementById('panierPanel');
  if (!drawer) return;
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => {
    drawer.style.display = 'none';
    document.body.style.overflow = '';
  }, 350);
}

function commanderPanier() {
  const panier = getPanier();
  if (panier.length === 0) return;
  const total = getTotalPanier();

  if (panier.length === 1) {
    // Une seule formation — checkout normal
    const f = panier[0];
    fermerPanier();
    window.location.href = `checkout.html?id=${f.id}&titre=${encodeURIComponent(f.titre)}&prix=${encodeURIComponent(f.prix)}&emoji=${encodeURIComponent(f.emoji)}`;
  } else {
    // Multi-formations — checkout panier
    const titres = panier.map(f => f.titre).join(' + ');
    const ids    = panier.map(f => f.id).join(',');
    const emojis = panier.map(f => f.emoji).join(',');
    fermerPanier();
    window.location.href = `checkout.html?mode=panier&ids=${encodeURIComponent(ids)}&titre=${encodeURIComponent(titres.slice(0,80))}&prix=${encodeURIComponent(total.toFixed(2)+'€')}&emoji=🛒&count=${panier.length}`;
  }
}

// ── INIT (appelé au chargement) ──
function initPanier() {
  injectPanierDrawer();
  updatePanierBadge();
}

// Auto-init quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPanier);
} else {
  initPanier();
}
