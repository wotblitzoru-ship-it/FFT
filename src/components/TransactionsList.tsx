import React, { useState } from 'react';
import { Transaction, Budget, getFriendlySections } from '../types';
import { jsPDF } from 'jspdf';
import { Receipt, Search, Filter, Plus, FileSpreadsheet, FileJson, Trash2, ArrowUpRight, ArrowDownRight, Printer } from 'lucide-react';

interface TransactionsListProps {
  budget: Budget;
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'budgetId' | 'createdAt' | 'createdBy' | 'createdByName'>) => Promise<void>;
  onRemoveTransaction: (transactionId: string) => Promise<void>;
  userNickname: string;
}

// Cyrillic to Latin transliteration for jsPDF compatibility
function translit(text: string): string {
  const ru: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  return text.split('').map(char => ru[char] !== undefined ? ru[char] : char).join('');
}

export default function TransactionsList({
  budget,
  transactions,
  onAddTransaction,
  onRemoveTransaction,
  userNickname
}: TransactionsListProps) {
  // Add transactions form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(() => {
    const sections = getFriendlySections(budget);
    return sections[0]?.subcategories[0]?.name || 'Другое';
  });
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter/search state
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'expense' | 'income'>('ALL');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Пожалуйста, введите корректную сумму больше нуля');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onAddTransaction({
        amount: Number(amount),
        category,
        description: description.trim(),
        type,
        date
      });
      setAmount('');
      setDescription('');
    } catch (err: any) {
      setError('Ошибка при сохранении: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Export logic
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Type', 'Category', 'Amount', 'Description', 'CreatedBy'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.type === 'expense' ? 'Расход' : 'Доход',
      t.category,
      t.amount,
      t.description.replace(/"/g, '""'),
      t.createdByName
    ]);

    // Set encoding to UTF-8 with BOM to open with correct symbols in Excel
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Family_Finance_${budget.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF statement download with transliterated strings to prevent Cyrillic rendering bugs
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(20);
    doc.text(translit(`OTCHET O SEMEYNYKH FINANSAKH: ${budget.name.toUpperCase()}`), 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Data otcheta: ${new Date().toLocaleDateString('ru-RU')}`, 14, 28);
    doc.text(`Kolichestvo operatsiy: ${transactions.length}`, 14, 34);

    let y = 45;
    
    // Draw columns headers
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text('N', 14, y);
    doc.text('Data', 22, y);
    doc.text('Tip', 45, y);
    doc.text('Kategoriya', 65, y);
    doc.text('Summa (RUB)', 105, y);
    doc.text('Opisanie', 135, y);
    
    doc.line(14, y + 2, 195, y + 2);
    y += 8;

    doc.setFont('Helvetica', 'normal');
    transactions.forEach((t, i) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(i + 1), 14, y);
      doc.text(t.date, 22, y);
      doc.text(t.type === 'expense' ? 'RASKHOD' : 'DOKHOD', 45, y);
      doc.text(translit(t.category), 65, y);
      doc.text(`${t.amount.toLocaleString('ru-RU')} RUB`, 105, y);
      
      const descTranslit = t.description ? translit(t.description) : '-';
      const truncatedDesc = descTranslit.length > 25 ? descTranslit.substring(0, 22) + '...' : descTranslit;
      doc.text(truncatedDesc, 135, y);
      
      y += 6;
    });

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = totalIncome - totalExpense;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 5;
    doc.line(14, y, 195, y);
    y += 10;
    doc.setFont('Helvetica', 'bold');
    doc.text(`ITOGO DOKHODY: ${totalIncome.toLocaleString('ru-RU')} RUB`, 14, y);
    y += 6;
    doc.text(`ITOGO RASKHODY: ${totalExpense.toLocaleString('ru-RU')} RUB`, 14, y);
    y += 6;
    doc.text(`SEMEINIY BALANS: ${balance.toLocaleString('ru-RU')} RUB`, 14, y);

    doc.save(`Report_${translit(budget.name).replace(/\s+/g, '_')}.pdf`);
  };

  // Standard window print trigger for full layout
  const handlePrintHTML = () => {
    window.print();
  };

  // Filter lists
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase()) || 
                          t.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    const matchesType = filterType === 'ALL' || t.type === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <div className="space-y-6" id="transactions-container">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4" id="transactions-header">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Операции и Транзакции</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Управляйте приходами и расходами семьи с детальными отчетами</p>
          </div>
        </div>

        {/* Exporters and Reports buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            title="Экспорт в Excel / Spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            title="Скачать PDF-выписку"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={handlePrintHTML}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            title="Печать Сводной Ведомости"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Распечатать</span>
          </button>
        </div>
      </div>

      {error && (
        <div id="transactions-form-error" className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/50 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="transactions-grids">
        {/* New Transaction Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm sticky top-6">
            <h3 className="font-bold text-base mb-4">Внести доход или расход</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    type === 'expense'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  Расход (Списание)
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    type === 'income'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  Доход (Приход)
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Сумма в рублях</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Сумма, руб."
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-mono transition-all"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Категория операции</label>
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
                  <optgroup label="Прочие операции">
                    <option value="Доход">Поступление (Доход)</option>
                    <option value="Другое">Другое (Вне категорий)</option>
                  </optgroup>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Дата</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-mono transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Краткое описание / Комментарий</label>
                <input
                  type="text"
                  placeholder="Например, Овощи в Ленте, Премия..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-sans"
                  maxLength={150}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-2.5 text-white rounded-xl text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  type === 'expense' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Plus className="w-4 h-4" /> Внести запись
              </button>
            </form>
          </div>
        </div>

        {/* Filters and transactions ledger */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            {/* Filter controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6" id="ledger-filters">
              {/* Search */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Поиск по описанию..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Type filter */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Filter className="w-4 h-4" />
                </span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="ALL">Все типы операций</option>
                  <option value="expense">Только Расходы</option>
                  <option value="income">Только Доходы</option>
                </select>
              </div>

              {/* Category filter */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Filter className="w-4 h-4" />
                </span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer font-sans"
                >
                  <option value="ALL">Все категории</option>
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
                    <option value="Доход">Поступление (Доход)</option>
                    <option value="Другое">Другое</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* List of transactions */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Журнал записей ({filteredTransactions.length})
              </h4>

              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 text-xs">
                  Записи не найдены. Измените параметры фильтра или внесите новую транзакцию слева.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredTransactions
                    .slice()
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((t) => {
                      const isExp = t.type === 'expense';
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 rounded-xl hover:scale-[1.01] transition-transform duration-250"
                        >
                          {/* Left: type indicator + details */}
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl text-white ${isExp ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {isExp ? <ArrowDownRight className="w-4 h-4 text-rose-500" /> : <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                                {t.description || (isExp ? 'Расход' : 'Доход')}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                <span className="font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  {t.category}
                                </span>
                                <span>{t.date}</span>
                                <span>•</span>
                                <span className="text-slate-500 italic">от {t.createdByName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: amount & remove */}
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold font-mono ${isExp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {isExp ? '-' : '+'}{t.amount.toLocaleString('ru-RU')} ₽
                            </span>
                            
                            <button
                              onClick={() => onRemoveTransaction(t.id)}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-colors"
                              title="Удалить запись"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
}
