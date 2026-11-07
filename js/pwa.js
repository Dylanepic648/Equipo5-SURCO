if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('../sw.js', import.meta.url).href)
      .catch(e => console.error('No se registró el service worker', e))
  })
}
