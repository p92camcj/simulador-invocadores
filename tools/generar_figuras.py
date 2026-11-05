#!/usr/bin/env python3
"""Prepara el arte de los personajes para el modo espectáculo (js/espectaculo.js).

Origen: assets/personajes/*.svg, el arte original de cada personaje (exportado
de Canva, una ilustración de cuerpo entero con el nombre en una pastilla
arriba). No se dibuja nada nuevo: solo se rasteriza, se quita la pastilla del
nombre y el fondo blanco donde lo haya, y se recorta.

Requiere Pillow y Playwright (Chromium) para rasterizar los SVG:
    node tools/rasterizar_svg.cjs        # SVG -> PNG en build/personajes/
    python3 tools/generar_figuras.py     # PNG -> assets/figuras/*.webp, assets/invocaciones/*.webp, assets/portal.jpg
"""
from collections import deque
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
RASTER = RAIZ / 'build' / 'personajes'
PERSONAJES = ['maestro', 'clarividente', 'ocultista', 'cronomante', 'estratega',
              'cronista', 'aprendiz', 'centinela', 'picaro', 'metamorfo',
              'entusiasta', 'reena', 'sora', 'lumo']
INVOCACIONES = ['cirelia', 'baelorith', 'aelgorth']
ALTO_MAX = 900
# Exportados con un rectángulo de fondo blanco (el resto ya viene sin fondo;
# aplicarlo a todos se comería detalles blancos del dibujo, como el halo de
# Cirelia).
CON_FONDO_BLANCO = {'aprendiz', 'ocultista'}


def es_pastilla(p):
    r, g, b, a = p
    return a > 200 and max(r, g, b) - min(r, g, b) < 18 and 35 < r < 95


def quitar_pastilla(im):
    """Borra todo lo que hay por encima de la pastilla gris con el nombre."""
    w, h = im.size
    px = im.load()
    fondo = 0
    for y in range(min(h, int(h * 0.22))):
        if sum(es_pastilla(px[x, y]) for x in range(0, w, 2)) > w * 0.12:
            fondo = y
    if fondo:
        for y in range(fondo + 6):
            for x in range(w):
                px[x, y] = (0, 0, 0, 0)
    return fondo


def quitar_fondo_blanco(im):
    """Relleno por inundación del blanco (o casi) conectado a los bordes."""
    w, h = im.size
    px = im.load()
    pasa = lambda p: p[3] < 20 or (min(p[:3]) > 222 and max(p[:3]) - min(p[:3]) < 26)
    visto = bytearray(w * h)
    cola = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
                 + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while cola:
        x, y = cola.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visto[y * w + x]:
            continue
        visto[y * w + x] = 1
        if not pasa(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        cola.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])


def quitar_restos_arriba(im, limite, minimo=600):
    """Borra islas pequeñas en la franja superior (restos del borde de la
    pastilla del nombre)."""
    w, h = im.size
    px = im.load()
    visto = bytearray(w * limite)
    for y0 in range(limite):
        for x0 in range(w):
            if visto[y0 * w + x0] or px[x0, y0][3] <= 24:
                continue
            isla, cola, toca_abajo = [], deque([(x0, y0)]), False
            visto[y0 * w + x0] = 1
            while cola:
                x, y = cola.popleft()
                isla.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 24:
                        if ny >= limite:
                            toca_abajo = True
                            continue
                        if not visto[ny * w + nx]:
                            visto[ny * w + nx] = 1
                            cola.append((nx, ny))
            # Solo islas grises oscuras/blancas (borde y letras de la
            # pastilla), nunca destellos de color del propio dibujo.
            colores = [px[x, y] for x, y in isla]
            desaturada = sum(max(c[:3]) - min(c[:3]) < 30 for c in colores) > len(colores) * 0.8
            if not toca_abajo and len(isla) < minimo and desaturada:
                for x, y in isla:
                    px[x, y] = (0, 0, 0, 0)


def preparar(nombre, destino):
    im = Image.open(RASTER / f'{nombre}.png').convert('RGBA')
    fondo_pastilla = quitar_pastilla(im)
    if nombre in CON_FONDO_BLANCO:
        quitar_fondo_blanco(im)
    if fondo_pastilla:
        quitar_restos_arriba(im, min(im.height, fondo_pastilla + 40))
    caja = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    im = im.crop(caja)
    if im.height > ALTO_MAX:
        im = im.resize((round(im.width * ALTO_MAX / im.height), ALTO_MAX), Image.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    # WebP con transparencia: una décima parte de lo que ocupa el PNG.
    im.save(destino, 'WEBP', quality=86, method=6)
    return im.size


def preparar_portal():
    """La ilustración del Portal sin el marco de la carta."""
    im = Image.open(RASTER / 'portal.png').convert('RGB')
    w, h = im.size
    im = im.crop((round(w * 0.095), round(h * 0.17), round(w * 0.905), round(h * 0.925)))
    im.save(RAIZ / 'assets' / 'portal.jpg', quality=86, optimize=True)
    return im.size


if __name__ == '__main__':
    for n in PERSONAJES:
        print(n, preparar(n, RAIZ / 'assets' / 'figuras' / f'{n}.webp'))
    for n in INVOCACIONES:
        print(n, preparar(n, RAIZ / 'assets' / 'invocaciones' / f'{n}.webp'))
    print('portal', preparar_portal())
