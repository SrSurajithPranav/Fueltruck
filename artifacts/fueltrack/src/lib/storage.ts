export type FoodCategory = 'Dairy' | 'Eggs' | 'Protein' | 'Grains' | 'Fruits & vegetables' | 'Other';
export type Meal = 'Breakfast' | 'Lunch' | 'Evening' | 'Dinner' | 'Snack' | 'Other';

export type Food = {
  id: string;
  name: string;
  category: FoodCategory;
  servingLabel: string;
  servingQuantity: number;
  servingUnit: string;
  proteinPerServing: number;
  defaultPrice: number;
  priceQuantity: number;
  priceUnit: string;
  manualCost: boolean;
  proteinOptional: boolean;
};

export type FoodEntry = {
  id: string;
  foodId: string;
  foodNameSnapshot: string;
  meal: Meal;
  quantity: number;
  unit: string;
  protein: number;
  cost: number;
  actualPrice?: number;
  createdAt: string;
};

export type DailyLog = { date: string; entries: FoodEntry[] };
export type Purchase = {
  id: string;
  date: string;
  foodId: string;
  foodNameSnapshot: string;
  quantity: number;
  unit: string;
  brand: string;
  price: number;
};
export type Settings = { proteinTarget: number; monthlyBudget: number; darkMode: boolean; spokenResponses: boolean };
export type AppData = {
  foods: Food[];
  dailyLogs: Record<string, DailyLog>;
  purchases: Purchase[];
  inventory: Record<string, number>;
  settings: Settings;
};

const STORAGE_KEY = 'fueltrack-local-v1';

const f = (
  id: string,
  name: string,
  category: FoodCategory,
  servingLabel: string,
  servingQuantity: number,
  servingUnit: string,
  proteinPerServing: number,
  defaultPrice: number,
  priceQuantity: number,
  priceUnit: string,
  manualCost = false,
  proteinOptional = false,
): Food => ({ id, name, category, servingLabel, servingQuantity, servingUnit, proteinPerServing, defaultPrice, priceQuantity, priceUnit, manualCost, proteinOptional });

export const seedFoods: Food[] = [
  f('milk', 'Milk', 'Dairy', '250 ml', 250, 'ml', 8, 22, 1000, 'litre'),
  f('egg', 'Egg', 'Eggs', '1 egg', 1, 'egg', 6, 7, 1, 'egg'),
  f('tofu', 'Tofu', 'Protein', '100 g', 100, 'g', 15.5, 65, 200, '200 g'),
  f('soya', 'Soya Chunks', 'Protein', '50 g dry', 50, 'g', 26, 50, 200, '200 g'),
  f('atta', 'Atta / Chapati', 'Grains', '5 chapatis', 5, 'chapati', 12.5, 50, 1000, 'kg'),
  f('dosa', 'Dosa', 'Grains', '1 dosa', 1, 'dosa', 0, 58, 1000, 'kg flour', false, true),
  f('curd', 'Curd', 'Dairy', '200 g', 200, 'g', 7, 28, 450, '450 g'),
  f('buttermilk', 'Buttermilk', 'Dairy', '1 glass', 1, 'glass', 4, 10, 1, 'glass'),
  f('oats', 'YogaBar High Protein Oats', 'Grains', '50 g', 50, 'g', 13, 300, 1000, 'kg'),
  f('fruits', 'Fruits', 'Fruits & vegetables', '1 portion', 1, 'portion', 0, 0, 1, 'portion', true, true),
  f('vegetables', 'Vegetables', 'Fruits & vegetables', '1 portion', 1, 'portion', 0, 0, 1, 'portion', true, true),
];

const emptyData = (): AppData => ({
  foods: seedFoods.map((food) => ({ ...food })),
  dailyLogs: {},
  purchases: [],
  inventory: {},
  settings: { proteinTarget: 80, monthlyBudget: 4000, darkMode: false, spokenResponses: true },
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function loadData(): AppData {
  const fallback = emptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const foods = Array.isArray(parsed.foods) ? parsed.foods.filter(isRecord).map((food) => ({ ...food })) as Food[] : fallback.foods;
    const logs = isRecord(parsed.dailyLogs) ? parsed.dailyLogs as Record<string, DailyLog> : {};
    const purchases = Array.isArray(parsed.purchases) ? parsed.purchases.filter(isRecord) as unknown as Purchase[] : [];
    const settings = isRecord(parsed.settings) ? parsed.settings as Partial<Settings> : {};
    return {
      foods: foods.length ? foods : fallback.foods,
      dailyLogs: logs,
      purchases,
      inventory: isRecord(parsed.inventory) ? Object.fromEntries(Object.entries(parsed.inventory).map(([id, value]) => [id, Math.max(0, Number(value) || 0)])) : {},
      settings: {
        proteinTarget: Number(settings.proteinTarget) > 0 ? Number(settings.proteinTarget) : 80,
        monthlyBudget: Number(settings.monthlyBudget) >= 0 ? Number(settings.monthlyBudget) : 4000,
        darkMode: settings.darkMode === true,
        spokenResponses: settings.spokenResponses !== false,
      },
    };
  } catch {
    return fallback;
  }
}

export function saveData(data: AppData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* storage may be unavailable in private browsing */ }
}

export function resetData() { saveData(emptyData()); return emptyData(); }
export function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
export function shiftIso(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}
export function currency(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}
export function quantityText(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
export function formatDay(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en-IN', options).format(new Date(`${date}T12:00:00`));
}
export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
}
export function foodCost(food: Food, quantity: number, actualPrice?: number) {
  if (actualPrice !== undefined) return Math.max(0, actualPrice);
  if (food.manualCost) return Math.max(0, actualPrice ?? 0);
  return Math.max(0, food.defaultPrice * quantity / Math.max(food.priceQuantity, 0.0001));
}
export function foodProtein(food: Food, quantity: number, actualProtein?: number) {
  if (food.proteinOptional && actualProtein !== undefined) return Math.max(0, actualProtein);
  return Math.max(0, food.proteinPerServing * quantity / Math.max(food.servingQuantity, 0.0001));
}
export function monthKey(date: string) { return date.slice(0, 7); }