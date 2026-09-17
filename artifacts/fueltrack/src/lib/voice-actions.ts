import {
  type AppData,
  type Food,
  type FoodEntry,
  type Meal,
  type Purchase,
  foodCost,
  foodProtein,
  shiftIso,
  todayIso,
} from '@/lib/storage';

export type VoiceAction =
  | { type: 'ADD_MEAL'; date: string; meal: Meal; items: Array<{ food: Food; quantity: number }> }
  | { type: 'ADD_PURCHASE'; date: string; food: Food; quantity: number; price: number }
  | { type: 'SET_PROTEIN_TARGET'; target: number }
  | { type: 'QUERY_PROTEIN'; date: string }
  | { type: 'QUERY_SPENDING'; food: Food | null; month: string }
  | { type: 'GET_MEAL_SUGGESTION'; meal: Meal }
  | { type: 'CREATE_FOOD'; food: Food };

export type VoicePlan = { transcript: string; actions: VoiceAction[]; clarification?: string };

const meals: Meal[] = ['Breakfast', 'Lunch', 'Evening', 'Dinner', 'Snack', 'Other'];

function normalise(value: string) {
  return value.toLowerCase().replace(/[₹,]/g, '').replace(/\s+/g, ' ').trim();
}

function dateFor(text: string) {
  return /\byesterday\b/.test(text) ? shiftIso(todayIso(), -1) : todayIso();
}

function mealFor(text: string): Meal {
  if (/\bbreakfast\b/.test(text)) return 'Breakfast';
  if (/\blunch\b/.test(text)) return 'Lunch';
  if (/\bevening|tea time\b/.test(text)) return 'Evening';
  if (/\bdinner\b/.test(text)) return 'Dinner';
  if (/\bsnack\b/.test(text)) return 'Snack';
  const hour = new Date().getHours();
  return hour < 11 ? 'Breakfast' : hour < 16 ? 'Lunch' : hour < 19 ? 'Evening' : 'Dinner';
}

function findFood(text: string, foods: Food[]) {
  return foods
    .flatMap((food) => food.name.split('/').map((term) => ({ food, term: term.trim().toLowerCase() })))
    .sort((a, b) => b.term.length - a.term.length)
    .find(({ term }) => term.length > 1 && text.includes(term))?.food ?? null;
}

function quantityFor(text: string) {
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(?:grams?|g|kg|pieces?|eggs?|litres?|l|ml)?\s*/);
  return match ? Math.max(0.01, Number(match[1])) : 1;
}

function customFood(name: string): Food {
  const clean = name.replace(/\b(today|yesterday|this morning|tonight)\b/gi, '').trim();
  return { id: `voice-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`, name: clean || 'Voice-added food', category: 'Other', servingLabel: '1 portion', servingQuantity: 1, servingUnit: 'portion', proteinPerServing: 0, defaultPrice: 0, priceQuantity: 1, priceUnit: 'portion', manualCost: true, proteinOptional: true };
}

function parseMeal(text: string, data: AppData): VoiceAction | null {
  const body = text.replace(/^.*?\b(ate|eat|had|have|consumed|finished)\b/, '').split(/\b(?:and\s+)?(?:bought|buy|purchased|purchase|got)\b/)[0].replace(/\bfor\s+(breakfast|lunch|evening|dinner|snack)\b/g, '').trim();
  if (!body) return null;
  const items = body.split(/\s*(?:with|and|,|\+)\s*/).map((part) => part.trim()).filter(Boolean).map((part) => {
    const quantity = quantityFor(part);
    const named = part.replace(/^\d+(?:\.\d+)?\s*(?:grams?|g|kg|pieces?|eggs?|litres?|l|ml)?\s*/, '').trim();
    return { food: findFood(named, data.foods) ?? customFood(named), quantity };
  });
  return items.length ? { type: 'ADD_MEAL', date: dateFor(text), meal: mealFor(text), items } : null;
}

export function parseVoicePlan(transcript: string, data: AppData): VoicePlan {
  const text = normalise(transcript);
  if (!text) return { transcript, actions: [], clarification: 'Tell FuelTrack what you ate, bought, or want to know.' };
  const actions: VoiceAction[] = [];
  const target = text.match(/(?:set|change) (?:my )?protein target to (\d+(?:\.\d+)?)\s*(?:g|grams?)?/);
  if (target) actions.push({ type: 'SET_PROTEIN_TARGET', target: Math.max(1, Number(target[1])) });
  const foodDefinition = text.match(/(?:add|create)\s+(.+?)\s+to my food database.*?(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*protein.*?(?:costs?|price)\s*(?:rs\.?|inr|rupees?)?\s*(\d+(?:\.\d+)?)/);
  if (foodDefinition) {
    const food = customFood(foodDefinition[1]);
    actions.push({ type: 'CREATE_FOOD', food: { ...food, servingLabel: '100 g', servingQuantity: 100, servingUnit: 'g', proteinPerServing: Number(foodDefinition[2]), defaultPrice: Number(foodDefinition[3]), priceQuantity: 100, priceUnit: '100 g', manualCost: false, proteinOptional: false } });
  }
  if (/how much protein/.test(text)) actions.push({ type: 'QUERY_PROTEIN', date: dateFor(text) });
  const spending = text.match(/how much (?:did i spend|have i spent) on (.+?)(?: this month| this week|$)/);
  if (spending) actions.push({ type: 'QUERY_SPENDING', food: findFood(spending[1], data.foods), month: todayIso().slice(0, 7) });
  if (/what should i eat|good dinner|meal suggestion/.test(text)) actions.push({ type: 'GET_MEAL_SUGGESTION', meal: mealFor(text) });
  const purchase = text.match(/\b(bought|buy|purchased|purchase|got)\b(.+)/);
  if (purchase) {
    const priceMatch = text.match(/\b(?:for|at|cost(?:ing)?|paid)\s*(?:rs\.?|inr|rupees?)?\s*(\d+(?:\.\d+)?)/);
    const raw = purchase[2].split(/\b(?:for|at|cost|paid)\b/)[0].trim();
    const food = findFood(raw, data.foods) ?? customFood(raw.replace(/^\d+(?:\.\d+)?\s*(?:grams?|g|kg|litres?|l|ml)?\s*/, ''));
    actions.push({ type: 'ADD_PURCHASE', date: dateFor(text), food, quantity: quantityFor(raw), price: priceMatch ? Math.max(0, Number(priceMatch[1])) : 0 });
  }
  if (/\b(ate|eat|had|have|consumed|finished)\b/.test(text)) {
    const meal = parseMeal(text, data);
    if (meal) actions.push(meal);
  }
  const missingPrice = actions.some((action) => action.type === 'ADD_PURCHASE' && action.price === 0);
  return { transcript, actions, clarification: missingPrice ? 'What price did you pay for that purchase?' : actions.length ? undefined : 'I could not find an action in that sentence.' };
}

export function validateVoicePlan(plan: VoicePlan) {
  if (!plan.actions.length) return plan.clarification ?? 'No supported action found.';
  if (plan.actions.some((action) => action.type === 'ADD_PURCHASE' && action.price <= 0)) return 'A purchase needs a price before it can be saved.';
  if (plan.actions.some((action) => action.type === 'ADD_MEAL' && action.items.some((item) => item.food.proteinOptional && item.quantity <= 0))) return 'Please provide a positive quantity for each food.';
  return null;
}

export type VoiceResult = { data: AppData; messages: string[]; queryResults: string[] };

export function applyVoicePlan(plan: VoicePlan, source: AppData): VoiceResult {
  const error = validateVoicePlan(plan);
  if (error) throw new Error(error);
  const data: AppData = { ...source, foods: [...source.foods], dailyLogs: { ...source.dailyLogs }, purchases: [...source.purchases], inventory: { ...source.inventory }, settings: { ...source.settings } };
  const messages: string[] = [];
  const queryResults: string[] = [];
  const ensureFood = (food: Food) => { const existing = data.foods.find((item) => item.id === food.id || item.name.toLowerCase() === food.name.toLowerCase()); if (existing) return existing; data.foods.push(food); return food; };
  for (const action of plan.actions) {
    if (action.type === 'SET_PROTEIN_TARGET') { data.settings.proteinTarget = action.target; messages.push(`Protein target set to ${action.target} g`); continue; }
    if (action.type === 'QUERY_PROTEIN') { const grams = data.dailyLogs[action.date]?.entries.reduce((sum, entry) => sum + entry.protein, 0) ?? 0; queryResults.push(`${grams} g protein on ${action.date}`); continue; }
    if (action.type === 'QUERY_SPENDING') { const total = data.purchases.filter((item) => item.date.startsWith(action.month) && (!action.food || item.foodId === action.food.id || item.foodNameSnapshot.toLowerCase() === action.food.name.toLowerCase())).reduce((sum, item) => sum + item.price, 0); queryResults.push(`${total} spent this month`); continue; }
    if (action.type === 'GET_MEAL_SUGGESTION') { const remaining = Math.max(0, data.settings.proteinTarget - (data.dailyLogs[todayIso()]?.entries.reduce((sum, entry) => sum + entry.protein, 0) ?? 0)); const candidate = [...data.foods].filter((food) => food.proteinPerServing > 0).sort((a, b) => Math.abs(a.proteinPerServing - remaining) - Math.abs(b.proteinPerServing - remaining))[0]; queryResults.push(candidate ? `Try ${candidate.name}: about ${candidate.proteinPerServing} g protein for ${action.meal.toLowerCase()} (you need about ${remaining} g).` : `You need about ${remaining} g protein today.`); continue; }
    if (action.type === 'CREATE_FOOD') { ensureFood(action.food); messages.push(`${action.food.name} added to your food database`); continue; }
    if (action.type === 'ADD_MEAL') {
      const entries: FoodEntry[] = action.items.map(({ food: rawFood, quantity }) => { const food = ensureFood(rawFood); return { id: crypto.randomUUID(), foodId: food.id, foodNameSnapshot: food.name, meal: action.meal, quantity, unit: food.servingUnit, protein: foodProtein(food, quantity), cost: foodCost(food, quantity), createdAt: new Date().toISOString() }; });
      const log = data.dailyLogs[action.date] ?? { date: action.date, entries: [] };
      data.dailyLogs[action.date] = { ...log, entries: [...log.entries, ...entries] };
      messages.push(`${entries.length} food${entries.length === 1 ? '' : 's'} added to ${action.meal.toLowerCase()}`);
    }
    if (action.type === 'ADD_PURCHASE') { const food = ensureFood(action.food); const purchase: Purchase = { id: crypto.randomUUID(), date: action.date, foodId: food.id, foodNameSnapshot: food.name, quantity: action.quantity, unit: food.priceUnit, brand: '', price: action.price }; data.purchases.unshift(purchase); data.inventory[food.id] = (data.inventory[food.id] ?? 0) + action.quantity; messages.push(`${food.name} purchase recorded`); }
  }
  return { data, messages, queryResults };
}