# Antecedentes y errores historicos

[[Estado del Proyecto]] y [[Proximos Pasos]] contienen la historia previa de implementación y pruebas. Conservamos esa historia: haber corregido un caso anterior no implica haber cubierto todos sus casos límite.

| Antecedente registrado | Qué aprender y cómo se relaciona con la revisión actual |
|---|---|
| Fallo de BOM en archivos | Un archivo puede llevar bytes iniciales que afectan su lectura. El arreglo previo no reemplaza validar estructura y persistencia: E12 y E17. |
| Coincidencias de búsqueda corregidas anteriormente | Una mejora en matching puede dejar sin cubrir códigos cortos, duplicados y barcodes emitidos: E01, E02 y E03. |
| Etiqueta física y ciclo con lector verificados anteriormente | Son evidencia para el contenido y equipo usado entonces. Nuevos lotes, textos y codificaciones necesitan sus propios casos: M05. |
| Cantidades y validaciones trabajadas en fases anteriores | Validar el número de copias no elimina el crecimiento del argumento USB: E09. |
| Ajustes de plantilla y centrado | El cálculo de ancho tiene que coincidir con la codificación emitida y dejar margen de lectura: E08 y E19. |
| Copia antigua y artefactos retirados | La limpieza ya se hizo; su prevención y organización se explican en M06. |

No se reabren automáticamente problemas ya resueltos. Para cada nuevo síntoma se necesita una reproducción concreta y una nota de [[Como registrar una correccion]]. La lista de trabajo actual está en [[Mapa de errores y aprendizaje]].
