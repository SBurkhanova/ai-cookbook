// Prompt builder + Claude call + safe parse, with a demo fallback when no
// ANTHROPIC_API_KEY is set. The frontend NEVER calls Anthropic directly.

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.8;

const SYSTEM_PROMPT = [
  'You are a creative chef. Your only job is to generate one recipe.',
  'Respond ONLY with a valid JSON object and nothing else — no markdown, no backticks, no preamble.',
  'Shape: { "title": string, "servings": string, "time": string, "difficulty": string,',
  '"ingredients": string[], "steps": string[], "tips": string }.',
  'Focus on the provided ingredients; you may add salt, oil, and basic pantry items.',
  'Strictly honor any dietary restrictions given (vegetarian, vegan, gluten-free, dairy-free) — never include a non-compliant ingredient.',
  'If the ingredients are nonsensical, unsafe, or cannot satisfy the dietary restrictions, respond instead with',
  '{ "error": "Cannot generate a recipe from these ingredients." }',
].join(' ');

export function buildUserPrompt({ ingredients = [], mealType, cookTime, diet = [] }) {
  const parts = [`Ingredients available: ${ingredients.join(', ')}.`];
  if (mealType) parts.push(`Meal type: ${mealType}.`);
  if (cookTime) parts.push(`Cook time limit: ${cookTime}.`);
  if (diet.length) parts.push(`Dietary restrictions (the recipe MUST satisfy ALL of these): ${diet.join(', ')}.`);
  return parts.join(' ');
}

// Strip a ```json ... ``` fence, then JSON.parse in a try/catch.
// Throws RECIPE_PARSE_ERROR on bad JSON, RECIPE_MODEL_ERROR on an {error} payload.
export function parseRecipeResponse(raw) {
  let text = (raw || '').trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();
  if (!text.startsWith('{')) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) text = text.slice(first, last + 1);
  }
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    const err = new Error('Model returned unparseable output');
    err.code = 'RECIPE_PARSE_ERROR';
    throw err;
  }
  if (obj && typeof obj.error === 'string') {
    const err = new Error(obj.error);
    err.code = 'RECIPE_MODEL_ERROR';
    throw err;
  }
  return obj;
}

function capitalize(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

export function demoRecipe({ ingredients = [], mealType, cookTime }) {
  const list = ingredients.length ? ingredients : ['pantry staples'];
  return {
    title: `${mealType ? capitalize(mealType) + ' ' : ''}${capitalize(list[0])} Skillet`,
    servings: '2',
    time: cookTime ? `under ${cookTime}` : '25 minutes',
    difficulty: 'Easy',
    ingredients: [...list, 'salt', 'olive oil', 'black pepper'],
    steps: [
      'Prep and roughly chop everything you have on hand.',
      `Heat a little olive oil and cook ${list.join(', ')} over medium heat.`,
      'Season with salt and pepper to taste.',
      'Plate, and finish with anything fresh you have left.',
    ],
    tips: 'Taste as you go and adjust the seasoning at the end — a squeeze of lemon or a splash of vinegar brightens almost any skillet.',
    _demo: true,
  };
}

export async function generateRecipe(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return demoRecipe(request);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(request) }],
    }),
  });

  if (!res.ok) {
    const err = new Error(`Anthropic API error (${res.status})`);
    err.code = 'UPSTREAM_ERROR';
    throw err;
  }
  const data = await res.json();
  return parseRecipeResponse(data?.content?.[0]?.text ?? '');
}
