import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: recurringList } = await supabase
    .from('transactions')
    .select('*')
    .neq('recurring', 'none')

  if (!recurringList) return new Response('No recurring transactions', { status: 200 })

  for (const t of recurringList) {
    let currentDate = new Date(t.date)
    const endDate = t.recurring_end ? new Date(t.recurring_end) : null

    while (true) {
      let nextDate = new Date(currentDate)
      if (t.recurring === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
      else if (t.recurring === 'biweekly') nextDate.setDate(nextDate.getDate() + 14)
      else if (t.recurring === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
      else if (t.recurring === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)

      if (nextDate > today) break
      if (endDate && nextDate > endDate) break

      const nextStr = nextDate.toISOString().split('T')[0]

      await supabase.from('transactions').insert({
        user_id: t.user_id,
        type: t.type,
        category_id: null,
        amount: t.amount,
        name: t.name,
        note: t.note,
        category_label: t.category_label,
        date: nextStr,
        recurring: t.recurring,
        recurring_end: t.recurring_end,
      })

      await supabase.from('transactions')
        .update({ date: nextStr })
        .eq('id', t.id)

      currentDate = nextDate
    }
  }

  return new Response('Recurring transactions generated', { status: 200 })
})