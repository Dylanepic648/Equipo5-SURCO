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

sidebar.offsetHeight; // fuerza el cálculo de estilos
requestAnimationFrame(() => requestAnimationFrame(() => sinAnim.remove()));

menu.addEventListener('click', () => {
    const colapsado = !sidebar.classList.contains('menu-toggle');
    aplicar(colapsado);
    localStorage.setItem('menu-colapsado', colapsado ? '1' : '0');
});