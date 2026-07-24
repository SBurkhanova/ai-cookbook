import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as recipes from '../services/recipeService.js';

const MAX_INGREDIENTS = 30;
const ALLOWED_DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again in a few minutes.' },
});

export const recipesRouter = Router();

recipesRouter.post('/generate', generateLimiter, async (req, res) => {
  const { ingredients, mealType, cookTime, diet } = req.body || {};
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'Provide at least one ingredient.' });
  }
  if (ingredients.length > MAX_INGREDIENTS) {
    return res.status(400).json({ error: `Too many ingredients (max ${MAX_INGREDIENTS}).` });
  }
  let cleanDiet = [];
  if (diet !== undefined) {
    if (!Array.isArray(diet) || diet.some((d) => !ALLOWED_DIETS.includes(d))) {
      return res.status(400).json({ error: `diet must be a subset of: ${ALLOWED_DIETS.join(', ')}.` });
    }
    cleanDiet = [...new Set(diet)];
  }
  try {
    res.json(await recipes.generate({ ingredients, mealType, cookTime, diet: cleanDiet }));
  } catch (err) {
    if (err.code === 'RECIPE_MODEL_ERROR') return res.status(422).json({ error: err.message });
    console.error('generate failed:', err.code || err.message);
    res.status(502).json({ error: "Couldn't generate a recipe — try again." });
  }
});

recipesRouter.post('/', async (req, res) => {
  const recipe = req.body || {};
  if (!recipe.generationId || !recipe.title) {
    return res.status(400).json({ error: 'A generated recipe (with generationId) is required.' });
  }
  try {
    res.status(201).json(await recipes.save(recipe));
  } catch (err) {
    console.error('save failed:', err.message);
    res.status(500).json({ error: 'Could not save the recipe.' });
  }
});

recipesRouter.get('/', async (_req, res) => {
  res.json(await recipes.list());
});

recipesRouter.delete('/:id', async (req, res) => {
  const ok = await recipes.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Recipe not found.' });
  res.json({ success: true });
});
