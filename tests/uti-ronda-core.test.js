'use strict';

const assert = require('node:assert/strict');
const {
  DRUG_LIBRARY,
  parseLocalizedNumber,
  calculateDsi,
  calculateDsiFromVitals,
  calculateBmi,
  calculateIdealWeight,
  calculatePredictedBodyWeight,
  calculateAdjustedWeight,
  calculateAnthropometry,
  calculateEgfrCkdEpi2021,
  assessRenalFunction,
  classifyAudioFile,
  calculateInfusion,
  calculateInfusionExposure,
  formatInfusionDuration,
  calculateMidazolamPreparation,
  calculateUrineOutputRate,
  detectDirectIdentifiers,
  generateEvolution,
} = require('../uti-ronda-core.js');

assert.equal(parseLocalizedNumber('0,5'), 0.5);
assert.equal(parseLocalizedNumber(' 120 '), 120);
assert.equal(parseLocalizedNumber('1e3'), null);
assert.equal(parseLocalizedNumber(''), null);

assert.equal(DRUG_LIBRARY.vasoactive.find((drug) => drug.id === 'norepinephrine').defaultAmount, 4);
assert.equal(DRUG_LIBRARY.sedative.find((drug) => drug.id === 'remifentanil').defaultAmount, 5);
assert.equal(DRUG_LIBRARY.vasoactive.find((drug) => drug.id === 'nitroglycerin').defaultAmount, null);
assert.equal(DRUG_LIBRARY.vasoactive.find((drug) => drug.id === 'nitroprusside').defaultAmount, null);
assert.equal(DRUG_LIBRARY.vasoactive.find((drug) => drug.id === 'nitroprusside').requiresManualAmount, true);
assert.equal(DRUG_LIBRARY.sedative.find((drug) => drug.id === 'midazolam').defaultAmount, 15);

assert.ok(Math.abs(calculateDsi(96, 52) - (96 / 52)) < 1e-12);
assert.equal(calculateDsi(0, 52), null);
assert.equal(calculateDsi(96, 0), null);
assert.equal(calculateDsi(301, 52), null);
assert.ok(Math.abs(calculateDsiFromVitals(104, 52, 96) - (96 / 52)) < 1e-12);
assert.equal(calculateDsiFromVitals('', 52, 96), null);
assert.equal(calculateDsiFromVitals(40, 52, 96), null);

assert.ok(Math.abs(calculateBmi(108, 180) - 33.3333333333) < 1e-9);
assert.ok(Math.abs(calculateIdealWeight(180) - 72.9) < 1e-12);
assert.ok(Math.abs(calculateAdjustedWeight(108, 72.9) - 86.94) < 1e-12);
const anthropometryWithObesity = calculateAnthropometry({ weightKg: 108, heightCm: 180 });
assert.equal(anthropometryWithObesity.hasObesity, true);
assert.ok(Math.abs(anthropometryWithObesity.adjustedWeightKg - 86.94) < 1e-12);
assert.equal(calculateAnthropometry({ weightKg: 70, heightCm: 180 }).adjustedWeightKg, null);
assert.equal(calculateBmi(10, 180), null);
assert.equal(calculateIdealWeight(99), null);
assert.equal(calculateAdjustedWeight(70, 72.9), null);
assert.equal(calculateAnthropometry({ weightKg: 'x', heightCm: 180 }), null);

assert.equal(Math.round(calculateEgfrCkdEpi2021(1.5, 90, 'male')), 44);
assert.equal(Math.round(calculateEgfrCkdEpi2021(1.5, 90, 'female')), 33);
assert.equal(calculateEgfrCkdEpi2021(1.5, 17, 'male'), null);
const stableRenal = assessRenalFunction({ renalStatus: 'stable', creatinineMgDl: 1.5, ageYears: 90, sex: 'male' });
assert.equal(Math.round(stableRenal.egfr), 44);
assert.equal(stableRenal.numericEstimateAllowed, true);
['aki-no-krt', 'ihd', 'crrt-sled'].forEach((renalStatus) => {
  const result = assessRenalFunction({ renalStatus, creatinineMgDl: 1.5, ageYears: 90, sex: 'male' });
  assert.equal(result.egfr, null);
  assert.equal(result.numericEstimateAllowed, false);
  assert.match(result.context, /TFGe no estimada/);
});
assert.equal(assessRenalFunction({ renalStatus: '' }).egfr, null);
assert.equal(assessRenalFunction({ renalStatus: 'stable', creatinineMgDl: '', ageYears: 70, sex: 'male' }).egfr, null);

const norepinephrine = calculateInfusion({
  ampoules: 2, amountPerAmpoule: 4, amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 8,
  weightKg: 108, idealWeightKg: 72.9, adjustedWeightKg: 86.94,
});
assert.ok(Math.abs(norepinephrine.concentrationMgMl - 0.08) < 1e-12);
assert.ok(Math.abs(norepinephrine.concentrationMcgMl - 80) < 1e-12);
assert.ok(Math.abs(norepinephrine.absoluteMcgMin - (80 * 8 / 60)) < 1e-12);
assert.ok(Math.abs(norepinephrine.doseMcgKgMinReal - (80 * 8 / 60 / 108)) < 1e-12);
assert.ok(Math.abs(norepinephrine.doseMcgKgMinIdeal - (80 * 8 / 60 / 72.9)) < 1e-12);
assert.ok(Math.abs(norepinephrine.doseMcgKgMinAdjusted - (80 * 8 / 60 / 86.94)) < 1e-12);

const midazolam = calculateMidazolamPreparation({ ampoules: 2, finalVolumeMl: 100, rateMlH: 5, weightKg: 70 });
assert.equal(midazolam.totalMg, 30);
assert.equal(midazolam.concentrationMgMl, 0.3);
assert.equal(midazolam.absoluteMgH, 1.5);
assert.equal(midazolam.absoluteMcgMin, 25);
const editedMidazolam = calculateMidazolamPreparation({ ampoules: 2, amountPerAmpoule: 10, finalVolumeMl: 100, rateMlH: 5 });
assert.equal(editedMidazolam.totalMg, 20);

const vasopressinAt3 = calculateInfusion({
  ampoules: 3, amountPerAmpoule: 20, amountUnit: 'UI', finalVolumeMl: 100, rateMlH: 3, weightKg: 70,
});
assert.equal(vasopressinAt3.concentrationUiMl, 0.6);
assert.ok(Math.abs(vasopressinAt3.absoluteUiH - 1.8) < 1e-12);
assert.ok(Math.abs(vasopressinAt3.absoluteUiMin - 0.03) < 1e-12);
const vasopressinAt4 = calculateInfusion({ ampoules: 3, amountPerAmpoule: 20, amountUnit: 'UI', finalVolumeMl: 100, rateMlH: 4 });
const vasopressinAt5 = calculateInfusion({ ampoules: 3, amountPerAmpoule: 20, amountUnit: 'UI', finalVolumeMl: 100, rateMlH: 5 });
assert.ok(Math.abs(vasopressinAt4.absoluteUiMin - 0.04) < 1e-12);
assert.ok(Math.abs(vasopressinAt5.absoluteUiMin - 0.05) < 1e-12);
const vasopressinDifferentVolume = calculateInfusion({ ampoules: 3, amountPerAmpoule: 20, amountUnit: 'UI', finalVolumeMl: 50, rateMlH: 3 });
assert.equal(vasopressinDifferentVolume.concentrationUiMl, 1.2);
assert.ok(Math.abs(vasopressinDifferentVolume.absoluteUiMin - 0.06) < 1e-12);

const nitroprussideWithManualContent = calculateInfusion({
  ampoules: 1, amountPerAmpoule: 50, amountUnit: 'mg', finalVolumeMl: 250, rateMlH: 10, weightKg: 70,
});
assert.equal(nitroprussideWithManualContent.concentrationMgMl, 0.2);
assert.ok(Math.abs(nitroprussideWithManualContent.absoluteMcgMin - (200 * 10 / 60)) < 1e-12);
assert.ok(Math.abs(nitroprussideWithManualContent.doseMcgKgMinReal - (200 * 10 / 60 / 70)) < 1e-12);

assert.deepEqual(classifyAudioFile({ name: 'WhatsApp Ptt.ogg', type: 'audio/ogg' }), {
  accepted: true, extension: 'ogg', mimeType: 'audio/ogg', isWhatsAppVoiceFormat: true,
  reason: 'Archivo de audio reconocido por tipo o extensión.',
});
[
  { name: 'PTT-2026.opus', type: '' },
  { name: 'PTT-2026.ogg', type: 'application/octet-stream' },
  { name: 'PTT-2026.oga', type: '' },
  { name: 'PTT-2026.m4a', type: 'application/octet-stream' },
  { name: 'WhatsApp Audio 2026-08-13 at 21.35.59.mp4', type: '' },
  { name: 'WhatsApp Audio 2026-08-13 at 21.35.59.mp4', type: 'application/octet-stream' },
].forEach((file) => assert.equal(classifyAudioFile(file).accepted, true, file.name));
assert.equal(classifyAudioFile({ name: 'audio-sin-extension', type: 'audio/mp4' }).accepted, true);
assert.equal(classifyAudioFile({ name: 'audio-sin-extension', type: 'video/mp4' }).accepted, true);
assert.equal(classifyAudioFile({ name: 'WhatsApp Audio.mp4', type: 'video/mp4' }).isWhatsAppVoiceFormat, true);
assert.equal(classifyAudioFile({ name: 'PTT', type: 'application/ogg' }).accepted, true);
assert.equal(classifyAudioFile({ name: 'nota.pdf', type: 'application/pdf' }).accepted, false);

const remifentanil = calculateInfusion({
  ampoules: 2, amountPerAmpoule: 5, amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 3, weightKg: 70,
});
assert.equal(remifentanil.concentrationMgMl, 0.1);
assert.ok(Math.abs(remifentanil.absoluteMcgMin - 5) < 1e-12);
assert.ok(Math.abs(remifentanil.doseMcgKgMin - (5 / 70)) < 1e-12);
assert.equal(calculateInfusion({ ampoules: 1, amountPerAmpoule: '', amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 5 }), null);

assert.equal(formatInfusionDuration(12), '12 h');
assert.equal(formatInfusionDuration(24), '24 h (1 día)');
assert.equal(formatInfusionDuration(36), '36 h (1,5 días)');
assert.equal(formatInfusionDuration(72), '72 h (3 días)');
assert.equal(formatInfusionDuration(73), null);
const remifentanil36h = calculateInfusionExposure({
  ampoules: 2, amountPerAmpoule: 5, amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 3,
  weightKg: 70, durationHours: 36,
});
assert.equal(remifentanil36h.durationLabel, '36 h (1,5 días)');
assert.ok(Math.abs(remifentanil36h.administeredMg - 10.8) < 1e-12);
assert.equal(calculateInfusionExposure({
  ampoules: 2, amountPerAmpoule: 5, amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 3, durationHours: 73,
}), null);

const normal = calculateUrineOutputRate({ urineMl: 420, weightKg: 70, hours: 6 });
assert.equal(normal.evaluable, true);
assert.equal(normal.key, 'no-signal');
assert.equal(normal.rateMlKgH, 1);

const oliguria = calculateUrineOutputRate({ urineMl: 140, weightKg: 70, hours: 6 });
assert.equal(oliguria.key, 'oliguria-window');
assert.ok(Math.abs(oliguria.rateMlKgH - (140 / 70 / 6)) < 1e-12);

const shortWindow = calculateUrineOutputRate({ urineMl: 80, weightKg: 70, hours: 4 });
assert.equal(shortWindow.key, 'low-short-window');

const zero12h = calculateUrineOutputRate({ urineMl: 0, weightKg: 70, hours: 12 });
assert.equal(zero12h.key, 'anuria-window');

const invalid = calculateUrineOutputRate({ urineMl: '', weightKg: 70, hours: 6 });
assert.equal(invalid.evaluable, false);
assert.equal(calculateUrineOutputRate({ urineMl: 500, weightKg: 351, hours: 6 }).evaluable, false);

assert.equal(detectDirectIdentifiers('Nota clínica sin datos nominales.').length, 0);
assert.equal(detectDirectIdentifiers('DNI: 12345678').some((item) => item.key === 'document'), true);
assert.equal(detectDirectIdentifiers('contacto ejemplo@correo.test').some((item) => item.key === 'email'), true);

const syntheticCase = {
  bed: '4',
  age: '68',
  icuDay: '3',
  activeProblem: 'shock distributivo de foco a confirmar',
  respiratory: {
    intubated: 'yes', mode: 'VCV', inspiratoryPressure: '18', peep: '8',
    tidalVolume: '420', fio2: '40', respiratoryRate: '18', peakPressure: '24',
  },
  systolicBp: '104', diastolicBp: '52', heartRate: '96',
  vasoactives: [{ drugId: 'norepinephrine', ampoules: '2', amountPerAmpoule: '4', amountUnit: 'mg', finalVolumeMl: '100', rateMlH: '8' }],
  sex: 'male', heightCm: '180', renalStatus: 'stable',
  weightKg: '70', urineMl: '140', urineHours: '6', balance24h: '850', creatinine: '1,4',
  antibiotics: 'esquema consignado en revisión', cultures: 'muestras enviadas', infectiousPending: 'resultados',
  rass: '-2', sedatives: [{ drugId: 'remifentanil', ampoules: '2', amountPerAmpoule: '5', amountUnit: 'mg', finalVolumeMl: '100', rateMlH: '3', durationHours: '36' }],
  manualTranscript: 'Sin novedades adicionales consignadas.',
};
const generated = generateEvolution(syntheticCase);
assert.match(generated.text, /0,33 mL\/kg\/h/);
assert.match(generated.text, /Índice de Shock Diastólico 1,85/);
assert.match(generated.text, /IMC 21,6 kg\/m²/);
assert.match(generated.text, /TFGe \d+ mL\/min\/1,73 m²/);
assert.doesNotMatch(generated.text, /CKD-EPI|sin raza|ajuste automático|DATOS A CORROBORAR|a corroborar/);
assert.match(generated.text, /menor de 0,5 mL\/kg\/h durante 6 h o más/);
assert.match(generated.text, /Noradrenalina a 8 mL\/h \(10,667 mcg\/min; 0,1524 mcg\/kg\/min con peso real\)/);
// El remifentanilo se normaliza sobre peso ideal, no real: con talla 180 y sexo
// masculino el peso predicho es 75,1 kg y la dosis baja de 0,0714 a 0,0666.
assert.match(generated.text, /Remifentanilo a 3 mL\/h \(5 mcg\/min; 0,0666 mcg\/kg\/min con peso ideal\); 36 h \(1,5 días\), total administrado estimado 10,8 mg a ritmo constante/);
assert.equal(generated.privacyFindings.length, 0);

const incomplete = generateEvolution({ bed: '7', respiratory: {} });
assert.equal(incomplete.text, 'Cama 7.');
assert.doesNotMatch(incomplete.text, /a corroborar|DATOS A CORROBORAR/);
assert.ok(incomplete.missing.includes('edad'));

const blockedNote = generateEvolution({
  bed: '2',
  manualTranscript: 'DNI 12345678',
});
assert.doesNotMatch(blockedNote.text, /12345678/);
assert.equal(blockedNote.privacyFindings.length > 0, true);

const vasoEvolution = generateEvolution({
  bed: '3', weightKg: '70',
  vasoactives: [{ drugId: 'vasopressin', ampoules: '3', amountPerAmpoule: '20', amountUnit: 'UI', finalVolumeMl: '100', rateMlH: '3' }],
});
assert.match(vasoEvolution.text, /Vasopresina a 3 mL\/h \(0,03 UI\/min; 1,8 UI\/h de apoyo\)/);
assert.ok(vasoEvolution.text.indexOf('0,03 UI/min') < vasoEvolution.text.indexOf('1,8 UI/h'));

const nivEvolution = generateEvolution({
  bed: '11',
  respiratory: {
    intubated: 'niv', nivMode: 'BiPAP', nivInterface: 'oronasal',
    nivInspiratoryPressure: '12', nivPeep: '6', nivFio2: '50', nivRespiratoryRate: '24',
  },
});
assert.match(nivEvolution.text, /Respiratorio: ventilación no invasiva \(VNI\); modo BiPAP, interfaz oronasal, IPAP\/presión inspiratoria 12 cmH₂O, EPAP\/PEEP 6 cmH₂O, FiO₂ 50 %, FR observada 24 rpm\./);

const nitroprussideEvolution = generateEvolution({
  bed: '12', weightKg: '70',
  vasoactives: [{ drugId: 'nitroprusside', ampoules: '1', amountPerAmpoule: '50', amountUnit: 'mg', finalVolumeMl: '250', rateMlH: '10' }],
});
assert.match(nitroprussideEvolution.text, /Nitroprusiato de sodio a 10 mL\/h \(33,333 mcg\/min; 0,4762 mcg\/kg\/min con peso real\)/);

const akiEvolution = generateEvolution({
  bed: '5', age: '70', sex: 'female', heightCm: '165', weightKg: '90',
  renalStatus: 'aki-no-krt', creatinine: '2,1',
});
assert.match(akiEvolution.text, /IRA sin terapia de reemplazo renal/);
assert.match(akiEvolution.text, /creatinina 2,1 mg\/dL/);
assert.doesNotMatch(akiEvolution.text, /TFGe|CKD-EPI|no estimada/);

const midazolamEvolution = generateEvolution({
  bed: '6', weightKg: '70',
  sedatives: [{ drugId: 'midazolam', ampoules: '2', amountPerAmpoule: '15', amountUnit: 'mg', finalVolumeMl: '100', rateMlH: '5', durationHours: '72' }],
});
assert.match(midazolamEvolution.text, /Midazolam a 5 mL\/h \(25 mcg\/min; 0,3571 mcg\/kg\/min con peso real\); 72 h \(3 días\), total administrado estimado 108 mg a ritmo constante/);

const missingSedationDuration = generateEvolution({
  bed: '8', weightKg: '70',
  sedatives: [{ drugId: 'midazolam', ampoules: '2', amountPerAmpoule: '15', amountUnit: 'mg', finalVolumeMl: '100', rateMlH: '5' }],
});
assert.match(missingSedationDuration.text, /Midazolam a 5 mL\/h/);
assert.doesNotMatch(missingSedationDuration.text, /duración a corroborar|total administrado no calculado/);
assert.ok(missingSedationDuration.missing.includes('Midazolam: duración de infusión (1–72 h)'));

const normalUrineEvolution = generateEvolution({
  bed: '9', weightKg: '95', urineMl: '2000', urineHours: '24',
});
assert.match(normalUrineEvolution.text, /diuresis 2\.000 mL en 24 h; débito 0,88 mL\/kg\/h/);
assert.doesNotMatch(normalUrineEvolution.text, /Sin señal|Interpretar junto|ventana consignada|a corroborar/);

const cleanedAiNote = generateEvolution({
  bed: '10',
  manualTranscript: 'Este contenido se generó con IA. Murmullo vesicular conservado, sin secreciones.',
});
assert.match(cleanedAiNote.text, /Murmullo vesicular conservado, sin secreciones\./);
assert.doesNotMatch(cleanedAiNote.text, /Este contenido se generó con IA|Nota clínica aportada|texto sin interpretar/);

// ---------------------------------------------------------------------------
// Peso predicho (Devine), indexación de diuresis, peso de dosificación y VT
// ---------------------------------------------------------------------------

const pbwMale165 = 50 + 0.91 * (165 - 152.4);
const pbwFemale165 = 45.5 + 0.91 * (165 - 152.4);

assert.ok(Math.abs(calculatePredictedBodyWeight(165, 'male') - pbwMale165) < 1e-9);
assert.ok(Math.abs(calculatePredictedBodyWeight(165, 'female') - pbwFemale165) < 1e-9);
assert.equal(calculatePredictedBodyWeight(165, ''), null, 'sin sexo no hay peso predicho');
assert.equal(calculatePredictedBodyWeight(165, 'otro'), null);
assert.equal(calculatePredictedBodyWeight(90, 'male'), null, 'talla fuera de rango');
assert.equal(calculatePredictedBodyWeight(115, 'male'), null, 'Devine daría menos de 20 kg');

// Con sexo usa Devine, y el peso ajustado se deriva del predicho (igual que MIRA)
const anthroObese = calculateAnthropometry({ weightKg: 100, heightCm: 165, sex: 'male' });
assert.ok(Math.abs(anthroObese.predictedBodyWeightKg - pbwMale165) < 1e-9);
assert.ok(Math.abs(anthroObese.idealWeightKg - pbwMale165) < 1e-9);
assert.equal(anthroObese.idealWeightBasis, 'devine');
assert.ok(Math.abs(anthroObese.adjustedWeightKg - (pbwMale165 + 0.4 * (100 - pbwMale165))) < 1e-9);

// Sin sexo cae al peso de referencia por IMC 22,5 y lo declara
const anthroNoSex = calculateAnthropometry({ weightKg: 100, heightCm: 165 });
assert.equal(anthroNoSex.predictedBodyWeightKg, null);
assert.equal(anthroNoSex.idealWeightBasis, 'bmi-reference');
assert.ok(Math.abs(anthroNoSex.idealWeightKg - 22.5 * Math.pow(1.65, 2)) < 1e-9);

// El peso real fabrica oliguria en el obeso; el predicho la corrige
const urineOnActual = calculateUrineOutputRate({ urineMl: 1500, weightKg: 130, hours: 24 });
assert.equal(urineOnActual.key, 'oliguria-window');
assert.equal(urineOnActual.indexWeightBasis, 'actual');

const urineIndexed = calculateUrineOutputRate({ urineMl: 1500, weightKg: 130, hours: 24, indexWeightKg: pbwMale165 });
assert.equal(urineIndexed.key, 'no-signal', 'con peso predicho no hay criterio de oliguria');
assert.equal(urineIndexed.indexWeightBasis, 'predicted');
assert.ok(Math.abs(urineIndexed.rateMlKgH - 1500 / pbwMale165 / 24) < 1e-9);
assert.ok(Math.abs(urineIndexed.rateOnActualWeightMlKgH - 1500 / 130 / 24) < 1e-9);

// Cada droga declara sobre qué peso se dosifica
assert.equal(DRUG_LIBRARY.sedative.find((d) => d.id === 'remifentanil').dosingWeight, 'ideal');
assert.equal(DRUG_LIBRARY.sedative.find((d) => d.id === 'fentanyl').dosingWeight, 'ideal');
assert.equal(DRUG_LIBRARY.sedative.find((d) => d.id === 'midazolam').dosingWeight, 'adjusted');
assert.equal(DRUG_LIBRARY.vasoactive.find((d) => d.id === 'norepinephrine').dosingWeight, 'actual');

function lineStartingWith(text, prefix) {
  return text.split('\n').find((line) => line.startsWith(prefix)) || '';
}

const obeseDraft = generateEvolution({
  bed: '1', age: 85, sex: 'male', icuDay: 2, activeProblem: 'Shock septico secundario a NAC',
  weightKg: 100, heightCm: 165,
  systolicBp: 100, diastolicBp: 50, heartRate: 105,
  renalStatus: 'stable', urineMl: 1500, urineHours: 24, balance24h: 500, creatinine: 1.05,
  rass: -3,
  respiratory: {
    intubated: 'yes', mode: 'PCV', inspiratoryPressure: 16, peep: 6,
    tidalVolume: 400, fio2: 35, respiratoryRate: 16, peakPressure: 22,
  },
  vasoactives: [{ drugId: 'norepinephrine', ampoules: 4, amountPerAmpoule: 4, amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 15 }],
  sedatives: [
    { drugId: 'remifentanil', ampoules: 2, amountPerAmpoule: 5, amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 10, durationHours: 48 },
    { drugId: 'midazolam', ampoules: 4, amountPerAmpoule: 15, amountUnit: 'mg', finalVolumeMl: 100, rateMlH: 10, durationHours: 48 },
  ],
  manualTranscript: 'Murmullo vesicular positivo con roncus aislados.',
});

const respLine = lineStartingWith(obeseDraft.text, 'Respiratorio:');
assert.ok(respLine.includes('mL/kg de peso predicho'), 'el VT debe informarse indexado al peso predicho');

const sedationLine = lineStartingWith(obeseDraft.text, 'Sedación:');
assert.ok(sedationLine.includes('con peso ideal'), 'remifentanilo se dosifica sobre peso ideal');
assert.ok(sedationLine.includes('con peso ajustado'), 'midazolam se dosifica sobre peso ajustado');
assert.ok(!sedationLine.includes('con peso real'), 'ningún sedante debe informarse sobre peso real en el obeso');

const hemoLine = lineStartingWith(obeseDraft.text, 'Hemodinamia:');
assert.ok(hemoLine.includes('con peso real'), 'los vasoactivos siguen sobre peso real por comparabilidad con SOFA-2');

const renalLine = lineStartingWith(obeseDraft.text, 'Renal y antropometría:');
assert.ok(renalLine.includes('peso predicho'), 'el débito urinario debe declarar el peso que usó');
assert.ok(!renalLine.includes('menor de 0,5 mL/kg/h'), 'no debe marcar oliguria: sobre peso predicho el débito es normal');

console.log('OK: VNI, nitroprusiato manual, DSI, antropometría, TFGe condicionada, midazolam, infusiones, diuresis, privacidad y borrador verificados.');
console.log('OK: peso predicho Devine, diuresis indexada, peso de dosificación por droga y VT indexado verificados.');
