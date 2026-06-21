import React, { useState } from 'react';
import { Budget, BudgetSection, Subcategory, getFriendlySections } from '../types';
import { Users, Plus, Trash2, Key, Share2, Clipboard, Settings, Check, Edit3, FolderPlus, HelpCircle } from 'lucide-react';

interface BudgetSettingsProps {
  budget: Budget | null;
  onJoinBudget: (budgetId: string) => Promise<void>;
  onCreateBudget: (name: string) => Promise<void>;
  onUpdateBudget: (budget: Partial<Budget>) => Promise<void>;
  onLeaveBudget: () => void;
  currentUser: any;
  userNickname: string;
}

export default function BudgetSettings({
  budget,
  onJoinBudget,
  onCreateBudget,
  onUpdateBudget,
  onLeaveBudget,
  currentUser,
  userNickname
}: BudgetSettingsProps) {
  const [newSpaceName, setNewSpaceName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Category Sections State
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  // Subsections state dictionary map (keyed by section ID)
  const [newSubName, setNewSubName] = useState<{ [secId: string]: string }>({});
  const [newSubLimit, setNewSubLimit] = useState<{ [secId: string]: string }>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCreateBudget(newSpaceName.trim());
      setNewSpaceName('');
    } catch (err: any) {
      setError('Ошибка при создании пространства: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onJoinBudget(joinCode.trim());
      setJoinCode('');
    } catch (err: any) {
      setError('Не удалось войти в пространство. Проверьте правильность кода.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!budget) return;
    navigator.clipboard.writeText(budget.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Section CRUD Management
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget || !newSectionName.trim()) return;
    setError(null);

    const sections = getFriendlySections(budget);
    const newId = 'sec-' + Math.random().toString(36).substring(2, 10);
    
    const updatedSections: BudgetSection[] = [
      ...sections,
      { id: newId, name: newSectionName.trim(), subcategories: [] }
    ];

    try {
      await onUpdateBudget({ sections: updatedSections });
      setNewSectionName('');
    } catch (err: any) {
      setError('Ошибка добавления раздела: ' + err.message);
    }
  };

  const handleRenameSection = async (secId: string) => {
    if (!budget || !editingSectionName.trim()) return;
    setError(null);

    const sections = getFriendlySections(budget);
    const updatedSections = sections.map(s => 
      s.id === secId ? { ...s, name: editingSectionName.trim() } : s
    );

    try {
      await onUpdateBudget({ sections: updatedSections });
      setEditingSectionId(null);
      setEditingSectionName('');
    } catch (err: any) {
      setError('Ошибка при переименовании раздела: ' + err.message);
    }
  };

  const handleRemoveSection = async (secId: string) => {
    if (!budget) return;
    if (!window.confirm('Вы уверены, что хотите удалить весь этот раздел вместе со всеми его подразделами?')) return;
    setError(null);

    const sections = getFriendlySections(budget);
    const updatedSections = sections.filter(s => s.id !== secId);

    // Sync back flat categories limits map
    const flatCategories: { [key: string]: number } = {};
    updatedSections.forEach(sec => {
      sec.subcategories.forEach(sub => {
        flatCategories[sub.name] = sub.limit;
      });
    });

    try {
      await onUpdateBudget({ 
        sections: updatedSections,
        categories: flatCategories
      });
    } catch (err: any) {
      setError('Ошибка удаления раздела: ' + err.message);
    }
  };

  // Subcategory (Subsection) CRUD Management
  const handleAddSubcategory = async (secId: string) => {
    if (!budget) return;
    const subName = newSubName[secId]?.trim();
    if (!subName) {
      setError('Введите название подраздела');
      return;
    }
    const limit = Number(newSubLimit[secId]) || 0;
    setError(null);

    const sections = getFriendlySections(budget);
    let subcategoryExists = false;

    // Check across all sections to make sure subcategory name is unique
    sections.forEach(s => {
      if (s.subcategories.some(sub => sub.name.toLowerCase() === subName.toLowerCase())) {
        subcategoryExists = true;
      }
    });

    if (subcategoryExists) {
      setError(`Подраздел/категория "${subName}" уже существует в вашем бюджете.`);
      return;
    }

    const updatedSections = sections.map(s => {
      if (s.id === secId) {
        return {
          ...s,
          subcategories: [...s.subcategories, { name: subName, limit }]
        };
      }
      return s;
    });

    // Sync back flat categories limits map
    const flatCategories: { [key: string]: number } = {};
    updatedSections.forEach(sec => {
      sec.subcategories.forEach(sub => {
        flatCategories[sub.name] = sub.limit;
      });
    });

    try {
      await onUpdateBudget({ 
        sections: updatedSections,
        categories: flatCategories
      });
      // Clear specific input state
      setNewSubName(prev => ({ ...prev, [secId]: '' }));
      setNewSubLimit(prev => ({ ...prev, [secId]: '' }));
    } catch (err: any) {
      setError('Ошибка при добавлении подраздела: ' + err.message);
    }
  };

  const handleUpdateSubcategoryLimit = async (secId: string, subName: string, newLimitString: string) => {
    if (!budget) return;
    const limitVal = Number(newLimitString) || 0;

    const sections = getFriendlySections(budget);
    const updatedSections = sections.map(s => {
      if (s.id === secId) {
        return {
          ...s,
          subcategories: s.subcategories.map(sub => 
            sub.name === subName ? { ...sub, limit: limitVal } : sub
          )
        };
      }
      return s;
    });

    // Sync back flat categories limits map
    const flatCategories: { [key: string]: number } = {};
    updatedSections.forEach(sec => {
      sec.subcategories.forEach(sub => {
        flatCategories[sub.name] = sub.limit;
      });
    });

    try {
      await onUpdateBudget({ 
        sections: updatedSections,
        categories: flatCategories
      });
    } catch (err: any) {
      setError('Ошибка при обновлении лимита подраздела: ' + err.message);
    }
  };

  const handleRemoveSubcategory = async (secId: string, subName: string) => {
    if (!budget) return;
    setError(null);

    const sections = getFriendlySections(budget);
    const updatedSections = sections.map(s => {
      if (s.id === secId) {
        return {
          ...s,
          subcategories: s.subcategories.filter(sub => sub.name !== subName)
        };
      }
      return s;
    });

    // Sync back flat categories limits map
    const flatCategories: { [key: string]: number } = {};
    updatedSections.forEach(sec => {
      sec.subcategories.forEach(sub => {
        flatCategories[sub.name] = sub.limit;
      });
    });

    try {
      await onUpdateBudget({ 
        sections: updatedSections,
        categories: flatCategories
      });
    } catch (err: any) {
      setError('Ошибка при удалении подраздела: ' + err.message);
    }
  };

  const currentSections = budget ? getFriendlySections(budget) : [];

  return (
    <div className="space-y-6" id="settings-container">
      <div id="settings-header" className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Настройки бюджета и структуры</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Синхронизация семейного сейфа и уровней категорий</p>
        </div>
      </div>

      {error && (
        <div id="settings-error" className="p-4 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {!budget ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="setup-budget-grid">
          {/* Create Budget space */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-base mb-2">Создать новое семейное пространство</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Создайте общее пространство, укажите категории расходов и поделитесь кодом с остальными членами семьи.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Название бюджета</label>
                <input
                  type="text"
                  placeholder="Например, Семья Ковалевых"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-800 dark:text-slate-100 font-sans"
                  maxLength={50}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                {submitting ? 'Создание...' : 'Создать Бюджет'}
              </button>
            </form>
          </div>

          {/* Join Budget space */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-base mb-2">Присоединиться к семье</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Если другой член семьи уже создал пространство, попросите у них код доступа и введите его ниже для мгновенной синхронизации.
            </p>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Код Пространства (ID)</label>
                <input
                  type="text"
                  placeholder="Введите скопированный код"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-800 dark:text-slate-100 font-mono"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-100 dark:text-slate-100 rounded-xl text-sm font-medium transition-all"
              >
                {submitting ? 'Подключение...' : 'Подключиться к Семье'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="active-budget-grid">
          {/* Details & Share */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <span className="text-[10px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-full">
                Активное пространство
              </span>
              <h3 className="font-bold text-lg mt-3 text-slate-800 dark:text-slate-100">{budget.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ваша роль: <span className="font-semibold text-slate-700 dark:text-slate-300">{userNickname}</span>
              </p>

              {/* Share Code */}
              <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" /> Код для других устройств
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Перешлите этот код членам семьи, чтобы они могли видеть и пополнять этот бюджет в реальном времени.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={budget.id}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono select-all text-slate-700 dark:text-slate-300"
                  />
                  <button
                    onClick={handleCopyCode}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                    title="Копировать код"
                    id="copy-code-btn"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Leave Option */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  id="leave-space-btn"
                  onClick={onLeaveBudget}
                  className="w-full text-center py-2 border border-rose-100 dark:border-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl transition-all"
                >
                  Выйти из пространства
                </button>
              </div>
            </div>

            {/* List of active members */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-slate-400" />
                <span>Зарегистрированные аккаунты ({budget.members.length})</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Устройства, вошедшие по данному коду, полностью синхронизированы в реальном времени.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {budget.members.map((member, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                      {member === currentUser?.uid ? `${userNickname} (Вы)` : `Пользователь UID: ...${member.substring(0, 6)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Manage Hierarchical Sections & Subcategories */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Create New Category SECTION (Parent) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-base mb-1">Создать родительский раздел</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Создайте крупную группу расходов (например: Автомобиль, Ремонт, Дети), внутри которой вы будете создавать подразделы с лимитами.
              </p>
              
              <form onSubmit={handleAddSection} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Назовите раздел, например: 'Обучение ребенка', 'Дача'"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-sans"
                  maxLength={60}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer dark:bg-indigo-500"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Создать раздел</span>
                </button>
              </form>
            </div>

            {/* Existing Custom Hierarchical Structure list */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Структура ваших разделов и лимитов</h4>
              
              {currentSections.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-400 text-xs text-bold">
                  Нет настроенных разделов. Создайте первый родительский раздел выше.
                </div>
              ) : (
                currentSections.map((section) => (
                  <div 
                    key={section.id} 
                    className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-4"
                  >
                    {/* Parent Section Header with actions */}
                    <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-3">
                      {editingSectionId === section.id ? (
                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                          <input
                            type="text"
                            value={editingSectionName}
                            onChange={(e) => setEditingSectionName(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rouneded text-xs"
                          />
                          <button
                            onClick={() => handleRenameSection(section.id)}
                            className="p-1 px-2.5 bg-indigo-600 text-white rounded text-[11px]"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setEditingSectionId(null)}
                            className="text-[11px] text-slate-450 hover:underline"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                            {section.name}
                          </h3>
                          <button
                            onClick={() => {
                              setEditingSectionId(section.id);
                              setEditingSectionName(section.name);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-md"
                            title="Переименовать раздел"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handleRemoveSection(section.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 opacity-75 hover:opacity-100 transition-opacity"
                        title="Удалить раздел и подразделы"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Удалить раздел</span>
                      </button>
                    </div>

                    {/* Subcategories (Subsections) nested under this section */}
                    <div className="space-y-2 mt-2">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                        Внутренние подразделы:
                      </span>

                      {section.subcategories.length === 0 ? (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1 pl-2">
                          Нет подразделов. Добавьте свой первый подраздел ниже.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                          {section.subcategories.map((sub) => (
                            <div key={sub.name} className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 pl-2 gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                  {sub.name}
                                </span>
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  {sub.limit > 0 ? `Индив. лимит в месяц: ${sub.limit.toLocaleString('ru-RU')} ₽` : 'Без установленного лимита'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-mono">Лимит:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={sub.limit || ''}
                                    placeholder="Нет лимита"
                                    onChange={(e) => handleUpdateSubcategoryLimit(section.id, sub.name, e.target.value)}
                                    className="w-20 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[11px] text-slate-800 dark:text-slate-200 font-mono text-center"
                                  />
                                  <span className="text-[11px] text-slate-400">₽</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveSubcategory(section.id, sub.name)}
                                  className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/25 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Удалить подраздел"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Inline Form to add Subsection (Subcategory) directly to this section */}
                    <div className="mt-4 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl rounded-t-none">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                        + Новый подраздел в этот раздел
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Название, например: Литература"
                          value={newSubName[section.id] || ''}
                          onChange={(e) => setNewSubName(prev => ({ ...prev, [section.id]: e.target.value }))}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-[11px] text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="number"
                          placeholder="Лимит в ₽ (0 = без)"
                          value={newSubLimit[section.id] || ''}
                          onChange={(e) => setNewSubLimit(prev => ({ ...prev, [section.id]: e.target.value }))}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-[11px] text-slate-800 dark:text-slate-100 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSubcategory(section.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Добавить подраздел</span>
                        </button>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
