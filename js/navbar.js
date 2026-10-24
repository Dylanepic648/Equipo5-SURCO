const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const main = document.getElementById('main');

function aplicar(abierto) {
    sidebar.classList.toggle('menu-toggle', abierto);
    menu.classList.toggle('menu-toggle', abierto);
    main.classList.toggle('menu-toggle', abierto);
}

sidebar.addEventListener('mouseenter', () => aplicar(true));
sidebar.addEventListener('mouseleave', () => aplicar(false));

import('./supabase.js');

document.getElementById('btnSalir')?.addEventListener('click', async e => {
  e.preventDefault()
  e.stopImmediatePropagation()
  if (!confirm('¿Quieres cerrar sesión?')) return
  const { supabase } = await import('./supabase.js')
  await supabase.auth.signOut()
  location.href = '/login.html'
}, true)