const statusEl = document.getElementById('status');
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');
const btnResetMM = document.getElementById('btnResetMM');
const btnLog = document.getElementById('btnLog');
const btnDownload = document.getElementById('btnDownload');
const btnOpenCsv = document.getElementById('btnOpenCsv');
const btnCopyCsv = document.getElementById('btnCopyCsv');

const btnAdv = document.getElementById('btnAdv');
const advPanel = document.getElementById('advPanel');

const devNameInput = document.getElementById('devName');
const devPrefixInput = document.getElementById('devPrefix');
const svcInput = document.getElementById('svc');
const chrInput = document.getElementById('chr');
const selRate = document.getElementById('selRate');

const droneSel = document.getElementById('droneTypeQuick');

const bleDot = document.getElementById('bleDot');
const valRSSI = document.getElementById('valRSSI');

const vI = document.getElementById('valI');
const vV1 = document.getElementById('valV1');
const vVBAT = document.getElementById('valVBAT');
const vP = document.getElementById('valP');
const vT1 = document.getElementById('valT1');
const vT2 = document.getElementById('valT2');

const minI = document.getElementById('minI');
const maxI = document.getElementById('maxI');
const minV1 = document.getElementById('minV1');
const maxV1 = document.getElementById('maxV1');
const minVBAT = document.getElementById('minVBAT');
const maxVBAT = document.getElementById('maxVBAT');
const minP = document.getElementById('minP');
const maxP = document.getElementById('maxP');
const minT1 = document.getElementById('minT1');
const maxT1 = document.getElementById('maxT1');
const minT2 = document.getElementById('minT2');
const maxT2 = document.getElementById('maxT2');

const canvI = document.getElementById('plotI');
const canvV1 = document.getElementById('plotV1');
const canvVBAT = document.getElementById('plotVBAT');
const canvP = document.getElementById('plotP');
const canvT1 = document.getElementById('plotT1');
const canvT2 = document.getElementById('plotT2');

let ctxI, ctxV1, ctxVBAT, ctxP, ctxT1, ctxT2;
let device = null;
let server = null;
let characteristic = null;

function setStatus(t) { statusEl.textContent = t; }
function fmt(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d) : '—'; }
function setBleDot(colorCss) { bleDot.style.background = colorCss; }

function formatDateHeader(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openAdv() {
  advPanel.hidden = false;
  btnAdv.setAttribute('aria-expanded', 'true');
}

function closeAdv() {
  advPanel.hidden = true;
  btnAdv.setAttribute('aria-expanded', 'false');
}

btnAdv.addEventListener('click', (e) => {
  e.stopPropagation();
  advPanel.hidden ? openAdv() : closeAdv();
});

document.addEventListener('click', () => {
  if (!advPanel.hidden) closeAdv();
});

advPanel.addEventListener('click', (e) => e.stopPropagation());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !advPanel.hidden) closeAdv();
});

const mm = {
  I: { min: +Infinity, max: -Infinity, d: 3 },
  V1: { min: +Infinity, max: -Infinity, d: 3 },
  VBAT: { min: +Infinity, max: -Infinity, d: 3 },
  P: { min: +Infinity, max: -Infinity, d: 1 },
  T1: { min: +Infinity, max: -Infinity, d: 1 },
  T2: { min: +Infinity, max: -Infinity, d: 1 },
};

function updateMM(key, val) {
  if (!Number.isFinite(val)) return;

  const s = mm[key];

  if (val < s.min) s.min = val;
  if (val > s.max) s.max = val;

  if (key === 'I') { minI.textContent = fmt(s.min, s.d); maxI.textContent = fmt(s.max, s.d); }
  if (key === 'V1') { minV1.textContent = fmt(s.min, s.d); maxV1.textContent = fmt(s.max, s.d); }
  if (key === 'VBAT') { minVBAT.textContent = fmt(s.min, s.d); maxVBAT.textContent = fmt(s.max, s.d); }
  if (key === 'P') { minP.textContent = fmt(s.min, s.d); maxP.textContent = fmt(s.max, s.d); }
  if (key === 'T1') { minT1.textContent = fmt(s.min, s.d); maxT1.textContent = fmt(s.max, s.d); }
  if (key === 'T2') { minT2.textContent = fmt(s.min, s.d); maxT2.textContent = fmt(s.max, s.d); }
}

function resetMM() {
  for (const k of Object.keys(mm)) {
    mm[k].min = +Infinity;
    mm[k].max = -Infinity;
  }

  minI.textContent = maxI.textContent = '—';
  minV1.textContent = maxV1.textContent = '—';
  minVBAT.textContent = maxVBAT.textContent = '—';
  minP.textContent = maxP.textContent = '—';
  minT1.textContent = maxT1.textContent = '—';
  minT2.textContent = maxT2.textContent = '—';
}

function fitCanvas(canvas, targetH = 110) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth;
  const cssH = targetH;

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return ctx;
}

const BUFLEN = 180;
const bufs = { I: [], V1: [], VBAT: [], P: [], T1: [], T2: [] };

function drawSparkline(ctx, data) {
  if (!ctx) return;

  const W = ctx.canvas.clientWidth;
  const H = ctx.canvas.clientHeight;

  ctx.clearRect(0, 0, W, H);

  if (data.length < 2) return;

  let min = Infinity;
  let max = -Infinity;

  for (const v of data) {
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min -= 1;
    max += 1;
  }

  const pad = 6;

  ctx.lineWidth = 2;
  ctx.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--brand-blue')
    .trim();
  ctx.beginPath();

  data.forEach((v, i) => {
    const x = pad + (W - 2 * pad) * (i / (data.length - 1));
    const y = H - pad - ((v - min) / (max - min)) * (H - 2 * pad);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function resizeAll() {
  ctxI = fitCanvas(canvI);
  ctxV1 = fitCanvas(canvV1);
  ctxVBAT = fitCanvas(canvVBAT);
  ctxP = fitCanvas(canvP);
  ctxT1 = fitCanvas(canvT1);
  ctxT2 = fitCanvas(canvT2);

  drawSparkline(ctxI, bufs.I);
  drawSparkline(ctxV1, bufs.V1);
  drawSparkline(ctxVBAT, bufs.VBAT);
  drawSparkline(ctxP, bufs.P);
  drawSparkline(ctxT1, bufs.T1);
  drawSparkline(ctxT2, bufs.T2);
}

window.addEventListener('resize', () => {
  clearTimeout(resizeAll._t);
  resizeAll._t = setTimeout(resizeAll, 120);
});

function push(buf, val) {
  buf.push(val);

  if (buf.length > BUFLEN) {
    buf.shift();
  }
}

let isLogging = false;
let logRows = [];
let logTimer = null;
let lastSample = { I: NaN, V1: NaN, VBAT: NaN, P: NaN, T1: NaN, T2: NaN, has: false };

function toFixedComma(n, d) {
  return Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '';
}

function nowIsoLocal() {
  const d = new Date();
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0');
  const mm = String(Math.abs(tz) % 60).padStart(2, '0');

  return d.toISOString().replace('Z', '') + sign + hh + ':' + mm;
}

function refreshExportButtons() {
  const hasData = logRows.length > 1;

  btnDownload.disabled = !hasData;
  btnOpenCsv.disabled = !hasData;
  btnCopyCsv.disabled = !hasData;
}

function startLogging() {
  droneSel.disabled = true;

  logRows = [];
  logRows.push("# FlightTest FSM");
  logRows.push("# Date: " + formatDateHeader());
  logRows.push("# Drone: " + droneSel.value);
  logRows.push("# DeviceName: " + (device?.name || "N/A"));
  logRows.push("");
  logRows.push("timestamp;I_A;VHV_V;VBAT_V;P_W;T1_C;T2_C");

  isLogging = true;
  btnLog.textContent = 'Stop logging';

  setStatus('Enregistrement en cours…');
  refreshExportButtons();

  const period = parseInt(selRate.value, 10) || 1000;

  if (logTimer) clearInterval(logTimer);

  logTimer = setInterval(() => {
    if (!isLogging || !lastSample.has) return;

    logRows.push([
      nowIsoLocal(),
      toFixedComma(lastSample.I, 3),
      toFixedComma(lastSample.V1, 3),
      toFixedComma(lastSample.VBAT, 3),
      toFixedComma(lastSample.P, 1),
      toFixedComma(lastSample.T1, 1),
      toFixedComma(lastSample.T2, 1)
    ].join(';'));

    refreshExportButtons();
  }, period);
}

function stopLogging() {
  isLogging = false;
  droneSel.disabled = false;
  btnLog.textContent = 'Start logging';

  setStatus('Enregistrement stoppé.');

  if (logTimer) {
    clearInterval(logTimer);
    logTimer = null;
  }

  refreshExportButtons();
}

function downloadCSV() {
  if (logRows.length <= 1) return;

  const csv = logRows.join('\n') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  a.href = url;
  a.download = `FlightTest_${ts}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  setStatus('CSV téléchargé');
}

function openCSVInTab() {
  if (logRows.length <= 1) return;

  const csv = logRows.join('\n') + '\n';
  const win = window.open();

  if (!win) {
    setStatus('Pop-up bloquée. Autorise les pop-up.');
    return;
  }

  win.document.write(
    '<pre style="white-space:pre-wrap;word-wrap:break-word;margin:1rem;">'
    + csv.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    + '</pre>'
  );

  setStatus('CSV ouvert. Sélectionne et copie.');
}

async function copyCSV() {
  if (logRows.length <= 1) return;

  const csv = logRows.join('\n') + '\n';

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(csv);
      setStatus('CSV copié dans le presse-papiers.');
    } else {
      const ta = document.createElement('textarea');

      ta.value = csv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);

      setStatus('CSV copié.');
    }
  } catch (e) {
    setStatus('Impossible de copier. Utilise “Ouvrir CSV”.');
  }
}

let advHandler = null;

function updateRssi(rssi) {
  valRSSI.textContent = Number.isFinite(rssi) ? String(Math.round(rssi)) : '—';

  if (!Number.isFinite(rssi)) setBleDot('var(--danger)');
  else if (rssi > -65) setBleDot('var(--ok)');
  else if (rssi > -80) setBleDot('var(--warn)');
  else setBleDot('var(--danger)');
}

async function startRssiWatch() {
  updateRssi(NaN);

  if (!device) return;
  if (!device.watchAdvertisements) return;

  stopRssiWatch();

  advHandler = (event) => updateRssi(event.rssi);
  device.addEventListener('advertisementreceived', advHandler);

  try {
    await device.watchAdvertisements();
  } catch (e) {
    console.warn(e);
  }
}

function stopRssiWatch() {
  if (device && advHandler) {
    device.removeEventListener('advertisementreceived', advHandler);
  }

  advHandler = null;
  updateRssi(NaN);
}

function parseAsciiCsv(dv) {
  let s = '';

  for (let i = 0; i < dv.byteLength; i++) {
    s += String.fromCharCode(dv.getUint8(i));
  }

  const tok = s.split(';').map(t => (t ?? '').trim());

  const toNum = (x) => {
    if (!x) return NaN;
    if (x.toLowerCase() === 'nan') return NaN;

    const v = parseFloat(x);

    return Number.isFinite(v) ? v : NaN;
  };

  return {
    I: toNum(tok[0]),
    V1: toNum(tok[1]),
    P: toNum(tok[2]),
    T1: toNum(tok[3]),
    T2: toNum(tok[4]),
    VBAT: toNum(tok[5])
  };
}

function parseBinaryPacket(dv) {
  if (dv.byteLength < 12) return null;

  const magic = dv.getUint8(0);
  const ver = dv.getUint8(1);

  if (magic !== 0xA5) return null;

  if (ver === 1 && dv.byteLength >= 12) {
    const I_mA = dv.getInt16(2, true);
    const V_mV = dv.getUint16(4, true);
    const P_dW = dv.getInt16(6, true);
    const T1_dC = dv.getInt16(8, true);
    const T2_dC = dv.getInt16(10, true);

    return {
      I: I_mA / 1000.0,
      V1: V_mV / 1000.0,
      P: P_dW / 10.0,
      T1: (T1_dC === -32768) ? NaN : (T1_dC / 10.0),
      T2: (T2_dC === -32768) ? NaN : (T2_dC / 10.0),
      VBAT: NaN
    };
  }

  if (ver === 3 && dv.byteLength >= 16) {
    const I_mA = dv.getInt16(2, true);
    const V_mV = dv.getInt32(4, true);
    const P_mW = dv.getInt32(8, true);
    const T1_dC = dv.getInt16(12, true);
    const T2_dC = dv.getInt16(14, true);

    return {
      I: I_mA / 1000.0,
      V1: V_mV / 1000.0,
      P: P_mW / 1000.0,
      T1: (T1_dC === -32768) ? NaN : (T1_dC / 10.0),
      T2: (T2_dC === -32768) ? NaN : (T2_dC / 10.0),
      VBAT: NaN
    };
  }

  if (ver === 4 && dv.byteLength >= 20) {
    const I_mA = dv.getInt16(2, true);
    const V_mV = dv.getInt32(4, true);
    const P_mW = dv.getInt32(8, true);
    const T1_dC = dv.getInt16(12, true);
    const T2_dC = dv.getInt16(14, true);
    const VBAT_mV = dv.getInt32(16, true);

    return {
      I: I_mA / 1000.0,
      V1: V_mV / 1000.0,
      P: P_mW / 1000.0,
      T1: (T1_dC === -32768) ? NaN : (T1_dC / 10.0),
      T2: (T2_dC === -32768) ? NaN : (T2_dC / 10.0),
      VBAT: VBAT_mV / 1000.0,
    };
  }

  return null;
}

function handleNotif(event) {
  try {
    const dv = event?.target?.value || characteristic?.value;

    if (!dv) {
      setStatus("Notif reçue mais DataView introuvable");
      return;
    }

    const len = dv.byteLength;
    const magic = len >= 1 ? dv.getUint8(0) : -1;
    const ver = len >= 2 ? dv.getUint8(1) : -1;

    console.log("=== BLE NOTIF ===");
    console.log("byteLength =", len);
    console.log("magic =", magic, "ver =", ver);

    let I = NaN;
    let V1 = NaN;
    let P = NaN;
    let T1 = NaN;
    let T2 = NaN;
    let VBAT = NaN;

    if (magic === 0xA5 && ver === 4 && len >= 20) {
      const I_mA = dv.getInt16(2, true);
      const V_mV = dv.getInt32(4, true);
      const P_mW = dv.getInt32(8, true);
      const T1_dC = dv.getInt16(12, true);
      const T2_dC = dv.getInt16(14, true);
      const VBAT_mV = dv.getInt32(16, true);

      I = I_mA / 1000.0;
      V1 = V_mV / 1000.0;
      P = P_mW / 1000.0;
      T1 = (T1_dC === -32768) ? NaN : (T1_dC / 10.0);
      T2 = (T2_dC === -32768) ? NaN : (T2_dC / 10.0);
      VBAT = VBAT_mV / 1000.0;

      //console.log("Decoded v4 =", { I, V1, P, T1, T2, VBAT });
      setStatus("BLE connecté");
    } else {
      const m = parseBinaryPacket(dv) ?? parseAsciiCsv(dv);

      //console.log("Fallback parsed =", m);

      I = m?.I ?? NaN;
      V1 = m?.V1 ?? NaN;
      P = m?.P ?? NaN;
      T1 = m?.T1 ?? NaN;
      T2 = m?.T2 ?? NaN;
      VBAT = m?.VBAT ?? NaN;

      setStatus("BLE connecté");
    }

    vP.textContent = Number.isFinite(P) ? fmt(P, 1) : '—';
    vI.textContent = Number.isFinite(I) ? fmt(I, 3) : '—';
    vV1.textContent = Number.isFinite(V1) ? fmt(V1, 3) : '—';
    vVBAT.textContent = Number.isFinite(VBAT) ? fmt(VBAT, 3) : '—';
    vT1.textContent = Number.isFinite(T1) ? fmt(T1, 1) : '—';
    vT2.textContent = Number.isFinite(T2) ? fmt(T2, 1) : '—';

    updateMM('P', P);
    updateMM('I', I);
    updateMM('V1', V1);

    if (Number.isFinite(VBAT)) updateMM('VBAT', VBAT);
    if (Number.isFinite(T1)) updateMM('T1', T1);
    if (Number.isFinite(T2)) updateMM('T2', T2);

    if (Number.isFinite(P)) push(bufs.P, P);
    if (Number.isFinite(I)) push(bufs.I, I);
    if (Number.isFinite(V1)) push(bufs.V1, V1);
    if (Number.isFinite(VBAT)) push(bufs.VBAT, VBAT);
    if (Number.isFinite(T1)) push(bufs.T1, T1);
    if (Number.isFinite(T2)) push(bufs.T2, T2);

    drawSparkline(ctxP, bufs.P);
    drawSparkline(ctxI, bufs.I);
    drawSparkline(ctxV1, bufs.V1);
    drawSparkline(ctxVBAT, bufs.VBAT);
    drawSparkline(ctxT1, bufs.T1);
    drawSparkline(ctxT2, bufs.T2);

    lastSample = { I, V1, VBAT, P, T1, T2, has: true };

  } catch (err) {
    console.error("handleNotif error:", err);
    setStatus("Erreur JS notif: " + err.message);
  }
}

async function connect() {
  try {
    if (!('bluetooth' in navigator)) {
      setStatus('Web Bluetooth non supporté.');
      return;
    }

    btnConnect.disabled = true;
    setStatus('Scan BLE…');

    const serviceUuid = svcInput.value.trim();
    const charUuid = chrInput.value.trim();
    const exactName = devNameInput.value.trim();
    const prefix = devPrefixInput.value.trim();

    const filters = [];

    if (exactName) {
      filters.push({ name: exactName });
    } else {
      filters.push({ namePrefix: prefix || "FSM" });
    }

    device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: [serviceUuid]
    });

    await startRssiWatch();

    device.addEventListener('gattserverdisconnected', onDisconnected);

    setStatus('Connexion GATT…');
    server = await device.gatt.connect();

    setStatus('Service…');
    const service = await server.getPrimaryService(serviceUuid);

    setStatus('Characteristic…');
    characteristic = await service.getCharacteristic(charUuid);

    setStatus('Notifications…');
    await characteristic.startNotifications();

    characteristic.addEventListener('characteristicvaluechanged', handleNotif);

    setBleDot('var(--ok)');
    setStatus(`Connecté à "${device.name}"`);

    btnDisconnect.disabled = false;

  } catch (e) {
    console.error(e);

    setStatus('Erreur: ' + e.message);
    btnConnect.disabled = false;
    setBleDot('var(--danger)');

    stopRssiWatch();
  }
}

async function disconnect() {
  setStatus('Déconnexion…');
  setBleDot('var(--danger)');

  btnDisconnect.disabled = true;
  btnConnect.disabled = false;

  stopRssiWatch();

  try {
    if (characteristic) {
      try {
        await characteristic.stopNotifications();
      } catch (e) { }

      characteristic.removeEventListener('characteristicvaluechanged', handleNotif);
      characteristic = null;
    }

    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
  } catch (e) {
    console.warn('Disconnect error:', e);
  }

  server = null;
  device = null;
  lastSample = { I: NaN, V1: NaN, VBAT: NaN, P: NaN, T1: NaN, T2: NaN, has: false };

  setStatus('Déconnecté.');
}

function onDisconnected() {
  stopRssiWatch();
  setBleDot('var(--danger)');
  setStatus('Déconnecté (radio).');

  btnConnect.disabled = false;
  btnDisconnect.disabled = true;
}

btnConnect.addEventListener('click', connect);
btnDisconnect.addEventListener('click', disconnect);
btnResetMM.addEventListener('click', resetMM);
btnLog.addEventListener('click', () => isLogging ? stopLogging() : startLogging());
btnDownload.addEventListener('click', downloadCSV);
btnOpenCsv.addEventListener('click', openCSVInTab);
btnCopyCsv.addEventListener('click', copyCSV);

resizeAll();
