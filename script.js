// script.js — Refactored Mega Mecha Overdrive: Golden
// version: 2.3 — Added Manual-Evolve toggle & per-stat adjust buttons

((d) => {
  // ----- DOM References -----
  const dom = {
    playerName: d.getElementById('playerName'),
    charName:   d.getElementById('charName'),
    rank:       d.getElementById('rank'),
    notes:      d.getElementById('notes'),

    rollLog:    d.getElementById('roll-log'),
    logOpen:    d.getElementById('logOpen'),
    logClose:   d.getElementById('logClose'),
    logContainer: d.getElementById('logTextContainer'),

    aetherMinus: d.getElementById('aetherMinus'),
    aetherPlus:  d.getElementById('aetherPlus'),
    aetherCount: d.getElementById('aetherCounter'),
    aetherReset: d.getElementById('aetherReset'),
    meterUse:    d.getElementById('meterReset'),
    meterPlus:   d.getElementById('meterPlus'),
    meterCount:  d.getElementById('meterCounter'),
    meterProg:   d.getElementById('meterProgress'),

    bgSlider:    d.getElementById('backgroundCarousel'),
    mechSlider:  d.getElementById('mechCarousel'),
    bgInput:     d.getElementById('backgroundBonus'),
    mechInput:   d.getElementById('mechBonus'),
    lockBtn:     d.getElementById('lockBonuses'),
    resetBtn:    d.getElementById('resetButton'),
    statsPanel:  d.getElementById('stats'),

    manualToggle: d.getElementById('manualToggle'), // checkbox for manual mode
    lastRoll:      d.getElementById('lastRoll'),
    popupContainer: d.getElementById('popupContainer'),

    // HP references
    hpSection: d.getElementById('hpSection'),       // wrapper for HP
    hpContainer: d.getElementById('hpContainer'),   // container for 5 slots
    shieldToggle: d.getElementById('shieldToggle')  // checkbox to enable shield
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

  //HP state: 5 core HP slots (tru=full), plus shield
  let hpSlots       = Array(5).fill(true);
  let shieldActive  = false;

  const statsTitle  = 'Lock in your background and mech';
  let bgCarousel, mechCarousel;

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
      const slot = d.createElement('div');
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
    
    // Count dice at each level or higher
    const diceAtLeastD6 = stats.filter(stat => {
      const base = statBaseIndex[stat];
      const bonus = getBonusCount(stat);
      const idx = Math.min(base + bonus, dieSizes.length - 1);
      return dieSizes[idx] >= 6;
    }).length;

    const diceAtLeastD8 = stats.filter(stat => {
      const base = statBaseIndex[stat];
      const bonus = getBonusCount(stat);
      const idx = Math.min(base + bonus, dieSizes.length - 1);
      return dieSizes[idx] >= 8;
    }).length;

    const diceAtLeastD10 = stats.filter(stat => {
      const base = statBaseIndex[stat];
      const bonus = getBonusCount(stat);
      const idx = Math.min(base + bonus, dieSizes.length - 1);
      return dieSizes[idx] >= 10;
    }).length;

    const diceAtLeastD12 = stats.filter(stat => {
      const base = statBaseIndex[stat];
      const bonus = getBonusCount(stat);
      const idx = Math.min(base + bonus, dieSizes.length - 1);
      return dieSizes[idx] >= 12;
    }).length;

    const diceAtD20 = stats.filter(stat => {
      const base = statBaseIndex[stat];
      const bonus = getBonusCount(stat);
      const idx = Math.min(base + bonus, dieSizes.length - 1);
      return dieSizes[idx] === 20;
    }).length;

    // Update rank based on dice levels
    const rankSelect = dom.rank;
    rankSelect.querySelector('option[value="e"]').disabled = diceAtLeastD6 < 4;
    rankSelect.querySelector('option[value="d"]').disabled = diceAtLeastD8 < 4;
    rankSelect.querySelector('option[value="c"]').disabled = diceAtLeastD10 < 4;
    rankSelect.querySelector('option[value="b"]').disabled = diceAtLeastD12 < 4;
    rankSelect.querySelector('option[value="a"]').disabled = diceAtD20 < 4;
    rankSelect.querySelector('option[value="s"]').disabled = diceAtD20 < 6;

    // Auto-select highest available rank
    const ranks = ['f', 'e', 'd', 'c', 'b', 'a', 's'];
    for (let i = ranks.length - 1; i >= 0; i--) {
      const option = rankSelect.querySelector(`option[value="${ranks[i]}"]`);
      if (!option.disabled) {
        rankSelect.value = ranks[i];
        break;
      }
    }

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

      dom.logContainer.innerHTML += `<p>${stat}: D${sides} → ${r}${crit?' (crit!)':''}</p>`;

      // If manual mode, stop auto-evolve/re-roll on crit
      if (manualMode || !crit) break;

      // Auto-evolution if not manual
      if (idx < dieSizes.length - 1) {
        statBaseIndex[stat] = ++base;
        idx = Math.min(base + getBonusCount(stat), dieSizes.length - 1);
        showPopup(`⚡${stat} evolves to D${dieSizes[idx]}!`, 'rollCrit');
        dom.logContainer.innerHTML += `<p>⚡${stat} evolves to D${dieSizes[idx]}!</p>`;
        await new Promise(r=>setTimeout(r,600));
        continue;
      }
      // At max die, auto re-roll
      showPopup(`🔁 ${stat} ${r} - CRIT!`, 'rollCrit');
      dom.logContainer.innerHTML += `<p>🔁 ${stat} ${r} - CRIT!</p>`;
      await new Promise(r=>setTimeout(r,600));
    }

    renderStats();
    showPopup(`${stat} total = ${total}`, 'rollTotal');
    dom.logContainer.innerHTML += `<p>${stat} total: ${total}</p>`;
    dom.lastRoll.innerHTML = `<p class="text-center">Last Roll: ${stat} = ${total}</p>`;
    dom.lastRoll.classList.add('show');
    dom.rollLog.style.opacity = 1;
    dom.rollLog.classList.remove('inactive');
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
      items.forEach(item => item.classList.remove('active-item'));
      items[idx].classList.add('active-item');
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
    dom.logClose.click();
    dom.rollLog.classList.add('inactive');
    dom.logContainer.innerHTML = '';
    updateAether(); updateMonolog(); saveToLocalStorage();
    if (bgCarousel) bgCarousel.show(0);
    if (mechCarousel) mechCarousel.show(0);
    renderStats(); renderHP(); updateLockUI();
    localStorage.removeItem('megaMechaState');
  });

  // ----- Persistence -----
  function gatherState() {
    const cleaned = {
      playerName: sanitizeInput(dom.playerName.value, 50),
      charName:   sanitizeInput(dom.charName.value, 50),
      notes:      sanitizeTextArea(dom.notes.value, 500)
    }
    return {
      playerName: cleaned.playerName,
      charName:   cleaned.charName,
      rank:       dom.rank.value,
      notes:      cleaned.notes,
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
      if (bgCarousel) bgCarousel.show(o.background.index || 0);
      if (mechCarousel) mechCarousel.show(o.mech.index || 0);
      if (shieldActive) dom.shieldToggle.checked = true;
    } catch (e) {
      console.error('Load error', e);
    }
  }

  function sanitizeInput(data, max) {
    data = data.trim();
    data = data.replace(/<|>|&/g, '');
    data = data.replace(/&/g, '&amp;');
    data = data.substring(0, max);
    return data;
  }

  function sanitizeTextArea(data, max) {
    data = data.replace(/\n/g, ' '); // remove newline chars
    data = data.replace(/<\?[\s\S]*?\?>/g, ''); // remove php
    data = data.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ''); // remove JS/CSS blocks
    data = data.replace(/<[^>]+>/g, ''); // remove html tags
    return sanitizeInput(data, max);
  }

  // ----- Initialization -----
  document.addEventListener('DOMContentLoaded', () => {
    // Roll log controls
    dom.logOpen.addEventListener('click', () => {
      if (dom.logContainer.textContent.length < 1) return;
      dom.logContainer.classList.add('show');
      dom.logOpen.style.display = 'none';
      dom.logClose.style.display = 'block';
    });

    dom.logClose.addEventListener('click', () => {
      if (dom.logContainer.textContent.length < 1) return;
      dom.logContainer.classList.remove('show');
      dom.logOpen.style.display = 'block';
      dom.logClose.style.display = 'none';
    });

    // initialize carousels
    bgCarousel  = initCarousel({ sliderId: 'backgroundCarousel', input: dom.bgInput });
    mechCarousel= initCarousel({ sliderId: 'mechCarousel',       input: dom.mechInput });

    // restore data
    loadFromLocalStorage();

    // draw UI
    renderStats(); renderHP(); updateAether(); updateMonolog(); updateLockUI();
    [dom.playerName, dom.charName, dom.notes].forEach(el => el.addEventListener('blur', saveToLocalStorage));
    dom.rank.addEventListener('change', saveToLocalStorage);
    [dom.bgInput, dom.mechInput].forEach(el => el.addEventListener('change', () => {renderStats(); updateLockUI(); saveToLocalStorage();}));
    dom.aetherMinus.addEventListener('click', ()=>{ if(valueAether>0) valueAether--; updateAether(); saveToLocalStorage(); });
    dom.aetherPlus .addEventListener('click', ()=>{ if(valueAether<200) valueAether++; updateAether(); saveToLocalStorage(); });
    dom.aetherReset.addEventListener('click', ()=>{ valueAether=0; updateAether(); saveToLocalStorage(); });
    dom.meterUse .addEventListener('click', ()=>{ if(valueMonolog===meterMax) valueMonolog=0; updateMonolog(); saveToLocalStorage(); });
    dom.meterPlus.addEventListener('click', ()=>{ if(valueMonolog<meterMax) valueMonolog++; updateMonolog(); saveToLocalStorage(); });
    const origRoll = rollStat; rollStat = async s=>{ await origRoll(s); saveToLocalStorage(); };
  });
})(document);
