import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
    doc,
    setDoc,
    onSnapshot,
    collection,
    getDocs,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';

const DEFAULT_USER_ID = 'default-user';

export function useFirestore(user, authLoading) {
    const [expenses, setExpenses] = useState([]);
    const [income, setIncome] = useState({
        gross: 45000,
        bonus: 5000,
        premiumPct: 15,
        startMonth: 1
    });
    const [loading, setLoading] = useState(true);

    // Determine effective user ID (authenticated or demo)
    const userId = user ? user.uid : DEFAULT_USER_ID;

    // Safety timeout to prevent infinite loading
    useEffect(() => {
        if (!authLoading && loading) {
            const timer = setTimeout(() => {
                if (loading) {
                    console.warn('Firestore loading timed out, forcing app load.');
                    setLoading(false);
                }
            }, 3000); // 3 seconds timeout

            return () => clearTimeout(timer);
        }
    }, [loading, authLoading]);

    // Listen to expenses collection
    useEffect(() => {
        if (authLoading) return;

        setLoading(true);
        const expensesRef = collection(db, 'users', userId, 'expenses');

        const unsubscribe = onSnapshot(expensesRef, (snapshot) => {
            const expensesList = [];
            snapshot.forEach((doc) => {
                expensesList.push({ id: doc.id, ...doc.data() });
            });
            // Sort by day
            expensesList.sort((a, b) => a.day - b.day);
            setExpenses(expensesList);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching expenses:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, authLoading]);

    // Listen to income document
    useEffect(() => {
        if (authLoading) return;
        // Don't reset loading here to avoid flickering, expenses is the main driver
        const incomeRef = doc(db, 'users', userId, 'settings', 'income');

        const unsubscribe = onSnapshot(incomeRef, (snapshot) => {
            if (snapshot.exists()) {
                setIncome(snapshot.data());
            } else if (userId !== DEFAULT_USER_ID) {
                // If new user has no settings, try to copy defaults (optional, or just keep initial state)
                // For now we keep the initial state defined in useState
                initializeDefaults(userId);
            }
        }, (error) => {
            console.error('Error fetching income:', error);
        });

        return () => unsubscribe();
    }, [userId, authLoading, initializeDefaults]);

    // Add or update expense
    const saveExpense = useCallback(async (expense) => {
        try {
            const expenseRef = doc(db, 'users', userId, 'expenses', expense.id.toString());
            await setDoc(expenseRef, {
                name: expense.name,
                amount: expense.amount,
                day: expense.day
            });
        } catch (error) {
            console.error('Error saving expense:', error);
            throw error;
        }
    }, [userId]);

    // Delete expense
    const deleteExpense = useCallback(async (expenseId) => {
        try {
            const expenseRef = doc(db, 'users', userId, 'expenses', expenseId.toString());
            await deleteDoc(expenseRef);
        } catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    }, [userId]);

    // Update income settings
    const updateIncome = useCallback(async (newIncome) => {
        try {
            const incomeRef = doc(db, 'users', userId, 'settings', 'income');
            await setDoc(incomeRef, newIncome);
            setIncome(newIncome); // Optimistic update
        } catch (error) {
            console.error('Error updating income:', error);
            throw error;
        }
    }, [userId]);

    // Initialize default data if empty
    const initializeDefaults = useCallback(async (targetUserId) => {
        try {
            const expensesRef = collection(db, 'users', targetUserId, 'expenses');
            const snapshot = await getDocs(expensesRef);

            if (snapshot.empty) {
                // Add default expenses
                const batch = writeBatch(db);
                const defaultExpenses = [
                    { id: 1, name: 'Nájem', amount: 15000, day: 1 },
                    { id: 2, name: 'Elektřina', amount: 2800, day: 15 },
                    { id: 3, name: 'Internet', amount: 500, day: 20 }
                ];

                defaultExpenses.forEach(exp => {
                    const expRef = doc(db, 'users', targetUserId, 'expenses', exp.id.toString());
                    batch.set(expRef, { name: exp.name, amount: exp.amount, day: exp.day });
                });

                // Add default income
                const incomeRef = doc(db, 'users', targetUserId, 'settings', 'income');
                batch.set(incomeRef, {
                    gross: 45000,
                    bonus: 5000,
                    premiumPct: 15,
                    startMonth: 1
                });

                await batch.commit();
            }
        } catch (error) {
            console.error('Error initializing defaults:', error);
        }
    }, []);

    return {
        expenses,
        income,
        loading,
        saveExpense,
        deleteExpense,
        updateIncome
    };
}
