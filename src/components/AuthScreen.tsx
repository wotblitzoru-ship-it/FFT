import React, { useState } from 'react';
import { Wallet, ArrowRight, ShieldCheck, Moon, Sun, MonitorCheck } from 'lucide-react';

interface AuthScreenProps {
  onSignedIn: (user: any, name: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function AuthScreen({ onSignedIn, isDark, onToggleTheme }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLocalBypass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError('Пожалуйста, введите ваше имя');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const localUserObj = {
        uid: 'offline_' + Math.random().toString(36).substring(2, 11),
        email: 'offline@familybudget.local',
        displayName: userName.trim(),
        isLocal: true
      };
      localStorage.setItem('localUser', JSON.stringify(localUserObj));
      onSignedIn(localUserObj, userName.trim());
    } catch (err: any) {
      console.error(err);
      setError('Ошибка при создании локального профиля: ' + (err.message || 'попробуйте снова'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between p-6 transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Top Bar with Theme Toggle */}
      <div className="flex justify-between items-center max-w-md mx-auto w-full" id="top-bar-auth">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-indigo-600 dark:bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-500/20" id="brand-logo">
            <Wallet className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg block leading-none">FamilyBudget</span>
            <span className="text-xs text-slate-500 font-mono">Локальный режим</span>
          </div>
        </div>
        <button
          id="theme-toggle-btn"
          onClick={onToggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:scale-105 active:scale-95 transition-all text-slate-500 dark:text-slate-400"
          title="Сменить тему"
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
        </button>
      </div>

      {/* Main Content Card */}
      <div className="flex-1 flex items-center justify-center py-10">
        <div 
          id="auth-card"
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 p-8 shadow-xl dark:shadow-slate-950/40 relative overflow-hidden"
        >
          {/* Accent light highlights in dark mode */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight" id="auth-title">
              Семейный Бюджет
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              Управляйте финансами вашей семьи комфортно. Удобные категории, ежемесячные лимиты по разделам, планирование регулярных платежей и наглядные графики.
            </p>
          </div>

          {error && (
            <div id="auth-error" className="mb-6 p-4 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLocalBypass} className="space-y-6" id="auth-form">
            {/* User Nickname Input */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Ваше Имя / Никнейм
              </label>
              <input
                id="nickname-input"
                type="text"
                placeholder="Например, Мама, Папа, Максим..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-sans text-sm transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400/80"
                maxLength={40}
                required
                autoFocus
              />
            </div>

            {/* Direct Login Button */}
            <button
              type="submit"
              id="local-login-btn"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-2xl text-sm font-semibold tracking-wide transition-all active:scale-98 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Войти в систему</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-[10px] font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Автосохранение данных в localStorage</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-[10px] font-mono">
              <MonitorCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Полная конфиденциальность: без серверов</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center max-w-md mx-auto w-full py-2">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          &copy; {new Date().getFullYear()} Family Finance system. Все данные хранятся локально на вашем устройстве.
        </p>
      </div>
    </div>
  );
}
