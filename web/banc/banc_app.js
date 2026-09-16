/**
 * BANC Connectome Simulation Interactive Web Client
 * Implements Canvas-based Circuit Graph, Spike Raster, Voltage Traces, and Motor Recruitment Table.
 */

// State
let currentCircuitId = 'giant_fiber';
let currentCircuitData = null;
let currentSimResults = null;
let graphMode = 'schematic'; // 'schematic' or 'anatomical'

// Dynamic API Base URL supporting file://, /banc/, and root deployments
const apiBase = window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8000/api/banc'
  : '/api/banc';

// Elements
const circuitSelect = document.getElementById('circuit-select');

const stimSlider = document.getElementById('stim-slider');
const stimVal = document.getElementById('stim-val');
const durSlider = document.getElementById('dur-slider');
const durVal = document.getElementById('dur-val');
const cutoffSlider = document.getElementById('cutoff-slider');
const cutoffVal = document.getElementById('cutoff-val');
const weightSlider = document.getElementById('weight-slider');
const weightVal = document.getElementById('weight-val');
const bgSlider = document.getElementById('bg-slider');
const bgVal = document.getElementById('bg-val');
const seedInput = document.getElementById('seed-input');

const btnRun = document.getElementById('btn-run');
const btnSweep = document.getElementById('btn-sweep');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export');
const btnViewSchematic = document.getElementById('btn-view-schematic');
const btnViewAnatomical = document.getElementById('btn-view-anatomical');
const btnCloseSweep = document.getElementById('btn-close-sweep');
const sweepSection = document.getElementById('sweep-section');

const circuitDesc = document.getElementById('circuit-description');
const graphModeCaption = document.getElementById('graph-mode-caption');
const tooltip = document.getElementById('node-tooltip');

// Canvases
const circuitCanvas = document.getElementById('circuit-canvas');
const circuitCtx = circuitCanvas.getContext('2d');
const rasterCanvas = document.getElementById('raster-canvas');
const rasterCtx = rasterCanvas.getContext('2d');
const voltageCanvas = document.getElementById('voltage-canvas');
const voltageCtx = voltageCanvas.getContext('2d');
const sweepCanvas = document.getElementById('sweep-canvas');
const sweepCtx = sweepCanvas.getContext('2d');

// Stats and Table
const statNeurons = document.getElementById('stat-neurons');
const statSynapses = document.getElementById('stat-synapses');
const statMotor = document.getElementById('stat-motor');
const statStability = document.getElementById('stat-stability');
const rasterSpikeCount = document.getElementById('raster-spike-count');
const rasterComputeMs = document.getElementById('raster-compute-ms');
const rasterMotorRate = document.getElementById('raster-motor-rate');
const recruitedSummary = document.getElementById('recruited-summary');
const motorTableBody = document.getElementById('motor-table-body');

// Setup Slider Event Listeners
stimSlider.addEventListener('input', (e) => { stimVal.textContent = `${e.target.value} Hz`; });
durSlider.addEventListener('input', (e) => { durVal.textContent = `${e.target.value} ms`; });
cutoffSlider.addEventListener('input', (e) => { cutoffVal.textContent = `≥ ${e.target.value} synapses`; });
weightSlider.addEventListener('input', (e) => { weightVal.textContent = `${e.target.value}×`; });
bgSlider.addEventListener('input', (e) => { bgVal.textContent = `${e.target.value} Hz`; });

circuitSelect.addEventListener('change', async (e) => {
  currentCircuitId = e.target.value;
  if (currentCircuitId === 'giant_fiber') {
    circuitDesc.textContent = 'DNp01 -> Thoracic VNC -> TTMn (jump) & DLMn (flight)';
    cutoffSlider.value = 3;
    cutoffVal.textContent = '≥ 3 synapses';
  } else {
    circuitDesc.textContent = 'DNp09 -> Thoracic Neuropils -> Leg flexor & extensor motor units';
    cutoffSlider.value = 5;
    cutoffVal.textContent = '≥ 5 synapses';
  }
  await loadCircuit(currentCircuitId);
  await runSimulation();
});

btnViewSchematic.addEventListener('click', () => {
  graphMode = 'schematic';
  btnViewSchematic.classList.add('active');
  btnViewAnatomical.classList.remove('active');
  graphModeCaption.textContent = 'Schematic Layered Flow (Brain DN → VNC Interneurons → Motor Output)';
  drawCircuitGraph();
});

btnViewAnatomical.addEventListener('click', () => {
  graphMode = 'anatomical';
  btnViewAnatomical.classList.add('active');
  btnViewSchematic.classList.remove('active');
  graphModeCaption.textContent = 'Anatomical 3D Projection (BANC EM nanometer coordinates)';
  drawCircuitGraph();
});

btnRun.addEventListener('click', runSimulation);
btnReset.addEventListener('click', () => {
  stimSlider.value = 0;
  stimVal.textContent = '0 Hz';
  runSimulation();
});

btnSweep.addEventListener('click', runSweep);
btnCloseSweep.addEventListener('click', () => { sweepSection.style.display = 'none'; });

btnExport.addEventListener('click', () => {
  window.location.href = `${apiBase}/export?circuit_id=${currentCircuitId}`;
});

// Load Circuit Topology
async function loadCircuit(circuitId) {
  try {
    const res = await fetch(`${apiBase}/circuit/${circuitId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentCircuitData = await res.json();

    // Update Stats Box
    statNeurons.textContent = currentCircuitData.stats.total_neurons;
    statSynapses.textContent = currentCircuitData.stats.total_synapses.toLocaleString();
    statMotor.textContent = currentCircuitData.stats.motor_neurons_count;

    // Calculate node coordinates for both modes
    computeLayoutCoordinates();
    drawCircuitGraph();
  } catch (err) {
    console.error('Failed to load circuit:', err);
  }
}



// Compute Graph Node Coordinates
let nodePositions = new Map(); // id -> {x, y, node}

function computeLayoutCoordinates() {
  if (!currentCircuitData) return;
  nodePositions.clear();

  const W = circuitCanvas.width;
  const H = circuitCanvas.height;
  const padX = 40;
  const padY = 30;

  const nodes = currentCircuitData.nodes;

  if (graphMode === 'schematic') {
    // 3 layers: Inputs (left: x=80), Interneurons (center: x=280), Motors (right: x=500)
    const inputs = nodes.filter(n => n.is_stimulated_input);
    const inters = nodes.filter(n => !n.is_stimulated_input && !n.is_motor_output);
    const motors = nodes.filter(n => n.is_motor_output);

    // Layout inputs
    inputs.forEach((n, i) => {
      const spacing = (H - 2 * padY) / (inputs.length + 1);
      nodePositions.set(n.id, { x: padX + 30, y: padY + (i + 1) * spacing, node: n });
    });

    // Layout interneurons (sub-grid or vertical distribution)
    const interCols = 2;
    inters.forEach((n, i) => {
      const col = i % interCols;
      const row = Math.floor(i / interCols);
      const numRows = Math.ceil(inters.length / interCols);
      const x = W * 0.35 + col * (W * 0.12);
      const y = padY + ((row + 0.5) / Math.max(1, numRows)) * (H - 2 * padY);
      nodePositions.set(n.id, { x, y, node: n });
    });

    // Layout motor neurons
    const motorCols = 3;
    motors.forEach((n, i) => {
      const col = i % motorCols;
      const row = Math.floor(i / motorCols);
      const numRows = Math.ceil(motors.length / motorCols);
      const x = W * 0.65 + col * (W * 0.11);
      const y = padY + ((row + 0.5) / Math.max(1, numRows)) * (H - 2 * padY);
      nodePositions.set(n.id, { x, y, node: n });
    });

  } else {
    // Anatomical mode using root_position_nm [X, Y, Z]
    // Fly orientation in EM: X is lateral (left-right), Y is dorso-ventral/anterior-posterior, Z is depth
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      const [x, y, z] = n.position_nm;
      if (x > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    });

    if (minX === Infinity) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    nodes.forEach(n => {
      const [x, y] = n.position_nm;
      const normX = (x - minX) / spanX;
      const normY = (y - minY) / spanY;
      const posX = padX + normX * (W - 2 * padX);
      const posY = padY + normY * (H - 2 * padY);
      nodePositions.set(n.id, { x: posX, y: posY, node: n });
    });
  }
}

// Draw Circuit Canvas
function drawCircuitGraph() {
  const W = circuitCanvas.width;
  const H = circuitCanvas.height;
  circuitCtx.clearRect(0, 0, W, H);

  if (!currentCircuitData || !currentCircuitData.edges) {
    circuitCtx.fillStyle = '#827e77';
    circuitCtx.font = '13px Inter, sans-serif';
    circuitCtx.textAlign = 'center';
    circuitCtx.fillText('Cargando topología del circuito BANC...', W / 2, H / 2);
    return;
  }

  computeLayoutCoordinates();

  // Background subtle grid
  circuitCtx.strokeStyle = 'rgba(45, 44, 41, 0.4)';
  circuitCtx.lineWidth = 1;
  for (let x = 40; x < W; x += 40) {
    circuitCtx.beginPath();
    circuitCtx.moveTo(x, 0);
    circuitCtx.lineTo(x, H);
    circuitCtx.stroke();
  }

  // Draw Edges (synaptic lines)
  const edges = currentCircuitData.edges;
  const cutoff = parseInt(cutoffSlider.value, 10);

  circuitCtx.lineWidth = 0.8;
  edges.forEach(e => {
    if (e.count < cutoff) return;
    const p1 = nodePositions.get(e.pre);
    const p2 = nodePositions.get(e.post);
    if (!p1 || !p2) return;

    circuitCtx.strokeStyle = (p1.node.is_stimulated_input)
      ? 'rgba(224, 159, 62, 0.35)'
      : 'rgba(78, 135, 140, 0.2)';

    circuitCtx.beginPath();
    circuitCtx.moveTo(p1.x, p1.y);
    circuitCtx.lineTo(p2.x, p2.y);
    circuitCtx.stroke();
  });

  // Draw Nodes
  nodePositions.forEach((pos, id) => {
    const node = pos.node;
    circuitCtx.beginPath();

    let radius = 3.5;
    if (node.is_stimulated_input) {
      circuitCtx.fillStyle = '#e09f3e'; // Amber
      radius = 6.5;
    } else if (node.is_motor_output) {
      circuitCtx.fillStyle = '#e06d53'; // Coral
      radius = 4.0;
    } else {
      circuitCtx.fillStyle = '#4e878c'; // Sage/Teal
      radius = 3.0;
    }

    circuitCtx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    circuitCtx.fill();

    // White outline for stimulated input
    if (node.is_stimulated_input) {
      circuitCtx.strokeStyle = '#ffffff';
      circuitCtx.lineWidth = 1.5;
      circuitCtx.stroke();
    }
  });
}

// Tooltip on Graph Hover
circuitCanvas.addEventListener('mousemove', (e) => {
  const rect = circuitCanvas.getBoundingClientRect();
  const scaleX = circuitCanvas.width / rect.width;
  const scaleY = circuitCanvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  let hovered = null;
  nodePositions.forEach((pos) => {
    const dist = Math.hypot(pos.x - mx, pos.y - my);
    if (dist < 8) hovered = pos.node;
  });

  if (hovered) {
    tooltip.style.display = 'block';
    tooltip.style.left = `${e.clientX - rect.left + 15}px`;
    tooltip.style.top = `${e.clientY - rect.top + 10}px`;
    tooltip.innerHTML = `
      <strong>${hovered.cell_type}</strong> (${hovered.super_class})<br>
      <span style="color: #9e9a92;">ID: ${hovered.id}</span><br>
      NT: <strong>${hovered.neurotransmitter}</strong> (${hovered.side || 'center'})<br>
      Effector: <em>${hovered.body_part_effector || hovered.neuromere || 'CNS'}</em>
    `;
  } else {
    tooltip.style.display = 'none';
  }
});

circuitCanvas.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
});

// Run Simulation
async function runSimulation() {
  btnRun.disabled = true;
  document.querySelector('.btn-spinner').style.display = 'inline-block';
  document.querySelector('.btn-text').textContent = 'Simulating...';

  const reqData = {
    circuit_id: currentCircuitId,
    stim_rate: parseFloat(stimSlider.value),
    duration_ms: parseFloat(durSlider.value),
    bg_rate: parseFloat(bgSlider.value),
    weight_scale: parseFloat(weightSlider.value),
    synapse_cutoff: parseInt(cutoffSlider.value, 10),
    seed: parseInt(seedInput.value, 10)
  };

  try {
    const res = await fetch(`${apiBase}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqData)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentSimResults = await res.json();

    renderSimulationResults(currentSimResults);
  } catch (err) {
    console.error('Simulation error:', err);
  } finally {


    btnRun.disabled = false;
    document.querySelector('.btn-spinner').style.display = 'none';
    document.querySelector('.btn-text').textContent = 'Run Simulation';
  }
}

// Render Results: Raster, Voltage Traces, Motor Table
function renderSimulationResults(data) {
  // 1. Update Metrics
  rasterSpikeCount.textContent = data.total_spikes.toLocaleString();
  rasterComputeMs.textContent = `${data.compute_time_ms} ms`;
  rasterMotorRate.textContent = `${data.population_rates_hz.motor_neurons} Hz`;

  statStability.textContent = data.network_status === 'healthy' ? 'Healthy' : data.network_status;
  statStability.className = `stat-val status-pill status-${data.network_status === 'healthy' ? 'healthy' : 'warning'}`;

  // 2. Render Spike Raster Plot
  drawSpikeRaster(data.spikes, data.duration_ms);

  // 3. Render Voltage Traces
  drawVoltageTraces(data.traces);

  // 4. Update Motor Table
  populateMotorTable(data.motor_outputs);
}

// Draw Spike Raster
function drawSpikeRaster(spikes, durationMs) {
  const W = rasterCanvas.width;
  const H = rasterCanvas.height;
  rasterCtx.clearRect(0, 0, W, H);

  // Background
  rasterCtx.fillStyle = '#0c0c0b';
  rasterCtx.fillRect(0, 0, W, H);

  // Axes ticks
  rasterCtx.strokeStyle = 'rgba(45, 44, 41, 0.6)';
  rasterCtx.lineWidth = 1;
  const numTimeTicks = 10;
  rasterCtx.fillStyle = '#827e77';
  rasterCtx.font = '10px JetBrains Mono, monospace';

  for (let i = 0; i <= numTimeTicks; i++) {
    const tVal = (durationMs / numTimeTicks) * i;
    const x = (tVal / durationMs) * (W - 40) + 30;
    rasterCtx.beginPath();
    rasterCtx.moveTo(x, 0);
    rasterCtx.lineTo(x, H - 20);
    rasterCtx.stroke();
    rasterCtx.fillText(`${Math.round(tVal)}ms`, x - 12, H - 6);
  }

  // Draw Spikes
  const totalNeurons = currentCircuitData.nodes.length;
  spikes.forEach(s => {
    const x = (s.t / durationMs) * (W - 40) + 30;
    const y = (s.neuron_idx / totalNeurons) * (H - 28) + 4;

    if (s.super_class === 'descending') {
      rasterCtx.fillStyle = '#e09f3e'; // Amber
      rasterCtx.fillRect(x - 0.75, y - 1, 1.5, 3.5);
    } else if (s.super_class === 'motor') {
      rasterCtx.fillStyle = '#e06d53'; // Coral
      rasterCtx.fillRect(x - 0.75, y - 1, 1.5, 3.5);
    } else {
      rasterCtx.fillStyle = '#4e878c'; // Teal
      rasterCtx.fillRect(x - 0.5, y - 1, 1.2, 3.0);
    }
  });
}

// Draw Voltage Traces
function drawVoltageTraces(traces) {
  const W = voltageCanvas.width;
  const H = voltageCanvas.height;
  voltageCtx.clearRect(0, 0, W, H);

  const times = traces.times;
  const voltages = traces.voltages;
  const keys = Object.keys(voltages);
  if (times.length === 0 || keys.length === 0) return;

  const duration = times[times.length - 1] || 500;
  const vMin = -58.0;
  const vMax = -40.0;

  const padL = 35, padR = 15, padT = 15, padB = 25;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Grid & Reference potentials
  const v0 = -52.0;
  const vTh = -45.0;

  const yV0 = padT + (1.0 - (v0 - vMin) / (vMax - vMin)) * plotH;
  const yVTh = padT + (1.0 - (vTh - vMin) / (vMax - vMin)) * plotH;

  // Threshold line (-45 mV)
  voltageCtx.strokeStyle = 'rgba(224, 109, 83, 0.4)';
  voltageCtx.setLineDash([4, 4]);
  voltageCtx.beginPath();
  voltageCtx.moveTo(padL, yVTh);
  voltageCtx.lineTo(W - padR, yVTh);
  voltageCtx.stroke();

  // Resting line (-52 mV)
  voltageCtx.strokeStyle = 'rgba(130, 126, 119, 0.3)';
  voltageCtx.beginPath();
  voltageCtx.moveTo(padL, yV0);
  voltageCtx.lineTo(W - padR, yV0);
  voltageCtx.stroke();
  voltageCtx.setLineDash([]);

  // Labels
  voltageCtx.fillStyle = '#827e77';
  voltageCtx.font = '10px JetBrains Mono';
  voltageCtx.fillText('-45 mV (Threshold)', padL + 4, yVTh - 4);
  voltageCtx.fillText('-52 mV (Resting)', padL + 4, yV0 + 12);

  // Colors for traces
  const traceColors = ['#e09f3e', '#e06d53', '#4e878c', '#6ee7b7'];

  keys.forEach((k, kidx) => {
    const vArr = voltages[k];
    voltageCtx.strokeStyle = traceColors[kidx % traceColors.length];
    voltageCtx.lineWidth = 1.5;
    voltageCtx.beginPath();

    times.forEach((t, i) => {
      const v = vArr[i] !== undefined ? vArr[i] : v0;
      const x = padL + (t / duration) * plotW;
      const clampedV = Math.max(vMin, Math.min(vMax, v));
      const y = padT + (1.0 - (clampedV - vMin) / (vMax - vMin)) * plotH;

      if (i === 0) voltageCtx.moveTo(x, y);
      else voltageCtx.lineTo(x, y);
    });
    voltageCtx.stroke();
  });
}

// Populate Motor Recruitment Table
function populateMotorTable(motorOutputs) {
  motorTableBody.innerHTML = '';
  let activeCount = 0;

  const maxRate = Math.max(1, ...motorOutputs.map(m => m.firing_rate_hz));

  motorOutputs.forEach(m => {
    if (m.delta_rate_hz > 0.1 || m.firing_rate_hz > 0.1) activeCount++;

    const tr = document.createElement('tr');
    const barWidth = Math.min(100, Math.round((m.firing_rate_hz / maxRate) * 100));

    tr.innerHTML = `
      <td><strong>${m.cell_type}</strong></td>
      <td>${m.body_part_effector || '--'}</td>
      <td><span class="badge badge-dark">${m.neuromere || 'VNC'}</span></td>
      <td><code style="font-size: 11px;">${m.id.substring(0, 10)}...</code></td>
      <td>${m.baseline_rate_hz || 0} Hz</td>
      <td><strong>${m.firing_rate_hz} Hz</strong></td>
      <td style="color: ${m.delta_rate_hz > 0 ? 'var(--accent-amber)' : 'var(--text-muted)'}; font-weight: 600;">
        +${m.delta_rate_hz || 0} Hz
      </td>
      <td>
        <div class="motor-bar-wrapper">
          <div class="motor-bar-fill" style="width: ${barWidth}%;"></div>
        </div>
      </td>
    `;
    motorTableBody.appendChild(tr);
  });

  recruitedSummary.innerHTML = `Recruited Motor Units: <strong>${activeCount} / ${motorOutputs.length}</strong>`;
}

// Dose-Response Sweep
async function runSweep() {
  sweepSection.style.display = 'block';
  btnSweep.disabled = true;
  btnSweep.textContent = 'Sweeping...';

  try {
    const url = `${apiBase}/sweep?circuit_id=${currentCircuitId}&weight_scale=${weightSlider.value}&synapse_cutoff=${cutoffSlider.value}&seed=${seedInput.value}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    drawSweepCurve(data.curve);
  } catch (err) {
    console.error('Sweep error:', err);
    alert(`Sweep failed: ${err.message}`);
  } finally {
    btnSweep.disabled = false;
    btnSweep.textContent = 'Dose-Response Sweep';
  }
}

// Draw Sweep Curve
function drawSweepCurve(curve) {
  const W = sweepCanvas.width;
  const H = sweepCanvas.height;
  sweepCtx.clearRect(0, 0, W, H);

  sweepCtx.fillStyle = '#0c0c0b';
  sweepCtx.fillRect(0, 0, W, H);

  const padL = 50, padR = 20, padT = 20, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxStim = 250;
  const maxMotorRate = Math.max(2.0, ...curve.map(c => c.motor_rate_hz)) * 1.2;

  // Grid
  sweepCtx.strokeStyle = 'rgba(45, 44, 41, 0.5)';
  sweepCtx.lineWidth = 1;
  sweepCtx.fillStyle = '#827e77';
  sweepCtx.font = '10px JetBrains Mono';

  for (let s = 0; s <= maxStim; s += 50) {
    const x = padL + (s / maxStim) * plotW;
    sweepCtx.beginPath();
    sweepCtx.moveTo(x, padT);
    sweepCtx.lineTo(x, H - padB);
    sweepCtx.stroke();
    sweepCtx.fillText(`${s}Hz`, x - 10, H - 10);
  }

  // Curve Line
  sweepCtx.strokeStyle = '#e06d53';
  sweepCtx.lineWidth = 2.5;
  sweepCtx.beginPath();

  curve.forEach((pt, i) => {
    const x = padL + (pt.stim_rate_hz / maxStim) * plotW;
    const y = padT + (1.0 - (pt.motor_rate_hz / maxMotorRate)) * plotH;
    if (i === 0) sweepCtx.moveTo(x, y);
    else sweepCtx.lineTo(x, y);
  });
  sweepCtx.stroke();

  // Curve Points
  curve.forEach(pt => {
    const x = padL + (pt.stim_rate_hz / maxStim) * plotW;
    const y = padT + (1.0 - (pt.motor_rate_hz / maxMotorRate)) * plotH;
    sweepCtx.fillStyle = '#e09f3e';
    sweepCtx.beginPath();
    sweepCtx.arc(x, y, 4, 0, Math.PI * 2);
    sweepCtx.fill();
    sweepCtx.stroke();
  });
}

// Initial Boot
(async function init() {
  await loadCircuit('giant_fiber');
  await runSimulation();
})();
