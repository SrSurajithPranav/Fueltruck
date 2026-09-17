import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Router as WouterRouter, useLocation } from 'wouter';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Coffee,
  Download,
  Edit3,
  FileUp,
  Flame,
  FolderOpen,
  IndianRupee,
  Leaf,
  Mic,
  MicOff,
  Moon,
  MoreHorizontal,
  Package,
  PackageOpen,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  ShoppingBasket,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  type AppData,
  type Food,
  type FoodCategory,
  type FoodEntry,
  type Meal,
  type Purchase,
  currency,
  foodCost,
  foodProtein,
  formatDay,
  loadData,
  monthKey,
  monthLabel,
  quantityText,
  saveData,
  shiftIso,
  todayIso,
} from '@/lib/storage';
import { applyVoicePlan, parseVoicePlan, validateVoicePlan, type VoicePlan } from '@/lib/voice-actions';

type Page = 'today' | 'stats' | 'purchases' | 'settings';
type Toast = { message: string; tone?: 'good' | 'warn' };
type VoiceMealItem = { food: Food; quantity: number; isNew: boolean };
type VoiceCommand =
  | { kind: 'meal'; transcript: string; date: string; meal: Meal; items: VoiceMealItem[] }
  | { kind: 'purchase'; transcript: string; date: string; food: Food; quantity: number; price: number; isNew: boolean };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const meals: Meal[] = ['Breakfast', 'Lunch', 'Evening', 'Dinner', 'Snack', 'Other'];
const categories: FoodCategory[] = ['Dairy', 'Eggs', 'Protein', 'Grains', 'Fruits & vegetables', 'Other'];

function FuelTrackApp() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [location, setLocation] = useLocation();
  const [date, setDate] = useState(todayIso());
  const [futureDateExplicit, setFutureDateExplicit] = useState(false);
  const [modal, setModal] = useState<'entry' | 'purchase' | 'food' | 'import' | 'clear' | 'voice' | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [voiceCommand, setVoiceCommand] = useState<VoicePlan | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const page: Page = location === '/stats' ? 'stats' : location === '/purchases' ? 'purchases' : location === '/settings' ? 'settings' : 'today';
  const notify = (message: string, tone: Toast['tone'] = 'good') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };
  const updateData = (next: AppData, message?: string) => {
    setData(next);
    saveData(next);
    if (message) notify(message);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.settings.darkMode);
  }, [data.settings.darkMode]);

  const closeModal = () => { setModal(null); setEditingEntry(null); setEditingFood(null); setVoiceCommand(null); };
  const navigate = (next: Page) => setLocation(next === 'today' ? '/' : `/${next}`);

  const addEntry = (entry: FoodEntry) => {
    const log = data.dailyLogs[date] ?? { date, entries: [] };
    updateData({ ...data, dailyLogs: { ...data.dailyLogs, [date]: { ...log, entries: [...log.entries, entry] } } }, `${entry.foodNameSnapshot} added`);
    closeModal();
  };
  const updateEntry = (entry: FoodEntry) => {
    const log = data.dailyLogs[date];
    if (!log) return;
    updateData({ ...data, dailyLogs: { ...data.dailyLogs, [date]: { ...log, entries: log.entries.map((item) => item.id === entry.id ? entry : item) } } }, 'Entry updated');
    closeModal();
  };
  const deleteEntry = (entryId: string) => {
    const log = data.dailyLogs[date];
    if (!log) return;
    updateData({ ...data, dailyLogs: { ...data.dailyLogs, [date]: { ...log, entries: log.entries.filter((item) => item.id !== entryId) } } }, 'Entry removed');
  };
  const duplicateDay = (sourceDate: string, targetDate: string, meal?: Meal) => {
    const source = data.dailyLogs[sourceDate];
    if (!source || source.entries.length === 0) { notify('Nothing logged to repeat yet', 'warn'); return; }
    const copied = source.entries.filter((entry) => !meal || entry.meal === meal).map((entry) => ({ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }));
    const current = data.dailyLogs[targetDate] ?? { date: targetDate, entries: [] };
    updateData({ ...data, dailyLogs: { ...data.dailyLogs, [targetDate]: { date: targetDate, entries: [...current.entries, ...copied] } } }, meal ? `${meal} repeated` : 'Yesterday repeated');
  };
  const addPurchase = (purchase: Purchase) => {
    updateData({ ...data, purchases: [purchase, ...data.purchases], inventory: { ...data.inventory, [purchase.foodId]: (data.inventory[purchase.foodId] ?? 0) + purchase.quantity } }, 'Purchase recorded');
    closeModal();
  };
  const saveFood = (food: Food) => {
    const foods = editingFood ? data.foods.map((item) => item.id === food.id ? food : item) : [...data.foods, food];
    updateData({ ...data, foods }, editingFood ? 'Food updated' : 'Food added');
    closeModal();
  };
  const removeFood = (foodId: string) => {
    if (data.dailyLogs[date]?.entries.some((entry) => entry.foodId === foodId)) { notify('This food is used in a log and cannot be removed', 'warn'); return; }
    updateData({ ...data, foods: data.foods.filter((food) => food.id !== foodId) }, 'Food removed');
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fueltrack-backup-${todayIso()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Backup downloaded');
  };
  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<AppData>;
        if (!Array.isArray(parsed.foods) || !parsed.dailyLogs || !Array.isArray(parsed.purchases) || !parsed.settings) throw new Error('Invalid');
        const imported: AppData = { foods: parsed.foods, dailyLogs: parsed.dailyLogs, purchases: parsed.purchases, inventory: parsed.inventory ?? {}, settings: { proteinTarget: Number(parsed.settings.proteinTarget) || 80, monthlyBudget: Number(parsed.settings.monthlyBudget) || 4000, darkMode: parsed.settings.darkMode === true } };
        updateData(imported, 'Backup restored');
        setModal(null);
      } catch { notify('That file is not a FuelTrack backup', 'warn'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Shell page={page} navigate={navigate}>
        {page === 'today' && (
          <TodayPage
            data={data}
            date={date}
            onAdd={() => setModal('entry')}
            onVoice={() => setModal('voice')}
            onSuggestion={() => { setVoiceCommand(parseVoicePlan('What should I eat for dinner?', data)); setModal('voice'); }}
            onEdit={(entry) => { setEditingEntry(entry); setModal('entry'); }}
            onDelete={deleteEntry}
            onRepeat={() => duplicateDay(shiftIso(date, -1), date)}
            onRepeatMeal={(meal) => duplicateDay(shiftIso(date, -1), date, meal)}
            futureDateExplicit={futureDateExplicit}
            onArrowDateChange={(nextDate) => { setDate(nextDate); setFutureDateExplicit(false); }}
            onPickerDateChange={(nextDate) => { setDate(nextDate); setFutureDateExplicit(nextDate > todayIso()); }}
          />
        )}
        {page === 'stats' && <StatsPage data={data} />}
        {page === 'purchases' && <PurchasesPage data={data} onAdd={() => setModal('purchase')} />}
        {page === 'settings' && (
          <SettingsPage
            data={data}
            onDataChange={updateData}
            onEditFood={(food) => { setEditingFood(food); setModal('food'); }}
            onAddFood={() => setModal('food')}
            onDeleteFood={removeFood}
            onExport={exportData}
            onImport={() => setModal('import')}
            onClear={() => setModal('clear')}
          />
        )}
      </Shell>

      {modal === 'entry' && (
        <EntryModal data={data} date={date} editing={editingEntry} onClose={closeModal} onSubmit={editingEntry ? updateEntry : addEntry} />
      )}
      {modal === 'purchase' && <PurchaseModal data={data} onClose={closeModal} onSubmit={addPurchase} />}
      {modal === 'voice' && <UniversalVoiceModal data={data} initialPlan={voiceCommand} onClose={closeModal} onPlanChange={setVoiceCommand} onSubmit={(plan) => {
        try {
          const result = applyVoicePlan(plan, data);
          updateData(result.data, [...result.messages, ...result.queryResults].join(' · ') || 'Voice action complete');
          closeModal();
        } catch (error) {
          notify(error instanceof Error ? error.message : 'That action needs more detail', 'warn');
        }
      }} />}
      {modal === 'food' && <FoodModal food={editingFood} onClose={closeModal} onSubmit={saveFood} />}
      {modal === 'import' && (
        <Modal title="Restore a backup" onClose={closeModal}>
          <div className="rounded-2xl bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
            Choose a FuelTrack JSON backup. Restoring replaces the data on this device.
          </div>
          <button data-testid="button-choose-import" className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground" onClick={() => fileRef.current?.click()}><FileUp size={18} /> Choose backup</button>
          <input data-testid="input-import-file" ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => event.target.files?.[0] && importData(event.target.files[0])} />
        </Modal>
      )}
      {modal === 'clear' && (
        <Modal title="Clear everything?" onClose={closeModal}>
          <p className="text-sm leading-6 text-muted-foreground">This removes food logs, purchases, and your food library from this browser. It cannot be undone.</p>
          <div className="mt-6 flex gap-3">
            <button data-testid="button-cancel-clear" className="flex-1 rounded-2xl border border-border px-4 py-3 font-semibold" onClick={closeModal}>Keep data</button>
            <button data-testid="button-confirm-clear" className="flex-1 rounded-2xl bg-destructive px-4 py-3 font-semibold text-destructive-foreground" onClick={() => { updateData({ foods: [], dailyLogs: {}, purchases: [], inventory: {}, settings: { proteinTarget: 80, monthlyBudget: 4000, darkMode: data.settings.darkMode } }); closeModal(); notify('Data cleared'); }}>Clear data</button>
          </div>
        </Modal>
      )}
      {toast && <div role="status" data-testid="status-toast" className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-3 text-sm font-semibold shadow-float ${toast.tone === 'warn' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{toast.message}</div>}
    </div>
  );
}

function Shell({ page, navigate, children }: { page: Page; navigate: (page: Page) => void; children: ReactNode }) {
  const items: { page: Page; label: string; icon: typeof Flame }[] = [
    { page: 'today', label: 'Today', icon: Flame },
    { page: 'stats', label: 'Stats', icon: TrendingUp },
    { page: 'purchases', label: 'Purchases', icon: ShoppingBasket },
    { page: 'settings', label: 'Settings', icon: SettingsIcon },
  ];
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[1400px]">
      <aside className="hidden w-[238px] shrink-0 flex-col border-r border-border/70 bg-card/50 px-5 py-8 md:flex">
        <button data-testid="button-brand" onClick={() => navigate('today')} className="mb-12 flex items-center gap-3 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-sm"><Flame size={21} strokeWidth={2.4} /></span>
          <span><span className="block font-display text-xl font-bold tracking-tight">FuelTrack</span><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">eat with intent</span></span>
        </button>
        <nav className="space-y-2">
          {items.map(({ page: itemPage, label, icon: Icon }) => <NavItem key={itemPage} active={page === itemPage} label={label} icon={<Icon size={18} />} onClick={() => navigate(itemPage)} />)}
        </nav>
        <div className="mt-auto rounded-2xl bg-secondary/50 p-4 text-sm">
          <Leaf size={17} className="mb-3 text-primary" />
          <p className="font-display text-base font-semibold leading-5">A little record, a lot of clarity.</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Your data stays on this device.</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-24 md:pb-8">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/90 px-5 py-4 backdrop-blur-md md:hidden">
          <button data-testid="button-mobile-brand" onClick={() => navigate('today')} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-primary text-primary-foreground"><Flame size={17} /></span>
            <span className="font-display text-lg font-bold">FuelTrack</span>
          </button>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">local only</span>
        </header>
        <div className="mx-auto max-w-[980px] px-5 py-7 sm:px-8 md:px-12 md:py-10">{children}</div>
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border/70 bg-card/95 px-2 pt-2 backdrop-blur-lg md:hidden">
        {items.map(({ page: itemPage, label, icon: Icon }) => <button data-testid={`nav-${itemPage}`} key={itemPage} onClick={() => navigate(itemPage)} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition ${page === itemPage ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={19} strokeWidth={page === itemPage ? 2.5 : 1.8} /><span>{label}</span></button>)}
      </nav>
    </div>
  );
}

function NavItem({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return <button data-testid={`nav-side-${label.toLowerCase()}`} onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}`}>{icon}<span>{label}</span></button>;
}

function normaliseVoiceText(value: string) {
  return value.toLowerCase().replace(/[₹,]/g, '').replace(/\s+/g, ' ').trim();
}

function customFoodFromVoice(name: string): Food {
  const cleanName = name.replace(/\b(today|yesterday|this morning|tonight)\b/gi, '').replace(/^(some|a|an|the)\s+/i, '').trim();
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-food';
  return { id: `voice-${slug}-${Date.now()}`, name: cleanName || 'Voice-added food', category: 'Other', servingLabel: '1 portion', servingQuantity: 1, servingUnit: 'portion', proteinPerServing: 0, defaultPrice: 0, priceQuantity: 1, priceUnit: 'portion', manualCost: true, proteinOptional: true };
}

function mentionedFood(text: string, foods: Food[]) {
  return foods.flatMap((food) => food.name.split('/').map((term) => ({ food, term: term.trim().toLowerCase() }))).sort((a, b) => b.term.length - a.term.length).find(({ term }) => term && text.includes(term));
}

function inferVoiceMeal(text: string): Meal {
  if (/\bbreakfast\b/.test(text)) return 'Breakfast';
  if (/\blunch\b/.test(text)) return 'Lunch';
  if (/\bevening|tea time\b/.test(text)) return 'Evening';
  if (/\bdinner\b/.test(text)) return 'Dinner';
  if (/\bsnack\b/.test(text)) return 'Snack';
  const hour = new Date().getHours();
  return hour < 11 ? 'Breakfast' : hour < 16 ? 'Lunch' : hour < 19 ? 'Evening' : 'Dinner';
}

function parseVoiceCommand(transcript: string, data: AppData): VoiceCommand | null {
  const text = normaliseVoiceText(transcript);
  if (!text) return null;
  const date = /\byesterday\b/.test(text) ? shiftIso(todayIso(), -1) : todayIso();
  const purchaseMatch = text.match(/\b(bought|buy|purchased|purchase|got)\b/);
  if (purchaseMatch) {
    const priceMatch = text.match(/\b(?:for|at|cost(?:ing)?|paid)\s*(?:rs\.?|inr|rupees?)?\s*(\d+(?:\.\d+)?)/);
    const verbEnd = (purchaseMatch.index ?? 0) + purchaseMatch[0].length;
    let itemText = text.slice(verbEnd).split(/\b(?:for|at|cost|paid)\b/)[0].replace(/\b(today|yesterday)\b/g, '').trim();
    const quantityMatch = itemText.match(/^(\d+(?:\.\d+)?)\s+/);
    const quantity = quantityMatch ? Math.max(0.01, Number(quantityMatch[1])) : 1;
    if (quantityMatch) itemText = itemText.slice(quantityMatch[0].length).trim();
    const known = mentionedFood(itemText, data.foods);
    return { kind: 'purchase', transcript, date, food: known?.food ?? customFoodFromVoice(itemText), quantity, price: priceMatch ? Math.max(0, Number(priceMatch[1])) : 0, isNew: !known };
  }
  const meal = inferVoiceMeal(text);
  const itemText = text.replace(/^.*?\b(ate|eat|had|have|consumed|finished)\b/, '').replace(/\bfor\s+(breakfast|lunch|evening|dinner|snack)\b/g, '').replace(/\b(today|yesterday)\b/g, '').trim();
  if (!itemText) return null;
  const parts = itemText.split(/\s*(?:with|and|,|\+)\s*/).map((part) => part.trim()).filter(Boolean);
  const items = parts.map((part) => {
    const quantityMatch = part.match(/^(\d+(?:\.\d+)?)\s+/);
    const quantity = quantityMatch ? Math.max(0.01, Number(quantityMatch[1])) : 1;
    const namedText = quantityMatch ? part.slice(quantityMatch[0].length).trim() : part;
    const known = mentionedFood(namedText, data.foods);
    return { food: known?.food ?? customFoodFromVoice(namedText), quantity, isNew: !known };
  }).filter((item) => item.food.name.length > 0);
  return items.length ? { kind: 'meal', transcript, date, meal, items } : null;
}

function VoiceModal({ data, initialCommand, onClose, onCommandChange, onSubmit }: { data: AppData; initialCommand: VoiceCommand | null; onClose: () => void; onCommandChange: (command: VoiceCommand | null) => void; onSubmit: (command: VoiceCommand) => void }) {
  const [transcript, setTranscript] = useState(initialCommand?.transcript ?? '');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechApi = typeof window !== 'undefined' ? window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } : null;
  const Recognition = speechApi?.SpeechRecognition ?? speechApi?.webkitSpeechRecognition;
  useEffect(() => () => recognitionRef.current?.stop(), []);
  const parse = (value: string) => { setTranscript(value); onCommandChange(parseVoiceCommand(value, data)); };
  const startListening = () => {
    if (!Recognition) { setError('Voice recognition is unavailable in this browser. You can still type the sentence below.'); return; }
    const recognition = new Recognition();
    recognition.lang = 'en-IN'; recognition.continuous = false; recognition.interimResults = true;
    recognition.onresult = (event) => parse(Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' '));
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError('I could not hear that clearly. Try again or edit the text.'); };
    recognitionRef.current = recognition; setError(''); setListening(true);
    try { recognition.start(); } catch { setListening(false); setError('The microphone is already in use. Try again.'); }
  };
  const command = parseVoiceCommand(transcript, data);
  return <Modal title="Add by voice" onClose={onClose}><div className="rounded-2xl bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">Say what you ate, bought, or paid for. FuelTrack will turn it into a reviewable entry before saving.</div><div className="my-5 flex justify-center"><button data-testid="button-voice-listen" aria-label={listening ? 'Stop listening' : 'Start listening'} onClick={listening ? () => recognitionRef.current?.stop() : startListening} className={`grid h-20 w-20 place-items-center rounded-full shadow-float transition ${listening ? 'animate-pulse bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground hover:scale-105'}`}>{listening ? <MicOff size={30} /> : <Mic size={30} />}</button></div><p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">{listening ? 'Listening…' : Recognition ? 'Tap to speak' : 'Voice unavailable — type instead'}</p><textarea data-testid="input-voice-transcript" value={transcript} onChange={(event) => parse(event.target.value)} placeholder='“I ate 5 dosa with curd for breakfast”' className="input min-h-24 resize-y py-3" />{error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}{command && <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">{command.kind === 'meal' ? <><div className="flex items-center justify-between"><p className="text-sm font-bold">Meal · {command.meal}</p><span className="text-xs text-muted-foreground">{formatDay(command.date)}</span></div><div className="mt-3 space-y-2">{command.items.map((item) => <div key={`${item.food.id}-${item.quantity}`} className="flex items-center justify-between text-sm"><span>{quantityText(item.quantity)} × {item.food.name}</span>{item.isNew && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">new food</span>}</div>)}</div></> : <><div className="flex items-center justify-between"><p className="text-sm font-bold">Purchase</p><span className="text-xs text-muted-foreground">{formatDay(command.date)}</span></div><div className="mt-3 flex items-center justify-between text-sm"><span>{quantityText(command.quantity)} × {command.food.name}</span><span className="font-bold">{currency(command.price)}</span></div>{command.isNew && <p className="mt-2 text-xs font-semibold text-primary">This will create a custom food automatically.</p>}</>}</div>}{command && <button data-testid="button-confirm-voice" onClick={() => onSubmit(command)} className="mt-5 w-full rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground">Confirm and save</button>}</Modal>;
}

function UniversalVoiceModal({ data, initialPlan, onClose, onPlanChange, onSubmit }: { data: AppData; initialPlan: VoicePlan | null; onClose: () => void; onPlanChange: (plan: VoicePlan | null) => void; onSubmit: (plan: VoicePlan) => void }) {
  const [transcript, setTranscript] = useState(initialPlan?.transcript ?? '');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechApi = typeof window !== 'undefined' ? window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } : null;
  const Recognition = speechApi?.SpeechRecognition ?? speechApi?.webkitSpeechRecognition;
  useEffect(() => () => recognitionRef.current?.stop(), []);
  const parse = (value: string) => { setTranscript(value); onPlanChange(value.trim() ? parseVoicePlan(value, data) : null); };
  const startListening = () => {
    if (!Recognition) { setError('Voice recognition is unavailable in this browser. You can still type below.'); return; }
    const recognition = new Recognition();
    recognition.lang = 'en-IN'; recognition.continuous = false; recognition.interimResults = true;
    recognition.onresult = (event) => parse(Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' '));
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError('I could not hear that clearly. Try again or edit the text.'); };
    recognitionRef.current = recognition; setError(''); setListening(true);
    try { recognition.start(); } catch { setListening(false); setError('The microphone is already in use. Try again.'); }
  };
  const plan = transcript.trim() ? parseVoicePlan(transcript, data) : null;
  const validationError = plan ? validateVoicePlan(plan) : null;
  return <Modal title="Tell FuelTrack" onClose={onClose}>
    <div className="rounded-2xl bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">Describe meals, purchases, targets, questions, or several actions in one sentence. Review it before anything is saved.</div>
    <div className="my-5 flex justify-center"><button data-testid="button-voice-listen-universal" aria-label={listening ? 'Stop listening' : 'Start listening'} onClick={listening ? () => recognitionRef.current?.stop() : startListening} className={`grid h-20 w-20 place-items-center rounded-full shadow-float transition ${listening ? 'animate-pulse bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground hover:scale-105'}`}>{listening ? <MicOff size={30} /> : <Mic size={30} />}</button></div>
    <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">{listening ? 'Listening...' : Recognition ? 'Tap to speak' : 'Voice unavailable - type instead'}</p>
    <textarea data-testid="input-universal-voice" value={transcript} onChange={(event) => parse(event.target.value)} placeholder="I had 3 dosa and 100g tofu for breakfast, and bought milk for 22 rupees" className="input min-h-24 resize-y py-3" />
    {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
    {plan && <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-bold">{plan.actions.length} action{plan.actions.length === 1 ? '' : 's'} detected</p><div className="mt-3 space-y-2 text-sm">{plan.actions.map((action, index) => <div key={`${action.type}-${index}`} className="flex items-center justify-between gap-3"><span>{action.type.replaceAll('_', ' ')}</span><span className="text-right text-xs text-muted-foreground">{action.type === 'ADD_MEAL' ? `${action.items.length} food${action.items.length === 1 ? '' : 's'} · ${action.meal}` : action.type === 'ADD_PURCHASE' ? action.food.name : action.type === 'SET_PROTEIN_TARGET' ? `${action.target} g` : ''}</span></div>)}</div>{(plan.clarification || validationError) && <p className="mt-3 text-xs font-semibold text-destructive">{validationError ?? plan.clarification}</p>}</div>}
    {plan && !validationError && !plan.clarification && <button data-testid="button-confirm-universal-voice" onClick={() => onSubmit(plan)} className="mt-5 w-full rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground">Review and save</button>}
  </Modal>;
}

function PageHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="mb-8 flex items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1></div>{action}</div>;
}

function TodayPage({ data, date, onArrowDateChange, onPickerDateChange, onAdd, onVoice, onSuggestion, onEdit, onDelete, onRepeat, onRepeatMeal, futureDateExplicit }: { data: AppData; date: string; onArrowDateChange: (date: string) => void; onPickerDateChange: (date: string) => void; onAdd: () => void; onVoice: () => void; onSuggestion: () => void; onEdit: (entry: FoodEntry) => void; onDelete: (id: string) => void; onRepeat: () => void; onRepeatMeal: (meal: Meal) => void; futureDateExplicit: boolean }) {
  const entries = data.dailyLogs[date]?.entries ?? [];
  const protein = entries.reduce((sum, entry) => sum + entry.protein, 0);
  const cost = entries.reduce((sum, entry) => sum + entry.cost, 0);
  const target = data.settings.proteinTarget;
  const progress = Math.min(100, target ? protein / target * 100 : 0);
  const isToday = date === todayIso();
  const isFuture = date > todayIso();
  const canLog = !isFuture || futureDateExplicit;
  let streak = 0;
  let streakDate = todayIso();
  while (data.dailyLogs[streakDate]?.entries.length) { streak += 1; streakDate = shiftIso(streakDate, -1); }
  return (
    <div className="animate-rise">
      <PageHeading eyebrow={isToday ? 'Your daily fuel' : 'Looking back'} title={isToday ? 'Today' : formatDay(date, { weekday: 'long', day: 'numeric', month: 'short' })} action={<div className="flex gap-2"><button data-testid="button-voice-entry-header" aria-label="Add by voice" title="Add by voice" onClick={onVoice} className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-sm transition hover:-translate-y-0.5"><Mic size={20} /></button><button data-testid="button-add-entry-header" disabled={!canLog} onClick={onAdd} className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><Plus size={21} /></button></div>} />
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 p-2">
        <IconButton label="Previous day" onClick={() => onArrowDateChange(shiftIso(date, -1))}><ChevronLeft size={19} /></IconButton>
        <label data-testid="button-date-picker" className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"><CalendarDays size={16} className="text-primary" /><span>{isToday ? 'Today' : formatDay(date)}</span><input data-testid="input-selected-date" type="date" value={date} onChange={(event) => onPickerDateChange(event.target.value)} className="absolute h-0 w-0 opacity-0" /></label>
        <div className="flex gap-1"><IconButton label="Next day" onClick={() => onArrowDateChange(shiftIso(date, 1))}><ChevronRight size={19} /></IconButton><IconButton label="Jump to today" onClick={() => onArrowDateChange(todayIso())}><RotateCcw size={16} /></IconButton></div>
      </div>
      {isFuture && <div className={`mb-4 rounded-2xl px-4 py-3 text-sm ${canLog ? 'bg-secondary/55 text-muted-foreground' : 'bg-accent/15 text-foreground'}`}>{canLog ? 'You selected a future date. Logs are enabled for this planned day.' : 'Future logging is locked while browsing with the arrows. Choose this date from the calendar to enable it.'}</div>}
      <section className="relative mb-7 overflow-hidden rounded-[26px] bg-primary p-5 text-primary-foreground shadow-float sm:p-7">
        <div className="absolute -right-9 -top-12 h-40 w-40 rounded-full border-[22px] border-primary-foreground/10" />
        <div className="absolute -bottom-16 right-16 h-32 w-32 rounded-full border-[16px] border-accent/25" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm text-primary-foreground/70">Protein so far</p><p className="mt-1 font-display text-4xl font-bold">{quantityText(protein)}<span className="ml-1 text-lg font-medium text-primary-foreground/70">g</span></p></div>
            <div className="rounded-2xl bg-primary-foreground/10 px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-widest text-primary-foreground/60">target</p><p className="font-semibold">{quantityText(target)} g</p></div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-primary-foreground/15"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <div className="mt-3 flex justify-between text-xs text-primary-foreground/70"><span>{progress >= 100 ? 'Target reached. Nicely done.' : `${quantityText(Math.max(0, target - protein))} g to go`}</span><span>{Math.round(progress)}%</span></div>
          <div className="mt-5 flex gap-3 border-t border-primary-foreground/15 pt-4 text-sm"><span className="flex items-center gap-1.5"><IndianRupee size={14} />{currency(cost).replace('₹', '')} spent</span><span className="text-primary-foreground/35">•</span><span>{entries.length} {entries.length === 1 ? 'item' : 'items'}</span></div>
        </div>
      </section>
      <div className="mb-7 grid grid-cols-2 gap-3">
        <button data-testid="button-add-food" disabled={!canLog} onClick={onAdd} className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-bold text-accent-foreground shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><Plus size={18} />Add food</button>
        <button data-testid="button-repeat-yesterday" disabled={!canLog} onClick={onRepeat} className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold transition hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={17} />Repeat yesterday</button>
      </div>
      <button data-testid="button-meal-suggestion" onClick={onSuggestion} className="mb-7 flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3.5 text-left transition hover:bg-accent/15"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground"><Leaf size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">What should I eat?</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">Get a practical suggestion for your remaining protein.</span></span><ArrowRight size={16} className="shrink-0 text-accent-foreground" /></button>
      <button data-testid="button-voice-entry" onClick={onVoice} className="mb-7 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5 text-left transition hover:bg-primary/10"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Mic size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Tell FuelTrack what happened</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">“I ate 5 dosa with curd for breakfast” or “I bought rice for ₹120 yesterday”</span></span><ArrowRight size={16} className="shrink-0 text-primary" /></button>
      <div className="mb-7 flex items-center justify-between rounded-2xl bg-secondary/45 px-4 py-3"><div className="flex items-center gap-2"><Flame size={17} className="text-accent" /><span className="text-sm font-semibold">Daily logging streak</span></div><span className="font-display text-lg font-bold">{streak} {streak === 1 ? 'day' : 'days'}</span></div>
      <div className="space-y-6">
        {meals.map((meal) => {
          const mealEntries = entries.filter((entry) => entry.meal === meal);
          const mealProtein = mealEntries.reduce((sum, entry) => sum + entry.protein, 0);
          return <section key={meal}>
             <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><h2 className="font-display text-xl font-bold">{meal}</h2>{mealEntries.length > 0 && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{quantityText(mealProtein)} g</span>}</div>{mealEntries.length > 0 && <button data-testid={`button-repeat-meal-${meal.toLowerCase()}`} disabled={!canLog} onClick={() => onRepeatMeal(meal)} className="text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-45">Repeat</button>}</div>
            {mealEntries.length === 0 ? <button data-testid={`button-empty-meal-${meal.toLowerCase()}`} disabled={!canLog} onClick={onAdd} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/90 px-4 py-3 text-left text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"><span className="grid h-7 w-7 place-items-center rounded-full bg-secondary/70"><Plus size={15} /></span>Add something to {meal.toLowerCase()}</button> : <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">{mealEntries.map((entry) => <EntryRow key={entry.id} entry={entry} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry.id)} />)}</div>}
          </section>;
        })}
      </div>
      {entries.length === 0 && <div className="mt-7 rounded-2xl bg-secondary/45 p-5 text-center"><Coffee size={23} className="mx-auto mb-2 text-primary" /><p className="font-display text-lg font-semibold">A fresh page for today</p><p className="mt-1 text-sm text-muted-foreground">Start with the first thing you eat or drink.</p></div>}
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete }: { entry: FoodEntry; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="group flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{entry.foodNameSnapshot}</p><p className="mt-0.5 text-xs text-muted-foreground">{quantityText(entry.quantity)} {entry.unit} <span className="mx-1">·</span> {quantityText(entry.protein)} g protein</p></div><div className="flex shrink-0 items-center gap-2"><div className="text-right text-sm font-semibold">{currency(entry.cost)}</div><button data-testid={`button-more-entry-${entry.id}`} aria-label={`More options for ${entry.foodNameSnapshot}`} onClick={() => setOpen((value) => !value)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"><MoreHorizontal size={17} /></button>{open && <div className="absolute z-10 mt-20 mr-5 w-32 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-float"><button data-testid={`button-edit-entry-${entry.id}`} onClick={onEdit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-secondary"><Edit3 size={14} />Edit</button><button data-testid={`button-delete-entry-${entry.id}`} onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-destructive hover:bg-secondary"><Trash2 size={14} />Delete</button></div>}</div></div>;
}

function StatsPage({ data }: { data: AppData }) {
  const [monthDate, setMonthDate] = useState(new Date());
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const logs = Object.values(data.dailyLogs).filter((log) => monthKey(log.date) === month);
  const totalProtein = logs.reduce((sum, log) => sum + log.entries.reduce((s, e) => s + e.protein, 0), 0);
  const totalSpend = logs.reduce((sum, log) => sum + log.entries.reduce((s, e) => s + e.cost, 0), 0);
  const targetDays = logs.filter((log) => log.entries.reduce((s, e) => s + e.protein, 0) >= data.settings.proteinTarget).length;
  const activeDays = logs.filter((log) => log.entries.length).length;
  const averageProtein = activeDays ? totalProtein / activeDays : 0;
  const averageSpend = activeDays ? totalSpend / activeDays : 0;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const categoriesSpend = data.foods.map((food) => ({ ...food, spend: logs.flatMap((log) => log.entries).filter((entry) => entry.foodId === food.id).reduce((sum, entry) => sum + entry.cost, 0) })).filter((food) => food.spend > 0).sort((a, b) => b.spend - a.spend);
  const monthPurchases = data.purchases.filter((purchase) => monthKey(purchase.date) === month).reduce((sum, purchase) => sum + purchase.price, 0);
  const projection = monthDate.getMonth() === new Date().getMonth() && monthDate.getFullYear() === new Date().getFullYear() ? totalSpend / Math.max(1, new Date().getDate()) * new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate() : totalSpend;
  return <div className="animate-rise"><PageHeading eyebrow="Patterns, not pressure" title="Stats" /><ProteinSources data={data} logs={logs} />
    <div className="mb-7 flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 p-2"><IconButton label="Previous month" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}><ChevronLeft size={18} /></IconButton><span className="font-display text-lg font-bold">{monthLabel(monthDate)}</span><IconButton label="Next month" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}><ChevronRight size={18} /></IconButton></div>
     <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Metric label="Protein total" value={`${quantityText(totalProtein)} g`} icon={<Flame size={17} />} /><Metric label="Avg protein / day" value={`${quantityText(averageProtein)} g`} icon={<TrendingUp size={17} />} /><Metric label="Avg spend / day" value={currency(averageSpend)} icon={<IndianRupee size={17} />} /><Metric label="Target days" value={`${targetDays}/${daysInMonth}`} icon={<Check size={17} />} /><Metric label="Log days" value={`${activeDays}`} icon={<CalendarDays size={17} />} /></div>
    <section className="mt-7 rounded-[24px] border border-border/70 bg-card/70 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Spending rhythm</p><p className="mt-2 font-display text-3xl font-bold">{currency(totalSpend)}</p><p className="mt-1 text-sm text-muted-foreground">food logged this month</p></div><div className="rounded-xl bg-secondary/70 p-2.5 text-primary"><IndianRupee size={18} /></div></div><div className="mt-6 flex items-center justify-between text-sm"><span className="text-muted-foreground">Budget {currency(data.settings.monthlyBudget)}</span><span className="font-bold">{Math.round(data.settings.monthlyBudget ? totalSpend / data.settings.monthlyBudget * 100 : 0)}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full transition-all ${totalSpend > data.settings.monthlyBudget ? 'bg-destructive' : 'bg-accent'}`} style={{ width: `${Math.min(100, data.settings.monthlyBudget ? totalSpend / data.settings.monthlyBudget * 100 : 0)}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-sm"><div><p className="text-xs text-muted-foreground">Month projection</p><p className="mt-1 font-bold">{currency(projection)}</p></div><div><p className="text-xs text-muted-foreground">Purchases paid</p><p className="mt-1 font-bold">{currency(monthPurchases)}</p></div></div></section>
    <section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-bold">By category</h2><span className="text-xs text-muted-foreground">{categoriesSpend.length ? `${categoriesSpend.length} categories` : 'No spend yet'}</span></div>{categoriesSpend.length ? <div className="space-y-2">{categoriesSpend.map((item, index) => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5"><span className={`grid h-9 w-9 place-items-center rounded-xl ${index === 0 ? 'bg-accent/20 text-accent-foreground' : 'bg-secondary text-primary'}`}><Package size={17} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold">{item.name}</span><span className="font-bold">{currency(item.spend)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary/70" style={{ width: `${totalSpend ? item.spend / totalSpend * 100 : 0}%` }} /></div></div></div>)}</div> : <EmptyState icon={<TrendingUp size={22} />} title="Your month is still quiet" body="Log a few meals and your spending rhythm will appear here." />}</section>
  </div>;
}

function ProteinSources({ data, logs }: { data: AppData; logs: Array<{ entries: FoodEntry[] }> }) {
  const totals = logs.flatMap((log) => log.entries).reduce<Record<string, number>>((result, entry) => {
    const category = data.foods.find((food) => food.id === entry.foodId)?.category ?? 'Other';
    result[category] = (result[category] ?? 0) + entry.protein;
    return result;
  }, {});
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const sources = Object.entries(totals).filter(([, value]) => value > 0).sort(([, a], [, b]) => b - a);
  return <section className="mb-7 rounded-[24px] border border-border/70 bg-card/70 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Where it comes from</p><h2 className="mt-2 font-display text-2xl font-bold">Protein sources</h2><p className="mt-1 text-sm text-muted-foreground">This month, from foods you logged.</p></div><Leaf size={21} className="text-primary" /></div>{sources.length ? <div className="mt-5 space-y-3">{sources.map(([name, value]) => <div key={name}><div className="flex justify-between gap-3 text-sm"><span className="font-semibold">{name}</span><span className="font-bold">{quantityText(value)} g · {Math.round(value / total * 100)}%</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? value / total * 100 : 0}%` }} /></div></div>)}</div> : <p className="mt-5 rounded-2xl bg-secondary/45 p-4 text-sm text-muted-foreground">Log foods with protein values to see the breakdown.</p>}</section>;
}

function PurchasesPage({ data, onAdd }: { data: AppData; onAdd: () => void }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const purchases = data.purchases.filter((purchase) => monthKey(purchase.date) === month);
  const history = data.purchases.reduce<Record<string, Purchase[]>>((groups, purchase) => { (groups[purchase.foodId] ??= []).push(purchase); return groups; }, {});
  const historyItems = Object.values(history).map((items) => [...items].sort((a, b) => b.date.localeCompare(a.date))).sort((a, b) => b[0].date.localeCompare(a[0].date));
   return <div className="animate-rise"><PageHeading eyebrow="The real receipt" title="Purchases" action={<button data-testid="button-add-purchase-header" onClick={onAdd} className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-sm"><Plus size={21} /></button>} />
    <div className="mb-7 flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 p-2"><IconButton label="Previous month" onClick={() => { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() - 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }}><ChevronLeft size={18} /></IconButton><span className="font-display text-lg font-bold">{monthLabel(new Date(`${month}-01T12:00:00`))}</span><IconButton label="Next month" onClick={() => { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() + 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }}><ChevronRight size={18} /></IconButton></div>
    <button data-testid="button-record-purchase" onClick={onAdd} className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm"><ShoppingBasket size={18} />Record a purchase</button>
    {purchases.length === 0 ? <EmptyState icon={<ShoppingBasket size={24} />} title="No receipts here yet" body="Record what you actually paid at the store. It stays separate from meal costs." action={<button data-testid="button-empty-record-purchase" onClick={onAdd} className="mt-4 font-bold text-primary">Add first purchase <ArrowRight size={15} className="inline" /></button>} /> : <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">{purchases.map((purchase) => <div key={purchase.id} data-testid={`row-purchase-${purchase.id}`} className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-4 last:border-0"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ShoppingBasket size={16} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{purchase.foodNameSnapshot}{purchase.brand && <span className="font-normal text-muted-foreground"> · {purchase.brand}</span>}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDay(purchase.date, { day: 'numeric', month: 'short', year: 'numeric' })} · {quantityText(purchase.quantity)} {purchase.unit}</p></div></div><span className="shrink-0 text-sm font-bold">{currency(purchase.price)}</span></div>)}</div>}
     {historyItems.length > 0 && <section className="mt-8"><div className="mb-3 flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-widest text-primary">What changed</p><h2 className="mt-1 font-display text-2xl font-bold">Price history</h2></div><span className="text-xs text-muted-foreground">all purchases</span></div><div className="space-y-2">{historyItems.map((items) => { const latest = items[0]; const previous = items[1]; const delta = previous ? latest.price - previous.price : 0; const averagePaid = items.reduce((sum, item) => sum + item.price, 0) / items.length; return <div key={latest.foodId} data-testid={`history-${latest.foodId}`} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{latest.foodNameSnapshot}</p><p className="mt-1 text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'purchase' : 'purchases'} · average paid {currency(averagePaid)}</p></div><div className="text-right"><p className="text-sm font-bold">{currency(latest.price)}</p>{previous && <p className={`mt-1 text-xs font-semibold ${delta > 0 ? 'text-destructive' : delta < 0 ? 'text-primary' : 'text-muted-foreground'}`}>{delta > 0 ? '+' : ''}{currency(delta)} vs last</p>}</div></div>; })}</div></section>}
  </div>;
}

function SettingsPage({ data, onDataChange, onEditFood, onAddFood, onDeleteFood, onExport, onImport, onClear }: { data: AppData; onDataChange: (data: AppData, message?: string) => void; onEditFood: (food: Food) => void; onAddFood: () => void; onDeleteFood: (id: string) => void; onExport: () => void; onImport: () => void; onClear: () => void }) {
  const [target, setTarget] = useState(String(data.settings.proteinTarget));
  const [budget, setBudget] = useState(String(data.settings.monthlyBudget));
  useEffect(() => { setTarget(String(data.settings.proteinTarget)); setBudget(String(data.settings.monthlyBudget)); }, [data.settings.proteinTarget, data.settings.monthlyBudget]);
  const saveSettings = (event: FormEvent) => { event.preventDefault(); onDataChange({ ...data, settings: { ...data.settings, proteinTarget: Math.max(1, Number(target) || 80), monthlyBudget: Math.max(0, Number(budget) || 0) } }, 'Preferences saved'); };
  const toggleDark = () => onDataChange({ ...data, settings: { ...data.settings, darkMode: !data.settings.darkMode } }, data.settings.darkMode ? 'Light mode on' : 'Dark mode on');
  return <div className="animate-rise"><PageHeading eyebrow="Your rhythm, your rules" title="Settings" />
    <form onSubmit={saveSettings} className="rounded-[24px] border border-border/70 bg-card/70 p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-xl font-bold">Daily preferences</h2><p className="mt-1 text-sm text-muted-foreground">Small numbers that keep the ritual useful.</p></div><SettingsIcon size={21} className="text-primary" /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Protein target" hint="grams per day"><div className="relative"><input data-testid="input-protein-target" type="number" min="1" step="0.5" value={target} onChange={(e) => setTarget(e.target.value)} className="input pr-12" /><span className="input-suffix">g</span></div></Field><Field label="Monthly food budget" hint="your planned ceiling"><div className="relative"><span className="input-prefix">₹</span><input data-testid="input-monthly-budget" type="number" min="0" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} className="input pl-8" /></div></Field></div><button data-testid="button-save-settings" type="submit" className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Save preferences</button></form>
    <section className="mt-7 rounded-[24px] border border-border/70 bg-card/70 p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-bold">Appearance</h2><p className="mt-1 text-sm text-muted-foreground">{data.settings.darkMode ? 'A softer evening palette.' : 'A warm, daylight palette.'}</p></div><button data-testid="button-toggle-dark-mode" onClick={toggleDark} className={`relative h-8 w-14 rounded-full p-1 transition ${data.settings.darkMode ? 'bg-primary' : 'bg-secondary'}`} aria-label="Toggle dark mode"><span className={`block h-6 w-6 rounded-full bg-card shadow-sm transition-transform ${data.settings.darkMode ? 'translate-x-6' : ''}`}>{data.settings.darkMode ? <Moon size={13} className="mx-auto mt-1.5 text-primary" /> : <Sun size={13} className="mx-auto mt-1.5 text-accent" />}</span></button></div></section>
    <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-widest text-primary">Reference shelf</p><h2 className="mt-1 font-display text-2xl font-bold">Food database</h2></div><button data-testid="button-add-food-setting" onClick={onAddFood} className="flex items-center gap-1.5 text-sm font-bold text-primary"><Plus size={16} />Add food</button></div><div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">{data.foods.map((food) => <div key={food.id} data-testid={`row-food-${food.id}`} className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{food.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{food.servingLabel} · {food.proteinOptional ? 'protein optional' : `${quantityText(food.proteinPerServing)} g protein`} · {food.manualCost ? 'manual cost' : `${currency(food.defaultPrice)} / ${food.priceUnit}`}</p></div><div className="flex shrink-0 gap-1"><IconButton label={`Edit ${food.name}`} onClick={() => onEditFood(food)}><Edit3 size={15} /></IconButton><IconButton label={`Delete ${food.name}`} onClick={() => onDeleteFood(food.id)}><Trash2 size={15} /></IconButton></div></div>)}</div></section>
     <section className="mt-7 rounded-[24px] border border-border/70 bg-card/70 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-widest text-primary">Worth knowing</p><h2 className="mt-1 font-display text-xl font-bold">Pantry stock</h2><p className="mt-1 text-sm text-muted-foreground">Track what is already at home. Purchases add to stock automatically.</p></div><PackageOpen size={21} className="text-primary" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{data.foods.map((food) => <label key={food.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/35 px-3 py-2.5 text-sm"><span className="min-w-0 truncate font-semibold">{food.name}</span><input data-testid={`input-stock-${food.id}`} type="number" min="0" step="0.1" value={data.inventory[food.id] ?? 0} onChange={(event) => onDataChange({ ...data, inventory: { ...data.inventory, [food.id]: Math.max(0, Number(event.target.value) || 0) } })} className="input w-24 py-2 text-right" /></label>)}</div></section>
     <section className="mt-7 rounded-[24px] border border-border/70 bg-card/70 p-5 sm:p-6"><h2 className="font-display text-xl font-bold">Your data</h2><p className="mt-1 text-sm text-muted-foreground">Keep a copy, move devices, or start over.</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><button data-testid="button-export-data" onClick={onExport} className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold hover:bg-secondary/60"><Download size={16} />Export</button><button data-testid="button-import-data" onClick={onImport} className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-bold hover:bg-secondary/60"><Upload size={16} />Import</button><button data-testid="button-clear-data" onClick={onClear} className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 px-3 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"><Trash2 size={16} />Clear data</button></div></section>
    <p className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><CircleHelp size={14} />FuelTrack is a private, offline food journal.</p>
  </div>;
}

function EntryModal({ data, date, editing, onClose, onSubmit }: { data: AppData; date: string; editing: FoodEntry | null; onClose: () => void; onSubmit: (entry: FoodEntry) => void }) {
  const existingFood = editing ? data.foods.find((food) => food.id === editing.foodId) : data.foods[0];
  const [foodId, setFoodId] = useState(editing?.foodId ?? existingFood?.id ?? '');
  const food = data.foods.find((item) => item.id === foodId) ?? existingFood;
  const [meal, setMeal] = useState<Meal>(editing?.meal ?? 'Breakfast');
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? food?.servingQuantity ?? 1));
  const [actualCost, setActualCost] = useState(editing?.actualPrice !== undefined ? String(editing.actualPrice) : '');
  const [protein, setProtein] = useState(editing ? String(editing.protein) : '');
  useEffect(() => { if (!editing && food) { setQuantity(String(food.servingQuantity)); setActualCost(''); setProtein(''); } }, [foodId]); // intentional reset when switching food
  if (!food) return <Modal title="Add food" onClose={onClose}><EmptyState icon={<FolderOpen size={22} />} title="Your food shelf is empty" body="Add a food in Settings first." /></Modal>;
  const qty = Math.max(0, Number(quantity) || 0);
  const cost = food.manualCost ? Math.max(0, Number(actualCost) || 0) : foodCost(food, qty, actualCost === '' ? undefined : Number(actualCost));
  const grams = food.proteinOptional && protein !== '' ? Math.max(0, Number(protein) || 0) : foodProtein(food, qty);
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit({ id: editing?.id ?? crypto.randomUUID(), foodId: food.id, foodNameSnapshot: food.name, meal, quantity: qty, unit: food.servingUnit, protein: grams, cost, actualPrice: actualCost === '' ? undefined : Math.max(0, Number(actualCost) || 0), createdAt: editing?.createdAt ?? new Date().toISOString() }); };
  return <Modal title={editing ? 'Edit entry' : 'Add food'} onClose={onClose}><form onSubmit={submit} className="space-y-4"><Field label="Food"><select data-testid="select-entry-food" value={foodId} onChange={(e) => setFoodId(e.target.value)} className="input">{data.foods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Meal"><select data-testid="select-entry-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)} className="input">{meals.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label={`Quantity (${food.servingUnit})`}><input data-testid="input-entry-quantity" type="number" min="0" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" /></Field></div>{food.proteinOptional && <Field label="Protein" hint="optional, leave at 0 if unknown"><div className="relative"><input data-testid="input-entry-protein" type="number" min="0" step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" className="input pr-12" /><span className="input-suffix">g</span></div></Field>}<Field label="Actual cost" hint={food.manualCost ? 'enter what this portion cost' : `default ${currency(foodCost(food, qty))}; override if needed`}><div className="relative"><span className="input-prefix">₹</span><input data-testid="input-entry-cost" type="number" min="0" step="0.5" value={actualCost} onChange={(e) => setActualCost(e.target.value)} placeholder={food.manualCost ? '0' : quantityText(foodCost(food, qty))} className="input pl-8" /></div></Field><div className="rounded-2xl bg-secondary/55 p-3.5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">This adds</span><span className="font-bold">{quantityText(grams)} g protein</span></div><div className="mt-1 flex justify-between"><span className="text-muted-foreground">Cost counted</span><span className="font-bold">{currency(cost)}</span></div></div><button data-testid="button-save-entry" type="submit" className="w-full rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground">{editing ? 'Save changes' : 'Add to today'}</button></form></Modal>;
}

function PurchaseModal({ data, onClose, onSubmit }: { data: AppData; onClose: () => void; onSubmit: (purchase: Purchase) => void }) {
  const [foodId, setFoodId] = useState(data.foods[0]?.id ?? '');
  const [date, setDate] = useState(todayIso());
  const [quantity, setQuantity] = useState('1');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const food = data.foods.find((item) => item.id === foodId) ?? data.foods[0];
  const submit = (event: FormEvent) => { event.preventDefault(); if (!food || Number(price) < 0) return; onSubmit({ id: crypto.randomUUID(), date, foodId: food.id, foodNameSnapshot: food.name, quantity: Math.max(0, Number(quantity) || 0), unit: food.priceUnit, brand: brand.trim(), price: Math.max(0, Number(price) || 0) }); };
  return <Modal title="Record a purchase" onClose={onClose}><form onSubmit={submit} className="space-y-4"><Field label="What did you buy?"><select data-testid="select-purchase-food" value={foodId} onChange={(e) => setFoodId(e.target.value)} className="input">{data.foods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Date"><input data-testid="input-purchase-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field><Field label={`Quantity (${food?.priceUnit ?? 'unit'})`}><input data-testid="input-purchase-quantity" type="number" min="0" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" /></Field></div><Field label="Brand" hint="optional"><input data-testid="input-purchase-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. local dairy" className="input" /></Field><Field label="Price paid"><div className="relative"><span className="input-prefix">₹</span><input data-testid="input-purchase-price" required type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="input pl-8" /></div></Field><button data-testid="button-save-purchase" type="submit" className="w-full rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground">Save purchase</button></form></Modal>;
}

function FoodModal({ food, onClose, onSubmit }: { food: Food | null; onClose: () => void; onSubmit: (food: Food) => void }) {
  const [name, setName] = useState(food?.name ?? '');
  const [category, setCategory] = useState<FoodCategory>(food?.category ?? 'Other');
  const [servingLabel, setServingLabel] = useState(food?.servingLabel ?? '');
  const [servingQuantity, setServingQuantity] = useState(String(food?.servingQuantity ?? 1));
  const [servingUnit, setServingUnit] = useState(food?.servingUnit ?? 'portion');
  const [protein, setProtein] = useState(String(food?.proteinPerServing ?? 0));
  const [price, setPrice] = useState(String(food?.defaultPrice ?? 0));
  const [priceQuantity, setPriceQuantity] = useState(String(food?.priceQuantity ?? 1));
  const [priceUnit, setPriceUnit] = useState(food?.priceUnit ?? 'portion');
  const [manualCost, setManualCost] = useState(food?.manualCost ?? false);
  const [proteinOptional, setProteinOptional] = useState(food?.proteinOptional ?? false);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; onSubmit({ id: food?.id ?? crypto.randomUUID(), name: name.trim(), category, servingLabel: servingLabel.trim() || `${servingQuantity} ${servingUnit}`, servingQuantity: Math.max(0.01, Number(servingQuantity) || 1), servingUnit: servingUnit.trim() || 'portion', proteinPerServing: Math.max(0, Number(protein) || 0), defaultPrice: Math.max(0, Number(price) || 0), priceQuantity: Math.max(0.01, Number(priceQuantity) || 1), priceUnit: priceUnit.trim() || 'portion', manualCost, proteinOptional }); };
  return <Modal title={food ? 'Edit food' : 'Add a food'} onClose={onClose}><form onSubmit={submit} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1"><Field label="Name"><input data-testid="input-food-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paneer" className="input" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Category"><select data-testid="select-food-category" value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)} className="input">{categories.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Serving label"><input data-testid="input-food-serving-label" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="100 g" className="input" /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Serving quantity"><input data-testid="input-food-serving-quantity" type="number" min="0.01" step="0.1" value={servingQuantity} onChange={(e) => setServingQuantity(e.target.value)} className="input" /></Field><Field label="Serving unit"><input data-testid="input-food-serving-unit" value={servingUnit} onChange={(e) => setServingUnit(e.target.value)} className="input" /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Protein / serving"><div className="relative"><input data-testid="input-food-protein" type="number" min="0" step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} className="input pr-10" /><span className="input-suffix">g</span></div></Field><Field label="Default price"><div className="relative"><span className="input-prefix">₹</span><input data-testid="input-food-price" type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className="input pl-8" /></div></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Price quantity"><input data-testid="input-food-price-quantity" type="number" min="0.01" step="0.1" value={priceQuantity} onChange={(e) => setPriceQuantity(e.target.value)} className="input" /></Field><Field label="Price unit"><input data-testid="input-food-price-unit" value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className="input" /></Field></div><div className="space-y-2 rounded-2xl bg-secondary/50 p-3"><label className="flex items-center gap-3 text-sm font-semibold"><input data-testid="checkbox-food-manual-cost" type="checkbox" checked={manualCost} onChange={(e) => setManualCost(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />Ask for cost each time</label><label className="flex items-center gap-3 text-sm font-semibold"><input data-testid="checkbox-food-optional-protein" type="checkbox" checked={proteinOptional} onChange={(e) => setProteinOptional(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />Protein is optional / editable</label></div><button data-testid="button-save-food" type="submit" className="w-full rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground">Save food</button></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"><div role="dialog" aria-modal="true" className="animate-pop max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-t-[28px] border border-border bg-card p-5 shadow-float sm:rounded-[28px] sm:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">{title}</h2><button data-testid="button-close-modal" aria-label="Close dialog" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-secondary"><X size={19} /></button></div>{children}</div></div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} aria-label={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground">{children}</button>;
}
function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-border/70 bg-card/70 p-4"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-primary">{icon}</div><p className="font-display text-xl font-bold">{value}</p><p className="mt-1 text-[11px] font-semibold text-muted-foreground">{label}</p></div>;
}
function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-[24px] border border-dashed border-border bg-secondary/25 px-5 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">{icon}</span><h3 className="mt-4 font-display text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>{action}</div>;
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><FuelTrackApp /></WouterRouter>;
}

export default App;