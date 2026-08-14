'use strict';

const core = window.UtiRondaCore;
const form = document.querySelector('#roundForm');
const infusionTemplate = document.querySelector('#infusionRowTemplate');
const output = document.querySelector('#evolutionOutput');
const outputEmpty = document.querySelector('#outputEmpty');
const copyButton = document.querySelector('#copyButton');
const copyStatus = document.querySelector('#copyStatus');
const audioInput = document.querySelector('#audioFile');
const audioDrop = document.querySelector('#audioDrop');
const audioPreview = document.querySelector('#audioPreview');
const audioPlayer = document.querySelector('#audioPlayer');
const transcriptFileInput = document.querySelector('#transcriptFile');
let audioObjectUrl = '';
let selectedAudioFile = null;

const byId = (id) => document.getElementById(id);
const value = (id) => byId(id).value.trim();
const numberText = (number, digits = 3) => Number(number).toLocaleString('es-AR', { maximumFractionDigits: digits });

function currentAnthropometry() {
  return core.calculateAnthropometry({ weightKg: value('weightKg'), heightCm: value('heightCm') });
}

function updateDsiCalculation() {
  const panel = byId('dsiResult');
  const dsi = core.calculateDsiFromVitals(value('systolicBp'), value('diastolicBp'), value('heartRate'));
  panel.querySelector('strong').textContent = dsi === null ? 'Esperando TAS, TAD y FC válidas' : numberText(dsi, 2);
  panel.querySelector('p').textContent = dsi === null
    ? 'Se calcula FC ÷ TAD; requiere TAS coherente con la TAD.'
    : 'Dato fisiológico complementario: interpretar con perfusión, tendencia, vasoactivos y contexto clínico; no genera conductas.';
}

function updateAnthropometry() {
  const panel = byId('anthropometryResult');
  const result = currentAnthropometry();
  if (!result) {
    panel.querySelector('strong').textContent = 'Esperando peso real y talla válidos';
    panel.querySelector('p').textContent = 'Límites para esta referencia: peso 20–350 kg y talla 100–250 cm.';
  } else {
    const adjusted = result.hasObesity && result.adjustedWeightKg !== null
      ? ` · peso ajustado ${numberText(result.adjustedWeightKg, 1)} kg`
      : '';
    panel.querySelector('strong').textContent = `Peso real ${numberText(result.actualWeightKg, 1)} kg · IMC ${numberText(result.bmi, 1)} kg/m²`;
    panel.querySelector('p').textContent = `Peso ideal estimado ${numberText(result.idealWeightKg, 1)} kg${adjusted}. Peso ideal/ajustado: comparación antropométrica, no sugerencia de titulación.`;
  }
  updateAllInfusions();
}

function updateRenalCalculation() {
  const panel = byId('egfrResult');
  const result = core.assessRenalFunction({
    renalStatus: value('renalStatus'),
    creatinineMgDl: value('creatinine'),
    ageYears: value('age'),
    sex: value('sex'),
  });
  panel.querySelector('strong').textContent = result.egfr === null
    ? (result.label || 'Situación renal pendiente')
    : `TFGe ${numberText(result.egfr, 0)} mL/min/1,73 m²`;
  panel.querySelector('p').textContent = result.egfr === null && result.renalStatus === 'stable' ? result.context : '';
}

function renderEmptyInfusionState(containerId) {
  const container = byId(containerId);
  container.querySelector('.empty-row-message')?.remove();
  if (!container.querySelector('.infusion-row')) {
    const message = document.createElement('p');
    message.className = 'empty-row-message';
    message.textContent = 'Sin infusiones cargadas; el borrador lo marcará a corroborar.';
    container.append(message);
  }
}

function getInfusionRowData(row) {
  return {
    drugId: row.querySelector('.inf-drug').value,
    ampoules: row.querySelector('.inf-ampoules').value,
    amountPerAmpoule: row.querySelector('.inf-amount').value,
    amountUnit: row.querySelector('.inf-amount-unit').value,
    finalVolumeMl: row.querySelector('.inf-volume').value,
    rateMlH: row.querySelector('.inf-rate').value,
    durationHours: row.querySelector('.inf-duration').value,
  };
}

function renderSourceTrace(row) {
  const group = row.dataset.group;
  const drug = core.getDrugById(group, row.querySelector('.inf-drug').value);
  const trace = row.querySelector('.source-trace');
  trace.className = 'source-trace neutral';
  if (!drug) {
    trace.innerHTML = '<strong>Referencia local</strong><span>Elegí un fármaco para ver la fuente del valor sugerido.</span>';
    return;
  }

  const amount = core.parseLocalizedNumber(row.querySelector('.inf-amount').value);
  const unit = row.querySelector('.inf-amount-unit').value;
  if (drug.requiresManualAmount) {
    trace.classList.add('warning');
    trace.innerHTML = `<strong>Ingreso obligatorio</strong><span>${drug.trace}. El campo contiene exclusivamente lo que ingreses.</span>`;
    return;
  }
  const unchanged = amount === drug.defaultAmount && unit === drug.defaultUnit;
  if (unchanged) {
    trace.innerHTML = `<strong>Valor sugerido · ${drug.source}</strong><span>${drug.trace}. Confirmalo contra la ampolla disponible.</span>`;
  } else {
    trace.classList.add('edited');
    trace.innerHTML = `<strong>Valor modificado</strong><span>Referencia: ${drug.trace}. El cálculo usa el contenido real que ingresaste.</span>`;
  }
}

function renderInfusionCalculation(row) {
  renderSourceTrace(row);
  const resultPanel = row.querySelector('.infusion-result');
  const drug = core.getDrugById(row.dataset.group, row.querySelector('.inf-drug').value);
  if (!drug) {
    resultPanel.className = 'infusion-result';
    resultPanel.textContent = 'Seleccioná un fármaco.';
    return;
  }
  const anthropometry = currentAnthropometry();
  const calculation = core.calculateInfusion({
    ...getInfusionRowData(row),
    weightKg: value('weightKg'),
    idealWeightKg: anthropometry?.idealWeightKg,
    adjustedWeightKg: anthropometry?.adjustedWeightKg,
  });
  if (!calculation) {
    resultPanel.className = 'infusion-result invalid';
    resultPanel.textContent = 'Completá ampollas, contenido real por ampolla, unidad, volumen final y velocidad.';
    return;
  }

  resultPanel.className = 'infusion-result ready';
  if (calculation.kind === 'activity') {
    resultPanel.innerHTML = `<strong>${numberText(calculation.rateMlH)} mL/h → ${numberText(calculation.absoluteUiMin, 4)} UI/min</strong> · concentración ${numberText(calculation.concentrationUiMl, 4)} UI/mL · ${numberText(calculation.absoluteUiH, 3)} UI/h (apoyo)`;
    return;
  }
  const realDose = calculation.doseMcgKgMinReal === null
    ? '<strong>mcg/kg/min:</strong> cargá un peso real válido (20–350 kg)'
    : row.dataset.group === 'vasoactive'
      ? `<strong>${numberText(calculation.doseMcgKgMinReal, 4)} mcg/kg/min por peso real</strong>`
      : `<strong>${numberText(calculation.doseMcgKgMinReal, 4)} mcg/kg/min por peso real</strong> · ${numberText(calculation.doseMcgKgH, 3)} mcg/kg/h`;
  const comparisonDoses = row.dataset.group === 'vasoactive' && calculation.doseMcgKgMinIdeal !== null
    ? [
      `${numberText(calculation.doseMcgKgMinIdeal, 4)} mcg/kg/min por peso ideal`,
      calculation.doseMcgKgMinAdjusted !== null
        ? `${numberText(calculation.doseMcgKgMinAdjusted, 4)} mcg/kg/min por peso ajustado`
        : '',
    ].filter(Boolean).join(' · ')
    : '';
  const preparationText = `<strong>${numberText(calculation.totalMg, 3)} mg preparados</strong> · concentración final <strong>${numberText(calculation.concentrationMgMl, 4)} mg/mL</strong> (${numberText(calculation.concentrationMcgMl, 2)} mcg/mL) · ${numberText(calculation.rateMlH)} mL/h → <strong>${numberText(calculation.absoluteMcgMin, 3)} mcg/min</strong> · ${realDose}${comparisonDoses ? `<br><span>Comparación: ${comparisonDoses}. No modifica la bomba.</span>` : ''}`;
  if (row.dataset.group !== 'sedative') {
    resultPanel.innerHTML = preparationText;
    return;
  }
  const durationHours = row.querySelector('.inf-duration').value;
  const exposure = core.calculateInfusionExposure({
    ...getInfusionRowData(row),
    weightKg: value('weightKg'),
  });
  if (!durationHours) {
    resultPanel.innerHTML = `${preparationText}<br><span class="duration-pending">Cargá la duración para estimar el total administrado.</span>`;
    return;
  }
  if (!exposure) {
    resultPanel.className = 'infusion-result invalid';
    resultPanel.innerHTML = `${preparationText}<br><span>Duración válida: mayor de 0 y hasta 72 horas.</span>`;
    return;
  }
  resultPanel.innerHTML = `${preparationText}<br><strong>Duración ${exposure.durationLabel}</strong> · total administrado estimado <strong>${numberText(exposure.administeredMg, 3)} mg</strong> a ritmo constante. <span>No equivale a acumulación farmacológica.</span>`;
}

function applyDrugSelection(row) {
  const drug = core.getDrugById(row.dataset.group, row.querySelector('.inf-drug').value);
  const amountInput = row.querySelector('.inf-amount');
  const unitInput = row.querySelector('.inf-amount-unit');
  if (!drug) {
    amountInput.value = '';
    renderInfusionCalculation(row);
    return;
  }
  amountInput.value = drug.defaultAmount ?? '';
  unitInput.value = drug.defaultUnit;
  amountInput.placeholder = drug.requiresManualAmount ? 'Ingresar contenido real' : 'Confirmar contenido';
  renderInfusionCalculation(row);
}

function addInfusionRow(containerId, group, preset = {}) {
  const fragment = infusionTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.infusion-row');
  row.dataset.group = group;
  const drugSelect = row.querySelector('.inf-drug');
  core.getDrugLibrary(group).forEach((drug) => {
    const option = document.createElement('option');
    option.value = drug.id;
    option.textContent = drug.label;
    drugSelect.append(option);
  });
  drugSelect.value = preset.drugId || '';
  row.querySelector('.inf-ampoules').value = preset.ampoules || '';
  row.querySelector('.inf-volume').value = preset.finalVolumeMl || '';
  row.querySelector('.inf-rate').value = preset.rateMlH || '';
  row.querySelector('.inf-duration').value = preset.durationHours || '';
  row.querySelector('.inf-duration-field').hidden = group !== 'sedative';

  drugSelect.addEventListener('change', () => applyDrugSelection(row));
  row.querySelectorAll('.inf-ampoules, .inf-amount, .inf-amount-unit, .inf-volume, .inf-rate, .inf-duration')
    .forEach((input) => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => renderInfusionCalculation(row)));
  row.querySelector('.remove-row').addEventListener('click', () => {
    row.remove();
    renderEmptyInfusionState(containerId);
  });
  byId(containerId).append(row);
  if (preset.drugId) {
    applyDrugSelection(row);
    row.querySelector('.inf-amount').value = preset.amountPerAmpoule ?? row.querySelector('.inf-amount').value;
    row.querySelector('.inf-amount-unit').value = preset.amountUnit || row.querySelector('.inf-amount-unit').value;
  }
  renderInfusionCalculation(row);
  renderEmptyInfusionState(containerId);
}

function collectInfusionRows(containerId) {
  return [...byId(containerId).querySelectorAll('.infusion-row')].map(getInfusionRowData);
}

function updateAllInfusions() {
  document.querySelectorAll('.infusion-row').forEach(renderInfusionCalculation);
}

function toggleRespiratoryFields() {
  const intubated = value('intubated');
  byId('invasiveFields').hidden = intubated !== 'yes';
  byId('nonInvasiveFields').hidden = intubated !== 'no';
}

function updateUrineCalculation() {
  const result = core.calculateUrineOutputRate({ urineMl: value('urineMl'), weightKg: value('weightKg'), hours: value('urineHours') });
  const panel = byId('urineResult');
  panel.className = 'calculation';
  if (!result.evaluable) {
    panel.classList.add('neutral');
    panel.querySelector('strong').textContent = 'Esperando datos válidos';
  } else {
    const period = `${numberText(core.parseLocalizedNumber(value('urineMl')), 0)} mL en ${numberText(core.parseLocalizedNumber(value('urineHours')), 1)} h`;
    const alertLabel = result.key === 'no-signal' ? '' : ` · ${result.label}`;
    panel.querySelector('strong').textContent = `${numberText(result.rateMlKgH, 2)} mL/kg/h · ${period}${alertLabel}`;
    panel.classList.add(['anuria-window', 'zero-short-window'].includes(result.key) ? 'alert' : ['oliguria-window', 'low-short-window'].includes(result.key) ? 'warning' : 'neutral');
  }
  panel.querySelector('p').textContent = result.key === 'no-signal' ? '' : result.detail;
}

function collectData() {
  return {
    bed: value('bed'), age: value('age'), sex: value('sex'), icuDay: value('icuDay'), activeProblem: value('activeProblem'),
    respiratory: {
      intubated: value('intubated'), mode: value('ventMode'), inspiratoryPressure: value('inspiratoryPressure'),
      peep: value('peep'), tidalVolume: value('tidalVolume'), fio2: value('fio2'),
      respiratoryRate: value('respiratoryRate'), peakPressure: value('peakPressure'),
      oxygenDevice: value('oxygenDevice'), oxygenFlow: value('oxygenFlow'), nonInvasiveFio2: value('nonInvasiveFio2'),
    },
    systolicBp: value('systolicBp'), diastolicBp: value('diastolicBp'), heartRate: value('heartRate'),
    vasoactives: collectInfusionRows('vasoactiveRows'), weightKg: value('weightKg'), heightCm: value('heightCm'),
    renalStatus: value('renalStatus'), urineMl: value('urineMl'), urineHours: value('urineHours'), balance24h: value('balance24h'), creatinine: value('creatinine'),
    antibiotics: value('antibiotics'), cultures: value('cultures'), infectiousPending: value('infectiousPending'),
    rass: value('rass'), sedatives: collectInfusionRows('sedativeRows'), manualTranscript: value('manualTranscript'),
  };
}

function updatePrivacyNotice() {
  const data = collectData();
  const findings = core.detectDirectIdentifiers([data.activeProblem, data.antibiotics, data.cultures, data.infectiousPending, data.manualTranscript].join('\n'));
  const panel = byId('privacyResult');
  if (!findings.length) {
    panel.className = 'inline-alert ok';
    panel.textContent = 'Sin señales obvias de identificadores directos en los textos.';
    return;
  }
  panel.className = 'inline-alert warning';
  panel.textContent = `Revisar antes de copiar: ${findings.map((item) => item.label).join(', ')}. La nota manual no se incorporará hasta retirarlos.`;
}

function generateDraft() {
  const result = core.generateEvolution(collectData());
  output.value = result.text;
  const hasText = Boolean(result.text);
  output.hidden = !hasText;
  outputEmpty.hidden = hasText;
  copyButton.disabled = !hasText;
  copyStatus.textContent = result.privacyFindings.length
    ? 'La nota no se incorporó porque activó la alerta de privacidad. Corregila antes de generar.'
    : hasText
      ? 'Borrador generado sólo con los datos consignados.'
      : 'No hay datos consignados para generar el borrador.';
  updatePrivacyNotice();
  if (window.innerWidth < 1050) output.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function copyDraft() {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch (_error) {
    output.hidden = false;
    output.select();
    document.execCommand('copy');
    output.setSelectionRange(0, 0);
  }
  copyStatus.textContent = 'Texto copiado. Revisalo antes de pegarlo en la historia clínica.';
}

function humanFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadAudioFile(file) {
  const classification = core.classifyAudioFile(file);
  const status = byId('audioStatus');
  if (!classification.accepted) {
    status.className = 'inline-alert audio-state warning';
    status.textContent = 'No se pudo reconocer el archivo como audio. No se subió ni se envió a ningún servidor.';
    return;
  }
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  selectedAudioFile = file;
  audioObjectUrl = URL.createObjectURL(file);
  byId('audioName').textContent = file.name;
  byId('audioMeta').textContent = `${classification.mimeType} · ${humanFileSize(file.size)} · retenido solo en esta sesión`;
  audioPreview.hidden = false;
  status.className = 'inline-alert audio-state';
  status.textContent = classification.isWhatsAppVoiceFormat
    ? 'Audio de WhatsApp aceptado y retenido localmente. Verificando si este navegador reproduce el formato; no se subió.'
    : 'Archivo aceptado y retenido localmente. Verificando reproducción; no se subió.';
  audioPlayer.src = audioObjectUrl;
  audioPlayer.load();
  if (file.size > 100 * 1024 * 1024) {
    status.className = 'inline-alert audio-state warning';
    status.textContent += ' Supera 100 MB y puede consumir mucha memoria.';
  }
}

function removeAudio() {
  audioPlayer.pause();
  audioPlayer.removeAttribute('src');
  audioPlayer.load();
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = '';
  selectedAudioFile = null;
  audioInput.value = '';
  audioPreview.hidden = true;
  byId('audioStatus').className = 'inline-alert audio-state';
  byId('audioStatus').textContent = 'Sin audio abierto. Este control no genera una transcripción.';
}

async function importTranscriptFile(file) {
  if (!file || (!file.type.startsWith('text/') && !/\.txt$/i.test(file.name))) {
    copyStatus.textContent = 'Seleccioná un archivo TXT local.';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    copyStatus.textContent = 'El TXT supera 2 MB; revisalo antes de importarlo.';
    return;
  }
  byId('manualTranscript').value = await file.text();
  updatePrivacyNotice();
  copyStatus.textContent = `TXT local importado: ${file.name}. Revisalo antes de generar.`;
}

function clearRound() {
  if (!window.confirm('¿Limpiar todos los datos cargados en esta ronda?')) return;
  form.reset();
  byId('vasoactiveRows').replaceChildren();
  byId('sedativeRows').replaceChildren();
  renderEmptyInfusionState('vasoactiveRows');
  renderEmptyInfusionState('sedativeRows');
  removeAudio();
  output.value = '';
  output.hidden = true;
  outputEmpty.hidden = false;
  copyButton.disabled = true;
  copyStatus.textContent = '';
  toggleRespiratoryFields();
  updateDsiCalculation();
  updateAnthropometry();
  updateUrineCalculation();
  updateRenalCalculation();
  updatePrivacyNotice();
}

byId('addVasoactive').addEventListener('click', () => addInfusionRow('vasoactiveRows', 'vasoactive'));
byId('addSedative').addEventListener('click', () => addInfusionRow('sedativeRows', 'sedative'));
byId('intubated').addEventListener('change', toggleRespiratoryFields);
['systolicBp', 'diastolicBp', 'heartRate'].forEach((id) => byId(id).addEventListener('input', updateDsiCalculation));
byId('weightKg').addEventListener('input', () => { updateAnthropometry(); updateUrineCalculation(); });
byId('heightCm').addEventListener('input', updateAnthropometry);
['renalStatus', 'sex'].forEach((id) => byId(id).addEventListener('change', updateRenalCalculation));
['age', 'creatinine'].forEach((id) => byId(id).addEventListener('input', updateRenalCalculation));
['urineMl', 'urineHours'].forEach((id) => byId(id).addEventListener('input', updateUrineCalculation));
['activeProblem', 'antibiotics', 'cultures', 'infectiousPending', 'manualTranscript'].forEach((id) => byId(id).addEventListener('input', updatePrivacyNotice));
byId('generateButton').addEventListener('click', generateDraft);
copyButton.addEventListener('click', copyDraft);
byId('clearButton').addEventListener('click', clearRound);
byId('removeAudio').addEventListener('click', removeAudio);
audioInput.addEventListener('change', () => loadAudioFile(audioInput.files[0]));
transcriptFileInput.addEventListener('change', () => importTranscriptFile(transcriptFileInput.files[0]));
audioPlayer.addEventListener('loadedmetadata', () => {
  if (!selectedAudioFile) return;
  const duration = Number.isFinite(audioPlayer.duration) ? ` Duración: ${Math.round(audioPlayer.duration)} s.` : '';
  byId('audioStatus').className = 'inline-alert audio-state ready';
  byId('audioStatus').textContent = `Archivo listo para escuchar localmente.${duration} No se subió y no genera texto.`;
});
audioPlayer.addEventListener('error', () => {
  if (!selectedAudioFile) return;
  byId('audioStatus').className = 'inline-alert audio-state warning';
  byId('audioStatus').textContent = 'Vista previa no disponible para este formato; el archivo sigue cargado localmente. No se subió. Podés escucharlo fuera de la app y pegar o importar la transcripción.';
});

['dragenter', 'dragover'].forEach((eventName) => audioDrop.addEventListener(eventName, (event) => {
  event.preventDefault();
  audioDrop.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((eventName) => audioDrop.addEventListener(eventName, (event) => {
  event.preventDefault();
  audioDrop.classList.remove('dragging');
}));
audioDrop.addEventListener('drop', (event) => loadAudioFile(event.dataTransfer.files[0]));
window.addEventListener('beforeunload', () => { if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl); });

renderEmptyInfusionState('vasoactiveRows');
renderEmptyInfusionState('sedativeRows');
toggleRespiratoryFields();
updateDsiCalculation();
updateAnthropometry();
updateUrineCalculation();
updateRenalCalculation();
