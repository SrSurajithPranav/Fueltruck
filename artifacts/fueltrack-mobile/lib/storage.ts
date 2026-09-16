import AsyncStorage from '@react-native-async-storage/async-storage';

export type FoodCategory = 'Dairy' | 'Eggs' | 'Protein' | 'Grains' | 'Fruits & vegetables' | 'Other';
export type Meal = 'Breakfast' | 'Lunch' | 'Evening' | 'Dinner' | 'Snack' | 'Other';
export type Food = {
  id: string; name: string; category: FoodCategory; servingLabel: string;
  servingQuantity: number; servingUnit: string; proteinPerServing: number;
  defaultPrice: number; priceQuantity: number; priceUnit: string;
  manualCost: boolean; proteinOptional: boolean;
};
export type FoodEntry = {
  id: string; foodId: string; foodNameSnapshot: string; meal: Meal;
  quantity: number; unit: string; protein: number; cost: number;
  actualPrice?: number; createdAt: string;
};
export type Purchase = {
  id: string; date: string; foodId: string; foodNameSnapshot: string;
  quantity: number; unit: string; brand: string; price: number;
};
export type AppData = {
  foods: Food[]; dailyLogs: Record<string, { date: string; entries: FoodEntry[] }>;
  purchases: Purchase[]; settings: { proteinTarget: number; monthlyBudget: number; darkMode: boolean };
};

const KEY = 'fueltrack-mobile-v1';
const food = (id: string, name: string, category: FoodCategory, servingLabel: string, servingQuantity: number, servingUnit: string, proteinPerServing: number, defaultPrice: number, priceQuantity: number, priceUnit: string, manualCost = false, proteinOptional = false): Food => ({ id, name, category, servingLabel, servingQuantity, servingUnit, proteinPerServing, defaultPrice, priceQuantity, priceUnit, manualCost, proteinOptional });

export const seedFoods: Food[] = [
  food('milk', 'Milk', 'Dairy', '250 ml', 250, 'ml', 8, 22, 1000, 'litre'),
  food('egg', 'Egg', 'Eggs', '1 egg', 1, 'egg', 6, 7, 1, 'egg'),
  food('tofu', 'Tofu', 'Protein', '100 g', 100, 'g', 15.5, 65, 200, '200 g'),
  food('soya', 'Soya Chunks', 'Protein', '50 g dry', 50, 'g', 26, 50, 200, '200 g'),
  food('atta', 'Atta / Chapati', 'Grains', '5 chapatis', 5, 'chapati', 12.5, 50, 1000, 'kg'),
  food('dosa', 'Dosa', 'Grains', '1 dosa', 1, 'dosa', 0, 58, 1000, 'kg flour', false, true),
  food('curd', 'Curd', 'Dairy', '200 g', 200, 'g', 7, 28, 450, '450 g'),
  food('buttermilk', 'Buttermilk', 'Dairy', '1 glass', 1, 'glass', 4, 10, 1, 'glass'),
  food('oats', 'YogaBar High Protein Oats', 'Grains', '50 g', 50, 'g', 13, 300, 1000, 'kg'),
  food('fruits', 'Fruits', 'Fruits & vegetables', '1 portion', 1, 'portion', 0, 0, 1, 'portion', true, true),
  food('vegetables', 'Vegetables', 'Fruits & vegetables', '1 portion', 1, 'portion', 0, 0, 1, 'portion', true, true),
];

export const emptyData = (): AppData => ({ foods: seedFoods.map((item) => ({ ...item })), dailyLogs: {}, purchases: [], settings: { proteinTarget: 80, monthlyBudget: 4000, darkMode: false } });
export const todayIso = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
export const shiftIso = (date: string, days: number) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + days); return next.toISOString().slice(0, 10); };
export const monthKey = (date: string) => date.slice(0, 7);
export const quantityText = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
export const currency = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
export const dateLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
export const foodProtein = (item: Food, quantity: number, custom?: number) => item.proteinOptional && custom !== undefined ? Math.max(0, custom) : Math.max(0, item.proteinPerServing * quantity / Math.max(0.01, item.servingQuantity));
export const foodCost = (item: Food, quantity: number, actual?: number) => actual !== undefined ? Math.max(0, actual) : item.manualCost ? 0 : Math.max(0, item.defaultPrice * quantity / Math.max(0.01, item.priceQuantity));
export const loadData = async (): Promise<AppData> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!Array.isArray(parsed.foods) || !parsed.dailyLogs || !Array.isArray(parsed.purchases) || !parsed.settings) return emptyData();
    return { foods: parsed.foods.length ? parsed.foods : emptyData().foods, dailyLogs: parsed.dailyLogs, purchases: parsed.purchases, settings: { proteinTarget: Number(parsed.settings.proteinTarget) > 0 ? Number(parsed.settings.proteinTarget) : 80, monthlyBudget: Number(parsed.settings.monthlyBudget) >= 0 ? Number(parsed.settings.monthlyBudget) : 4000, darkMode: parsed.settings.darkMode === true } };
  } catch { return emptyData(); }
};
export const saveData = async (data: AppData) => { try { await AsyncStorage.setItem(KEY, JSON.stringify(data)); } catch { /* Storage can be unavailable in restricted previews. */ } };