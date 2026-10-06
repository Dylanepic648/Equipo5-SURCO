import { supabase } from './supabase.js'
import { } from './login.js'

const { data, error } = await supabase
  .from('operaciones')
  .select()

console.log(data, error)