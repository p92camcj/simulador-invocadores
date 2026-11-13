# Estrategia de las autómatas

Qué estrategias del reglamento usan las autómatas, cómo se han medido y
qué opciones hay para que aprendan de partidas reales. Escrito el
2026-11-06 (versión 1.29.1). Las cifras salen de `tools/arena.mjs`
(partidas completas entre autómatas, con semilla fija y asientos rotados).

## Estrategias que salen del reglamento

1. **Cada Gema es un punto.** Gana quien suma más Gemas, y no se da
   cambio: activar un Portal central cuesta una Gema de 1, es decir, un
   punto. Solo compensa si la habilidad trae más de lo que cuesta. Era el
   fallo más grave de Difícil: gastaba sus Gemas en habilidades centrales
   sin retorno y acababa la partida con 1,6 Gemas de media.
2. **Cobrar, no solo cerrar.** Al cerrar una invocación cobra cada
   requisito visible, no duplicado y en un Portal con dueña. Cerrar cuando
   la mayoría de Gemas son de otras es ayudarlas. Difícil y Experta
   calculan el reparto exacto antes de cerrar.
3. **Negar con duplicados.** Un requisito duplicado no da Gemas a nadie.
   Jugar el mismo personaje en otro Portal anula la Gema de una rival.
4. **No dejar el cierre servido.** Si tu jugada deja la invocación a una
   carta de cerrarse, la siguiente jugadora puede cerrarla y cobrar.
   Difícil lo estima con el conteo de cartas; Experta juega en cada mundo
   posible el turno de cada rival y mira qué pasa.
5. **Pícaro y Maestro.** Un Pícaro visible en tu Portal da +1 en
   cualquier invocación; el Maestro da +3 si es requisito y no hay ningún
   Pícaro en la mesa. Ambos entran en el cálculo del reparto.
6. **Todos los Portales cuentan.** Los centrales también tienen que estar
   ocupados para cerrar. En las partidas entre autómatas se quedaban vacíos
   muchos turnos.

## Resultados

| Mesa | Antes | Ahora |
|---|---|---|
| Difícil contra 2 Normal | 46 % | 78 % |
| Difícil contra 3 Normal | 41 % | 52 % |
| Difícil contra Normal (2 jugadoras) | 73 % | 77 % |
| Experta contra 2 Difícil | 60 % (Difícil antigua) | 48 % (Difícil nueva, más fuerte) |
| Experta contra Difícil (2 jugadoras) | 67 % | 66 % |
| Experta nueva contra 2 Experta antiguas | 33 % (empate) | 38 % |
| Invocaciones por partida, Experta + 2 Difícil | 0,7 | 1,1 |

Probado y descartado en 1.29.1: premiar el "progreso hacia el cierre"
(llenar Portales, colocar requisitos aunque cobren otras). Con autojuego, la
autómata que lo usaba perdía: ayudaba más a las rivales que a sí misma.
En 1.38.5 se recupera a propósito: ver la sección siguiente.

## Cooperar para invocar (1.38.5)

Pedido por Julio el 2026-11-13: las autómatas no priorizaban completar las
invocaciones, y ese es el objetivo principal. Invocadores es
semicooperativo: se coopera para invocar y, dentro de eso, se compite por
ser quien más Gemas tiene. Lo lógico es poner requisitos en los Portales
centrales (no cobra nadie) y uno en un Portal propio, para cobrar solo una.

Hasta 1.38.4 Difícil y Experta solo miraban Gemas propias menos Gemas de
la mejor rival. Entre autómatas nadie quería colocar un requisito que
pudiera aprovechar otra, y la invocación casi nunca se cerraba.

Ahora hay dos pesos más en `PESOS` (`js/bot-estrategia.js`), que usan las dos
dificultades (Experta también al puntuar sus mundos simulados):

- `invocar` (10): lo que vale que la invocación se complete, cobre quien
  cobre. Cerrar es casi siempre la mejor jugada, y dejar el cierre servido a
  la siguiente jugadora ya no se evita si la invocación sale adelante.
- `progreso` (1): cada requisito distinto visible en cualquier Portal
  (también central), menos medio por cada Portal vacío u oculto.

Como el valor de posición (requisito único en Portal propio) sigue ahí, la
autómata prefiere su requisito en su Portal y el resto en los centrales. En
Fase B, Difícil resta el progreso que pierde al tapar u ocultar el requisito
de una rival, y suma el de girar boca arriba un Portal oculto. Con
`invocar` y `progreso` a 0 juega exactamente como antes.

Medido con `tools/equilibrio.mjs` (3 jugadoras salvo indicación, misma
semilla):

| Mesa | Invocaciones por partida antes | Ahora | Partidas sin ninguna, antes → ahora |
|---|---|---|---|
| 3 Difícil, modo Normal (1000) | 0,37 | 2,11 | 68 % → 0 % |
| 3 Difícil, modo Experto (1000) | 0,08 | 2,10 | 92 % → 4 % |
| 4 Difícil, modo Normal (1000) | 0,37 | 2,18 | 66 % → 0 % |
| 3 Experta, modo Experto (80) | 1,95 | 3,67 | 10 % → 0 %; Madain del 20 % al 79 % |

Experta ya cooperaba bastante (simula el turno de cada rival y veía que
dejar la mesa bloqueada no le daba nada), pero en modo Experto se quedaba
corta: ahora llega a la A en el 91 % de las partidas (antes 28 %). En modo
Normal, Experta contra Experta ya completaba las 3 invocaciones en la
muestra medida, antes y después.

Normal también coopera: ya no tapa el único requisito visible de una rival
(bloqueaba la invocación) y, si su carta conocida es un requisito que aún no
está en la mesa, lo pone a la vista, en un Portal propio si puede.

| Mesa (modo Normal, 1000 partidas) | Invocaciones antes | Ahora | Victorias de Difícil antes → ahora |
|---|---|---|---|
| 3 Normal | 0,31 | 2,29 | |
| Difícil contra 2 Normal | 0,40 | 2,22 | 79 % → 45 % |

Difícil sigue ganando bastante más que Normal (45 % frente a 27 % por
asiento), pero la diferencia baja: antes Normal casi nunca invocaba y cada
Gema de 1 decidía la partida; ahora las Gemas de las invocaciones las
reparten todas.

Victorias entre Difícil: Contra dos
Difícil antiguas (que no cooperan) la nueva gana un 26-32 % en vez del 33 %
de un reparto justo: quien no coopera se aprovecha de quien sí. Es el
dilema de todo juego semicooperativo; la regla de "si no hay ninguna
invocación no gana nadie" (pendiente de Adrián) lo corregiría. Pesos más
competitivos (`posicion` 0,7, `rival` 1, contar a la mitad los requisitos en
Portales de rivales) apenas recortan esa diferencia y bajan mucho las
invocaciones, así que se descartaron.

## Aprendizaje con partidas de personas (1.30.0)

Elegido: aprender en el propio navegador, de forma autónoma, a partir de
las JUGADAS (no solo del resultado), porque cada partida da unas diez
jugadas por persona y así se aprende con pocas partidas.

1. Cada vez que una persona juega una carta se guarda lo que veía en la
   mesa (la misma vista que usan las autómatas, desde su asiento y sin
   nombres) y la jugada que hizo. Se conservan las últimas 300.
2. Al acabar la partida se busca qué pesos de la evaluación de Difícil
   explican mejor esas jugadas (máxima verosimilitud): cuánto le importa a
   esa gente lo que ganan las rivales, lo ya colocado, el riesgo de dejar
   el cierre servido, y si prefiere jugar la carta que ve.
3. Desde 15 jugadas, la Experta usa ese modelo para prever a las personas
   cuando simula sus turnos.

Medido en la arena con "personas" simuladas que juegan distinto a Difícil
(se preocupan poco por las rivales y nada por dejar el cierre servido): el
ajuste recupera exactamente sus pesos y la Experta pasa del 50 % al 61 % de
victorias contra ellas.

Límites: lo aprendido vive en cada dispositivo (se puede descargar e
importar en otro para juntarlo) y la Experta tarda algo más por turno.

### Otras opciones que quedan

- **Aprender del resultado** (qué pesos ganan más contra personas): pide
  muchas más partidas que aprender de las jugadas.
- **Enviar las partidas a un servidor**: lo más cómodo a largo plazo, pero
  necesita un servidor y aviso de privacidad. Encaja con el futuro modo
  multijugador por red.
