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

Probado y descartado: premiar el "progreso hacia el cierre" (llenar
Portales, colocar requisitos aunque cobren otras). Con autojuego, la
autómata que lo usaba perdía: ayudaba más a las rivales que a sí misma.

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
