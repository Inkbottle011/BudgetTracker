import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTransactionStore } from '../store/useTransactionStore'

export function useTransactions() {
  const { setTransactions, setCategories } = useTransactionStore()
  
  useEffect(() => {
    async function fetchData() {
      const { data: transactions, error: t_error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      
      const { data: categories, error: c_error } = await supabase
      .from('categories')
      .select('*')
      
      console.log('transactions error:', t_error)
      console.log('categories error:', c_error)
      
      if (transactions) setTransactions(transactions)
        if (categories) setCategories(categories)
        }
    
    fetchData()
  }, [])
}