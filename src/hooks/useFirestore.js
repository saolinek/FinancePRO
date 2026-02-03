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

const USER_DOC_ID = 'default-user'; // Pro jednoduchost bez auth

export function useFirestore() {
    const [expenses, setExpenses] = useState([]);
    const [income, setIncome] = useState({
        gross: 45000,
        bonus: 5000,
        premiumPct: 15,
        startMonth: 1
    });
    const [loading, setLoading] = useState(true);

    // Listen to expenses collection
    useEffect(() => {
        const expensesRef = collection(db, 'users', USER_DOC_ID, 'expenses');

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
    }, []);

    // Listen to income document
    useEffect(() => {
        const incomeRef = doc(db, 'users', USER_DOC_ID, 'settings', 'income');

        const unsubscribe = onSnapshot(incomeRef, (snapshot) => {
            if (snapshot.exists()) {
                setIncome(snapshot.data());
            }
        }, (error) => {
            console.error('Error fetching income:', error);
        });

        return () => unsubscribe();
    }, []);

    // Add or update expense
    const saveExpense = useCallback(async (expense) => {
        try {
            const expenseRef = doc(db, 'users', USER_DOC_ID, 'expenses', expense.id.toString());
            await setDoc(expenseRef, {
                name: expense.name,
                amount: expense.amount,
                day: expense.day
            });
        } catch (error) {
            console.error('Error saving expense:', error);
            throw error;
        }
    }, []);

    // Delete expense
    const deleteExpense = useCallback(async (expenseId) => {
        try {
            const expenseRef = doc(db, 'users', USER_DOC_ID, 'expenses', expenseId.toString());
            await deleteDoc(expenseRef);
        } catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    }, []);

    // Update income settings
    const updateIncome = useCallback(async (newIncome) => {
        try {
            const incomeRef = doc(db, 'users', USER_DOC_ID, 'settings', 'income');
            await setDoc(incomeRef, newIncome);
            setIncome(newIncome); // Optimistic update
        } catch (error) {
            console.error('Error updating income:', error);
            throw error;
        }
    }, []);

    // Initialize default data if empty
    const initializeDefaults = useCallback(async () => {
        try {
            const expensesRef = collection(db, 'users', USER_DOC_ID, 'expenses');
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
                    const expRef = doc(db, 'users', USER_DOC_ID, 'expenses', exp.id.toString());
                    batch.set(expRef, { name: exp.name, amount: exp.amount, day: exp.day });
                });

                // Add default income
                const incomeRef = doc(db, 'users', USER_DOC_ID, 'settings', 'income');
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

    // Initialize on first load
    useEffect(() => {
        initializeDefaults();
    }, [initializeDefaults]);

    return {
        expenses,
        income,
        loading,
        saveExpense,
        deleteExpense,
        updateIncome
    };
}
