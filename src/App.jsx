import React, { useState, useMemo } from 'react';
import {
    Plus,
    Wallet,
    Trash2,
    Settings,
    CreditCard,
    Edit3,
    X,
    TrendingUp,
    AlertCircle,
    Save,
    Star,
    Loader2,
    LogIn,
    User,
    LogOut
} from 'lucide-react';
import { useFirestore } from './hooks/useFirestore';
import { useAuth } from './hooks/useAuth';

const App = () => {
    const { user, loading: authLoading, login, logout } = useAuth();

    // --- FIREBASE HOOKS ---
    const {
        expenses,
        income,
        loading,
        saveExpense,
        deleteExpense,
        updateIncome
    } = useFirestore(user);

    const [showUserMenu, setShowUserMenu] = useState(false);

    // --- STAV (STATE) ---
    const [modal, setModal] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [expenseForm, setExpenseForm] = useState({ name: '', amount: '', day: '1' });
    const [localIncome, setLocalIncome] = useState(null);

    // Sync local income only when editing salary to avoid overriding saved values
    React.useEffect(() => {
        if (modal === 'salary' && income && !localIncome) {
            setLocalIncome(income);
        }
    }, [income, localIncome, modal]);

    // Use local income only while editing; otherwise use Firebase income
    const currentIncome = modal === 'salary' ? (localIncome || income) : income;

    const monthNames = ["Lednu", "Únoru", "Březnu", "Dubnu", "Květnu", "Červnu", "Červenci", "Srpnu", "Září", "Říjnu", "Listopadu", "Prosinci"];

    // --- LOGIKA: VÝPOČET ČISTÉ MZDY (CZ 2026) ---
    const calculateNet = (grossTotal) => {
        if (!grossTotal || grossTotal <= 0) return 0;
        const health = Math.ceil(grossTotal * 0.045);
        const social = Math.ceil(grossTotal * 0.071);
        let tax = Math.ceil(grossTotal * 0.15);
        tax = Math.max(0, tax - 2570);
        return grossTotal - health - social - tax;
    };

    // --- LOGIKA: TERMÍNY VÝPLATY ---
    const getPaydayDate = (date) => {
        let d = new Date(date.getFullYear(), date.getMonth(), 8);
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 6) d.setDate(d.getDate() + 2);
        else if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
        return d;
    };

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    // Příští výplata
    const nextPaydayDate = useMemo(() => {
        let payday = getPaydayDate(today);
        if (today > payday) {
            payday = getPaydayDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
        }
        return payday;
    }, [today]);

    // Poslední výplata (ze které teď žijeme)
    const lastPaydayDate = useMemo(() => {
        let paydayThisMonth = getPaydayDate(today);
        if (today >= paydayThisMonth) {
            return paydayThisMonth;
        } else {
            return getPaydayDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        }
    }, [today]);

    // --- LOGIKA: PRÉMIOVÁ VÝPLATA ---
    const nextPremiumMonthInfo = useMemo(() => {
        let checkMonth = today.getMonth();
        let checkYear = today.getFullYear();

        for (let i = 0; i < 12; i++) {
            let m = (checkMonth + i) % 12;
            let y = checkYear + Math.floor((checkMonth + i) / 12);
            if ((m - currentIncome.startMonth + 12) % 3 === 0) {
                const paydayInThatMonth = getPaydayDate(new Date(y, m, 1));
                if (paydayInThatMonth >= nextPaydayDate) {
                    return monthNames[m];
                }
            }
        }
        return "Nezadáno";
    }, [currentIncome.startMonth, nextPaydayDate, today]);

    // Výpočet čisté částky pro konkrétní měsíc
    const getNetForMonth = (date) => {
        const isPremium = (date.getMonth() - currentIncome.startMonth + 12) % 3 === 0;
        const premiumAmount = isPremium ? (currentIncome.gross * (currentIncome.premiumPct / 100)) : 0;
        const totalGross = currentIncome.gross + currentIncome.bonus + premiumAmount;
        return calculateNet(totalGross);
    };

    const lastPaydayNet = useMemo(() => getNetForMonth(lastPaydayDate), [lastPaydayDate, currentIncome]);
    const nextPaydayNet = useMemo(() => getNetForMonth(nextPaydayDate), [nextPaydayDate, currentIncome]);

    // --- LOGIKA: ZŮSTATEK PO VŠECH VÝDAJÍCH ---
    const timelineData = useMemo(() => {
        // Viditelné položky v přehledu (do příští výplaty)
        const upcomingExpenses = expenses.map(ex => {
            let d = new Date(today.getFullYear(), today.getMonth(), ex.day);
            if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, ex.day);
            return { ...ex, date: d, type: 'expense' };
        }).filter(ex => ex.date < nextPaydayDate)
            .sort((a, b) => a.date - b.date);

        // Suma VŠECH měsíčních výdajů
        const allExpensesSum = expenses.reduce((sum, ex) => sum + (parseFloat(ex.amount) || 0), 0);

        // Zůstatek počítaný z POSLEDNÍ výplaty
        const remainingFromLast = lastPaydayNet - allExpensesSum;

        return {
            items: [...upcomingExpenses, {
                id: 'payday',
                name: 'Příští výplata',
                amount: nextPaydayNet,
                date: nextPaydayDate,
                type: 'income',
                isPremium: (nextPaydayDate.getMonth() - currentIncome.startMonth + 12) % 3 === 0
            }],
            remaining: remainingFromLast
        };
    }, [expenses, nextPaydayDate, lastPaydayNet, nextPaydayNet, currentIncome.startMonth, today]);

    // --- HANDLERY ---
    const handleSaveExpense = async () => {
        if (!expenseForm.name || !expenseForm.amount) return;
        const data = {
            id: editingId || Date.now(),
            name: expenseForm.name,
            amount: parseFloat(expenseForm.amount),
            day: parseInt(expenseForm.day)
        };

        try {
            await saveExpense(data);
            setEditingId(null);
            setExpenseForm({ name: '', amount: '', day: '1' });
        } catch (error) {
            console.error('Failed to save expense:', error);
        }
    };

    const handleDeleteExpense = async (id) => {
        try {
            await deleteExpense(id);
        } catch (error) {
            console.error('Failed to delete expense:', error);
        }
    };

    const handleSaveIncome = async () => {
        try {
            await updateIncome(localIncome);
            setModal(null);
        } catch (error) {
            console.error('Failed to save income:', error);
        }
    };

    const startEdit = (ex) => {
        setEditingId(ex.id);
        setExpenseForm({ name: ex.name, amount: ex.amount.toString(), day: ex.day.toString() });
        setModal('expenses');
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <p className="text-slate-500 font-medium">Načítám data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-40 select-none font-sans">

            {/* Header s informacemi z minulé výplaty */}
            <div className="bg-white p-6 border-b border-slate-200 shadow-sm sticky top-0 z-30">
                {/* Login bar */}
                <div className="flex justify-center mb-4">
                    {authLoading ? (
                        <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
                    ) : user ? (
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-full transition-colors"
                            >
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                                ) : (
                                    <User size={18} className="text-slate-600" />
                                )}
                                <span className="text-sm font-semibold text-slate-700 max-w-[120px] truncate">
                                    {user.displayName || user.email?.split('@')[0]}
                                </span>
                            </button>
                            {showUserMenu && (
                                <div className="absolute right-0 top-12 bg-white shadow-lg rounded-2xl border border-slate-100 p-2 min-w-[150px] z-50">
                                    <button
                                        onClick={() => { logout(); setShowUserMenu(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                    >
                                        <LogOut size={16} /> Odhlásit se
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={login}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-semibold text-sm transition-colors shadow-lg shadow-indigo-200"
                        >
                            <LogIn size={16} /> Přihlásit se
                        </button>
                    )}
                </div>

                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Star size={10} className="text-yellow-500 fill-yellow-500" /> Prémie v
                        </h1>
                        <p className="text-lg font-black text-slate-800">{nextPremiumMonthInfo}</p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zbyde z minulé výplaty</h1>
                        <p className={`text-xl font-black ${timelineData.remaining < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {timelineData.remaining.toLocaleString()} Kč
                        </p>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                        className="bg-emerald-500 h-full transition-all duration-700"
                        style={{ width: `${Math.max(0, Math.min(100, (timelineData.remaining / lastPaydayNet) * 100))}%` }}
                    />
                </div>
            </div>

            {/* Seznam položek */}
            <div className="max-w-md mx-auto p-4 space-y-3">
                {timelineData.items.map((item) => (
                    <div
                        key={item.id}
                        className={`p-5 rounded-[2rem] border transition-all ${item.type === 'income'
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-100'
                            : 'bg-rose-500 border-rose-400 text-white shadow-xl shadow-rose-100'
                            }`}
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${item.type === 'income' ? 'bg-white/20' : 'bg-white/20 text-white'}`}>
                                    {item.type === 'income' ? <TrendingUp size={20} /> : <CreditCard size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{item.name}</span>
                                        {item.isPremium && <span className="text-[9px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-black uppercase">Prémie</span>}
                                    </div>
                                    <div className={`text-xs ${item.type === 'income' ? 'text-emerald-50' : 'text-rose-50'}`}>
                                        {item.date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })}
                                    </div>
                                </div>
                            </div>
                            <div className="text-lg font-black">
                                {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()} Kč
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Ovládací tlačítka */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 w-full max-w-sm px-6 z-40">
                <button
                    onClick={() => setModal('expenses')}
                    className="flex-1 bg-rose-500 text-white h-16 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-200 active:scale-95 transition-transform"
                >
                    <Edit3 size={18} /> Výdaje
                </button>
                <button
                    onClick={() => {
                        setLocalIncome(income);
                        setModal('salary');
                    }}
                    className="flex-1 bg-emerald-600 text-white h-16 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
                >
                    <Settings size={18} /> Příjem
                </button>
            </div>

            {/* Modal - Backdrop zavírání */}
            {modal && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex flex-col justify-end"
                    onClick={() => { setModal(null); setEditingId(null); }}
                >
                    <div className="flex-1 w-full cursor-pointer" />

                    <div
                        className="bg-white w-full max-h-[90vh] rounded-t-[3rem] p-8 overflow-y-auto shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

                        {modal === 'expenses' ? (
                            <div className="space-y-6 pb-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-black text-slate-800">Moje výdaje</h2>
                                    <button onClick={() => { setModal(null); setEditingId(null); }} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
                                </div>

                                <div className="space-y-3">
                                    {expenses.map(ex => (
                                        <div key={ex.id} className={`flex items-center justify-between p-5 rounded-3xl border ${editingId === ex.id ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                                            <div>
                                                <div className="font-bold text-slate-800">{ex.name}</div>
                                                <div className="text-xs text-slate-400 font-medium">{ex.day}. v měsíci • {ex.amount.toLocaleString()} Kč</div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => startEdit(ex)} className="text-slate-400 p-2"><Edit3 size={18} /></button>
                                                <button onClick={() => handleDeleteExpense(ex.id)} className="text-rose-400 p-2"><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-6 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 text-center tracking-widest">
                                        {editingId ? 'Upravit položku' : 'Nový výdaj'}
                                    </p>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Název</label>
                                        <input
                                            className="w-full bg-white rounded-2xl p-4 font-bold shadow-sm outline-none"
                                            value={expenseForm.name}
                                            onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Částka (Kč)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white rounded-2xl p-4 font-bold shadow-sm outline-none"
                                            value={expenseForm.amount}
                                            onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Den v měsíci</label>
                                        <select
                                            className="w-full bg-white rounded-2xl p-4 font-bold shadow-sm outline-none appearance-none"
                                            value={expenseForm.day}
                                            onChange={e => setExpenseForm({ ...expenseForm, day: e.target.value })}
                                        >
                                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                                                <option key={d} value={d}>{d}. den</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleSaveExpense}
                                        className="w-full bg-rose-500 text-white p-4 rounded-2xl font-black shadow-lg"
                                    >
                                        {editingId ? 'Uložit změny' : 'Přidat do seznamu'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-6">
                                <h2 className="text-2xl font-black text-slate-800">Příjem</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Hrubá mzda</label>
                                        <input
                                            type="number" value={localIncome?.gross || 0}
                                            onChange={e => setLocalIncome({ ...localIncome, gross: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-slate-100 rounded-2xl p-4 font-bold outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Bonusy</label>
                                        <input
                                            type="number" value={localIncome?.bonus || 0}
                                            onChange={e => setLocalIncome({ ...localIncome, bonus: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-slate-100 rounded-2xl p-4 font-bold outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Prémie (%)</label>
                                    <input
                                        type="number" value={localIncome?.premiumPct || 0}
                                        onChange={e => setLocalIncome({ ...localIncome, premiumPct: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-100 rounded-2xl p-4 font-bold outline-none"
                                    />
                                </div>
                                <div className="bg-emerald-600 text-white p-6 rounded-[2.5rem] shadow-xl">
                                    <p className="text-[10px] font-black uppercase opacity-60">Odhad příští čisté výplaty</p>
                                    <div className="text-4xl font-black">{nextPaydayNet.toLocaleString()} Kč</div>
                                </div>
                                <button
                                    onClick={handleSaveIncome}
                                    className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black"
                                >
                                    Uložit a zavřít
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
