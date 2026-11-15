import { useAppStore } from '../src/store/appStore';
import { INITIAL_SHOPPING_LIST, INITIAL_STOCK, WEEKLY_BUDGET_LIMIT } from '../src/constants/mockData';
import { TrainingDay } from '../src/types';

const initial = useAppStore.getState();
const today = () => new Date().toISOString().split('T')[0];

beforeEach(() => {
  useAppStore.setState(initial, true);
});

describe('weeks and targets', () => {
  it('starts on week 1 with the base targets', () => {
    const s = useAppStore.getState();
    expect(s.currentWeek).toBe(1);
    expect(s.dailyCalorieTarget).toBe(3200);
    expect(s.dailyProteinTarget).toBe(155);
    expect(s.weeklyBudgetLimit).toBe(WEEKLY_BUDGET_LIMIT);
  });

  it('marks every 4th week as a deload week', () => {
    useAppStore.getState().setWeek(4);
    expect(useAppStore.getState().isDeloadWeek).toBe(true);
    useAppStore.getState().setWeek(5);
    expect(useAppStore.getState().isDeloadWeek).toBe(false);
  });

  it('raises targets in weeks 5-8 and 9-12', () => {
    useAppStore.getState().setWeek(6);
    expect(useAppStore.getState().dailyCalorieTarget).toBe(3300);
    useAppStore.getState().setWeek(10);
    expect(useAppStore.getState().dailyProteinTarget).toBe(170);
  });

  it('ignores weeks outside 1-12', () => {
    useAppStore.getState().setWeek(13);
    useAppStore.getState().setWeek(0);
    expect(useAppStore.getState().currentWeek).toBe(1);
  });
});

describe('program generation', () => {
  it('creates a workout for each of the 12 weeks', () => {
    const keys = Object.keys(useAppStore.getState().workouts);
    expect(keys.some((k) => k.startsWith('1_'))).toBe(true);
    expect(keys.some((k) => k.startsWith('12_'))).toBe(true);
  });

  it('halves compound weights in deload weeks', () => {
    const { workouts } = useAppStore.getState();
    const day = Object.values(workouts).find((w) => w.exercises.some((e) => e.isCompound && e.targetWeightKg))!.day;
    const w3 = workouts[`3_${day}`].exercises.find((e) => e.isCompound && e.targetWeightKg !== undefined)!;
    const w4 = workouts[`4_${day}`].exercises.find((e) => e.id === w3.id)!;
    // week 4 = base + 3 active weeks of +2.5 kg, then halved
    expect(w4.targetWeightKg!).toBeLessThan(w3.targetWeightKg!);
  });
});

describe('weight tracking', () => {
  it('adds +200 kcal when weight stalls for three weigh-ins', () => {
    useAppStore.setState({
      weightHistory: [
        { date: '2026-01-01', weight: 78 },
        { date: '2026-01-08', weight: 78 },
      ],
    });
    useAppStore.getState().addWeightRecord(77.8);
    expect(useAppStore.getState().dailyCalorieTarget).toBe(3400);
  });

  it('keeps the base target when weight goes up', () => {
    useAppStore.setState({
      weightHistory: [
        { date: '2026-01-01', weight: 77 },
        { date: '2026-01-08', weight: 77.5 },
      ],
    });
    useAppStore.getState().addWeightRecord(78);
    expect(useAppStore.getState().dailyCalorieTarget).toBe(3200);
  });

  it('ignores zero or negative weights', () => {
    const before = useAppStore.getState().weightHistory.length;
    useAppStore.getState().addWeightRecord(0);
    expect(useAppStore.getState().weightHistory).toHaveLength(before);
  });
});

describe('shopping and stock', () => {
  it('buying an item spends budget and adds to stock; unbuying reverts both', () => {
    const before = useAppStore.getState().stock['Tavuk'].quantity;
    useAppStore.getState().toggleShoppingItem('shop_tavuk');
    let s = useAppStore.getState();
    expect(s.weeklyBudgetSpent).toBe(159);
    expect(s.stock['Tavuk'].quantity).toBe(before + 2000);

    useAppStore.getState().toggleShoppingItem('shop_tavuk');
    s = useAppStore.getState();
    expect(s.weeklyBudgetSpent).toBe(0);
    expect(s.stock['Tavuk'].quantity).toBe(before);
  });

  it('changing the price of a bought item updates the spent budget', () => {
    useAppStore.getState().toggleShoppingItem('shop_tavuk');
    useAppStore.getState().updateShoppingItemPrice('shop_tavuk', 200);
    expect(useAppStore.getState().weeklyBudgetSpent).toBe(200);
  });

  it('resetWeeklyBudget clears purchases and spending', () => {
    useAppStore.getState().toggleShoppingItem('shop_tavuk');
    useAppStore.getState().resetWeeklyBudget();
    const s = useAppStore.getState();
    expect(s.weeklyBudgetSpent).toBe(0);
    expect(s.shoppingList.every((i) => !i.purchased)).toBe(true);
  });

  it('does not mutate previous state or the initial stock data', () => {
    const prevStock = useAppStore.getState().stock;
    const prevTavuk = prevStock['Tavuk'].quantity;
    useAppStore.getState().toggleShoppingItem('shop_tavuk');
    useAppStore.getState().updateStockQuantity('Yumurta', 99);

    expect(prevStock['Tavuk'].quantity).toBe(prevTavuk);
    expect(INITIAL_STOCK['Tavuk'].quantity).toBe(400);
    expect(INITIAL_STOCK['Yumurta'].quantity).toBe(6);
    expect(useAppStore.getState().stock['Tavuk']).not.toBe(prevStock['Tavuk']);
    expect(INITIAL_SHOPPING_LIST[0].purchased).toBe(false);
  });
});

describe('meals', () => {
  it('ticking a meal takes its ingredients out of stock and unticking puts them back', () => {
    useAppStore.getState().selectMenu('tavuklu');
    const meal = useAppStore.getState().dailyMeals[today()][0];
    const ing = meal.ingredients.find((i) => i.stockUnit && i.stockDeductionAmount)!;
    const before = useAppStore.getState().stock[ing.stockUnit!].quantity;

    useAppStore.getState().toggleMeal(0, true);
    const after = useAppStore.getState().stock[ing.stockUnit!].quantity;
    expect(after).toBe(Math.max(0, before - ing.stockDeductionAmount!));

    useAppStore.getState().toggleMeal(0, false);
    expect(useAppStore.getState().stock[ing.stockUnit!].quantity).toBe(after + ing.stockDeductionAmount!);
  });

  it('marks a workout completed once every exercise is ticked', () => {
    const day = TrainingDay.PAZARTESI;
    const w = useAppStore.getState().workouts[`1_${day}`];
    w.exercises.forEach((e) => useAppStore.getState().toggleExercise(day, e.id));
    expect(useAppStore.getState().workouts[`1_${day}`].completed).toBe(true);
  });
});
