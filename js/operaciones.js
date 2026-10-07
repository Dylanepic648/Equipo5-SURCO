import { supabase } from '../../js/supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  window.location.href = '../../login.html'
}

const { data: d, error: dr } = await supabase.from('usuarios').select()
console.log(d, dr)

const datacatch = d;


