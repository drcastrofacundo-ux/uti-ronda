(function (root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UtiRondaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MISSING = 'a corroborar';

  const CLINICAL_LIMITS = Object.freeze({
    weightKg: Object.freeze({ min: 20, max: 350 }),
    heightCm: Object.freeze({ min: 100, max: 250 }),
    ageYears: Object.freeze({ min: 18, max: 120 }),
    systolicPressureMmHg: Object.freeze({ min: 1, max: 300 }),
    heartRateBpm: Object.freeze({ min: 1, max: 300 }),
    diastolicPressureMmHg: Object.freeze({ min: 1, max: 200 }),
  });

  const RENAL_STATUS = Object.freeze({
    stable: 'Función renal estable',
    'aki-no-krt': 'IRA sin terapia de reemplazo renal',
    ihd: 'Hemodiálisis intermitente',
    'crrt-sled': 'TRR continua / SLED',
  });

  const DRUG_LIBRARY = Object.freeze({
    vasoactive: Object.freeze([
      Object.freeze({ id: 'norepinephrine', label: 'Noradrenalina', defaultAmount: 4, defaultUnit: 'mg', source: 'UTI Tools', trace: 'vasopresores.html: 4 mg/ampolla' }),
      Object.freeze({ id: 'vasopressin', label: 'Vasopresina', defaultAmount: 20, defaultUnit: 'UI', source: 'UTI Tools', trace: 'vasopresores.html: 20 UI/ampolla' }),
      Object.freeze({ id: 'dobutamine', label: 'Dobutamina', defaultAmount: 250, defaultUnit: 'mg', source: 'UTI Tools', trace: 'vasopresores.html: 250 mg/ampolla' }),
      Object.freeze({ id: 'epinephrine', label: 'Adrenalina', defaultAmount: 1, defaultUnit: 'mg', source: 'UTI Tools', trace: 'vasopresores.html: 1 mg/ampolla' }),
      Object.freeze({
        id: 'nitroglycerin', label: 'Nitroglicerina', defaultAmount: null, defaultUnit: 'mg', source: 'conflicto local',
        trace: 'UTI Tools registra 25 mg/ampolla y la Recorrida previa 50 mg/ampolla; ingresar el contenido real', requiresManualAmount: true,
      }),
    ]),
    sedative: Object.freeze([
      Object.freeze({
        id: 'midazolam', label: 'Midazolam', defaultAmount: 15, defaultUnit: 'mg', source: 'práctica local confirmada por el usuario',
        trace: '15 mg/ampolla como valor sugerido y confirmable; verificar siempre la presentación disponible',
      }),
      Object.freeze({ id: 'remifentanil', label: 'Remifentanilo', defaultAmount: 5, defaultUnit: 'mg', source: 'MIRA + UTI Tools', trace: 'ambos registran 5 mg/ampolla' }),
      Object.freeze({ id: 'fentanyl', label: 'Fentanilo', defaultAmount: 0.5, defaultUnit: 'mg', source: 'MIRA + UTI Tools', trace: '0,5 mg/ampolla = 500 mcg/ampolla' }),
      Object.freeze({ id: 'dexmedetomidine', label: 'Dexmedetomidina', defaultAmount: 0.2, defaultUnit: 'mg', source: 'MIRA + UTI Tools', trace: '0,2 mg/ampolla = 200 mcg/ampolla' }),
      Object.freeze({
        id: 'propofol', label: 'Propofol', defaultAmount: null, defaultUnit: 'mg', source: 'MIRA',
        trace: 'MIRA registra dosis en mg/kg/h, pero no fija contenido por ampolla; ingresar el contenido real', requiresManualAmount: true,
      }),
    ]),
  });

  const AUDIO_EXTENSIONS = Object.freeze(['ogg', 'oga', 'opus', 'm4a', 'mp4', 'aac', 'mp3', 'wav', 'webm']);
  const MAX_SEDATION_DURATION_HOURS = 72;

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function parseLocalizedNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const normalized = clean(value).replace(',', '.');
    if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatNumber(value, maximumFractionDigits = 2) {
    return new Intl.NumberFormat('es-AR', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value);
  }

  function isFiniteInRange(value, limits) {
    return Number.isFinite(value) && value >= limits.min && value <= limits.max;
  }

  function calculateDsi(heartRateBpm, diastolicPressureMmHg) {
    const heartRate = parseLocalizedNumber(heartRateBpm);
    const diastolic = parseLocalizedNumber(diastolicPressureMmHg);
    if (!isFiniteInRange(heartRate, CLINICAL_LIMITS.heartRateBpm)) return null;
    if (!isFiniteInRange(diastolic, CLINICAL_LIMITS.diastolicPressureMmHg)) return null;
    return heartRate / diastolic;
  }

  function calculateDsiFromVitals(systolicPressureMmHg, diastolicPressureMmHg, heartRateBpm) {
    const systolic = parseLocalizedNumber(systolicPressureMmHg);
    const diastolic = parseLocalizedNumber(diastolicPressureMmHg);
    if (!isFiniteInRange(systolic, CLINICAL_LIMITS.systolicPressureMmHg)) return null;
    if (!isFiniteInRange(diastolic, CLINICAL_LIMITS.diastolicPressureMmHg) || systolic < diastolic) return null;
    return calculateDsi(heartRateBpm, diastolic);
  }

  function calculateBmi(weightKg, heightCm) {
    const weight = parseLocalizedNumber(weightKg);
    const height = parseLocalizedNumber(heightCm);
    if (!isFiniteInRange(weight, CLINICAL_LIMITS.weightKg)) return null;
    if (!isFiniteInRange(height, CLINICAL_LIMITS.heightCm)) return null;
    return weight / Math.pow(height / 100, 2);
  }

  function calculateIdealWeight(heightCm, targetBmi = 22.5) {
    const height = parseLocalizedNumber(heightCm);
    const target = parseLocalizedNumber(targetBmi);
    if (!isFiniteInRange(height, CLINICAL_LIMITS.heightCm) || target === null || target <= 0) return null;
    return target * Math.pow(height / 100, 2);
  }

  function calculateAdjustedWeight(actualWeightKg, idealWeightKg, correctionFactor = 0.4) {
    const actual = parseLocalizedNumber(actualWeightKg);
    const ideal = parseLocalizedNumber(idealWeightKg);
    const factor = parseLocalizedNumber(correctionFactor);
    if (!isFiniteInRange(actual, CLINICAL_LIMITS.weightKg)) return null;
    if (!isFiniteInRange(ideal, CLINICAL_LIMITS.weightKg)) return null;
    if (factor === null || factor < 0 || factor > 1 || actual <= ideal) return null;
    return ideal + factor * (actual - ideal);
  }

  function calculateAnthropometry(input) {
    const actualWeightKg = parseLocalizedNumber(input?.weightKg);
    const heightCm = parseLocalizedNumber(input?.heightCm);
    const bmi = calculateBmi(actualWeightKg, heightCm);
    const idealWeightKg = calculateIdealWeight(heightCm);
    if (bmi === null || idealWeightKg === null) return null;
    const hasObesity = bmi >= 30;
    const adjustedWeightKg = hasObesity
      ? calculateAdjustedWeight(actualWeightKg, idealWeightKg)
      : null;
    return Object.freeze({ actualWeightKg, heightCm, bmi, idealWeightKg, adjustedWeightKg, hasObesity });
  }

  function calculateEgfrCkdEpi2021(creatinineMgDl, ageYears, sex) {
    const creatinine = parseLocalizedNumber(creatinineMgDl);
    const age = parseLocalizedNumber(ageYears);
    if (creatinine === null || creatinine <= 0 || !isFiniteInRange(age, CLINICAL_LIMITS.ageYears)) return null;
    if (sex !== 'female' && sex !== 'male') return null;
    const female = sex === 'female';
    const k = female ? 0.7 : 0.9;
    const alpha = female ? -0.241 : -0.302;
    const ratio = creatinine / k;
    return 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.2)
      * Math.pow(0.9938, age) * (female ? 1.012 : 1);
  }

  function assessRenalFunction(input) {
    const renalStatus = clean(input?.renalStatus);
    if (!Object.prototype.hasOwnProperty.call(RENAL_STATUS, renalStatus)) {
      return Object.freeze({ renalStatus: '', label: '', egfr: null, numericEstimateAllowed: false, context: 'Seleccioná la situación renal.' });
    }
    if (renalStatus !== 'stable') {
      const contexts = {
        'aki-no-krt': 'TFGe no estimada: CKD-EPI 2021 no es confiable con creatinina no estable.',
        ihd: 'TFGe no estimada durante hemodiálisis intermitente.',
        'crrt-sled': 'TFGe no estimada durante TRR continua / SLED.',
      };
      return Object.freeze({ renalStatus, label: RENAL_STATUS[renalStatus], egfr: null, numericEstimateAllowed: false, context: contexts[renalStatus] });
    }
    const egfr = calculateEgfrCkdEpi2021(input?.creatinineMgDl, input?.ageYears, clean(input?.sex));
    return Object.freeze({
      renalStatus,
      label: RENAL_STATUS[renalStatus],
      egfr,
      numericEstimateAllowed: true,
      context: egfr === null
        ? 'Completá edad (18–120 años), sexo y creatinina válida para estimar TFGe.'
        : '',
    });
  }

  function getDrugLibrary(group) {
    return DRUG_LIBRARY[group] || [];
  }

  function getDrugById(group, drugId) {
    return getDrugLibrary(group).find((drug) => drug.id === drugId) || null;
  }

  function classifyAudioFile(fileLike) {
    const name = clean(fileLike?.name);
    const mimeType = clean(fileLike?.type).toLowerCase();
    const extensionMatch = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    const extension = extensionMatch ? extensionMatch[1] : '';
    const acceptedByMime = mimeType.startsWith('audio/') || ['application/ogg', 'video/ogg', 'video/mp4'].includes(mimeType);
    const acceptedByExtension = AUDIO_EXTENSIONS.includes(extension);
    const accepted = Boolean(name) && (acceptedByMime || acceptedByExtension);
    return Object.freeze({
      accepted,
      extension,
      mimeType: mimeType || 'tipo no informado por el navegador',
      isWhatsAppVoiceFormat: ['ogg', 'oga', 'opus', 'm4a', 'mp4'].includes(extension) ||
        mimeType.includes('ogg') || mimeType.includes('opus') || mimeType.includes('mp4'),
      reason: accepted
        ? 'Archivo de audio reconocido por tipo o extensión.'
        : 'El archivo no tiene un tipo o extensión de audio reconocible.',
    });
  }

  function calculateInfusion(input) {
    const ampoules = parseLocalizedNumber(input?.ampoules);
    const amountPerAmpoule = parseLocalizedNumber(input?.amountPerAmpoule);
    const amountUnit = clean(input?.amountUnit);
    const finalVolumeMl = parseLocalizedNumber(input?.finalVolumeMl);
    const rateMlH = parseLocalizedNumber(input?.rateMlH);
    const weightKg = parseLocalizedNumber(input?.weightKg);
    const idealWeightKg = parseLocalizedNumber(input?.idealWeightKg);
    const adjustedWeightKg = parseLocalizedNumber(input?.adjustedWeightKg);
    const validUnits = ['mg', 'mcg', 'UI'];

    if (
      ampoules === null || ampoules <= 0 || ampoules > 100 ||
      amountPerAmpoule === null || amountPerAmpoule <= 0 ||
      !validUnits.includes(amountUnit) ||
      finalVolumeMl === null || finalVolumeMl <= 0 || finalVolumeMl > 5000 ||
      rateMlH === null || rateMlH < 0 || rateMlH > 1000
    ) return null;

    const weightValid = isFiniteInRange(weightKg, CLINICAL_LIMITS.weightKg);
    const idealWeightValid = isFiniteInRange(idealWeightKg, CLINICAL_LIMITS.weightKg);
    const adjustedWeightValid = isFiniteInRange(adjustedWeightKg, CLINICAL_LIMITS.weightKg);
    if (amountUnit === 'UI') {
      const totalUi = ampoules * amountPerAmpoule;
      const concentrationUiMl = totalUi / finalVolumeMl;
      const absoluteUiH = concentrationUiMl * rateMlH;
      return Object.freeze({
        kind: 'activity', ampoules, amountPerAmpoule, amountUnit, finalVolumeMl, rateMlH,
        totalUi, concentrationUiMl, absoluteUiH, absoluteUiMin: absoluteUiH / 60,
        weightKg: weightValid ? weightKg : null,
      });
    }

    const amountPerAmpouleMg = amountUnit === 'mcg' ? amountPerAmpoule / 1000 : amountPerAmpoule;
    const totalMg = ampoules * amountPerAmpouleMg;
    const concentrationMgMl = totalMg / finalVolumeMl;
    const concentrationMcgMl = concentrationMgMl * 1000;
    const absoluteMgH = concentrationMgMl * rateMlH;
    const absoluteMcgH = absoluteMgH * 1000;
    const absoluteMcgMin = absoluteMcgH / 60;
    return Object.freeze({
      kind: 'mass', ampoules, amountPerAmpoule, amountUnit, finalVolumeMl, rateMlH,
      totalMg, concentrationMgMl, concentrationMcgMl, absoluteMgH, absoluteMcgH, absoluteMcgMin,
      weightKg: weightValid ? weightKg : null,
      doseMcgKgMin: weightValid ? absoluteMcgMin / weightKg : null,
      doseMcgKgH: weightValid ? absoluteMcgH / weightKg : null,
      doseMcgKgMinReal: weightValid ? absoluteMcgMin / weightKg : null,
      doseMcgKgMinIdeal: idealWeightValid ? absoluteMcgMin / idealWeightKg : null,
      doseMcgKgMinAdjusted: adjustedWeightValid ? absoluteMcgMin / adjustedWeightKg : null,
    });
  }

  function formatInfusionDuration(hoursValue) {
    const hours = parseLocalizedNumber(hoursValue);
    if (hours === null || hours <= 0 || hours > MAX_SEDATION_DURATION_HOURS) return null;
    if (hours < 24) return `${formatNumber(hours, 1)} h`;
    const days = hours / 24;
    return `${formatNumber(hours, 1)} h (${formatNumber(days, 2)} ${days === 1 ? 'día' : 'días'})`;
  }

  function calculateInfusionExposure(input) {
    const calculation = calculateInfusion(input);
    const durationHours = parseLocalizedNumber(input?.durationHours);
    if (!calculation || durationHours === null || durationHours <= 0 || durationHours > MAX_SEDATION_DURATION_HOURS) return null;
    if (calculation.kind === 'activity') {
      return Object.freeze({
        ...calculation,
        durationHours,
        durationLabel: formatInfusionDuration(durationHours),
        administeredUi: calculation.absoluteUiH * durationHours,
      });
    }
    return Object.freeze({
      ...calculation,
      durationHours,
      durationLabel: formatInfusionDuration(durationHours),
      administeredMg: calculation.absoluteMgH * durationHours,
      administeredMcg: calculation.absoluteMcgH * durationHours,
    });
  }

  function calculateMidazolamPreparation(input) {
    return calculateInfusion({
      ...input,
      amountPerAmpoule: input?.amountPerAmpoule ?? 15,
      amountUnit: 'mg',
    });
  }

  function calculateUrineOutputRate(input) {
    const urineMl = parseLocalizedNumber(input?.urineMl);
    const weightKg = parseLocalizedNumber(input?.weightKg);
    const hours = parseLocalizedNumber(input?.hours);

    if (
      urineMl === null || urineMl < 0 || urineMl > 30000 ||
      !isFiniteInRange(weightKg, CLINICAL_LIMITS.weightKg) ||
      hours === null || hours <= 0 || hours > 48
    ) {
      return {
        evaluable: false,
        rateMlKgH: null,
        key: 'not-evaluable',
        label: 'No calculable',
        detail: 'Se necesitan volumen urinario, peso y horas válidos; confirmar que el registro sea completo.',
      };
    }

    const rateMlKgH = urineMl / weightKg / hours;
    if (urineMl === 0 && hours >= 12) {
      return {
        evaluable: true,
        rateMlKgH,
        key: 'anuria-window',
        label: 'Sin diuresis registrada durante 12 h o más',
        detail: 'Señal condicionada a una ventana completa y a la ausencia real de diuresis; corroborar registro y permeabilidad del sistema.',
      };
    }
    if (urineMl === 0) {
      return {
        evaluable: true,
        rateMlKgH,
        key: 'zero-short-window',
        label: 'Sin diuresis registrada en una ventana menor de 12 h',
        detail: 'El período no alcanza 12 h; corroborar registro y permeabilidad del sistema.',
      };
    }
    if (rateMlKgH < 0.5 && hours >= 6) {
      return {
        evaluable: true,
        rateMlKgH,
        key: 'oliguria-window',
        label: 'Débito urinario menor de 0,5 mL/kg/h durante 6 h o más',
        detail: 'Compatible con criterio urinario temporal si la medición es completa; no establece por sí solo etiología ni conducta.',
      };
    }
    if (rateMlKgH < 0.5) {
      return {
        evaluable: true,
        rateMlKgH,
        key: 'low-short-window',
        label: 'Débito bajo con ventana menor de 6 h',
        detail: 'El período es insuficiente para aplicar el criterio temporal de 6 h; repetir o completar la ventana.',
      };
    }
    return {
      evaluable: true,
      rateMlKgH,
      key: 'no-signal',
      label: 'Sin señal por débito urinario en la ventana consignada',
      detail: 'Interpretar junto con tendencia, balance, creatinina y contexto clínico.',
    };
  }

  const identifierPatterns = [
    { key: 'document', pattern: /\b(?:dni|documento)\b/i, label: 'mención de documento/DNI' },
    { key: 'record', pattern: /\b(?:historia\s*cl[ií]nica|n[úu]mero\s+de\s+historia|hc\s*[:#-]?\s*\d)\b/i, label: 'mención de historia clínica' },
    { key: 'contact', pattern: /\b(?:tel[eé]fono|celular|whatsapp|correo|e-?mail)\b/i, label: 'dato de contacto' },
    { key: 'email', pattern: /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i, label: 'dirección de correo' },
    { key: 'long-number', pattern: /\b\d{7,11}\b/, label: 'secuencia numérica compatible con identificador' },
  ];

  function detectDirectIdentifiers(text) {
    const value = String(text ?? '');
    return identifierPatterns
      .filter((item) => item.pattern.test(value))
      .map(({ key, label }) => ({ key, label }));
  }

  function valueOrMissing(value, missing, label) {
    const normalized = clean(value);
    if (normalized) return normalized;
    if (label) missing.push(label);
    return MISSING;
  }

  function numericOrMissing(value, missing, label, suffix) {
    const parsed = parseLocalizedNumber(value);
    if (parsed === null) {
      missing.push(label);
      return `${MISSING}${suffix ? ` ${suffix}` : ''}`;
    }
    return `${formatNumber(parsed)}${suffix ? ` ${suffix}` : ''}`;
  }

  function formatInfusionForEvolution(row, group, weightKg, missing) {
    const drug = getDrugById(group, clean(row?.drugId));
    if (!drug) return '';
    const calculation = calculateInfusion({ ...row, weightKg });
    if (!calculation) {
      missing.push(`${drug.label}: preparación, velocidad o unidad`);
      return '';
    }
    if (calculation.kind === 'activity') {
      return `${drug.label} a ${formatNumber(calculation.rateMlH)} mL/h (${formatNumber(calculation.absoluteUiMin, 4)} UI/min; ${formatNumber(calculation.absoluteUiH, 3)} UI/h de apoyo)`;
    }
    const normalized = calculation.doseMcgKgMin === null
      ? ''
      : `; ${formatNumber(calculation.doseMcgKgMin, 4)} mcg/kg/min con peso real`;
    const base = `${drug.label} a ${formatNumber(calculation.rateMlH)} mL/h (${formatNumber(calculation.absoluteMcgMin, 3)} mcg/min${normalized})`;
    if (group !== 'sedative') return base;
    const exposure = calculateInfusionExposure({ ...row, weightKg });
    if (!exposure) {
      missing.push(`${drug.label}: duración de infusión (1–72 h)`);
      return base;
    }
    return `${base}; ${exposure.durationLabel}, total administrado estimado ${formatNumber(exposure.administeredMg, 3)} mg a ritmo constante`;
  }

  function joinInfusionRows(rows, group, weightKg, missing, label) {
    const rendered = (Array.isArray(rows) ? rows : [])
      .map((row) => formatInfusionForEvolution(row, group, weightKg, missing))
      .filter(Boolean);
    if (rendered.length) return rendered.join('; ');
    missing.push(label);
    return '';
  }

  function buildRespiratory(data, missing) {
    const intubated = clean(data?.intubated);
    if (!intubated) {
      missing.push('soporte respiratorio/intubación');
      return '';
    }
    if (intubated === 'yes') {
      const mode = clean(data.mode);
      const numericDetails = [
        ['presión inspiratoria/control', data.inspiratoryPressure, 'cmH₂O'],
        ['PEEP', data.peep, 'cmH₂O'],
        ['VT', data.tidalVolume, 'mL'],
        ['FiO₂', data.fio2, '%'],
        ['FR programada', data.respiratoryRate, 'rpm'],
        ['presión pico', data.peakPressure, 'cmH₂O'],
      ].map(([label, value, unit]) => {
        const parsed = parseLocalizedNumber(value);
        return parsed === null ? '' : `${label} ${formatNumber(parsed)} ${unit}`;
      }).filter(Boolean);
      const details = [mode ? `modo ${mode}` : '', ...numericDetails].filter(Boolean);
      return `Respiratorio: intubado${details.length ? `; ${details.join(', ')}` : ''}.`;
    }

    const device = clean(data.oxygenDevice);
    const flow = parseLocalizedNumber(data.oxygenFlow);
    const fio2 = parseLocalizedNumber(data.nonInvasiveFio2);
    if (flow === null && fio2 === null) missing.push('flujo o FiO₂ del soporte no invasivo');
    const support = [
      device,
      flow !== null ? `flujo ${formatNumber(flow)} L/min` : '',
      fio2 !== null ? `FiO₂ ${formatNumber(fio2)} %` : '',
    ].filter(Boolean);
    return `Respiratorio: no intubado${support.length ? `; soporte con ${support.join(', ')}` : ''}.`;
  }

  function sanitizeClinicalNote(value) {
    return clean(value)
      .replace(/\beste contenido se gener[oó] con IA\b[\s.:;,–—-]*/gi, '')
      .trim();
  }

  function generateEvolution(data) {
    const missing = [];
    const privacyFindings = detectDirectIdentifiers([
      data?.activeProblem,
      data?.antibiotics,
      data?.cultures,
      data?.infectiousPending,
      data?.manualTranscript,
    ].join('\n'));

    const bed = clean(data?.bed);
    const age = parseLocalizedNumber(data?.age);
    const icuDay = parseLocalizedNumber(data?.icuDay);
    const activeProblem = clean(data?.activeProblem);
    if (!bed) missing.push('cama');
    if (age === null) missing.push('edad');
    if (icuDay === null) missing.push('día de UTI');
    if (!activeProblem) missing.push('problema/diagnóstico activo');
    const identityParts = [
      bed ? `Cama ${bed}` : '',
      age !== null ? `paciente de ${formatNumber(age)} años` : '',
      icuDay !== null ? `día de UTI ${formatNumber(icuDay)}` : '',
    ].filter(Boolean);
    const identityLine = [
      identityParts.length ? `${identityParts.join(', ')}.` : '',
      activeProblem ? `Problema activo: ${activeProblem}.` : '',
    ].filter(Boolean).join(' ');

    const systolic = parseLocalizedNumber(data?.systolicBp);
    const diastolic = parseLocalizedNumber(data?.diastolicBp);
    const heartRate = parseLocalizedNumber(data?.heartRate);
    const dsi = calculateDsiFromVitals(data?.systolicBp, data?.diastolicBp, data?.heartRate);
    if (dsi === null) missing.push('Índice de Shock Diastólico');
    const vasoactives = joinInfusionRows(data?.vasoactives, 'vasoactive', data?.weightKg, missing, 'vasoactivos');
    const hemodynamicParts = [
      systolic !== null && diastolic !== null ? `TA ${formatNumber(systolic)}/${formatNumber(diastolic)} mmHg` : '',
      systolic !== null && diastolic === null ? `TAS ${formatNumber(systolic)} mmHg` : '',
      diastolic !== null && systolic === null ? `TAD ${formatNumber(diastolic)} mmHg` : '',
      heartRate !== null ? `FC ${formatNumber(heartRate)} lpm` : '',
      dsi !== null ? `Índice de Shock Diastólico ${formatNumber(dsi, 2)}` : '',
      vasoactives ? `vasoactivos: ${vasoactives}` : '',
    ].filter(Boolean);
    const hemodynamicLine = hemodynamicParts.length ? `Hemodinamia: ${hemodynamicParts.join('; ')}.` : '';

    const weight = parseLocalizedNumber(data?.weightKg);
    const anthropometry = calculateAnthropometry({ weightKg: data?.weightKg, heightCm: data?.heightCm });
    if (!anthropometry) missing.push('IMC (peso real y talla válidos)');
    const urineMl = parseLocalizedNumber(data?.urineMl);
    const urineHours = parseLocalizedNumber(data?.urineHours);
    const balance = parseLocalizedNumber(data?.balance24h);
    const creatinine = parseLocalizedNumber(data?.creatinine);
    const renalAssessment = assessRenalFunction({
      renalStatus: data?.renalStatus,
      creatinineMgDl: data?.creatinine,
      ageYears: data?.age,
      sex: data?.sex,
    });
    if (!renalAssessment.renalStatus) missing.push('situación renal');
    const urineAssessment = calculateUrineOutputRate({
      urineMl: data?.urineMl,
      weightKg: data?.weightKg,
      hours: data?.urineHours,
    });
    const urineAlerts = {
      'anuria-window': 'sin diuresis registrada durante 12 h o más',
      'zero-short-window': 'sin diuresis registrada en una ventana menor de 12 h',
      'oliguria-window': 'débito menor de 0,5 mL/kg/h durante 6 h o más',
      'low-short-window': 'débito menor de 0,5 mL/kg/h en una ventana menor de 6 h',
    };
    const urineText = urineMl === null
      ? ''
      : [
        `diuresis ${formatNumber(urineMl)} mL${urineHours !== null ? ` en ${formatNumber(urineHours)} h` : ''}`,
        urineAssessment.evaluable ? `débito ${formatNumber(urineAssessment.rateMlKgH, 2)} mL/kg/h` : '',
        urineAssessment.evaluable ? (urineAlerts[urineAssessment.key] || '') : '',
      ].filter(Boolean).join('; ');
    const renalParts = [
      renalAssessment.label,
      weight !== null ? `peso real ${formatNumber(weight)} kg` : '',
      anthropometry ? `IMC ${formatNumber(anthropometry.bmi, 1)} kg/m²` : '',
      urineText,
      balance !== null ? `balance 24 h ${formatNumber(balance)} mL` : '',
      creatinine !== null ? `creatinina ${formatNumber(creatinine)} mg/dL` : '',
      renalAssessment.egfr !== null ? `TFGe ${formatNumber(renalAssessment.egfr, 0)} mL/min/1,73 m²` : '',
    ].filter(Boolean);
    const renalLine = renalParts.length ? `Renal y antropometría: ${renalParts.join('; ')}.` : '';

    const antibiotics = clean(data?.antibiotics);
    const cultures = clean(data?.cultures);
    const pending = clean(data?.infectiousPending);
    const infectiousParts = [
      antibiotics ? `ATB ${antibiotics}` : '',
      cultures ? `cultivos: ${cultures}` : '',
      pending ? `pendientes: ${pending}` : '',
    ].filter(Boolean);
    const infectiousLine = infectiousParts.length ? `Infectología: ${infectiousParts.join('; ')}.` : '';
    const rass = parseLocalizedNumber(data?.rass);
    const sedatives = joinInfusionRows(data?.sedatives, 'sedative', data?.weightKg, missing, 'drogas activas de sedoanalgesia');
    const sedationParts = [rass !== null ? `RASS ${formatNumber(rass)}` : '', sedatives].filter(Boolean);
    const sedationLine = sedationParts.length ? `Sedación: ${sedationParts.join('; ')}.` : '';

    const respiratoryLine = buildRespiratory(data?.respiratory || {}, missing);
    const note = sanitizeClinicalNote(data?.manualTranscript);
    const noteLine = privacyFindings.length ? '' : note;
    if (!note) missing.push('nota/transcripción manual');

    const uniqueMissing = [...new Set(missing)];

    return {
      text: [
        identityLine,
        respiratoryLine,
        hemodynamicLine,
        renalLine,
        infectiousLine,
        sedationLine,
        noteLine,
      ].filter(Boolean).join('\n'),
      missing: uniqueMissing,
      privacyFindings,
      urineAssessment,
    };
  }

  return {
    DRUG_LIBRARY,
    CLINICAL_LIMITS,
    RENAL_STATUS,
    parseLocalizedNumber,
    calculateDsi,
    calculateDsiFromVitals,
    calculateBmi,
    calculateIdealWeight,
    calculateAdjustedWeight,
    calculateAnthropometry,
    calculateEgfrCkdEpi2021,
    assessRenalFunction,
    getDrugLibrary,
    getDrugById,
    classifyAudioFile,
    calculateInfusion,
    calculateInfusionExposure,
    formatInfusionDuration,
    calculateMidazolamPreparation,
    calculateUrineOutputRate,
    detectDirectIdentifiers,
    generateEvolution,
  };
});
