import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';

import { Budget, Transaction, Reminder, UserState, BudgetSection, getFriendlySections } from './types';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import RemindersList from './components/RemindersList';
import BudgetSettings from './components/BudgetSettings';

import {
  Wallet,
  LayoutDashboard,
  ReceiptText,
  CalendarDays,
  Settings,
  LogOut,
  Sun,
  Moon,
  TriangleAlert,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // User auth state
  const [user, setUser] = useState<any | null>(null);
  const [userNickname, setUserNickname] = useState<string>(() => {
    return localStorage.getItem('userNickname') || '';
  });
  const [authLoading, setAuthLoading] = useState(true);

  // Active workspace / budget state
  const [budgetId, setBudgetId] = useState<string | null>(() => {
    return localStorage.getItem('budgetSpaceId');
  });
  const [budget, setBudget] = useState<Budget | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Active view tab state: 'dashboard' | 'transactions' | 'reminders' | 'space'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'reminders' | 'space'>('dashboard');

  // Mobile menu open state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Sync indicators
  const [syncStatus, setSyncStatus] = useState<'synced' | 'connecting' | 'offline'>('connecting');

  // Watch theme change and add/remove HTML body styles
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  // 1. Auth Listener
  useEffect(() => {
    const savedLocalUser = localStorage.getItem('localUser');
    if (savedLocalUser) {
      try {
        const parsed = JSON.parse(savedLocalUser);
        setUser(parsed);
        setAuthLoading(false);
        return;
      } catch (e) {
        console.error('Stale local user discarded', e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!localStorage.getItem('localUser')) {
        setUser(currentUser);
        setAuthLoading(false);
      }
      
      // If no user, reset the budget loaded states
      if (!currentUser && !localStorage.getItem('localUser')) {
        setBudget(null);
        setTransactions([]);
        setReminders([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firebase Sync listeners
  useEffect(() => {
    if (!user || !budgetId) {
      setBudget(null);
      setTransactions([]);
      setReminders([]);
      setDataLoading(false);
      return;
    }

    if (user.isLocal) {
      setSyncStatus('synced');
      setDataLoading(true);
      try {
        const localBudgetStr = localStorage.getItem(`local_budget_${budgetId}`);
        if (localBudgetStr) {
          setBudget(JSON.parse(localBudgetStr));
        } else {
          setBudgetId(null);
          localStorage.removeItem('budgetSpaceId');
        }

        const localTxsStr = localStorage.getItem(`local_transactions_${budgetId}`) || '[]';
        setTransactions(JSON.parse(localTxsStr));

        const localRemsStr = localStorage.getItem(`local_reminders_${budgetId}`) || '[]';
        setReminders(JSON.parse(localRemsStr));
      } catch (err) {
        console.error('Failed to parse local budget storage state', err);
      } finally {
        setDataLoading(false);
      }
      return;
    }

    setSyncStatus('connecting');
    setDataLoading(true);

    const budgetRef = doc(db, 'budgets', budgetId);
    
    // Listen to Budget space
    const unsubscribeBudget = onSnapshot(
      budgetRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setBudget(docSnap.data() as Budget);
          setSyncStatus('synced');
        } else {
          // If workspace doesn't exist, disconnect
          console.warn('Budget space not found in firestore');
          setBudgetId(null);
          localStorage.removeItem('budgetSpaceId');
        }
        setDataLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `budgets/${budgetId}`);
        setSyncStatus('offline');
        setDataLoading(false);
      }
    );

    // Listen to associated Transactions subcollection
    const transactionsRef = collection(db, 'budgets', budgetId, 'transactions');
    const unsubscribeTransactions = onSnapshot(
      transactionsRef,
      (querySnap) => {
        const list: Transaction[] = [];
        querySnap.forEach((docSnap) => {
          list.push(docSnap.data() as Transaction);
        });
        setTransactions(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `budgets/${budgetId}/transactions`);
      }
    );

    // Listen to associated Reminders subcollection
    const remindersRef = collection(db, 'budgets', budgetId, 'reminders');
    const unsubscribeReminders = onSnapshot(
      remindersRef,
      (querySnap) => {
        const list: Reminder[] = [];
        querySnap.forEach((docSnap) => {
          list.push(docSnap.data() as Reminder);
        });
        setReminders(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `budgets/${budgetId}/reminders`);
      }
    );

    return () => {
      unsubscribeBudget();
      unsubscribeTransactions();
      unsubscribeReminders();
    };
  }, [user, budgetId]);

  // Auth Screen login event
  const handleSignedIn = (signedInUser: any, nickname: string) => {
    setUser(signedInUser);
    setUserNickname(nickname);
    localStorage.setItem('userNickname', nickname);
  };

  // Sign out event
  const handleSignOut = async () => {
    try {
      if (user?.isLocal) {
        localStorage.removeItem('localUser');
        localStorage.removeItem('budgetSpaceId');
        setUser(null);
        setBudgetId(null);
        return;
      }
      await signOut(auth);
      // Clean storage
      localStorage.removeItem('budgetSpaceId');
      setBudgetId(null);
    } catch (err) {
      console.error('Error logging out from Firebase auth', err);
    }
  };

  // 3. Database Actions

  // Create budget space
  const createBudgetSpace = async (spaceName: string) => {
    if (!user) return;
    const randomId = 'fam-' + Math.random().toString(36).substring(2, 11);
    const docPath = `budgets/${randomId}`;

    const defaultSections: BudgetSection[] = [
      {
        id: 'sec-' + Math.random().toString(36).substring(2, 10),
        name: 'Питание и продукты',
        subcategories: [
          { name: 'Продукты', limit: 15000 },
          { name: 'Кафе и рестораны', limit: 5000 }
        ]
      },
      {
        id: 'sec-' + Math.random().toString(36).substring(2, 10),
        name: 'Транспорт и авто',
        subcategories: [
          { name: 'Бензин', limit: 6000 },
          { name: 'Общественный транспорт', limit: 1500 },
          { name: 'Такси', limit: 2000 }
        ]
      },
      {
        id: 'sec-' + Math.random().toString(36).substring(2, 10),
        name: 'Жилье и услуги',
        subcategories: [
          { name: 'ЖКХ / Счета', limit: 8000 },
          { name: 'Аренда / Ипотека', limit: 30000 }
        ]
      },
      {
        id: 'sec-' + Math.random().toString(36).substring(2, 10),
        name: 'Развлечения и отдых',
        subcategories: [
          { name: 'Кино и театры', limit: 3000 },
          { name: 'Подписки и хобби', limit: 2000 }
        ]
      },
      {
        id: 'sec-' + Math.random().toString(36).substring(2, 10),
        name: 'Здоровье и спорт',
        subcategories: [
          { name: 'Аптека и врачи', limit: 4000 },
          { name: 'Спортзал и секции', limit: 3000 }
        ]
      }
    ];

    // Keep flat categories map updated too for fallback / backup reasons
    const flatCategories: { [key: string]: number } = {};
    defaultSections.forEach(sec => {
      sec.subcategories.forEach(sub => {
        flatCategories[sub.name] = sub.limit;
      });
    });

    const newBudget: Budget = {
      id: randomId,
      name: spaceName,
      createdBy: user.uid,
      createdAt: new Date().toISOString(), // Use ISO string as fallback, handles client-side metadata easily
      updatedAt: new Date().toISOString(),
      categories: flatCategories,
      sections: defaultSections,
      members: [user.uid]
    };

    if (user.isLocal) {
      localStorage.setItem(`local_budget_${randomId}`, JSON.stringify(newBudget));
      localStorage.setItem(`local_transactions_${randomId}`, JSON.stringify([]));
      localStorage.setItem(`local_reminders_${randomId}`, JSON.stringify([]));
      setBudgetId(randomId);
      localStorage.setItem('budgetSpaceId', randomId);
      setBudget(newBudget);
      setTransactions([]);
      setReminders([]);
      setActiveTab('dashboard');
      return;
    }

    try {
      const budgetRef = doc(db, 'budgets', randomId);
      await setDoc(budgetRef, newBudget);
      setBudgetId(randomId);
      localStorage.setItem('budgetSpaceId', randomId);
      setActiveTab('dashboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  // Join space via ID
  const joinBudgetSpace = async (targetId: string) => {
    if (!user) return;
    const cleanId = targetId.trim();
    const docPath = `budgets/${cleanId}`;

    if (user.isLocal) {
      const localBudgetStr = localStorage.getItem(`local_budget_${cleanId}`);
      if (!localBudgetStr) {
        throw new Error('Код пространства не найден в локальном хранилище. Пожалуйста, создайте новое семейное пространство!');
      }
      const budgetObj = JSON.parse(localBudgetStr);
      if (!budgetObj.members.includes(user.uid)) {
        budgetObj.members.push(user.uid);
        localStorage.setItem(`local_budget_${cleanId}`, JSON.stringify(budgetObj));
      }
      setBudgetId(cleanId);
      localStorage.setItem('budgetSpaceId', cleanId);
      setBudget(budgetObj);
      
      const localTxsStr = localStorage.getItem(`local_transactions_${cleanId}`) || '[]';
      setTransactions(JSON.parse(localTxsStr));
      const localRemsStr = localStorage.getItem(`local_reminders_${cleanId}`) || '[]';
      setReminders(JSON.parse(localRemsStr));
      setActiveTab('dashboard');
      return;
    }

    try {
      const budgetRef = doc(db, 'budgets', cleanId);
      const docSnap = await getDoc(budgetRef);
      if (!docSnap.exists()) {
        throw new Error('Код пространства не найден');
      }

      // Add user to members array in Firestore
      await updateDoc(budgetRef, {
        members: arrayUnion(user.uid)
      });

      setBudgetId(cleanId);
      localStorage.setItem('budgetSpaceId', cleanId);
      setActiveTab('dashboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  // Update budget properties (limits, etc)
  const updateBudget = async (properties: Partial<Budget>) => {
    if (!budgetId) return;
    const docPath = `budgets/${budgetId}`;

    if (user?.isLocal) {
      if (!budget) return;
      const updated = {
        ...budget,
        ...properties,
        updatedAt: new Date().toISOString()
      };
      setBudget(updated);
      localStorage.setItem(`local_budget_${budgetId}`, JSON.stringify(updated));
      return;
    }

    try {
      const budgetRef = doc(db, 'budgets', budgetId);
      await updateDoc(budgetRef, {
        ...properties,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  // Disconnect from workspace
  const leaveBudgetSpace = () => {
    setBudgetId(null);
    localStorage.removeItem('budgetSpaceId');
    setActiveTab('space');
  };

  // Record a transaction
  const addTransaction = async (transactionData: Omit<Transaction, 'id' | 'budgetId' | 'createdAt' | 'createdBy' | 'createdByName'>) => {
    if (!budgetId || !user) return;
    const randomId = 'tx-' + Math.random().toString(36).substring(2, 11);
    const path = `budgets/${budgetId}/transactions/${randomId}`;

    const newTx: Transaction = {
      ...transactionData,
      id: randomId,
      budgetId: budgetId,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      createdByName: userNickname
    };

    if (user?.isLocal) {
      const updatedTxs = [newTx, ...transactions];
      setTransactions(updatedTxs);
      localStorage.setItem(`local_transactions_${budgetId}`, JSON.stringify(updatedTxs));
      return;
    }

    try {
      const txRef = doc(db, 'budgets', budgetId, 'transactions', randomId);
      await setDoc(txRef, newTx);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Delete a transaction
  const removeTransaction = async (transactionId: string) => {
    if (!budgetId) return;
    const path = `budgets/${budgetId}/transactions/${transactionId}`;

    if (user?.isLocal) {
      const updatedTxs = transactions.filter(t => t.id !== transactionId);
      setTransactions(updatedTxs);
      localStorage.setItem(`local_transactions_${budgetId}`, JSON.stringify(updatedTxs));
      return;
    }

    try {
      const txRef = doc(db, 'budgets', budgetId, 'transactions', transactionId);
      await deleteDoc(txRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Record a reminder
  const addReminder = async (reminderData: Omit<Reminder, 'id' | 'budgetId' | 'createdAt' | 'createdBy'>) => {
    if (!budgetId || !user) return;
    const randomId = 'rem-' + Math.random().toString(36).substring(2, 11);
    const path = `budgets/${budgetId}/reminders/${randomId}`;

    const newReminder: Reminder = {
      ...reminderData,
      id: randomId,
      budgetId: budgetId,
      createdAt: new Date().toISOString(),
      createdBy: user.uid
    };

    if (user?.isLocal) {
      const updatedRems = [newReminder, ...reminders];
      setReminders(updatedRems);
      localStorage.setItem(`local_reminders_${budgetId}`, JSON.stringify(updatedRems));
      return;
    }

    try {
      const remRef = doc(db, 'budgets', budgetId, 'reminders', randomId);
      await setDoc(remRef, newReminder);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Mark reminder as settled in current month, auto-producing a transaction log too
  const markAsPaid = async (reminderId: string, currentMonthKey: string) => {
    if (!budgetId) return;
    const remPath = `budgets/${budgetId}/reminders/${reminderId}`;

    if (user?.isLocal) {
      const matchedReminder = reminders.find(r => r.id === reminderId);
      if (matchedReminder) {
        // 1. Create matching expense transaction
        await addTransaction({
          amount: matchedReminder.amount,
          category: matchedReminder.category,
          description: `Оплата: ${matchedReminder.title}`,
          type: 'expense',
          date: new Date().toISOString().split('T')[0]
        });

        // 2. Mark reminder status
        const updatedRems = reminders.map(r => 
          r.id === reminderId ? { ...r, lastPaidMonth: currentMonthKey } : r
        );
        setReminders(updatedRems);
        localStorage.setItem(`local_reminders_${budgetId}`, JSON.stringify(updatedRems));
      }
      return;
    }

    try {
      const matchedReminder = reminders.find(r => r.id === reminderId);
      if (matchedReminder) {
        // 1. Create matching expense transaction
        await addTransaction({
          amount: matchedReminder.amount,
          category: matchedReminder.category,
          description: `Оплата: ${matchedReminder.title}`,
          type: 'expense',
          date: new Date().toISOString().split('T')[0]
        });

        // 2. Mark reminder status
        const remRef = doc(db, 'budgets', budgetId, 'reminders', reminderId);
        await updateDoc(remRef, {
          lastPaidMonth: currentMonthKey
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, remPath);
    }
  };

  // Delete a reminder
  const removeReminder = async (reminderId: string) => {
    if (!budgetId) return;
    const path = `budgets/${budgetId}/reminders/${reminderId}`;

    if (user?.isLocal) {
      const updatedRems = reminders.filter(r => r.id !== reminderId);
      setReminders(updatedRems);
      localStorage.setItem(`local_reminders_${budgetId}`, JSON.stringify(updatedRems));
      return;
    }

    try {
      const remRef = doc(db, 'budgets', budgetId, 'reminders', reminderId);
      await deleteDoc(remRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Calculate global budget anomalies to show alert badges on layout
  const alertBadgesCount = () => {
    let count = 0;
    if (!budget) return 0;
    
    // Category limits
    const today = new Date();
    const currentMonthNum = today.getMonth() + 1;
    const currentMonthStr = `${today.getFullYear()}-${String(currentMonthNum).padStart(2, '0')}`;
    const monthlyExps = transactions.filter(t => t.date.startsWith(currentMonthStr) && t.type === 'expense');
    
    const spending: { [key: string]: number } = {};
    monthlyExps.forEach(e => spending[e.category] = (spending[e.category] || 0) + e.amount);

    Object.entries(budget.categories).forEach(([name, limitVal]) => {
      const limit = Number(limitVal) || 0;
      if (limit > 0 && (spending[name] || 0) > limit) {
        count++;
      }
    });

    // Unpaid reminders past their day of month
    const currentDay = today.getDate();
    reminders.forEach(r => {
      if (r.lastPaidMonth !== currentMonthStr && r.dueDay < currentDay) {
        count++;
      }
    });

    return count;
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="text-center font-mono space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl animate-spin mx-auto shadow-indigo-500/20 shadow-lg">
            F
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Синхронизация учетной записи...</p>
        </div>
      </div>
    );
  }

  // Not signed-in yet -> show AuthScreen
  if (!user) {
    return <AuthScreen onSignedIn={handleSignedIn} isDark={isDark} onToggleTheme={toggleTheme} />;
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside id="desktop-sidebar" className="hidden lg:flex flex-col justify-between w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-6 shadow-sm">
        
        <div className="space-y-8">
          {/* Logo brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 dark:bg-indigo-500 rounded-xl text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-sm block leading-none">FamilyBudget</span>
              <span className="text-[10px] text-slate-400 font-mono">версия 1.4</span>
            </div>
          </div>

          {/* Sync indicator */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-100 dark:border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'connecting' ? 'bg-indigo-500 animate-ping' : 'bg-rose-500'
              }`} />
              <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400">
                {syncStatus === 'synced' ? 'Онлайн синхр.' : syncStatus === 'connecting' ? 'Регистрация...' : 'Офлайн'}
              </span>
            </div>
            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Live
            </span>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'dashboard' && budget
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              } ${!budget ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              disabled={!budget}
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard className="w-4.5 h-4.5" />
                Панель управления
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'transactions' && budget
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              } ${!budget ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              disabled={!budget}
            >
              <span className="flex items-center gap-3">
                <ReceiptText className="w-4.5 h-4.5" />
                История операций
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('reminders'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'reminders' && budget
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              } ${!budget ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              disabled={!budget}
            >
              <span className="flex items-center gap-3">
                <CalendarDays className="w-4.5 h-4.5" />
                Платежи
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('space'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'space'
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              } cursor-pointer`}
            >
              <span className="flex items-center gap-3">
                <Settings className="w-4.5 h-4.5" />
                Пространство
              </span>
              {alertBadgesCount() > 0 && budget && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-[10px] text-white font-bold flex items-center gap-0.5 font-mono animate-pulse">
                  <TriangleAlert className="w-3.5 h-3.5" />
                  {alertBadgesCount()}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* User profile & controls */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
              {userNickname ? userNickname.substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold truncate block text-slate-800 dark:text-slate-200">{userNickname || 'Пользователь'}</span>
              <span className="text-[10px] text-slate-400 font-mono truncate block">{user.email || 'Анонимно'}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="flex-1 p-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-500 dark:text-slate-400 rounded-xl transition-all cursor-pointer"
              title="Сменить тему"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            <button
              onClick={handleSignOut}
              className="flex-1 p-2.5 border border-rose-100 dark:border-rose-950/20 bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer"
              title="Выйти из системы"
            >
              <LogOut className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER BAR */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header id="mobile-header" className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 dark:bg-indigo-500 rounded-lg text-white">
              <Wallet className="w-4.5 h-4.5" />
            </div>
            <span className="font-bold tracking-tight text-sm">FamilyBudget</span>
            {syncStatus === 'synced' ? (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-all"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* MOBILE NAVIGATION MENU OUTLAY */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-x-0 top-[57px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-lg z-35 p-6 space-y-6">
            <nav className="space-y-1">
              <button
                disabled={!budget}
                onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold ${
                  activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Панель управления
              </button>
              <button
                disabled={!budget}
                onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold ${
                  activeTab === 'transactions' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <ReceiptText className="w-4 h-4" />
                История операций
              </button>
              <button
                disabled={!budget}
                onClick={() => { setActiveTab('reminders'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold ${
                  activeTab === 'reminders' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Платежи
              </button>
              <button
                onClick={() => { setActiveTab('space'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold ${
                  activeTab === 'space' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Settings className="w-4 h-4" />
                Пространство
              </button>
            </nav>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  {userNickname ? userNickname.substring(0, 2).toUpperCase() : 'U'}
                </div>
                <div>
                  <span className="text-xs font-bold block">{userNickname}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">{user.email || 'Анонимно'}</span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 border border-rose-100 dark:border-rose-950/20 text-rose-600 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* MAIN DISPLAY VIEW */}
        <main id="main-view-box" className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center h-96 font-mono space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] text-slate-500">Загрузка данных из облака...</span>
            </div>
          ) : !budget ? (
            /* Forces joining/creating a budget group on initial entry */
            <BudgetSettings
              budget={null}
              onJoinBudget={joinBudgetSpace}
              onCreateBudget={createBudgetSpace}
              onUpdateBudget={updateBudget}
              onLeaveBudget={leaveBudgetSpace}
              currentUser={user}
              userNickname={userNickname}
            />
          ) : (
            /* Active view tab switch */
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  budget={budget}
                  transactions={transactions}
                  reminders={reminders}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsList
                  budget={budget}
                  transactions={transactions}
                  onAddTransaction={addTransaction}
                  onRemoveTransaction={removeTransaction}
                  userNickname={userNickname}
                />
              )}

              {activeTab === 'reminders' && (
                <RemindersList
                  budget={budget}
                  reminders={reminders}
                  onAddReminder={addReminder}
                  onMarkAsPaid={markAsPaid}
                  onRemoveReminder={removeReminder}
                />
              )}

              {activeTab === 'space' && (
                <BudgetSettings
                  budget={budget}
                  onJoinBudget={joinBudgetSpace}
                  onCreateBudget={createBudgetSpace}
                  onUpdateBudget={updateBudget}
                  onLeaveBudget={leaveBudgetSpace}
                  currentUser={user}
                  userNickname={userNickname}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
