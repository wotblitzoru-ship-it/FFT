import React, { useState } from 'react';
import { Reminder, Budget, getFriendlySections } from '../types';
import { CalendarRange, Plus, CheckCircle, Clock, Trash2, ShieldAlert, BadgeCheck } from 'lucide-react';

interface RemindersListProps {
  budget: Budget;
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, 'id' | 'budgetId' | 'createdAt' | 'createdBy'>) => Promise<void>;
  onMarkAsPaid: (reminderId: string, currentMonthKey: string) => Promise<void>;
  onRemoveReminder: (reminderId: string) => Promise<void>;
}

export default function RemindersList({
  budget,
  reminders,
  onAddReminder,
  onMarkAsPaid,
  onRemoveReminder
}: RemindersListProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(() => {
    const sections = getFriendlySections(budget);
    return sections[0]?.subcategories[0]?.name || 'Другое';
  });
  const [dueDay, setDueDay] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current month in YYYY-MM format
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentDay = today.getDate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    setError(null);
    setSubmitting(true);
    try {
      await onAddReminder({
        title: title.trim(),
        amount: Number(amount),
        category: category,
        dueDay: Number(dueDay)
      });
      setTitle('');
      setAmount('');
      setDueDay('1');
    } catch (err: any) {
      setError('Ошибка при сохранении напоминания: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to determine status
  const getStatus = (reminder: Reminder) => {
    const isPaidThisMonth = reminder.lastPaidMonth === currentMonthKey;
    if (isPaidThisMonth) return 'paid';
    
    // Check if overdue
    if (reminder.dueDay < currentDay) return 'overdue';
    
    return 'pending';
  };

  return (
    <div className="space-y-6" id="reminders-container">
      <div id="reminders-header" className="flex items-center gap-3">
        <div className="p-2 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 rounded-xl">
          <CalendarRange className="w-5 h-5 flex-shrink-0 animate-bounce" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Регулярные Платежи</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Контролируйте обязательные коммунальные, страховые и арендные расходы</p>
        </div>
      </div>

      {error && (
        <div id="reminders-error" className="p-4 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="reminders-sections">
        {/* Add Recurring Reminder Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm sticky top-6">
            <h3 className="font-bold text-base mb-4">Новое обязательство</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Название платежа</label>
                <input
                  type="text"
                  placeholder="Например, Интернет, Аренда, Ипотека..."
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-sans"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Сумма (₽)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="2500"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">День месяц (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Категория</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all cursor-pointer font-sans"
                >
                  {getFriendlySections(budget).map((sec) => (
                    <optgroup key={sec.id} label={sec.name}>
                      {sec.subcategories.map((sub) => (
                        <option key={sub.name} value={sub.name}>
                          {sub.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="Прочие">
                    <option value="Другое">Другое</option>
                  </optgroup>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold tracking-wide transition-all uppercase mt-2 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Добавить в регулярные
              </button>
            </form>
          </div>
        </div>

        {/* Existing Reminders Status List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-base mb-4">Ближайшие и оплаченные регулярные траты</h3>

            {reminders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500">
                <CalendarRange className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-xs">Регулярные платежи не добавлены.</p>
                <p className="text-[10px] text-slate-400 mt-1">Добавьте обязательные расходы, например ТВ, телефон, аренду или кредит, слева.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sorted reminders: overdue first, then pending, then paid */}
                {reminders
                  .slice()
                  .sort((a, b) => {
                    const statusA = getStatus(a);
                    const statusB = getStatus(b);
                    if (statusA === 'overdue' && statusB !== 'overdue') return -1;
                    if (statusA !== 'overdue' && statusB === 'overdue') return 1;
                    if (statusA === 'pending' && statusB === 'paid') return -1;
                    if (statusA === 'paid' && statusB === 'pending') return 1;
                    return a.dueDay - b.dueDay;
                  })
                  .map((reminder) => {
                    const status = getStatus(reminder);
                    const isPaid = status === 'paid';
                    const isOverdue = status === 'overdue';

                    return (
                      <div
                        key={reminder.id}
                        className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border transition-all ${
                          isPaid
                            ? 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-900 opacity-75'
                            : isOverdue
                            ? 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/40'
                            : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800'
                        }`}
                      >
                        {/* Title & Info */}
                        <div className="flex-1 min-w-0 mb-3 md:mb-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-bold text-sm ${isPaid ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                              {reminder.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {reminder.category}
                            </span>
                            {isOverdue && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-0.5 animate-pulse">
                                <ShieldAlert className="w-3 h-3" /> Просрочено!
                              </span>
                            )}
                            {isPaid && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                <BadgeCheck className="w-3 h-3" /> Оплачено
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                              {reminder.amount.toLocaleString('ru-RU')} ₽
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Каждый месяц, до {reminder.dueDay}-го числа
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end md:self-auto">
                          {!isPaid && (
                            <button
                              onClick={() => onMarkAsPaid(reminder.id, currentMonthKey)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                              title="Отметить как оплаченный"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Отметить оплаченным
                            </button>
                          )}
                          
                          <button
                            onClick={() => onRemoveReminder(reminder.id)}
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-colors"
                            title="Удалить напоминание"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
