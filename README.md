# UTI Ronda · MVP local

Módulo estático y aislado dentro de `app` para organizar una ronda y generar un borrador de evolución en español clínico. No usa backend, no envía datos, no persiste la ronda y no se integra con Geclisa. Incluye un enlace hacia el checkout local de `UTI Tools`, pero no modifica ese repositorio ni MIRA.

## Privacidad

- No existen campos para nombre, DNI, historia clínica, teléfono ni correo.
- El detector local marca menciones obvias de identificadores en los campos de texto.
- Si la nota manual activa esa alerta, no se incorpora al borrador hasta corregirla.
- La detección es preventiva y no garantiza anonimización completa: la revisión humana sigue siendo obligatoria.

## Texto, audio y transcripción

El flujo principal es pegar una nota o transcripción ya revisada, o importar un TXT local. UTI Ronda no interpreta, corrige ni resume automáticamente ese texto: lo incorpora directamente al borrador, sujeto a revisión médica y al control preventivo de identificadores. Elimina únicamente la leyenda administrativa `Este contenido se generó con IA` cuando aparece en el texto importado.

El audio quedó como control opcional y plegado, únicamente para escucharlo mientras se corrige el texto. Puede descargarse manualmente desde WhatsApp Web y abrirse localmente. WhatsApp no se automatiza ni se conecta con la app. El navegador crea una URL `blob:` temporal para reproducir el archivo; no se sube ni se guarda.

Se aceptan audios `.opus`, `.ogg`, `.oga`, `.m4a` y `.mp4`, además de AAC, MP3, WAV y WebM, por extensión o por un tipo MIME de audio asociado. Los audios de WhatsApp encapsulados como MP4 también se aceptan si Windows o el navegador informan `audio/mp4`, `video/mp4`, un MIME vacío o un MIME genérico/incorrecto: la extensión reconocida alcanza para mantener el archivo cargado localmente.

La reproducción depende del soporte de códec y contenedor del navegador. Si el elemento `<audio>` no puede previsualizar un archivo aceptado, la app conserva su nombre, tamaño y estado local y muestra `Vista previa no disponible para este formato; el archivo sigue cargado localmente`; no lo rechaza ni lo sube.

No hay transcripción automática, local ni cloud. En esta notebook se encontró el módulo Python `faster_whisper`, pero no un modelo local, un ejecutable estable ni `ffmpeg`; integrarlo exigiría dependencias y archivos pesados. El control se llama **“Cargar transcripción existente (.txt)”** porque únicamente abre un texto ya producido por otra herramienta: no transcribe el audio. La transcripción automática queda como funcionalidad futura, sin nube, API ni procesos pesados en este cambio.

## Soporte respiratorio

El selector diferencia ventilación invasiva, ventilación no invasiva (VNI) y oxigenoterapia sin VNI. Para VNI permite consignar modo, interfaz, IPAP o presión inspiratoria, EPAP/PEEP, FiO₂ y frecuencia respiratoria observada. El borrador incorpora solamente los parámetros ingresados y no interpreta respuesta ni propone cambios del soporte.

## Infusiones

La biblioteca trazable se transpuso en `uti-ronda-core.js` sin importar ni modificar los otros artefactos:

- `UTI Tools/vasopresores.html`: noradrenalina 4 mg/ampolla, dobutamina 250 mg/ampolla, adrenalina 1 mg/ampolla y vasopresina 20 UI/ampolla.
- Nitroprusiato de sodio está disponible sin contenido precargado: UTI Tools y MIRA locales no fijan una presentación, por lo que exige ingresar y corroborar el contenido real por ampolla.
- Nitroglicerina queda sin contenido precargado porque `UTI Tools` registra 25 mg/ampolla y la Recorrida previa 50 mg/ampolla.
- MIRA + UTI Tools: fentanilo 0,5 mg/ampolla (500 mcg), remifentanilo 5 mg/ampolla y dexmedetomidina 0,2 mg/ampolla (200 mcg).
- Midazolam usa `15 mg/ampolla` como valor sugerido, confirmado por el usuario para su práctica. Permanece editable y debe verificarse contra la presentación disponible. El contenido por ampolla, la masa total (`ampollas × 15 mg`) y la concentración final (`masa total ÷ volumen final`) se muestran como magnitudes distintas.
- Propofol está presente en MIRA como dosis en mg/kg/h, pero sin una presentación de ampolla confirmada; por eso exige contenido real.

Los valores sugeridos son editables y la pantalla distingue referencia, modificación e ingreso obligatorio. Las fórmulas puras son:

```text
masa total (mg) = ampollas × contenido por ampolla convertido a mg
concentración (mg/mL) = masa total ÷ volumen final
dosis absoluta (mcg/min) = concentración (mg/mL) × 1000 × mL/h ÷ 60
dosis normalizada primaria (mcg/kg/min) = mcg/min ÷ peso real

actividad total (UI) = ampollas × UI por ampolla
UI/min = (UI ÷ volumen final editable) × mL/h ÷ 60
```

Para vasopresina la lectura principal es `mL/h → UI/min`; `UI/h` queda como apoyo. Ejemplo: 3 ampollas de 20 UI en 100 mL producen 0,6 UI/mL; 3, 4 y 5 mL/h equivalen a 0,03, 0,04 y 0,05 UI/min. El volumen final siempre permanece editable.

La interfaz muestra la concentración para auditar el cálculo. En vasoactivos de masa también compara `mcg/kg/min` por peso real, ideal y ajustado cuando esos pesos están disponibles. El peso real queda identificado como referencia primaria; las otras lecturas no modifican la bomba ni sugieren titulación. El borrador omite ampollas y dilución y conserva velocidad, dosis absoluta y dosis por peso real para no saturar la evolución. No titula, clasifica ni recomienda conducta.

Para midazolam, remifentanilo, fentanilo, dexmedetomidina y propofol se registra una duración de infusión mayor de 0 y hasta 72 horas. Desde 24 h se muestra también la equivalencia en días (por ejemplo, `36 h (1,5 días)`). El total administrado se estima con:

```text
total administrado (mg) = dosis absoluta (mg/h) × duración (h)
```

La estimación supone concentración y velocidad constantes durante todo el período. Es dosis acumulada administrada, no una estimación de acumulación farmacocinética, concentración plasmática ni tiempo de despertar.

## Hemodinamia y antropometría

Las funciones puras reutilizan las convenciones verificadas en los módulos locales de `UTI Tools`:

```text
Índice de Shock Diastólico (DSI) = frecuencia cardíaca ÷ presión arterial diastólica
IMC = peso real (kg) ÷ talla² (m)
peso ideal estimado = 22,5 kg/m² × talla² (m)
```

El DSI requiere FC `1–300 lpm`, TAD `1–200 mmHg` y, en la interfaz, TAS válida `1–300 mmHg` y no menor que la TAD. Se muestra sin umbrales ni acciones automáticas, con una leyenda que exige integrarlo con perfusión, tendencia, vasoactivos y contexto clínico.

Para antropometría se aceptan peso real `20–350 kg` y talla `100–250 cm`, los mismos límites de UTI Tools. En obesidad (`IMC ≥30 kg/m²`) se agrega una comparación de peso ajustado:

```text
peso ajustado = peso ideal + 0,4 × (peso real − peso ideal)
```

UTI Tools ya contenía IMC y peso ideal por IMC objetivo `22,5`; no contenía una función de peso ajustado. Por trazabilidad, el coeficiente `0,4` queda explícito y se documenta como convención antropométrica en la guía de la Association of Anaesthetists (PMCID `PMC5029585`). En esta app queda limitado a una comparación en obesidad: no está validado aquí como denominador para titular vasoactivos ni para automatizar tratamiento.

## Cálculo renal

La función pura `calculateUrineOutputRate` usa:

```text
mL/kg/h = diuresis en mL ÷ peso en kg ÷ horas evaluadas
```

Las señales de débito menor de `0,5 mL/kg/h` requieren una ventana de al menos 6 h. “Sin diuresis registrada durante 12 h o más” solo aparece cuando el volumen consignado es cero y el período alcanza 12 h. Ambos mensajes exigen corroborar que la ventana sea completa y el sistema permeable; no definen etiología ni indican conducta.

La situación renal se registra como `función renal estable`, `IRA sin TRR`, `hemodiálisis intermitente` o `TRR continua / SLED`. La TFGe usa CKD-EPI 2021 sin coeficiente racial, transpuesta de `uti-tools/opioides-calculos.js`, únicamente cuando la situación es `función renal estable` y existen edad `18–120 años`, sexo y creatinina válida. En IRA o TRR no incorpora una TFGe ni una explicación administrativa al borrador.

El borrador incluye únicamente campos consignados. No agrega `a corroborar`, listados de faltantes ni comentarios genéricos cuando un cálculo no corresponde. Para diuresis normal informa volumen, período exacto y débito; reserva las leyendas adicionales para débito bajo o ausencia de diuresis según la ventana cargada.

## Alcance clínico

- DSI, IMC, pesos de referencia y TFGe son datos contextuales y revisables.
- No hay umbrales de DSI, recomendaciones, clasificación de shock ni cambios automáticos de vasoactivos.
- Peso ideal y ajustado no reemplazan el peso real ni autorizan una regla de dosificación.
- CKD-EPI 2021 no se calcula con creatinina no estable ni durante TRR.
- No se incorporan datos reales de pacientes, integraciones cloud, backend ni persistencia.

## Pruebas

Desde la carpeta `uti-ronda`:

```powershell
node .\tests\uti-ronda-core.test.js
node --check .\uti-ronda-core.js
node --check .\app.js
```

Para revisar la interfaz:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4173/`.
