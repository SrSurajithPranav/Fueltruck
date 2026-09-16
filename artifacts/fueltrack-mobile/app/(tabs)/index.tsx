import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import {
  AppData,
  currency,
  dateLabel,
  emptyData,
  Food,
  FoodCategory,
  FoodEntry,
  foodCost,
  foodProtein,
  loadData,
  Meal,
  monthKey,
  Purchase,
  quantityText,
  saveData,
  shiftIso,
  todayIso,
} from '@/lib/storage';

type Page = 'today' | 'stats' | 'purchases' | 'settings';
const meals: Meal[] = ['Breakfast', 'Lunch', 'Evening', 'Dinner', 'Snack', 'Other'];
const categories: FoodCategory[] = ['Dairy', 'Eggs', 'Protein', 'Grains', 'Fruits & vegetables', 'Other'];

export default function FuelTrackHome() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<AppData | null>(null);
  const [page, setPage] = useState<Page>('today');
  const [date, setDate] = useState(todayIso());
  const [futureDateExplicit, setFutureDateExplicit] = useState(false);
  const [modal, setModal] = useState<'entry' | 'purchase' | 'food' | 'import' | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => { loadData().then(setData); }, []);
  if (!data) return <View style={styles.loading}><Text style={styles.logo}>FuelTrack</Text><Text style={styles.muted}>Loading your local journal…</Text></View>;

  const theme = data.settings.darkMode ? colors.dark : colors.light;
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(''), 2200); };
  const commit = (next: AppData, message?: string) => { setData(next); void saveData(next); if (message) notify(message); };
  const closeModal = () => { setModal(null); setEditingEntry(null); setEditingFood(null); };
  const log = data.dailyLogs[date]?.entries ?? [];
  const canLog = date <= todayIso() || futureDateExplicit;

  const addEntry = (entry: FoodEntry) => {
    const current = data.dailyLogs[date] ?? { date, entries: [] };
    commit({ ...data, dailyLogs: { ...data.dailyLogs, [date]: { ...current, entries: [...current.entries, entry] } } }, `${entry.foodNameSnapshot} added`);
    closeModal();
  };
  const updateEntry = (entry: FoodEntry) => {
    const current = data.dailyLogs[date];
    if (!current) return;
    commit({ ...data, dailyLogs: { ...data.dailyLogs, [date]: { ...current, entries: current.entries.map((item) => item.id === entry.id ? entry : item) } } }, 'Entry updated');
    closeModal();
  };
  const removeEntry = (id: string) => {
    const current = data.dailyLogs[date];
    if (!current) return;
    commit({ ...data, dailyLogs: { ...data.dailyLogs, [date]: { ...current, entries: current.entries.filter((item) => item.id !== id) } } }, 'Entry removed');
  };
  const repeatDay = (meal?: Meal) => {
    const source = data.dailyLogs[shiftIso(date, -1)];
    if (!source?.entries.length) return notify('Nothing logged yesterday');
    const copied = source.entries.filter((entry) => !meal || entry.meal === meal).map((entry) => ({ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString() }));
    const current = data.dailyLogs[date] ?? { date, entries: [] };
    commit({ ...data, dailyLogs: { ...data.dailyLogs, [date]: { ...current, entries: [...current.entries, ...copied] } } }, meal ? `${meal} repeated` : 'Yesterday repeated');
  };
  const addPurchase = (purchase: Purchase) => { commit({ ...data, purchases: [purchase, ...data.purchases] }, 'Purchase recorded'); closeModal(); };
  const saveFood = (food: Food) => {
    const foods = editingFood ? data.foods.map((item) => item.id === food.id ? food : item) : [...data.foods, food];
    commit({ ...data, foods }, editingFood ? 'Food updated' : 'Food added'); closeModal();
  };
  const deleteFood = (id: string) => {
    if (data.dailyLogs[date]?.entries.some((entry) => entry.foodId === id)) return notify('This food is used in this day');
    commit({ ...data, foods: data.foods.filter((item) => item.id !== id) }, 'Food removed');
  };
  const exportBackup = async () => {
    await Share.share({ title: 'FuelTrack backup', message: JSON.stringify(data, null, 2) });
  };
  const clearData = () => Alert.alert('Clear everything?', 'This removes your logs, purchases, and food library from this device.', [
    { text: 'Keep data', style: 'cancel' },
    { text: 'Clear data', style: 'destructive', onPress: () => { const next = emptyData(); next.settings.darkMode = data.settings.darkMode; commit(next, 'Data cleared'); } },
  ]);
  const importBackup = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as AppData;
      if (!Array.isArray(parsed.foods) || !parsed.dailyLogs || !Array.isArray(parsed.purchases) || !parsed.settings) throw new Error();
      commit({ foods: parsed.foods, dailyLogs: parsed.dailyLogs, purchases: parsed.purchases, settings: { proteinTarget: Number(parsed.settings.proteinTarget) || 80, monthlyBudget: Number(parsed.settings.monthlyBudget) || 4000, darkMode: parsed.settings.darkMode === true } }, 'Backup restored');
      setModal(null);
    } catch { notify('That is not a valid FuelTrack backup'); }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }} />
      <View style={styles.header}>
        <Pressable onPress={() => setPage('today')} style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: theme.primary }]}><Feather name="activity" size={18} color={theme.primaryForeground} /></View>
          <View><Text style={[styles.logo, { color: theme.foreground }]}>FuelTrack</Text><Text style={[styles.eyebrow, { color: theme.mutedForeground }]}>Food • Protein • Spend</Text></View>
        </Pressable>
        <Text style={[styles.local, { color: theme.mutedForeground }]}>LOCAL ONLY</Text>
      </View>
      <View style={styles.content}>
        {page === 'today' && <TodayScreen data={data} date={date} theme={theme} log={log} canLog={canLog} onAdd={() => canLog && setModal('entry')} onEdit={(entry) => { setEditingEntry(entry); setModal('entry'); }} onDelete={removeEntry} onRepeat={repeatDay} onRepeatMeal={repeatDay} onDateChange={(next, explicit) => { setDate(next); setFutureDateExplicit(explicit); }} />}
        {page === 'stats' && <StatsScreen data={data} theme={theme} />}
        {page === 'purchases' && <PurchasesScreen data={data} theme={theme} onAdd={() => setModal('purchase')} />}
        {page === 'settings' && <SettingsScreen data={data} theme={theme} onChange={commit} onEditFood={(food) => { setEditingFood(food); setModal('food'); }} onAddFood={() => setModal('food')} onDeleteFood={deleteFood} onExport={exportBackup} onImport={() => setModal('import')} onClear={clearData} />}
      </View>
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(8, insets.bottom) }]}>
        {([['today', 'Today', 'activity'], ['stats', 'Stats', 'trending-up'], ['purchases', 'Purchases', 'shopping-bag'], ['settings', 'Settings', 'settings']] as const).map(([key, label, icon]) => (
          <Pressable key={key} onPress={() => setPage(key)} style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}>
            <Feather name={icon} size={19} color={page === key ? theme.primary : theme.mutedForeground} />
            <Text style={[styles.tabLabel, { color: page === key ? theme.primary : theme.mutedForeground }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {toast ? <View style={[styles.toast, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryForeground, fontWeight: '700' }}>{toast}</Text></View> : null}
      <EntrySheet visible={modal === 'entry'} data={data} editing={editingEntry} date={date} theme={theme} onClose={closeModal} onSubmit={editingEntry ? updateEntry : addEntry} />
      <PurchaseSheet visible={modal === 'purchase'} data={data} theme={theme} onClose={closeModal} onSubmit={addPurchase} />
      <FoodSheet visible={modal === 'food'} food={editingFood} theme={theme} onClose={closeModal} onSubmit={saveFood} />
      <ImportSheet visible={modal === 'import'} theme={theme} onClose={closeModal} onImport={importBackup} />
    </View>
  );
}

function TodayScreen({ data, date, theme, log, canLog, onAdd, onEdit, onDelete, onRepeat, onRepeatMeal, onDateChange }: { data: AppData; date: string; theme: typeof colors.light; log: FoodEntry[]; canLog: boolean; onAdd: () => void; onEdit: (entry: FoodEntry) => void; onDelete: (id: string) => void; onRepeat: (meal?: Meal) => void; onRepeatMeal: (meal: Meal) => void; onDateChange: (date: string, explicit: boolean) => void }) {
  const protein = log.reduce((sum, item) => sum + item.protein, 0);
  const spend = log.reduce((sum, item) => sum + item.cost, 0);
  const percent = Math.min(100, data.settings.proteinTarget ? protein / data.settings.proteinTarget * 100 : 0);
  const today = date === todayIso();
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <View style={styles.titleRow}><View><Text style={[styles.eyebrow, { color: theme.primary }]}>{today ? 'YOUR DAILY FUEL' : 'LOOKING BACK'}</Text><Text style={[styles.title, { color: theme.foreground }]}>{today ? 'Today' : dateLabel(date)}</Text></View><RoundButton icon="plus" color={theme.accent} textColor={theme.accentForeground} onPress={onAdd} disabled={!canLog} /></View>
    <View style={[styles.dateBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <RoundButton icon="chevron-left" color="transparent" textColor={theme.mutedForeground} onPress={() => onDateChange(shiftIso(date, -1), false)} />
      <Pressable onPress={() => Alert.alert('Choose a date', 'Use the arrows to browse days. Future dates can be enabled from the calendar picker in the web version.') } style={styles.dateCenter}><Feather name="calendar" size={16} color={theme.primary} /><Text style={[styles.bodyBold, { color: theme.foreground }]}>{today ? 'Today' : dateLabel(date)}</Text></Pressable>
      <RoundButton icon="chevron-right" color="transparent" textColor={theme.mutedForeground} onPress={() => onDateChange(shiftIso(date, 1), false)} />
    </View>
    {date > todayIso() ? <View style={[styles.notice, { backgroundColor: theme.secondary }]}><Feather name="info" size={15} color={theme.primary} /><Text style={[styles.small, { color: theme.secondaryForeground }]}>{canLog ? 'Planned day enabled.' : 'Future day is view-only while browsing with arrows.'}</Text></View> : null}
    <View style={[styles.hero, { backgroundColor: theme.primary }]}>
      <View style={styles.heroTop}><View><Text style={styles.heroMuted}>Protein so far</Text><Text style={styles.heroNumber}>{quantityText(protein)}<Text style={styles.heroUnit}> g</Text></Text></View><View style={styles.targetPill}><Text style={styles.heroMuted}>TARGET</Text><Text style={styles.targetValue}>{quantityText(data.settings.proteinTarget)} g</Text></View></View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: theme.accent }]} /></View>
      <View style={styles.heroBottom}><Text style={styles.heroMuted}>{percent >= 100 ? 'Target reached' : `${quantityText(Math.max(0, data.settings.proteinTarget - protein))} g to go`}</Text><Text style={styles.heroMuted}>{Math.round(percent)}%</Text></View>
      <View style={styles.heroDivider} /><Text style={styles.heroBottomText}>{currency(spend)} spent <Text style={styles.heroDot}>·</Text> {log.length} {log.length === 1 ? 'item' : 'items'}</Text>
    </View>
    <View style={styles.twoCol}><ActionButton icon="plus" label="Add food" color={theme.accent} textColor={theme.accentForeground} onPress={onAdd} disabled={!canLog} /><ActionButton icon="repeat" label="Repeat yesterday" color={theme.card} textColor={theme.foreground} borderColor={theme.border} onPress={() => onRepeat()} disabled={!canLog} /></View>
    {meals.map((meal) => {
      const items = log.filter((entry) => entry.meal === meal);
      return <View key={meal} style={styles.mealSection}><View style={styles.mealHeader}><Text style={[styles.sectionTitle, { color: theme.foreground }]}>{meal}</Text>{items.length > 0 ? <Pressable onPress={() => onRepeatMeal(meal)} disabled={!canLog}><Text style={[styles.smallBold, { color: canLog ? theme.primary : theme.mutedForeground }]}>Repeat</Text></Pressable> : null}</View>{items.length === 0 ? <Pressable onPress={onAdd} disabled={!canLog} style={[styles.emptyMeal, { borderColor: theme.border, opacity: canLog ? 1 : 0.5 }]}><View style={[styles.miniIcon, { backgroundColor: theme.secondary }]}><Feather name="plus" size={15} color={theme.primary} /></View><Text style={[styles.body, { color: theme.mutedForeground }]}>Add something to {meal.toLowerCase()}</Text></Pressable> : items.map((entry) => <EntryRow key={entry.id} entry={entry} theme={theme} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry.id)} />)}</View>;
    })}
  </ScrollView>;
}

function EntryRow({ entry, theme, onEdit, onDelete }: { entry: FoodEntry; theme: typeof colors.light; onEdit: () => void; onDelete: () => void }) {
  return <View style={[styles.entryRow, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.entryText}><Text style={[styles.bodyBold, { color: theme.foreground }]}>{entry.foodNameSnapshot}</Text><Text style={[styles.small, { color: theme.mutedForeground }]}>{quantityText(entry.quantity)} {entry.unit} · {quantityText(entry.protein)} g protein</Text></View><View style={styles.entryRight}><Text style={[styles.bodyBold, { color: theme.foreground }]}>{currency(entry.cost)}</Text><Pressable onPress={() => Alert.alert(entry.foodNameSnapshot, 'Choose an action', [{ text: 'Cancel', style: 'cancel' }, { text: 'Edit', onPress: onEdit }, { text: 'Delete', style: 'destructive', onPress: onDelete }])}><Feather name="more-horizontal" size={20} color={theme.mutedForeground} /></Pressable></View></View>;
}

function StatsScreen({ data, theme }: { data: AppData; theme: typeof colors.light }) {
  const month = monthKey(todayIso());
  const logs = Object.values(data.dailyLogs).filter((log) => monthKey(log.date) === month);
  const totalProtein = logs.reduce((sum, log) => sum + log.entries.reduce((inner, entry) => inner + entry.protein, 0), 0);
  const totalSpend = logs.reduce((sum, log) => sum + log.entries.reduce((inner, entry) => inner + entry.cost, 0), 0);
  const activeDays = logs.filter((log) => log.entries.length).length;
  const targetDays = logs.filter((log) => log.entries.reduce((sum, entry) => sum + entry.protein, 0) >= data.settings.proteinTarget).length;
  const byCategory = data.foods.map((food) => ({ name: food.name, amount: logs.flatMap((log) => log.entries).filter((entry) => entry.foodId === food.id).reduce((sum, entry) => sum + entry.cost, 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projection = new Date().getDate() ? totalSpend / new Date().getDate() * daysInMonth : 0;
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><TitleBlock eyebrow="PATTERNS, NOT PRESSURE" title="Stats" theme={theme} /><View style={styles.metricGrid}><Metric label="Protein total" value={`${quantityText(totalProtein)} g`} theme={theme} icon="activity" /><Metric label="Avg protein / day" value={`${quantityText(activeDays ? totalProtein / activeDays : 0)} g`} theme={theme} icon="trending-up" /><Metric label="Avg spend / day" value={currency(activeDays ? totalSpend / activeDays : 0)} theme={theme} icon="credit-card" /><Metric label="Target days" value={`${targetDays}/${daysInMonth}`} theme={theme} icon="check" /></View><View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.eyebrow, { color: theme.mutedForeground }]}>SPENDING RHYTHM</Text><Text style={[styles.panelNumber, { color: theme.foreground }]}>{currency(totalSpend)}</Text><Text style={[styles.body, { color: theme.mutedForeground }]}>food logged this month</Text><View style={[styles.progressTrack, { backgroundColor: theme.secondary, marginTop: 18 }]}><View style={[styles.progressFill, { width: `${Math.min(100, data.settings.monthlyBudget ? totalSpend / data.settings.monthlyBudget * 100 : 0)}%`, backgroundColor: theme.accent }]} /></View><View style={styles.twoColText}><Text style={[styles.small, { color: theme.mutedForeground }]}>Budget {currency(data.settings.monthlyBudget)}</Text><Text style={[styles.smallBold, { color: theme.foreground }]}>{currency(Math.max(0, data.settings.monthlyBudget - totalSpend))} left</Text></View><View style={styles.statLine}><Text style={[styles.small, { color: theme.mutedForeground }]}>Projected monthly spend</Text><Text style={[styles.bodyBold, { color: theme.foreground }]}>{currency(projection)}</Text></View></View><SectionHeader title="By category" theme={theme} /><View style={styles.listGap}>{byCategory.length ? byCategory.map((item, index) => <View key={item.name} style={[styles.categoryRow, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={[styles.miniIcon, { backgroundColor: index === 0 ? theme.accent : theme.secondary }]}><Feather name="package" size={15} color={index === 0 ? theme.accentForeground : theme.primary} /></View><View style={{ flex: 1 }}><View style={styles.twoColText}><Text style={[styles.bodyBold, { color: theme.foreground }]}>{item.name}</Text><Text style={[styles.bodyBold, { color: theme.foreground }]}>{currency(item.amount)}</Text></View><View style={[styles.bar, { backgroundColor: theme.secondary }]}><View style={[styles.barFill, { width: `${totalSpend ? item.amount / totalSpend * 100 : 0}%`, backgroundColor: theme.primary }]} /></View></View></View>) : <EmptyState title="Your month is still quiet" body="Log a few meals and your spending rhythm will appear here." theme={theme} />}</View></ScrollView>;
}

function PurchasesScreen({ data, theme, onAdd }: { data: AppData; theme: typeof colors.light; onAdd: () => void }) {
  const history = Object.values(data.purchases.reduce<Record<string, Purchase[]>>((groups, item) => { (groups[item.foodId] ??= []).push(item); return groups; }, {}));
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><TitleBlock eyebrow="THE REAL RECEIPT" title="Purchases" theme={theme} action={<RoundButton icon="plus" color={theme.accent} textColor={theme.accentForeground} onPress={onAdd} />} /><ActionButton icon="shopping-bag" label="Record a purchase" color={theme.primary} textColor={theme.primaryForeground} onPress={onAdd} /><SectionHeader title="Recent purchases" theme={theme} />{data.purchases.length === 0 ? <EmptyState title="No receipts here yet" body="Record what you actually paid at the store. It stays separate from meal costs." theme={theme} /> : <View style={styles.listGap}>{data.purchases.slice(0, 12).map((purchase) => <View key={purchase.id} style={[styles.entryRow, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.entryText}><Text style={[styles.bodyBold, { color: theme.foreground }]}>{purchase.foodNameSnapshot}{purchase.brand ? ` · ${purchase.brand}` : ''}</Text><Text style={[styles.small, { color: theme.mutedForeground }]}>{dateLabel(purchase.date)} · {quantityText(purchase.quantity)} {purchase.unit}</Text></View><Text style={[styles.bodyBold, { color: theme.foreground }]}>{currency(purchase.price)}</Text></View>)}</View>}<SectionHeader title="Price history" theme={theme} />{history.length > 0 ? <View style={styles.listGap}>{history.map((items) => { const average = items.reduce((sum, item) => sum + item.price, 0) / items.length; const latest = items[0]; return <View key={latest.foodId} style={[styles.historyRow, { backgroundColor: theme.card, borderColor: theme.border }]}><View><Text style={[styles.bodyBold, { color: theme.foreground }]}>{latest.foodNameSnapshot}</Text><Text style={[styles.small, { color: theme.mutedForeground }]}>{items.length} purchase{items.length === 1 ? '' : 's'} · average paid {currency(average)}</Text></View><Text style={[styles.bodyBold, { color: theme.foreground }]}>{currency(latest.price)}</Text></View>; })}</View> : null}</ScrollView>;
}

function SettingsScreen({ data, theme, onChange, onEditFood, onAddFood, onDeleteFood, onExport, onImport, onClear }: { data: AppData; theme: typeof colors.light; onChange: (data: AppData, message?: string) => void; onEditFood: (food: Food) => void; onAddFood: () => void; onDeleteFood: (id: string) => void; onExport: () => void; onImport: () => void; onClear: () => void }) {
  const [target, setTarget] = useState(String(data.settings.proteinTarget));
  const [budget, setBudget] = useState(String(data.settings.monthlyBudget));
  const save = () => onChange({ ...data, settings: { ...data.settings, proteinTarget: Math.max(1, Number(target) || 80), monthlyBudget: Math.max(0, Number(budget) || 0) } }, 'Preferences saved');
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><TitleBlock eyebrow="YOUR RHYTHM, YOUR RULES" title="Settings" theme={theme} /><View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}><SectionHeader title="Daily preferences" theme={theme} /><View style={styles.formRow}><Input label="Protein target" value={target} onChangeText={setTarget} suffix="g" theme={theme} /><Input label="Monthly budget" value={budget} onChangeText={setBudget} suffix="₹" theme={theme} /></View><ActionButton label="Save preferences" color={theme.primary} textColor={theme.primaryForeground} onPress={save} /></View><View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.settingRow}><View><Text style={[styles.bodyBold, { color: theme.foreground }]}>Dark mode</Text><Text style={[styles.small, { color: theme.mutedForeground }]}>A softer evening palette.</Text></View><Switch value={data.settings.darkMode} onValueChange={(value) => onChange({ ...data, settings: { ...data.settings, darkMode: value } }, value ? 'Dark mode on' : 'Light mode on')} trackColor={{ false: theme.secondary, true: theme.primary }} thumbColor={theme.card} /></View></View><View style={styles.sectionHead}><View><Text style={[styles.eyebrow, { color: theme.primary }]}>REFERENCE SHELF</Text><Text style={[styles.sectionTitle, { color: theme.foreground }]}>Food database</Text></View><Pressable onPress={onAddFood}><Text style={[styles.smallBold, { color: theme.primary }]}>+ Add food</Text></Pressable></View><View style={styles.listGap}>{data.foods.map((food) => <View key={food.id} style={[styles.entryRow, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={styles.entryText}><Text style={[styles.bodyBold, { color: theme.foreground }]}>{food.name}</Text><Text style={[styles.small, { color: theme.mutedForeground }]}>{food.servingLabel} · {food.proteinOptional ? 'protein optional' : `${quantityText(food.proteinPerServing)} g protein`}</Text></View><View style={styles.iconActions}><Pressable onPress={() => onEditFood(food)}><Feather name="edit-2" size={17} color={theme.primary} /></Pressable><Pressable onPress={() => onDeleteFood(food.id)}><Feather name="trash-2" size={17} color={theme.destructive} /></Pressable></View></View>)}</View><View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}><SectionHeader title="Your data" theme={theme} /><Text style={[styles.body, { color: theme.mutedForeground }]}>Keep a copy, move devices, or start over.</Text><View style={styles.twoCol}><ActionButton icon="share" label="Export" color={theme.secondary} textColor={theme.foreground} onPress={onExport} /><ActionButton icon="upload" label="Import" color={theme.secondary} textColor={theme.foreground} onPress={onImport} /></View><ActionButton icon="trash-2" label="Clear all data" color="transparent" textColor={theme.destructive} borderColor={theme.destructive} onPress={onClear} /></View></ScrollView>;
}

function TitleBlock({ eyebrow, title, theme, action }: { eyebrow: string; title: string; theme: typeof colors.light; action?: React.ReactNode }) { return <View style={styles.titleRow}><View><Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow}</Text><Text style={[styles.title, { color: theme.foreground }]}>{title}</Text></View>{action}</View>; }
function SectionHeader({ title, theme }: { title: string; theme: typeof colors.light }) { return <Text style={[styles.sectionTitle, { color: theme.foreground, marginTop: 22, marginBottom: 10 }]}>{title}</Text>; }
function EmptyState({ title, body, theme }: { title: string; body: string; theme: typeof colors.light }) { return <View style={[styles.emptyState, { backgroundColor: theme.secondary }]}><Feather name="coffee" size={23} color={theme.primary} /><Text style={[styles.sectionTitle, { color: theme.foreground, marginTop: 8 }]}>{title}</Text><Text style={[styles.body, { color: theme.mutedForeground, textAlign: 'center', marginTop: 5 }]}>{body}</Text></View>; }
function Metric({ label, value, icon, theme }: { label: string; value: string; icon: 'activity' | 'trending-up' | 'credit-card' | 'check'; theme: typeof colors.light }) { return <View style={[styles.metric, { backgroundColor: theme.card, borderColor: theme.border }]}><Feather name={icon} size={16} color={theme.primary} /><Text style={[styles.metricValue, { color: theme.foreground }]}>{value}</Text><Text style={[styles.small, { color: theme.mutedForeground }]}>{label}</Text></View>; }
function RoundButton({ icon, color, textColor, onPress, disabled = false }: { icon: keyof typeof Feather.glyphMap; color: string; textColor: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.roundButton, { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}><Feather name={icon} size={20} color={textColor} /></Pressable>; }
function ActionButton({ icon, label, color, textColor, onPress, borderColor, disabled = false }: { icon?: keyof typeof Feather.glyphMap; label: string; color: string; textColor: string; onPress: () => void; borderColor?: string; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: color, borderColor: borderColor ?? color, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>{icon ? <Feather name={icon} size={17} color={textColor} /> : null}<Text style={[styles.bodyBold, { color: textColor }]}>{label}</Text></Pressable>; }
function Input({ label, value, onChangeText, suffix, theme, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; suffix?: string; theme: typeof colors.light; placeholder?: string }) { return <View style={{ flex: 1 }}><Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>{label}</Text><View style={[styles.inputWrap, { borderColor: theme.input, backgroundColor: theme.background }]}><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.mutedForeground} keyboardType="decimal-pad" style={[styles.input, { color: theme.foreground }]} />{suffix ? <Text style={[styles.small, { color: theme.mutedForeground }]}>{suffix}</Text> : null}</View></View>; }

function Sheet({ visible, title, theme, onClose, children }: { visible: boolean; title: string; theme: typeof colors.light; onClose: () => void; children: React.ReactNode }) { return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}><View style={[styles.sheet, { backgroundColor: theme.card }]}><View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: theme.foreground }]}>{title}</Text><Pressable onPress={onClose}><Feather name="x" size={22} color={theme.mutedForeground} /></Pressable></View>{children}</View></KeyboardAvoidingView></Modal>; }
function ChoiceRow({ items, selected, onSelect, theme }: { items: string[]; selected: string; onSelect: (value: string) => void; theme: typeof colors.light }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 3 }}>{items.map((item) => <Pressable key={item} onPress={() => onSelect(item)} style={[styles.choice, { backgroundColor: item === selected ? theme.primary : theme.secondary }]}><Text style={[styles.smallBold, { color: item === selected ? theme.primaryForeground : theme.secondaryForeground }]}>{item}</Text></Pressable>)}</ScrollView>; }
function EntrySheet({ visible, data, editing, theme, onClose, onSubmit }: { visible: boolean; data: AppData; editing: FoodEntry | null; date: string; theme: typeof colors.light; onClose: () => void; onSubmit: (entry: FoodEntry) => void }) {
  const initialFood = data.foods.find((item) => item.id === editing?.foodId) ?? data.foods[0];
  const [foodId, setFoodId] = useState(initialFood?.id ?? ''); const [meal, setMeal] = useState<Meal>(editing?.meal ?? 'Breakfast'); const [rawQuantity, setRawQuantity] = useState(String(editing?.quantity ?? initialFood?.servingQuantity ?? 1)); const [actualCost, setActualCost] = useState(editing?.actualPrice === undefined ? '' : String(editing.actualPrice)); const [protein, setProtein] = useState(editing?.protein ? String(editing.protein) : '');
  useEffect(() => { const item = data.foods.find((food) => food.id === foodId); if (!editing && item) { setRawQuantity(String(item.servingQuantity)); setActualCost(''); setProtein(''); } }, [foodId, data.foods, editing]);
  const item = data.foods.find((food) => food.id === foodId) ?? initialFood; if (!item) return null;
  const quantity = Math.max(0, Number(rawQuantity) || 0); const cost = foodCost(item, quantity, actualCost === '' ? undefined : Number(actualCost)); const grams = foodProtein(item, quantity, protein === '' ? undefined : Number(protein));
  return <Sheet visible={visible} title={editing ? 'Edit entry' : 'Add food'} theme={theme} onClose={onClose}><ScrollView contentContainerStyle={styles.sheetScroll}><Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Food</Text><ChoiceRow items={data.foods.map((food) => food.name)} selected={item.name} onSelect={(name) => setFoodId(data.foods.find((food) => food.name === name)?.id ?? foodId)} theme={theme} /><Text style={[styles.inputLabel, { color: theme.mutedForeground, marginTop: 12 }]}>Meal</Text><ChoiceRow items={meals} selected={meal} onSelect={(value) => setMeal(value as Meal)} theme={theme} /><View style={styles.formRow}><Input label={`Quantity (${item.servingUnit})`} value={String(quantity)} onChangeText={setRawQuantity} theme={theme} /><Input label="Actual cost" value={actualCost} onChangeText={setActualCost} suffix="₹" theme={theme} placeholder={quantityText(foodCost(item, quantity))} /></View>{item.proteinOptional ? <Input label="Protein (optional)" value={protein} onChangeText={setProtein} suffix="g" theme={theme} /> : null}<View style={[styles.summaryBox, { backgroundColor: theme.secondary }]}><Text style={[styles.body, { color: theme.secondaryForeground }]}>This adds {quantityText(grams)} g protein · counts {currency(cost)}</Text></View><ActionButton label={editing ? 'Save changes' : 'Add to day'} color={theme.primary} textColor={theme.primaryForeground} onPress={() => onSubmit({ id: editing?.id ?? `${Date.now()}`, foodId: item.id, foodNameSnapshot: item.name, meal, quantity, unit: item.servingUnit, protein: grams, cost, actualPrice: actualCost === '' ? undefined : Number(actualCost), createdAt: editing?.createdAt ?? new Date().toISOString() })} /></ScrollView></Sheet>;
}

function PurchaseSheet({ visible, data, theme, onClose, onSubmit }: { visible: boolean; data: AppData; theme: typeof colors.light; onClose: () => void; onSubmit: (purchase: Purchase) => void }) {
  const [foodId, setFoodId] = useState(data.foods[0]?.id ?? ''); const [date, setDate] = useState(todayIso()); const [quantity, setQuantity] = useState('1'); const [brand, setBrand] = useState(''); const [price, setPrice] = useState(''); const item = data.foods.find((food) => food.id === foodId) ?? data.foods[0];
  if (!item) return null;
  return <Sheet visible={visible} title="Record a purchase" theme={theme} onClose={onClose}><ScrollView contentContainerStyle={styles.sheetScroll}><Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Food</Text><ChoiceRow items={data.foods.map((food) => food.name)} selected={item.name} onSelect={(name) => setFoodId(data.foods.find((food) => food.name === name)?.id ?? foodId)} theme={theme} /><View style={styles.formRow}><Input label="Date" value={date} onChangeText={setDate} theme={theme} placeholder="YYYY-MM-DD" /><Input label={`Quantity (${item.priceUnit})`} value={quantity} onChangeText={setQuantity} theme={theme} /></View><Input label="Brand (optional)" value={brand} onChangeText={setBrand} theme={theme} placeholder="e.g. local dairy" /><Input label="Price paid" value={price} onChangeText={setPrice} suffix="₹" theme={theme} placeholder="0" /><ActionButton label="Save purchase" color={theme.primary} textColor={theme.primaryForeground} onPress={() => onSubmit({ id: `${Date.now()}`, date, foodId: item.id, foodNameSnapshot: item.name, quantity: Math.max(0, Number(quantity) || 0), unit: item.priceUnit, brand: brand.trim(), price: Math.max(0, Number(price) || 0) })} /></ScrollView></Sheet>;
}

function FoodSheet({ visible, food, theme, onClose, onSubmit }: { visible: boolean; food: Food | null; theme: typeof colors.light; onClose: () => void; onSubmit: (food: Food) => void }) {
  const [name, setName] = useState(food?.name ?? ''); const [category, setCategory] = useState<FoodCategory>(food?.category ?? 'Other'); const [servingLabel, setServingLabel] = useState(food?.servingLabel ?? ''); const [servingQuantity, setServingQuantity] = useState(String(food?.servingQuantity ?? 1)); const [servingUnit, setServingUnit] = useState(food?.servingUnit ?? 'portion'); const [protein, setProtein] = useState(String(food?.proteinPerServing ?? 0)); const [price, setPrice] = useState(String(food?.defaultPrice ?? 0)); const [priceQuantity, setPriceQuantity] = useState(String(food?.priceQuantity ?? 1)); const [priceUnit, setPriceUnit] = useState(food?.priceUnit ?? 'portion');
  return <Sheet visible={visible} title={food ? 'Edit food' : 'Add a food'} theme={theme} onClose={onClose}><ScrollView contentContainerStyle={styles.sheetScroll}><Input label="Name" value={name} onChangeText={setName} theme={theme} placeholder="e.g. Paneer" /><Text style={[styles.inputLabel, { color: theme.mutedForeground, marginTop: 12 }]}>Category</Text><ChoiceRow items={categories} selected={category} onSelect={(value) => setCategory(value as FoodCategory)} theme={theme} /><View style={styles.formRow}><Input label="Serving label" value={servingLabel} onChangeText={setServingLabel} theme={theme} placeholder="100 g" /><Input label="Serving quantity" value={servingQuantity} onChangeText={setServingQuantity} theme={theme} /></View><View style={styles.formRow}><Input label="Serving unit" value={servingUnit} onChangeText={setServingUnit} theme={theme} /><Input label="Protein / serving" value={protein} onChangeText={setProtein} suffix="g" theme={theme} /></View><View style={styles.formRow}><Input label="Default price" value={price} onChangeText={setPrice} suffix="₹" theme={theme} /><Input label="Price quantity" value={priceQuantity} onChangeText={setPriceQuantity} theme={theme} /></View><Input label="Price unit" value={priceUnit} onChangeText={setPriceUnit} theme={theme} /><ActionButton label="Save food" color={theme.primary} textColor={theme.primaryForeground} onPress={() => onSubmit({ id: food?.id ?? `${Date.now()}`, name: name.trim() || 'New food', category, servingLabel: servingLabel.trim() || `${servingQuantity} ${servingUnit}`, servingQuantity: Math.max(0.01, Number(servingQuantity) || 1), servingUnit: servingUnit.trim() || 'portion', proteinPerServing: Math.max(0, Number(protein) || 0), defaultPrice: Math.max(0, Number(price) || 0), priceQuantity: Math.max(0.01, Number(priceQuantity) || 1), priceUnit: priceUnit.trim() || 'portion', manualCost: food?.manualCost ?? false, proteinOptional: food?.proteinOptional ?? false })} /></ScrollView></Sheet>;
}

function ImportSheet({ visible, theme, onClose, onImport }: { visible: boolean; theme: typeof colors.light; onClose: () => void; onImport: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <Sheet visible={visible} title="Restore a backup" theme={theme} onClose={onClose}><Text style={[styles.body, { color: theme.mutedForeground }]}>Paste the JSON from a FuelTrack export below.</Text><TextInput multiline value={value} onChangeText={setValue} placeholder="{ ... }" placeholderTextColor={theme.mutedForeground} style={[styles.textArea, { color: theme.foreground, borderColor: theme.input, backgroundColor: theme.background }]} /><ActionButton label="Restore backup" color={theme.primary} textColor={theme.primaryForeground} onPress={() => onImport(value)} /></Sheet>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F8F5EF' }, muted: { fontSize: 14, color: '#66716C' }, content: { flex: 1 }, header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandMark: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, logo: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, local: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }, scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 116 }, titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }, title: { fontSize: 38, fontWeight: '800', letterSpacing: -1.1, marginTop: 5 }, roundButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, dateBar: { height: 56, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5, marginBottom: 14 }, dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }, hero: { borderRadius: 25, padding: 20, marginBottom: 14 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between' }, heroMuted: { color: 'rgba(252,248,239,.7)', fontSize: 12 }, heroNumber: { color: '#FCF8EF', fontSize: 43, fontWeight: '800', letterSpacing: -1 }, heroUnit: { fontSize: 17, fontWeight: '500' }, targetPill: { backgroundColor: 'rgba(252,248,239,.12)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'flex-end' }, targetValue: { color: '#FCF8EF', fontSize: 16, fontWeight: '800', marginTop: 2 }, progressTrack: { height: 8, borderRadius: 9, backgroundColor: 'rgba(252,248,239,.16)', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 9 }, heroBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }, heroDivider: { height: 1, backgroundColor: 'rgba(252,248,239,.16)', marginTop: 17, marginBottom: 13 }, heroBottomText: { color: '#FCF8EF', fontSize: 13, fontWeight: '700' }, heroDot: { color: 'rgba(252,248,239,.35)' }, twoCol: { flexDirection: 'row', gap: 10, marginBottom: 22 }, actionButton: { minHeight: 49, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 15, marginTop: 10, flex: 1 }, mealSection: { marginBottom: 19 }, mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, sectionTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 }, smallBold: { fontSize: 12, fontWeight: '800' }, small: { fontSize: 12, lineHeight: 17 }, body: { fontSize: 14, lineHeight: 20 }, bodyBold: { fontSize: 14, fontWeight: '700' }, emptyMeal: { minHeight: 57, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13 }, miniIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, entryRow: { minHeight: 62, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }, entryText: { flex: 1, paddingRight: 12 }, entryRight: { flexDirection: 'row', alignItems: 'center', gap: 10 }, notice: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 }, tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 9 }, tab: { alignItems: 'center', gap: 4, minWidth: 70 }, tabLabel: { fontSize: 10, fontWeight: '700' }, toast: { position: 'absolute', bottom: 96, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 12, borderRadius: 30 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '48%', borderWidth: 1, borderRadius: 16, padding: 13, minHeight: 99 }, metricValue: { fontSize: 19, fontWeight: '800', marginTop: 8, marginBottom: 3 }, panel: { borderWidth: 1, borderRadius: 23, padding: 18, marginTop: 16 }, panelNumber: { fontSize: 31, fontWeight: '800', marginTop: 7 }, twoColText: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, statLine: { borderTopWidth: 1, borderTopColor: 'rgba(100,100,100,.16)', marginTop: 15, paddingTop: 13, flexDirection: 'row', justifyContent: 'space-between' }, bar: { height: 5, borderRadius: 8, overflow: 'hidden', marginTop: 8 }, barFill: { height: '100%', borderRadius: 8 }, categoryRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, listGap: { gap: 2 }, historyRow: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 21, marginBottom: 9 }, settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconActions: { flexDirection: 'row', gap: 16 }, formRow: { flexDirection: 'row', gap: 10, marginTop: 13 }, inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6, marginTop: 4 }, inputWrap: { height: 46, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 }, input: { flex: 1, fontSize: 15 }, choice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 }, summaryBox: { padding: 13, borderRadius: 14, marginTop: 15 }, emptyState: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 32, alignItems: 'center' }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(25,35,31,.38)' }, sheet: { borderTopLeftRadius: 27, borderTopRightRadius: 27, maxHeight: '92%', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, sheetTitle: { fontSize: 23, fontWeight: '800' }, sheetScroll: { paddingBottom: 18, gap: 3 }, textArea: { minHeight: 170, borderWidth: 1, borderRadius: 15, padding: 12, textAlignVertical: 'top', marginTop: 12, marginBottom: 8 },
});