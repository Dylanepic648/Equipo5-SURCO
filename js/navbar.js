const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const main = document.getElementById('main');

function aplicar(colapsado) {
    sidebar.classList.toggle('menu-toggle', colapsado);
    menu.classList.toggle('menu-toggle', colapsado);
    main.classList.toggle('menu-toggle', colapsado);
}

const sinAnim = document.createElement('style');
sinAnim.textContent = '.sidebar, .sidebar *, .main { transition: none !important; }';
document.head.appendChild(sinAnim);

aplicar(localStorage.getItem('menu-colapsado') === '1');

sidebar.offsetHeight;
requestAnimationFrame(() => requestAnimationFrame(() => sinAnim.remove()));

const guardado = () => localStorage.getItem('menu-colapsado') === '1';

sidebar.addEventListener('mouseenter', () => aplicar(guardado()));

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