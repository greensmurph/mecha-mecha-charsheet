// script.js — Refactored Mega Mecha Overdrive: Golden
// version: 2.3 — Added Manual-Evolve toggle & per-stat adjust buttons
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import {
  getFirestore, collection,
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app-check.js';

(()=>{
  // ----- Firebase Setup ----- //
  const firebaseConfig = {
    apiKey: "AIzaSyDHOwOzz83Ua5ZNk7VaKbuv2ZI-XvhJl-c",
    authDomain: "mega-mecha-sheet.firebaseapp.com",
    projectId: "mega-mecha-sheet",
    storageBucket: "mega-mecha-sheet.firebasestorage.app",
    messagingSenderId: "1062382078139",
    appId: "1:1062382078139:web:82d439a151a053c282419e"
  };

  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  const RECAPTCHA_V3_SITE_KEY = '6LcphVgrAAAAAG0iwvqEgoyH7ba0lX-ztkf8iLQe';
  
  const app = initializeApp(firebaseConfig);

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });

  const auth = getAuth(app);
  const db = getFirestore(app);

  // ----- DOM References -----
  const dom = {
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    btnLogin: document.getElementById('btnLogin'),
    btnSignUp: document.getElementById('btnSignUp'),
    btnSignOut: document.getElementById('btnSignOut'),
    loginForm: document.querySelector('#login form'),

    // Character Info
    playerName: document.getElementById('playerName'),
    charName:   document.getElementById('charName'),
    rank:       document.getElementById('rank'),
    notes:      document.getElementById('notes'),

    aetherMinus: document.getElementById('aetherMinus'),
    aetherPlus:  document.getElementById('aetherPlus'),
    aetherCount: document.getElementById('aetherCounter'),
    aetherReset: document.getElementById('aetherReset'),
    meterUse:    document.getElementById('meterReset'),
    meterPlus:   document.getElementById('meterPlus'),
    meterCount:  document.getElementById('meterCounter'),
    meterProg:   document.getElementById('meterProgress'),

    bgSlider:    document.getElementById('backgroundCarousel'),
    mechSlider:  document.getElementById('mechCarousel'),
    bgInput:     document.getElementById('backgroundBonus'),
    mechInput:   document.getElementById('mechBonus'),
    lockBtn:     document.getElementById('lockBonuses'),
    resetBtn:    document.getElementById('resetButton'),
    statsPanel:  document.getElementById('stats'),

    manualToggle: document.getElementById('manualToggle'), // checkbox for manual mode
    lastRoll:      document.getElementById('lastRoll'),
    popupContainer: document.getElementById('popupContainer'),

    // HP references
    hpSection: document.getElementById('hpSection'),       // wrapper for HP
    hpContainer: document.getElementById('hpContainer'),   // container for 5 slots
    shieldToggle: document.getElementById('shieldToggle')  // checkbox to enable shield
  };

  // ----- State -----
  const stats = ['Focus','Instinct','Overdrive','Resonance','Style','Willpower'];
  const dieSizes = [4, 6, 8, 10, 12, 20];
  const statBaseIndex = Object.fromEntries(stats.map(s => [s, 0]));
  const statBusy      = Object.fromEntries(stats.map(s => [s, false]));
  const meterMax      = 5;
  let valueAether   = 0;
  let valueMonolog  = 0;
  let bonusesLocked = false;
  let manualMode    = false;
  let currentUser   = null;
  let syncTimeout   = null;

  //HP state: 5 core HP slots (tru=full), plus shield
  let hpSlots       = Array(5).fill(true);
  let shieldActive  = false;

  const statsTitle  = 'Lock in your background and mech';
  let bgCarousel, mechCarousel;

  // ----- Auth Functions -----
  function signInUser() {
    const email = dom.loginEmail.value.trim();
    const pass = dom.loginPassword.value.trim();

    if (!email || !pass) {
      showPopup('Please enter email and password', 'rollCrit');
      return;
    }

    signInWithEmailAndPassword(auth, email, pass)
      .then(res => showPopup(`Signed in as ${res.user.email}`, 'rollTotal'))
      .catch(err => showPopup(err.message, 'rollCrit'));
  }

  function signUpUser() {
    const email = dom.loginEmail.value.trim();
    const pass = dom.loginPassword.value.trim();

    if (!email || !pass) {
      showPopup('Please enter email and password', 'rollCrit');
      return;
    }

    createUserWithEmailAndPassword(auth, email, pass)
      .then(res => showPopup(`Account created: ${res.user.email}`, 'rollTotal'))
      .catch(err => showPopup(err.message, 'rollCrit'));
  }

  function signOutUser() {
    saveToFirestore();
    signOut(auth);
  }

  function handleAuthChange(user) {
    currentUser = user;
    if (user) {
      console.log('✅ Logged in as ', user.email);
      loadUserData();
      dom.btnSignOut.style.display = 'inline-block';
    } else {
      currentUser = null;
      dom.btnSignOut.style.display = 'none';
    }
  }

  function saveToFirestore() {
    if (!currentUser) return;
    const docRef = doc(db, 'characters', currentUser.uid);
    const data = gatherState();
    return setDoc(docRef, data)
      .then(() => console.log('📝 Sync to Firestore'))
      .catch(e => console.error('Save error: ', e));
  }

  function scheduleSync() {
    if (!currentUser) return;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(saveToFirestore, 10000); // 10s debounce
  }

  async function loadUserData() {
    const docRef = doc(db, 'characters', currentUser.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      localStorage.setItem('megaMechaState', JSON.stringify(snap.data()));
      loadFromLocalStorage();
      showPopup('✅ Loaded from cloud', 'rollTotal');
    } else {
      console.log('No cloud data found');
    }
  }

  // ----- Utility Functions -----
  const updateAether = () => {
    dom.aetherCount.textContent = valueAether;
    dom.aetherMinus.disabled = valueAether <= 0;
    dom.aetherPlus.disabled  = valueAether >= 200;
  };

  const updateMonolog = () => {
    dom.meterCount.textContent = valueMonolog;
    dom.meterProg.value        = valueMonolog;
    dom.meterUse.disabled      = valueMonolog < meterMax;
    dom.meterPlus.disabled     = valueMonolog >= meterMax;
  };

  const showPopup = (msg, type) => {
    const pu = document.createElement('div');
    pu.className = `rollPopup ${type}`;
    pu.textContent = msg;
    const ctr = dom.popupContainer;
    while (ctr.children.length >= 6) ctr.removeChild(ctr.firstChild);
    ctr.appendChild(pu);
    setTimeout(() => pu.style.opacity = 0, 4500);
    setTimeout(() => pu.remove(), 6000);
  };

  const getBonusCount = stat => {
    let cnt = 0;
    if (dom.bgInput.value === stat) cnt++;
    if (dom.mechInput.value === stat) cnt++;
    return cnt;
  };

  // ----- HP Rendering -----
  function renderHP() {
    if (!dom.hpContainer) return;
    dom.hpContainer.innerHTML = '';
    dom.hpSection.classList.toggle('shield-active', shieldActive);

    hpSlots.forEach((full, i) => {
      const slot = document.createElement('div');
      slot.className = `hp-slot ${full ? 'full' : 'empty'}`;
      slot.addEventListener('click', () => {
        // toggle damage/heal
        hpSlots[i] = !hpSlots[i];
        renderHP();
        saveToLocalStorage();
      });
      dom.hpContainer.appendChild(slot);
    });
  }

  // ----- Stats Rendering with Manual Controls -----
  function renderStats() {
    dom.statsPanel.innerHTML = '';
    stats.forEach(stat => {
      const base = statBaseIndex[stat];
      const bonus = getBonusCount(stat);
      const idx = Math.min(base + bonus, dieSizes.length - 1);
      const die = dieSizes[idx];

      // Wrapper to hold die + optional adjust buttons
      const wrapper = document.createElement('div');
      wrapper.className = 'stat-die-wrapper';

      // Die display
      const div = document.createElement('div');
      div.className = 'stat-die';
      div.dataset.stat = stat;
      div.dataset.dieIndex = idx;
      div.textContent = `${stat}: D${die}`;
      div.addEventListener('click', () => rollStat(stat));
      wrapper.appendChild(div);

      // Manual adjust buttons
      if (manualMode) {
        dom.statsPanel.closest('.aside-bar').classList.add('manual-mode');
        const dec = document.createElement('button');
        dec.textContent = '-';
        dec.className = 'stat-adjust stat-dec';
        dec.addEventListener('click', () => {
          if (statBaseIndex[stat] > 0) statBaseIndex[stat]--;
          renderStats();
          saveToLocalStorage();
        });
        const inc = document.createElement('button');
        inc.textContent = '+';
        inc.className = 'stat-adjust stat-inc';
        inc.addEventListener('click', () => {
          if (statBaseIndex[stat] < dieSizes.length - 1) statBaseIndex[stat]++;
          renderStats();
          saveToLocalStorage();
        });
        wrapper.appendChild(dec);
        wrapper.appendChild(inc);
      } else {
        dom.statsPanel.closest('.aside-bar').classList.remove('manual-mode');
      }

      dom.statsPanel.appendChild(wrapper);
    });
  }

  // ----- Dice Rolling (respect manualMode) -----
  async function rollStat(stat) {
    if (statBusy[stat]) return;
    statBusy[stat] = true;
    let total = 0;
    let base = statBaseIndex[stat];
    let idx = Math.min(base + getBonusCount(stat), dieSizes.length - 1);

    while (true) {
      const sides = dieSizes[idx];
      const r = Math.floor(Math.random() * sides) + 1;
      total += r;
      const crit = r === sides;
      showPopup(`${stat} rolls D${sides} → ${r}${crit?' (crit!)':''}`, 'rollResult');

      // If manual mode, stop auto-evolve/re-roll on crit
      if (manualMode || !crit) break;

      // Auto-evolution if not manual
      if (idx < dieSizes.length - 1) {
        statBaseIndex[stat] = ++base;
        idx = Math.min(base + getBonusCount(stat), dieSizes.length - 1);
        showPopup(`⚡${stat} evolves to D${dieSizes[idx]}!`, 'rollCrit');
        await new Promise(r=>setTimeout(r,600));
        continue;
      }
      // At max die, auto re-roll
      showPopup(`🔁 ${stat} ${r} - CRIT!`, 'rollCrit');
      await new Promise(r=>setTimeout(r,600));
    }

    renderStats();
    showPopup(`${stat} total = ${total}`, 'rollTotal');
    dom.lastRoll.innerHTML = `<p class="text-center">Last Roll: ${stat} = ${total}</p>`;
    dom.lastRoll.classList.add('show');
    statBusy[stat] = false;
  }

  // ----- Carousel Init -----
  function initCarousel({ sliderId, input }) {
    const carousel = document.getElementById(sliderId);
    const track    = carousel.querySelector('.carousel-track');
    const items    = track.querySelectorAll('.carousel-item');
    const prev     = carousel.querySelector('.carousel-nav.prev');
    const next     = carousel.querySelector('.carousel-nav.next');
    let idx = 0, startX=0, dragging=false;

    function show(i) {
      idx = Math.max(0, Math.min(i, items.length-1));
      track.style.transform = `translateX(${-idx*100}%)`;
      prev.disabled = idx===0;
      next.disabled = idx===items.length-1;
      input.value = items[idx].dataset.value;
      input.dispatchEvent(new Event('change'));
    }

    prev.addEventListener('click',() => show(idx-1));
    next.addEventListener('click',() => show(idx+1));
    carousel.addEventListener('touchstart',e=>{ if(e.touches.length===1){ startX=e.touches[0].clientX; dragging=true;} },{passive:true});
    carousel.addEventListener('touchmove',e=>{ if(!dragging)return; if(Math.abs(e.touches[0].clientX-startX)>10) e.preventDefault(); },{passive:false});
    carousel.addEventListener('touchend',e=>{ if(!dragging)return; dragging=false; const diff=e.changedTouches[0].clientX-startX; show(idx+(diff<-40?1:diff>40?-1:0)); });

    show(0);
    return { show, getIndex: () => idx };
  }

  // ----- Lock & Reset UI -----
  function updateLockUI() {
    const bgIdx = bgCarousel ? bgCarousel.getIndex() : 0;
    const mechIdx = mechCarousel ? mechCarousel.getIndex() : 0;
    const canLock = !bonusesLocked && bgIdx !== 0 && mechIdx !== 0;
    dom.lockBtn.classList.toggle('show', canLock);
    dom.statsPanel.classList.toggle('inactive', !bonusesLocked);
    [dom.bgSlider, dom.mechSlider].forEach(slider => slider.classList.toggle('locked', bonusesLocked));
    dom.statsPanel.title = bonusesLocked ? '' : statsTitle;
  }

  dom.manualToggle.addEventListener('change', e => {
    manualMode = e.target.checked;
    renderStats();
  });

  dom.shieldToggle.addEventListener('change', e => {
    shieldActive = e.target.checked;
    renderHP();
    saveToLocalStorage();
  })

  dom.lockBtn.addEventListener('click', () => {
    if (bonusesLocked) return;
    bonusesLocked = true;
    updateLockUI(); saveToLocalStorage();
  });

  dom.resetBtn.addEventListener('click', () => {
    if (!confirm('Are you sure you want to reset all character data? This cannot be undone.')) return;
    bonusesLocked = false;
    manualMode = false;
    shieldActive = false;
    hpSlots = Array(5).fill(true);
    dom.manualToggle.checked = false;
    dom.shieldToggle.checked = false;
    dom.bgInput.value = '';
    dom.mechInput.value = '';
    valueAether = 0; valueMonolog = 0;
    stats.forEach(s => { statBaseIndex[s] = 0; statBusy[s] = false; });
    dom.playerName.value = dom.charName.value = dom.notes.value = '';
    dom.rank.value = 'f';
    dom.popupContainer.innerHTML = '';
    dom.lastRoll.classList.remove('show'); dom.lastRoll.textContent = '';
    updateAether(); updateMonolog(); saveToLocalStorage();
    if (bgCarousel) bgCarousel.show(0);
    if (mechCarousel) mechCarousel.show(0);
    renderStats(); renderHP(); updateLockUI();
    localStorage.removeItem('megaMechaState');
  });

  // ----- Persistence -----
  function gatherState() {
    return {
      playerName: dom.playerName.value,
      charName:   dom.charName.value,
      rank:       dom.rank.value,
      notes:      dom.notes.value,
      aether:     valueAether,
      monolog:    valueMonolog,
      background: { value: dom.bgInput.value, index: bgCarousel ? bgCarousel.getIndex() : 0 },
      mech:       { value: dom.mechInput.value, index: mechCarousel ? mechCarousel.getIndex() : 0 },
      bonusesLocked,
      statBaseIndex: {...statBaseIndex},
      hpSlots,
      shieldActive
    };
  }

  function saveToLocalStorage() {
    localStorage.setItem('megaMechaState', JSON.stringify(gatherState()));
    scheduleSync();
  }

  function loadFromLocalStorage() {
    const json = localStorage.getItem('megaMechaState');
    if (!json) return;
    try {
      const o = JSON.parse(json);
      Object.assign(statBaseIndex, o.statBaseIndex);
      hpSlots      = Array.isArray(o.hpSlots) ? o.hpSlots : hpSlots;
      shieldActive = !!o.shieldActive;
      dom.playerName.value = o.playerName;
      dom.charName.value   = o.charName;
      dom.rank.value       = o.rank;
      dom.notes.value      = o.notes;
      valueAether = o.aether;
      valueMonolog = o.monolog;
      bonusesLocked = o.bonusesLocked;
      if (bgCarousel) bgCarousel.show(o.background?.index || 0);
      if (mechCarousel) mechCarousel.show(o.mech.index || 0);
      if (shieldActive) dom.shieldToggle.checked = true;
    } catch (e) {
      console.error('Load error', e);
    }
  }

  // ----- Initialization -----
  document.addEventListener('DOMContentLoaded', () => {
    // initialize carousels
    bgCarousel  = initCarousel({ sliderId: 'backgroundCarousel', input: dom.bgInput });
    mechCarousel= initCarousel({ sliderId: 'mechCarousel',       input: dom.mechInput });

    // restore data
    loadFromLocalStorage();

    // Auth
    onAuthStateChanged(auth, handleAuthChange);

    // draw UI
    renderStats(); renderHP(); updateAether(); updateMonolog(); updateLockUI();

    // event listeners
    dom.loginForm.addEventListener('submit', e => e.preventDefault());
    dom.btnLogin.addEventListener('click', ()=> {signInUser();});
    dom.btnSignUp.addEventListener('click', ()=> {signUpUser();});
    dom.btnSignOut.addEventListener('click', ()=> {signOutUser();});
    [dom.bgInput, dom.mechInput].forEach(el => el.addEventListener('change', () => { renderStats(); updateLockUI(); saveToLocalStorage(); }));
    dom.aetherMinus.addEventListener('click', ()=>{ if(valueAether>0) valueAether--; updateAether(); saveToLocalStorage(); });
    dom.aetherPlus .addEventListener('click', ()=>{ if(valueAether<200) valueAether++; updateAether(); saveToLocalStorage(); });
    dom.aetherReset.addEventListener('click', ()=>{ valueAether=0; updateAether(); saveToLocalStorage(); });
    dom.meterUse .addEventListener('click', ()=>{ if(valueMonolog===meterMax) valueMonolog=0; updateMonolog(); saveToLocalStorage(); });
    dom.meterPlus.addEventListener('click', ()=>{ if(valueMonolog<meterMax) valueMonolog++; updateMonolog(); saveToLocalStorage(); });
    const origRoll = rollStat; rollStat = async s=>{ await origRoll(s); saveToLocalStorage(); };
  });

})();
