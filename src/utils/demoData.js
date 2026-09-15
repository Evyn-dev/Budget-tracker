import { emptyBudget } from './budgetDocument';

// Fresh relative dates keep recaps useful. All people and businesses are fictional.
export function createDemoData(now = new Date()) {
  const date = days => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const data = emptyBudget();
  let id = 100;
  const tx = (days, amount, category, note, cash = false, extra = {}) => ({
    id: id++, date: date(days), amount, category, note, type: amount < 0 ? 'expense' : 'income',
    paymentMethod: amount < 0 ? cash ? 'cash' : 'card' : null, ...extra,
  });
  data.transactions = [
    tx(-58, 2450, 'Paycheck', 'Northstar Studio — salary'), tx(-43, 2450, 'Paycheck', 'Northstar Studio — salary'),
    tx(-29, 2450, 'Paycheck', 'Northstar Studio — salary'), tx(-14, 2450, 'Paycheck', 'Northstar Studio — salary'),
    tx(-1, 2450, 'Paycheck', 'Northstar Studio — salary'), tx(-12, 180, 'Freelance', 'Fictional illustration project'),
    tx(-53, -1050, 'Bills', 'Rent'), tx(-24, -1050, 'Bills', 'Rent'),
    tx(-38, -126, 'Food', 'Groceries'), tx(-20, -78, 'Transport', 'Transit pass'),
    tx(-10, -84.50, 'Food', 'Maple Market groceries'), tx(-7, -32, 'Food', 'Lunch with friends', true),
    tx(-5, -48, 'Hobbies', 'Art supplies'), tx(-3, -12, 'Transport', 'Bus fare', true),
    tx(-2, -62, 'Food', 'Weekly shop', false, { splitGroupId: 'demo-split' }),
    tx(-2, -24, 'Shopping', 'Household items in same purchase', false, { splitGroupId: 'demo-split' }),
    tx(-8, -65, 'Shopping', 'Returned headphones', false, { id: 900, refunded: true, refundedById: 901 }),
    tx(-4, 65, 'Refund', 'Headphones refund', false, { id: 901, refundSourceId: 900 }),
    tx(-17, -25, 'Entertainment', 'Cinema'), tx(-6, -22, 'Health', 'Pharmacy'),
  ];
  data.bucketTransfers = [
    { id: 1, amount: 1800, from: 'digital', to: 'savings', date: date(-27), note: 'Emergency fund' },
    { id: 2, amount: 300, from: 'digital', to: 'wallet', date: date(-15), note: 'Cash for the month' },
    { id: 3, amount: 250, from: 'digital', to: 'savings', date: date(-1), note: 'Payday saving' },
  ];
  data.subscriptions = [
    { id: 20, name: 'Aurora Music', amount: 10.99, frequency: 'monthly', customIntervalDays: 30, dueDate: date(3), note: 'Fictional music service' },
    { id: 21, name: 'Sketch Cloud', amount: 8, frequency: 'monthly', customIntervalDays: 30, dueDate: date(11), note: 'Creative tools' },
    { id: 22, name: 'Community Gym', amount: 120, frequency: 'yearly', customIntervalDays: 30, dueDate: date(24), note: 'Annual membership' },
  ];
  data.debts = [{ id: 30, name: 'Alex Example', amount: 45, note: 'Shared fictional concert tickets', createdAt: date(-8) },
    { id: 31, name: 'Jordan Sample', amount: 28, note: 'Dinner split', createdAt: date(-3) }];
  data.creditCards = [{ id: 40, name: 'Sample Rewards Card', balance: 215, limit: 3000, minimumPayment: 25,
    dueDate: date(12), createdAt: date(-50), note: 'Fictional card; no account number', history: [
      { id: 41, type: 'charge', amount: 315, date: date(-18), note: 'Travel reservation' },
      { id: 42, type: 'payment', amount: 100, date: date(-6), note: 'Monthly payment' },
    ] }];
  data.customExpenseCategories = ['Hobbies'];
  data.customIncomeCategories = ['Freelance'];
  data.hiddenExpenseCategories = ['Other'];
  return data;
}
