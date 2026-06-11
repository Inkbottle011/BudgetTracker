import { create } from 'zustand'
import { Transaction, Category, Budget } from '../types'

interface TransactionStore {
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  setTransactions: (t: Transaction[]) => void
  setCategories: (c: Category[]) => void
  setBudgets: (b: Budget[]) => void
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  transactions: [],
  categories: [],
  budgets: [],
  setTransactions: (transactions) => set({ transactions }),
  setCategories: (categories) => set({ categories }),
  setBudgets: (budgets) => set({ budgets }),
}))