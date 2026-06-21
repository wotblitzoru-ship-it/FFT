import React from 'react';
import { Budget, Transaction, Reminder, getFriendlySections } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, ShieldAlert, CheckCircle, Info, CalendarRange } from 'lucide-react';

interface DashboardProps {
  budget: Budget;
  transactions: Transaction[];
  reminders: Reminder[];
}

const MONTH_NAMES = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
];

export default function Dashboard({ budget, transactions, reminders }: DashboardProps) {
  // 1. Current Date calculations
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1; // 1-12
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  // 2. Metrics (Overall & Current Month)
  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(currentMonthStr));
  
  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense;

  // Let's compute historical total balance (all transactions)
  const allTimeIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const allTimeExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = allTimeIncome - allTimeExpense;

  // 3. Category limits and spending alerts calculation
  const categorySpending: { [cat: string]: number } = {};
  currentMonthTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });

  // Track which categories exceeded limits for notifications
  const limitsExceeded = Object.entries(budget.categories)
    .filter(([name, limit]) => limit > 0 && (categorySpending[name] || 0) > limit)
    .map(([name, limit]) => ({
      name,
      limit,
      spent: categorySpending[name] || 0,
      excess: (categorySpending[name] || 0) - limit
    }));

  // 4. Data preparation for: VISUALIZATION BY MONTHS (Area/Line chart)
  // Let's group last 6 months
  const monthlyData: { [key: string]: { name: string; label: string; income: number; expense: number } } = {};
  
  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(today.getMonth() - i);
    const yKey = d.getFullYear();
    const mKey = String(d.getMonth() + 1).padStart(2, '0');
    const monthStr = `${yKey}-${mKey}`;
    monthlyData[monthStr] = {
      name: monthStr,
      label: `${MONTH_NAMES[d.getMonth()]} ${yKey}`,
      income: 0,
      expense: 0
    };
  }

  // Populate actual transactions into the last 6 months
  transactions.forEach(t => {
    const monthKey = t.date.substring(0, 7); // YYYY-MM
    if (monthlyData[monthKey]) {
      if (t.type === 'income') {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expense += t.amount;
      }
    }
  });

  const chartDataByMonth = Object.values(monthlyData);

  // 5. Data preparation for: CATEGORY DISTRIBUTION BAR/CELLS
  const chartDataByCategory = Object.entries(budget.categories).map(([name, limit]) => ({
    name,
    limit,
    spent: categorySpending[name] || 0
  }));

  const COLORS = [
    '#6366f1', '#10b981', '#f43f5e', '#f59e0b',
    '#06b6d4', '#ec4899', '#8b5cf6', '#3b82f6'
  ];

  // 6. Reminder notifications (upcoming and overdue bills)
  const currentDay = today.getDate();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  // Pending reminders for this month
  const unpaidRemindersCount = reminders.filter(r => r.lastPaidMonth !== currentMonthKey).length;
  // Overdue reminders (dated in current month before today)
  const overdueReminders = reminders.filter(r => r.lastPaidMonth !== currentMonthKey && r.dueDay < currentDay);

  return (
    <div className="space-y-6" id="dashboard-container">
      
      {/* 1. Header Banner */}
      <div id="dashboard-header" className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Сводная Панель</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Обзор общего состояния семейного бюджета</p>
        </div>
      </div>

      {/* 2. WARNINGS AND NOTIFICATIONS BANNER (ALERTS EXCEEDED) */}
      {limitsExceeded.length > 0 && (
        <div id="limits-alert-banner" className="bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/50 rounded-2xl p-4 space-y-2 text-rose-800 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-bounce" />
            <span className="font-bold text-sm">Внимание! Выявлен перерасчет по лимитам:</span>
          </div>
          <div className="text-xs space-y-1 pl-7">
            {limitsExceeded.map((lim, i) => (
              <p key={i}>
                Категория <strong className="font-bold underline">{lim.name}</strong> превысила установленный лимит на{' '}
                <strong className="font-semibold text-rose-600 dark:text-rose-300">{(lim.excess).toLocaleString('ru-RU')} ₽</strong>{' '}
                (Потрачено {(lim.spent).toLocaleString('ru-RU')} ₽ из {lim.limit.toLocaleString('ru-RU')} ₽).
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Reminders Notification */}
      {overdueReminders.length > 0 && (
        <div id="reminders-alert-banner" className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 space-y-2 text-amber-800 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-amber-500 animate-pulse" />
            <span className="font-bold text-sm">Просроченные регулярные платежи ({overdueReminders.length}):</span>
          </div>
          <div className="text-xs space-y-1 pl-7">
            {overdueReminders.map((rem, i) => (
              <p key={i}>
                Регулярный платеж <span className="font-semibold">{rem.title}</span> на сумму <span className="font-semibold font-mono">{rem.amount.toLocaleString('ru-RU')} ₽</span> должен был быть оплачен до {rem.dueDay}-го числа.
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 3. METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="metrics-cards">
        {/* Total balance of family account */}
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white shadow-md shadow-indigo-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet className="w-24 h-24" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 block">Общий Баланс Семьи</span>
          <span className="text-2xl font-bold tracking-tight block mt-1.5 font-mono">
            {currentBalance.toLocaleString('ru-RU')} ₽
          </span>
          <p className="text-[10px] mt-2 opacity-75 font-mono">Всего поступлений за все время</p>
        </div>

        {/* Current Month Income */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Доходы за месяц</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight block mt-2 font-mono text-slate-800 dark:text-slate-100">
            {totalIncome.toLocaleString('ru-RU')} ₽
          </span>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">{MONTH_NAMES[today.getMonth()]} {currentYear}</p>
        </div>

        {/* Current Month Expenses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Расходы за месяц</span>
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight block mt-2 font-mono text-slate-800 dark:text-slate-100">
            {totalExpense.toLocaleString('ru-RU')} ₽
          </span>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">{MONTH_NAMES[today.getMonth()]} {currentYear}</p>
        </div>

        {/* Monthly saving balance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Остаток в месяце</span>
            <div className={`p-1.5 rounded-lg ${netSavings >= 0 ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <span className={`text-xl font-bold tracking-tight block mt-2 font-mono ${netSavings >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
            {netSavings.toLocaleString('ru-RU')} ₽
          </span>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">
            {netSavings >= 0 ? 'Сохранено бюджета' : 'Превышение лимитов расходов'}
          </p>
        </div>
      </div>

      {/* 4. GRAPHS SPREAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-layout">
        {/* Left/Middle: Expenses Trend Chart by Month */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-base mb-1">Динамика Семейного Бюджета</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Сравнение доходов и расходов семьи по месяцам (последние 6 мес.)</p>
          
          <div className="h-[280px]" id="monthly-trend-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataByMonth}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-5" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    fontSize: '12px', 
                    backgroundColor: '#1e293b', 
                    color: '#f8fafc',
                    border: 'none'
                  }}
                  formatter={(value: any) => [`${value.toLocaleString('ru-RU')} ₽`]}
                />
                <Area type="monotone" dataKey="income" name="Доход" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Расход" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                <Legend iconSize={10} verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Category Distribution */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-base mb-1">Распределение по Категориям</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Сравнение реальных трат этого месяца с установленными лимитами</p>
          
          <div className="h-[280px]" id="categories-chart-box">
            {chartDataByCategory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-xs">
                Пока нет настроенных категорий.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" className="dark:opacity-5" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} width={75} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      backgroundColor: '#1e293b', 
                      color: '#f8fafc',
                      border: 'none'
                    }}
                    formatter={(value: any, name: string) => [
                      `${value.toLocaleString('ru-RU')} ₽`,
                      name === 'spent' ? 'Потрачено' : 'Лимит'
                    ]}
                  />
                  <Bar dataKey="spent" name="Потрачено" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    {chartDataByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                  <Bar dataKey="limit" name="Лимит" fill="#e2e8f0" radius={[0, 4, 4, 0]} opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5. INDIVIDUAL CATEGORY SPENDING PROGRESS BARS GROUPED BY CUSTOM SECTIONS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm animate-fade-in" id="progress-bars-block">
        <h3 className="font-bold text-base mb-1">Лимиты и структура трат</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-sans">
          Мониторинг расходов семьи по разделам и входящим в них подразделам в реальном времени.
        </p>
        
        {getFriendlySections(budget).length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs dark:text-slate-500">
            Категории расходов еще не добавлены. Зайдите во вкладку «Пространство» для настройки.
          </div>
        ) : (
          <div className="space-y-8">
            {getFriendlySections(budget).map((section) => {
              const activeSubcategories = section.subcategories;
              if (activeSubcategories.length === 0) return null;

              return (
                <div key={section.id} className="space-y-3.5 border-l-2 border-indigo-500/25 dark:border-indigo-500/40 pl-4 py-1">
                  {/* Parent Section Title */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 px-2.5 py-1 rounded">
                      📁 {section.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Подразделов: {activeSubcategories.length}
                    </span>
                  </div>

                  {/* Subcategories visual progress bar grids */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeSubcategories.map((sub) => {
                      const name = sub.name;
                      const limit = sub.limit;
                      const spent = categorySpending[name] || 0;
                      const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                      const isOver = limit > 0 && spent > limit;

                      return (
                        <div key={name} className="space-y-2 p-3.5 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-900 rounded-xl hover:scale-[1.005] transition-transform duration-200">
                          <div className="flex justify-between text-xs gap-3">
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{name}</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0 text-[11px]">
                              {spent.toLocaleString('ru-RU')} ₽ {limit > 0 ? `/ ${limit.toLocaleString('ru-RU')} ₽` : '(Без лимита)'}
                            </span>
                          </div>

                          {/* Visual progress bar */}
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOver
                                  ? 'bg-rose-500 shadow-sm shadow-rose-500/20'
                                  : percent > 85
                                  ? 'bg-amber-500 shadow-sm shadow-indigo-500/20'
                                  : 'bg-indigo-600 dark:bg-indigo-500'
                              }`}
                              style={{ width: `${limit > 0 ? percent : 100}%` }}
                            />
                          </div>

                          {/* Detail Indicators */}
                          <div className="flex items-center justify-between text-[10px] uppercase font-semibold font-mono tracking-wider">
                            {limit > 0 ? (
                              isOver ? (
                                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                  <ShieldAlert className="w-3.5 h-3.5" /> Превышен лимит!
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" /> В норме ({Math.round(percent)}%)
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <Info className="w-3.5 h-3.5" /> Лимит не задан
                              </span>
                            )}

                            {limit > 0 && !isOver && (
                              <span className="text-slate-500 dark:text-slate-400">
                                Свободно: {(limit - spent).toLocaleString('ru-RU')} ₽
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
