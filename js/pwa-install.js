
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('pwa-install-container');
  if (!container) return;

  let deferredPrompt = null;

  // Detectar iOS
  const isIOS = () => {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  };

  const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

  // Crear botón
  const createButton = (text) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = '9999';
    btn.style.padding = '10px 15px';
    btn.style.backgroundColor = '#6c4eb6';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';
    return btn;
  };

  // Android: capturar el evento
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const btn = createButton('Instalar esta app');
    btn.addEventListener('click', () => {
      btn.remove();
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
          console.log('App instalada');
        }
        deferredPrompt = null;
      });
    });

    container.appendChild(btn);
  });

  // iOS: mostrar instrucciones si no está ya instalada
  if (isIOS() && !isInStandaloneMode()) {
    const btn = createButton('¿Quieres instalar esta app?');
    btn.addEventListener('click', () => {
      alert('Para instalar esta app en tu iPhone o iPad:\n1. Toca el botón "Compartir" (cuadro con flecha).\n2. Selecciona "Añadir a pantalla de inicio".');
    });
    container.appendChild(btn);
  }
});
