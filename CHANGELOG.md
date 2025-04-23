# Changelog

Todas las versiones importantes del simulador de Invocadores.

---

## [v1.2.0] - 2024-04-23

### Añadido
- Botón azul flotante "Jugar una carta" en la cabecera para abrir el panel de juego.
- Comportamiento coherente del botón azul con la selección de carta (usa la misma lógica que clickar en una carta).
- Botón "Jugar carta" visible solo cuando comienza la partida.
- Panel flotante "Jugar carta" rediseñado: compacto, con botones alineados, y botón de cierre ("X").
- Panel de juego ahora reutiliza lógica existente (`selectCard(0)`), evitando duplicación de código.

### Corregido
- Eliminado botón duplicado `btnEndTurn` en el HTML.
- Corregido error en `setup.js` y `actions.js` por elementos no disponibles al cargar.
- Se evita mostrar el botón azul antes de que comience el juego.
- Ajustado comportamiento de `btnCtrlPlay` para evitar errores si no hay cartas en la mano.

---

## [v1.1.0] - 2025-04-23

### Añadido
- Detección automática de versión desde `manifest.json`.
- Aviso de nueva versión disponible con botón para actualizar la app al instante.
- Enlace desde la interfaz al `CHANGELOG.md` del repositorio.

---


## [v1.0.0] - 2025-04-22

### Añadido
- Primera versión funcional y jugable del simulador.
- Interfaz visual adaptada para escritorio y móvil.
- Sistema completo de turnos y portales.
- Habilidades activas de personajes: Cronista, Clarividente, Centinela, Ocultista, Aprendiz, Metamorfo, etc.
- Sistema de visibilidad por carta según jugador y estado.
- Gestión de puntuación por objetivos invocados.
- Iconografía de personajes.
- Registro y activación de Service Worker para funcionamiento offline.
- Archivo `manifest.json` con nombre, colores e iconos.
- Botón flotante de instalación PWA para Android.
- Instrucciones de instalación para iOS.

---
