#!/usr/bin/env python3
"""Recorta la ilustración de cada carta (assets/cards/*.png) y le quita el
fondo negro liso, para el modo espectáculo (js/espectaculo.js).

No se dibuja nada nuevo: es el mismo arte de las cartas, sin el marco ni el
fondo. El fondo de la ilustración es negro puro (0,0,0) y los contornos del
dibujo son casi negros (8-20), así que basta un relleno por inundación del
negro puro desde los bordes del recorte para separar la figura sin comerse
sus líneas.

Uso (requiere Pillow):  python3 tools/generar_figuras.py
Escribe assets/figuras/<personaje>.png. Vuelve a ejecutarlo si cambian las
cartas.
"""
from collections import deque
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'assets' / 'cards'
DESTINO = RAIZ / 'assets' / 'figuras'
PERSONAJES = ['maestro', 'clarividente', 'ocultista', 'cronomante', 'estratega',
              'cronista', 'aprendiz', 'centinela', 'picaro', 'metamorfo',
              'entusiasta', 'reena', 'sora', 'lumo']
# Zona de la ilustración dentro de la carta (362x504), por debajo del
# título y por encima del recuadro de la habilidad.
CAJA = (12, 84, 342, 362)
UMBRAL = 4  # suma R+G+B máxima para considerar "fondo negro puro"


def _inundar(px, w, h, semillas, pasa, quitado):
    cola = deque(semillas)
    while cola:
        x, y = cola.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or quitado[y * w + x]:
            continue
        if not pasa(px[x, y]):
            continue
        quitado[y * w + x] = 1
        cola.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])


def _quitar_iconos_sueltos(px, w, h, franja=60):
    """Borra islas opacas que empiezan en la franja inferior del recorte:
    son los iconos de habilidad de la carta, no parte de la figura."""
    visto = bytearray(w * h)
    for y0 in range(h):
        for x0 in range(w):
            if visto[y0 * w + x0] or px[x0, y0][3] == 0:
                continue
            isla, cola = [], deque([(x0, y0)])
            visto[y0 * w + x0] = 1
            while cola:
                x, y = cola.popleft()
                isla.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not visto[ny * w + nx] and px[nx, ny][3]:
                        visto[ny * w + nx] = 1
                        cola.append((nx, ny))
            if min(y for _, y in isla) > h - franja or len(isla) < 6:
                for x, y in isla:
                    px[x, y] = (0, 0, 0, 0)


def recortar(nombre):
    carta = Image.open(ORIGEN / f'{nombre}.png').convert('RGBA')
    im = carta.crop(CAJA)
    w, h = im.size
    px = im.load()
    quitado = bytearray(w * h)
    borde = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] \
        + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    # 1) Marco gris de la carta (desaturado, no negro puro), solo desde los
    #    laterales y el borde superior: por abajo hay figuras (p. ej. Reena)
    #    que llegan al límite del recorte con zonas blancas.
    laterales = [(x, 0) for x in range(w)] + [(0, y) for y in range(h)] \
        + [(w - 1, y) for y in range(h)]
    es_marco = lambda p: max(p[:3]) - min(p[:3]) < 45 and sum(p[:3]) > UMBRAL
    _inundar(px, w, h, laterales, es_marco, quitado)
    # 2) Fondo negro puro, sembrado desde los bordes y desde todo lo quitado.
    semillas = list(borde)
    for y in range(h):
        for x in range(w):
            if quitado[y * w + x]:
                semillas.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    marcado = bytearray(quitado)
    for y in range(h):
        for x in range(w):
            if quitado[y * w + x]:
                marcado[y * w + x] = 0
    es_fondo = lambda p: sum(p[:3]) <= UMBRAL
    _inundar(px, w, h, semillas, es_fondo, marcado)
    for i in range(w * h):
        if quitado[i] or marcado[i]:
            px[i % w, i // w] = (0, 0, 0, 0)
    _quitar_iconos_sueltos(px, w, h)
    caja = im.getbbox()
    if caja:
        im = im.crop(caja)
    DESTINO.mkdir(parents=True, exist_ok=True)
    im.save(DESTINO / f'{nombre}.png', optimize=True)
    return im.size


if __name__ == '__main__':
    for n in PERSONAJES:
        print(n, recortar(n))
