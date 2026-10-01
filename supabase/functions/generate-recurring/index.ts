// Adds subscription charges that have come due, for every user.
// All the logic lives in the database function generate_subscription_transactions()
// (see supabase/sql/subscriptions/01_setup.sql). It adds each charge once on its
// real date and the database refuses duplicates, so running this often, late,
// or twice at the same time is safe. The app also runs it for the signed-in user
// whenever it opens, so missed runs (e.g. while the project was paused) catch up.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase.rpc('generate_subscription_transactions')

  if (error) {
    console.error('generate_subscription_transactions failed:', error.message)
    return new Response(`Failed: ${error.message}`, { status: 500 })
  }

  return new Response(`Added ${data ?? 0} subscription charge(s)`, { status: 200 })
})
