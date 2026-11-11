# GAP V2 — conexión de datos (aislada)
Estado: laboratorio, NO conectado a producción ni publicado.

## Fuente comprobada
La web principal publica `site.enc` y `fast.enc` cifrados con AES-GCM y contraseña local. El registro real sólo existe en memoria del navegador tras descifrarlo. No se deben subir claves, contraseñas, material descifrado ni datos privados a GitHub público.

## Contrato de importación
`index.html` acepta un JSON local de registros:
```json
[
 {"date":"2026-11-05","snapshot":{"ticker":"TSLA","side":"CALL","gammaZeroDistancePct":0.1,"momentum15mPct":0.2,"fromPrevClosePct":0.3,"confirmingBars15m":2},"outcome":"PENDIENTE"}
]
```
Los números del ejemplo son ilustrativos, no datos reales.

## Requisitos para conectar automáticamente
1. Identificar en el código fuente del productor de GAP el esquema exacto y el instante congelado de cada predicción.
2. Construir un adaptador de solo lectura dentro de la sesión autenticada, sin exponer datos a un endpoint público.
3. Verificar que no se filtran valores posteriores al corte (evitar look-ahead).
4. Ensayar 5, 6, 9 y 10 de noviembre y días fuera de muestra.
5. Publicar el botón sólo después de probar compatibilidad, restauración y no regresión.

## Precauciones
- No modificar GAP, ni el registro original, ni V1/V2/V3/V4/INTRADÍA.
- No considerar 'FAVORABLE' como pronóstico validado.
- Si falta cualquier campo, el motor devuelve SIN_DATOS.


## Origen REAL localizado (11 nov 2026)
Repositorio privado: albertonational/Options-Mobile
- apps/gammalito-predicciongap/automation/close-forecast.mjs: genera pronóstico de próxima apertura solo SPY/QQQ con lecturas verificadas del cierre y 30 minutos antes; exige fuente Max Change · VOLUME 1m y ventana de 5 min.
- apps/gammalito-predicciongap/automation/close-reconstructions.json: históricos reconstruidos, marcados explícitamente como no prospectivos.
- apps/gammalito-predicciongap/automation/publish.mjs: publicación cifrada.
- apps/gammalito-predicciongap/automation/CLOSE-FORECAST.md: contrato funcional.
Regla original: CALL si delta precio >0 y delta Net GEX >0; PUT si ambos <0; si no INDECISO. Una contradicción respecto a Gamma Zero es contexto, no cambia el juicio.
IMPORTANTE: El motor experimental anterior requiere campos no presentes en esta salida (momentum15mPct, fromPrevClosePct, confirmingBars15m). NO debe conectarse sin reescribirlo para usar exclusivamente evidencia realmente disponible y probarlo fuera de muestra. Tampoco se debe sustituir INDECISO o SIN DATOS por CALL/PUT ficticios.
