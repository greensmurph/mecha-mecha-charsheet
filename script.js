/**
 * Mega Mecha Overdrive: Golden - Character Sheet Logic
 * version: 1.2
 * =================================================
 * Core game mechanics and UI interaction handling for the character sheet.
 * Features:
 * - Stat dice system with evolution mechanics
 * - Resource tracking (Aether/Monolog)
 * - Character data persistence
 * - Background/Mech bonus management
 */

// Core Game Constants
// ------------------
// Available stats and their corresponding die sizes (D4 -> D20)
const stats = ['Focus','Instinct','Overdrive','Resonance','Style','Willpower'];
const dieSizes = [4, 6, 8, 10, 12, 20];

// Stat Evolution Tracking
// ----------------------
// Tracks the base evolution level (0-5) for each stat
// This index maps to dieSizes array (e.g., index 0 = D4, 1 = D6, etc.)
const statBaseIndex = {
  Focus:     0,
  Instinct:  0,
  Overdrive: 0,
  Resonance: 0,
  Style:     0,
  Willpower: 0
};

// Prevents multiple simultaneous rolls of the same stat
const statBusy = {
  Focus:     false,
  Instinct:  false,
  Overdrive: false,
  Resonance: false,
  Style:     false,
  Willpower: false
};

// DOM Element References
// --------------------
// Character Information Fields
const playerNameInput = document.getElementById('playerName');
const charNameInput = document.getElementById('charName');
const rankInput = document.getElementById('rank');
const playerNotesInput = document.getElementById('notes');

// Resource Counter Elements
// -----------------------
// Aether Token Controls
const decrementAether  = document.getElementById('aetherMinus');
const incrementAether  = document.getElementById('aetherPlus');
const textAether      = document.getElementById('aetherCounter');
const resetAether     = document.getElementById('aetherReset');

// Monolog-o-meter Controls
const useMonolog      = document.getElementById('meterReset');
const incrementMonolog = document.getElementById('meterPlus');
const textMonolog     = document.getElementById('meterCounter');
const progressMonolog = document.getElementById('meterProgress');

// Resource Counter State
// Initial values for Aether tokens (0-200) and Monolog meter (0-6)
let valueAether = 0;
let valueMonolog = 0;

/**
 * Updates the Aether token counter display and button states
 * Disables increment at max (200) and decrement at min (0)
 */
function updateCounterAether() {
  textAether.textContent = valueAether;
  decrementAether.disabled = valueAether <= 0;
  incrementAether.disabled = valueAether >= 200;
}

/**
 * Updates the Monolog-o-meter display, progress bar, and button states
 * Disables increment at max (6) and enables "Use!" button when full
 */
function updateCounterMonolog() {
  textMonolog.textContent = valueMonolog;
  progressMonolog.value = valueMonolog;
  useMonolog.disabled = valueMonolog < 6;
  incrementMonolog.disabled = valueMonolog >= 6;
}

// Aether Token Event Handlers
// -------------------------
decrementAether.addEventListener('click', () => {
  if (valueAether > 0) {
    valueAether--;
    updateCounterAether();
  }
});

incrementAether.addEventListener('click', () => {
  if (valueAether < 200) {
    valueAether++;
    updateCounterAether();
  }
});

resetAether.addEventListener('click', () => {
  valueAether = 0;
  updateCounterAether();
});

// Monolog-o-meter Event Handlers
// ---------------------------
useMonolog.addEventListener('click', () => {
  if (valueMonolog === 6) {
    valueMonolog = 0;
    updateCounterMonolog();
  }
});

incrementMonolog.addEventListener('click', () => {
  if (valueMonolog < 6) {
    valueMonolog++;
    updateCounterMonolog();
  }
});

// Bonus Selection and Dice Display Elements
// --------------------------------------
const backgroundSelect = document.getElementById('backgroundBonus');  // Background choice dropdown
const mechSelect       = document.getElementById('mechBonus');        // Mech choice dropdown
const lockBonuses      = document.getElementById('lockBonuses');      // Lock selections button
const resetButton      = document.getElementById('resetButton');      // Reset all button
const resultDisplay    = document.getElementById('lastRoll');         // Last roll result display
const popupContainer   = document.getElementById('popupContainer');   // Roll notification container
const statsContainer   = document.getElementById('stats');            // Stat dice container
const dunkelMech       = document.getElementById('dunkelMech');      // Regular Overdrive mech option
const verdammisMech    = document.getElementById('verdammisMech');   // Special Overdrive mech variant
const statsTitle       = 'Lock in your background and mech';

// Initialize stats container in inactive state until bonuses are locked
statsContainer.title = statsTitle;
statsContainer.className = 'inactive';

// Bonus Selection State
// Tracks if background/mech choices are locked, preventing further changes
let bonusesLocked = false;

/**
 * Toggles the lock state of bonus selection dropdowns
 * @param {boolean} state - True to lock selections, false to unlock
 */
function toggleLockButtons(state) {
  // Update lock state and button visibility
  bonusesLocked = state;
  if (bonusesLocked) {
    lockBonuses.classList.remove('show');
  } else {
    lockBonuses.classList.add('show');
  }
}

/**
 * Validates bonus selections and updates UI accordingly
 * Shows lock button when both background and mech are selected
 * Hides lock button and stats grid when selections are incomplete
 */
function checkBonusSelections() {
  const bgVal = backgroundSelect.value;
  const mechVal = mechSelect.value;
  if (bgVal !== '' && mechVal !== '') {
    // Both chosen -> reveal "lock" button and stats grid
    lockBonuses.classList.add('show');

  } else {
    // At least one not chosen -> hide "lock" button and stats grid
    if (bgVal !== '' || mechVal !== '') {
      // do nothing
    } else {
      toggleLockButtons(false);
      statsContainer.classList.add('inactive');
      statsContainer.title = statsTitle;
    }
  }
}

/**
 * Calculates total bonus count for a given stat from background/mech selections
 * Handles special case for Verdammis-class Ifrit (counts as Overdrive)
 * @param {string} statName - The stat to check bonuses for
 * @returns {number} - Number of bonuses (0-2) applying to the stat
 */
function getBonusCount(statName) {
  let count = 0;
  const bg = backgroundSelect.value;
  let mech = mechSelect.value;
  if (mech === 'VerdammisMech') mech = 'Overdrive';
  if (bg === statName) count++;
  if (mech === statName) count++;
  return count;
}

/**
 * Renders the stat dice display panel
 * Creates interactive dice buttons for each stat, showing current die size
 * Die size is computed from base evolution level plus active bonuses
 * Visual styling changes based on die size (D4-D20)
 */
function renderStats() {
  const container = document.getElementById('stats');
  container.innerHTML = '';

  stats.forEach(statName => {
    const base = statBaseIndex[statName];
    const bonusCount = getBonusCount(statName);
    const effectiveIndex = Math.min(base + bonusCount, dieSizes.length - 1);
    const dieFace = dieSizes[effectiveIndex];

    const div = document.createElement('div');
    div.className = 'stat-die';
    div.dataset.stat = statName;
    div.dataset.dieIndex = effectiveIndex;
    div.textContent = `${statName}: D${dieFace}`;
    div.addEventListener('click', () => onRoll(statName));
    container.appendChild(div);
  });
}

/**
 * Displays a temporary popup message for roll results
 * @param {string} message - The message to display
 * @param {string} rollType - Type of roll result ('rollResult'|'rollCrit'|'rollTotal')
 * Popups fade out after 1.5s and are removed after 3s
 * Maximum of 6 popups shown simultaneously
 */
function showPopup(message, rollType) {
  // Maintain a maximum of 6 recent popups
  const container = document.getElementById('popupContainer');
  while (container.children.length >= 6) {
    container.removeChild(container.firstChild);
  }

  // Create and append new popup with animation classes
  const pop = document.createElement('div');
  pop.className = `rollPopup ${rollType}`;
  pop.textContent = message;
  document.getElementById('popupContainer').appendChild(pop);

  // Handle popup lifecycle - fade out after 1.5s, remove after 3s
  setTimeout(() => {
    pop.style.opacity = '0';
  }, 1500);
  setTimeout(() => {
    pop.remove();
  }, 3000);
}

// 7. Handle rolling + “evolution” when a stat-die button is clicked
async function onRoll(statName) {
  if (statBusy[statName]) return;
  statBusy[statName] = true;


  let total = 0;

  // Compute starting effectiveIndex = base + bonus
  let base = statBaseIndex[statName];
  const bonusCount = getBonusCount(statName);
  let currentIndex = Math.min(base + bonusCount, dieSizes.length - 1);

  let rolling = true;
  while (rolling) {
    const sides = dieSizes[currentIndex];
    const roll = Math.floor(Math.random() * sides) + 1;
    const crit = roll === sides;
    total += roll;

    // Show the raw roll result
    showPopup(`${statName} rolls D${sides} → ${roll}${crit ? ' (crit!)' : ''}`, 'rollResult');

    if (crit) { 
      // Case A: We are not yet at the final index (D20), so allow evolution
      if ( currentIndex < dieSizes.length - 1) {
        // Crit—and we can still evolve
        base++;
        statBaseIndex[statName] = base;
        // Recompute effectiveIndex = new base + bonus (capped)
        currentIndex = Math.min(base + bonusCount, dieSizes.length - 1);
        showPopup(`⚡ ${statName} is now a D${dieSizes[currentIndex]}!`, 'rollCrit');
        // Pause briefly so the 'evolotion' popup is visible, then continue rolling
        await new Promise(r => setTimeout(r, 600));
        continue; // loop again on the new/evolved die
      }
      // Case B: We are at max index (D20), so stop evolving, but allow re-rolling on crit
      showPopup(`🔁 ${statName} ${roll} - CRIT! Rolling again...`, 'rollCrit');
      await new Promise(r => setTimeout(r, 600));
      continue;  // loop again on the same D20
    }
    // Not a crit, take total of roll
    rolling = false;
  }

  // Re-render so the UI updates to the new effective die
  renderStats();
  showPopup(`${statName} total = ${total}`, 'rollTotal');

  // Update display text
  resultDisplay.innerHTML = `<p class="text-center">Last Roll: ${statName} = ${total}</p>`;
  resultDisplay.className = 'show';

  statBusy[statName] = false;
}

// 8. Confirm Bonus handlers (lock dropdowns)
lockBonuses.addEventListener('click', () => {
  // If already locked, do nothing
  if (bonusesLocked) return;

  // Disable both selects, lock button, and show the unlock button
  backgroundSelect.disabled = true;
  mechSelect.disabled = true;
  statsContainer.classList.remove('inactive');
  toggleLockButtons(true);
  saveToLocalStorage();
});

// 9. Reset sheet handler  (resets everthing)
resetButton.addEventListener('click', () => {
  // Re-enable dropdowns and lock button, hide the unlock button
  backgroundSelect.removeAttribute('disabled');
  mechSelect.removeAttribute('disabled');
  bonusesLocked = false;
  statsContainer.classList.add('inactive');
  statsContainer.title = statsTitle;
  lockBonuses.classList.remove('show');
  aetherReset.click();
  progressMonolog.value = 0;
  playerNameInput.value = '';
  charNameInput.value = '';
  rankInput.value = 'e';
  playerNotesInput.value = '';

  // Clear dropdown values
  backgroundSelect.value = '';
  mechSelect.value = '';
  verdammisMech.disabled = true;

  // Reset stat base index
  stats.forEach(statName => {
    statBaseIndex[statName] = 0;
    statBusy[statName] = false;
  });

  // Clear any popups on screen
  popupContainer.innerHTML = '';

  // Clear result text
  resultDisplay.removeAttribute('class');
  resultDisplay.innerHTML = '';

  // Re-render stat dice
  renderStats();
  saveToLocalStorage();
});

// 10. Re-render on dropdown changes
backgroundSelect.addEventListener('change', ()=>{
  if (backgroundSelect.value === 'Overdrive') {
    verdammisMech.disabled = false;
    dunkelMech.disabled = true;
    if (mechSelect.value === 'Overdrive') {
      mechSelect.value = '';
    }
  } else {
    verdammisMech.disabled = true;
    dunkelMech.disabled = false;
    if (mechSelect.value === 'VerdammisMech') {
      mechSelect.value = '';
    } 
  }
  renderStats();
  checkBonusSelections();
});
mechSelect.addEventListener('change', ()=>{
  renderStats();
  checkBonusSelections();
});

// 11. Gather all user input
function gatherAllState() {
  return {
    playerName: playerNameInput.value,
    charName: charNameInput.value,
    rank: rankInput.value,
    notes:playerNotesInput.value,
    aetherTokens: valueAether,
    monolog: valueMonolog,
    background: backgroundSelect.value,
    mech: mechSelect.value,
    statBaseIndex: { ...statBaseIndex },
  };
}

function saveToLocalStorage() {
  const allState = gatherAllState();
  try {
    localStorage.setItem('megaMechaState', JSON.stringify(allState));
  }  catch (e) {
    console.error("Failed to save to your browser storage:", e);
  }
}

function loadFromLocalStorage() {
  const json = localStorage.getItem('megaMechaState');
  if (!json) return;

  try {
    const obj = JSON.parse(json);
    if (obj.playerName != null) playerNameInput.value = obj.playerName;
    if (obj.charName != null) charNameInput.value = obj.charName;
    if (obj.rank != null) rankInput.value = obj.rank;
    if (obj.notes != null)playerNotesInput.value = obj.notes;
    if (obj.aetherTokens != null) valueAether = obj.aetherTokens;
    if (obj.monolog != null) valueMonolog = obj.monolog;
    updateCounterAether();
    updateCounterMonolog();
    if (obj.background != null) backgroundSelect.value = obj.background;
    if (obj.mech != null) mechSelect.value = obj.mech;
    if (obj.statBaseIndex) {
      Object.assign(statBaseIndex, obj.statBaseIndex);
    }
    statsContainer.classList.remove('inactive');
    renderStats();
    checkBonusSelections();

  } catch (e) {
    console.error("Failed to load from your browser storage:", e);
  }
}

// 12. Initial render when the page loads
window.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();

  document
    .querySelectorAll(
      '#playerName, #charName, #rank, #notes, #backgroundBonus, #mechBonus'
    ).forEach(el => el.addEventListener('change', saveToLocalStorage));
  
  decrementAether.addEventListener('click', saveToLocalStorage);
  incrementAether.addEventListener('click', saveToLocalStorage);
  resetAether.addEventListener('click', saveToLocalStorage);
  incrementMonolog.addEventListener('click', saveToLocalStorage);
  useMonolog.addEventListener('click', saveToLocalStorage);

  const originalOnroll = onRoll;
  onRoll = async statName => {
    await originalOnroll(statName);
    saveToLocalStorage();
  }

  renderStats();
  updateCounterAether();
  updateCounterMonolog();
});
