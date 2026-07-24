const ingredients = [];
const selectedDiet = new Set();
let currentRecipe = null;
const $ = (id) => document.getElementById(id);

const DIET_LABELS = {
  vegetarian: '🥦 Vegetarian', vegan: '🌱 Vegan',
  'gluten-free': '🌾 Gluten-free', 'dairy-free': '🥛 Dairy-free',
};
const dietLabel = (d) => DIET_LABELS[d] || d;

document.querySelectorAll('.diet-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    const d = btn.dataset.diet;
    if (selectedDiet.has(d)) { selectedDiet.delete(d); btn.classList.remove('active'); }
    else { selectedDiet.add(d); btn.classList.add('active'); }
  });
});

function renderDietTags(el, diet) {
  if (!el) return;
  el.innerHTML = '';
  (diet || []).forEach((d) => {
    const tag = document.createElement('span');
    tag.className = 'diet-tag';
    tag.textContent = dietLabel(d);
    el.appendChild(tag);
  });
}

loadCommunity();

const input = $('ingredient-input');
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addIngredient(input.value);
    input.value = '';
  }
});

function addIngredient(raw) {
  const v = raw.trim().replace(/,$/, '');
  if (!v || ingredients.includes(v)) return;
  ingredients.push(v);
  renderChips();
}
function removeIngredient(v) {
  const i = ingredients.indexOf(v);
  if (i > -1) ingredients.splice(i, 1);
  renderChips();
}
function renderChips() {
  const box = $('chips');
  box.innerHTML = '';
  ingredients.forEach((v) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = v;
    const x = document.createElement('button');
    x.textContent = '×';
    x.onclick = () => removeIngredient(v);
    chip.appendChild(x);
    box.appendChild(chip);
  });
}

$('generate-btn').addEventListener('click', generate);

async function generate() {
  const err = $('error');
  err.hidden = true;
  if (ingredients.length === 0) {
    err.textContent = 'Add at least one ingredient first.';
    err.hidden = false;
    return;
  }
  const btn = $('generate-btn');
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    const res = await fetch('/api/recipes/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ingredients,
        mealType: $('meal-type').value || undefined,
        cookTime: $('cook-time').value || undefined,
        diet: [...selectedDiet],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    currentRecipe = data;
    renderRecipe(data);
  } catch (e) {
    err.textContent = e.message || "Couldn't generate a recipe — try again.";
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Generate Recipe';
  }
}

function difficultyClass(d) {
  const key = String(d || '').toLowerCase();
  return ['easy', 'medium', 'hard'].includes(key) ? key : 'unknown';
}

function renderRecipe(r) {
  $('r-title').textContent = r.title || 'Recipe';
  $('r-time').textContent = r.time || '';
  $('r-servings').textContent = (r.servings || '?') + ' servings';
  const diff = $('r-difficulty');
  diff.textContent = r.difficulty || 'Unknown';
  diff.className = 'badge ' + difficultyClass(r.difficulty);
  const cachedPill = $('r-cached');
  if (cachedPill) cachedPill.hidden = !r.cached;
  renderDietTags($('r-diet'), r.diet);
  fill('r-ingredients', r.ingredients, 'li');
  fill('r-steps', r.steps, 'li');
  const tip = r.tips && !/DEMO MODE|ANTHROPIC_API_KEY/i.test(r.tips) ? r.tips : '';
  $('r-tips').textContent = tip;
  $('r-tips').hidden = !tip;
  $('save-msg').hidden = true;
  $('save-btn').disabled = false;
  $('save-btn').textContent = 'Save Recipe';
  $('form-panel').hidden = true;
  $('recipe-panel').hidden = false;
}

function fill(id, items, tag) {
  const el = $(id);
  el.innerHTML = '';
  (items || []).forEach((t) => {
    const li = document.createElement(tag);
    li.textContent = t;
    el.appendChild(li);
  });
}

$('save-btn').addEventListener('click', async () => {
  if (!currentRecipe) return;
  const btn = $('save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await fetch('/api/recipes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(currentRecipe),
    });
    if (!res.ok) throw new Error('Save failed');
    $('save-msg').textContent = 'Saved to Community Recipes.';
    $('save-msg').hidden = false;
    btn.textContent = 'Saved ✓';
    loadCommunity();
  } catch (e) {
    $('save-msg').textContent = e.message;
    $('save-msg').hidden = false;
    btn.disabled = false; btn.textContent = 'Save Recipe';
  }
});

$('another-btn').addEventListener('click', () => {
  ingredients.length = 0;
  renderChips();
  $('meal-type').value = '';
  $('cook-time').value = '';
  selectedDiet.clear();
  document.querySelectorAll('.diet-pill.active').forEach((b) => b.classList.remove('active'));
  currentRecipe = null;
  $('recipe-panel').hidden = true;
  $('form-panel').hidden = false;
  input.focus();
});

async function loadCommunity() {
  let recipes = [];
  try { recipes = await (await fetch('/api/recipes')).json(); } catch { /* ignore */ }
  const list = $('community-list');
  list.innerHTML = '';
  $('community-empty').hidden = recipes.length > 0;
  recipes.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    const label = document.createElement('span');
    label.textContent = `${r.title} — ${r.difficulty || ''}`;
    label.style.flex = '1';
    label.onclick = () => { currentRecipe = r; renderRecipe(r); window.scrollTo(0, 0); };
    const tags = document.createElement('span');
    tags.className = 'diet-tags inline';
    (r.diet || []).forEach((d) => {
      const t = document.createElement('span');
      t.className = 'diet-tag';
      t.textContent = dietLabel(d);
      tags.appendChild(t);
    });
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '🗑';
    del.onclick = async (e) => {
      e.stopPropagation();
      await fetch('/api/recipes/' + r.id, { method: 'DELETE' });
      loadCommunity();
    };
    card.appendChild(label);
    card.appendChild(tags);
    card.appendChild(del);
    list.appendChild(card);
  });
}
