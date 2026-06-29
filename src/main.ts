import {
  Archive,
  Check,
  Eraser,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Volume2,
  X,
  createIcons,
} from "lucide";
import {
  buildCustomGroove,
  builderNoteOptions,
  builderPackId,
  builderStepCount,
  createInitialBuilderState,
  resizeBuilderCells,
  type BuilderCellValue,
  type BuilderLane,
  type BuilderState,
} from "./customGroove";
import { DrumPreviewEngine, previewEngineOptions } from "./drumEngine";
import {
  downloadGrooveMidi,
  exportGrooveMixWav,
  exportGrooveStemZip,
  exportSelectedAudioZip,
} from "./exporter";
import "./styles.css";
import type { AudioExportKind, Catalog, DrumGroup, Groove, PackSummary, PreviewEngineMode } from "./types";

type State = {
  packId: string;
  tempoId: string;
  categoryId: string;
  query: string;
  selectedIds: Set<string>;
  playingId: string | null;
  loop: boolean;
  previewMode: PreviewEngineMode;
  previewTempo: number;
  tempoDirty: boolean;
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing app root");
}
const app = appRoot;

const engine = new DrumPreviewEngine();
const drumGroups: DrumGroup[] = ["kick", "snare", "hat", "tom", "ride", "crash"];
const icons = { Archive, Check, Eraser, Play, Plus, RotateCcw, Search, Square, Trash2, Volume2, X };
const maxRenderedRows = 700;
const builderPackName = "Part Builder";

let catalog: Catalog;
let state: State;
let builderState: BuilderState = createInitialBuilderState();
let filteredGrooves: Groove[] = [];
let displayedGrooves: Groove[] = [];

engine.onStop = () => {
  state.playingId = null;
  renderPlaybackSurface();
  setStatus("Ready");
};
engine.onStatus = (message) => {
  setStatus(message);
};

init().catch((error) => {
  app.innerHTML = `<main class="fatal">${escapeHtml(error instanceof Error ? error.message : String(error))}</main>`;
});

async function init() {
  catalog = await fetchCatalog();
  const initialPack = packFromHash(catalog.packs) ?? catalog.packs[0]?.id;

  if (!initialPack) {
    throw new Error("No grooves were found.");
  }

  state = {
    packId: initialPack,
    tempoId: "all",
    categoryId: "all",
    query: "",
    selectedIds: new Set(),
    playingId: null,
    loop: true,
    previewMode: "home-kit",
    previewTempo: initialTempoForPack(initialPack),
    tempoDirty: false,
  };

  renderShell();
  bindEvents();
  renderAll();
}

async function fetchCatalog() {
  const response = await fetch("catalog.json");
  if (!response.ok) {
    throw new Error("Catalog is missing. Run npm run generate:catalog.");
  }
  return response.json() as Promise<Catalog>;
}

function renderShell() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">GD</span>
          <div>
            <strong>GroovyDrummer</strong>
            <span>${catalog.totalGrooves} grooves</span>
          </div>
        </div>
        <nav class="pack-nav" id="packNav" aria-label="Packs"></nav>
        <div class="sidebar-controls">
          <label class="field">
            <span>Preview kit</span>
            <select id="kitSelect">
              ${previewEngineOptions.map((mode) => `<option value="${mode.id}">${escapeHtml(mode.name)}</option>`).join("")}
            </select>
          </label>
          <label class="toggle">
            <input id="loopToggle" type="checkbox" checked />
            <span>Loop</span>
          </label>
        </div>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="pack-heading">
            <span class="eyebrow" id="packMeta"></span>
            <h1 id="packTitle"></h1>
          </div>
          <div class="toolbar">
            <label class="search-field">
              <i data-lucide="search"></i>
              <input id="searchInput" type="search" placeholder="Search grooves" autocomplete="off" />
            </label>
            <label class="volume">
              <i data-lucide="volume-2"></i>
              <input id="volumeInput" type="range" min="-24" max="0" step="1" value="${kitVolume(state.previewMode)}" />
            </label>
            <div class="tempo-control" role="group" aria-label="Preview tempo">
              <span>Tempo <strong id="tempoMode">Auto</strong></span>
              <div class="tempo-inputs">
                <input id="tempoNumber" type="text" inputmode="decimal" autocomplete="off" value="${formatTempo(state.previewTempo)}" aria-label="Preview tempo BPM" />
                <span>BPM</span>
                <button class="icon-button mini" id="tempoResetButton" type="button" title="Reset tempo" aria-label="Reset tempo">
                  <i data-lucide="rotate-ccw"></i>
                </button>
              </div>
            </div>
            <button class="icon-button" id="stopButton" type="button" title="Stop playback" aria-label="Stop playback">
              <i data-lucide="square"></i>
            </button>
          </div>
        </header>

        <section class="segments" id="segmentsPanel">
          <div class="segment-row" id="tempoTabs" aria-label="Tempo"></div>
          <div class="segment-row category" id="categoryTabs" aria-label="Category"></div>
        </section>

        <section class="export-strip" id="exportStrip">
          <div class="selection-meter">
            <strong id="selectedCount">0 selected</strong>
            <span id="statusText">Ready</span>
          </div>
          <div class="export-actions">
            <button class="text-button" id="midiZipButton" type="button">
              <i data-lucide="archive"></i>
              <span>MIDI ZIP</span>
            </button>
            <button class="text-button" id="mixZipButton" type="button">
              <i data-lucide="archive"></i>
              <span>Mix WAV ZIP</span>
            </button>
            <button class="text-button" id="stemsZipButton" type="button">
              <i data-lucide="archive"></i>
              <span>Stems ZIP</span>
            </button>
            <button class="icon-button" id="clearSelectionButton" type="button" title="Clear selection" aria-label="Clear selection">
              <i data-lucide="x"></i>
            </button>
          </div>
        </section>

        <section class="groove-browser" id="grooveBrowser">
          <div class="table-head">
            <label class="check-cell">
              <input id="selectVisibleInput" type="checkbox" />
            </label>
            <span></span>
            <span>Name</span>
            <span>Pattern</span>
            <span class="right">Hits</span>
            <span>Export</span>
          </div>
          <div class="rows" id="rows"></div>
        </section>

        <section class="part-builder" id="builderPanel" hidden></section>
      </main>
    </div>
  `;
}

function bindEvents() {
  byId("packNav").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-pack-id]");
    if (!button) {
      return;
    }
    state.packId = button.dataset.packId ?? state.packId;
    state.tempoId = "all";
    state.categoryId = "all";
    window.location.hash = state.packId;
    renderAll();
  });

  byId("tempoTabs").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tempo-id]");
    if (!button) {
      return;
    }
    state.tempoId = button.dataset.tempoId ?? "all";
    renderAll();
  });

  byId("categoryTabs").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-category-id]");
    if (!button) {
      return;
    }
    state.categoryId = button.dataset.categoryId ?? "all";
    renderAll();
  });

  byId<HTMLInputElement>("searchInput").addEventListener("input", (event) => {
    state.query = (event.currentTarget as HTMLInputElement).value;
    renderAll();
  });

  byId<HTMLInputElement>("loopToggle").addEventListener("change", (event) => {
    state.loop = (event.currentTarget as HTMLInputElement).checked;
  });

  byId<HTMLSelectElement>("kitSelect").addEventListener("change", (event) => {
    state.previewMode = (event.currentTarget as HTMLSelectElement).value as PreviewEngineMode;
    engine.setMode(state.previewMode);
    const volume = kitVolume(state.previewMode);
    engine.setVolume(volume);
    byId<HTMLInputElement>("volumeInput").value = String(volume);
    restartPlayingGroove();
  });

  byId<HTMLInputElement>("tempoNumber").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    commitTempoInput();
  });

  byId<HTMLInputElement>("tempoNumber").addEventListener("blur", () => {
    commitTempoInput();
  });

  byId("tempoResetButton").addEventListener("click", () => {
    state.tempoDirty = false;
    const groove = currentPlayingGroove();
    state.previewTempo = groove ? effectivePreviewTempo(groove) : initialTempoForPack(state.packId);
    syncTempoControls();
    restartPlayingGroove();
  });

  byId<HTMLInputElement>("volumeInput").addEventListener("input", (event) => {
    engine.setVolume(Number((event.currentTarget as HTMLInputElement).value));
  });

  byId("stopButton").addEventListener("click", () => {
    state.playingId = null;
    engine.stop();
    renderPlaybackSurface();
  });

  byId("rows").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const checkbox = target.closest<HTMLInputElement>("input[data-select-id]");
    const button = target.closest<HTMLButtonElement>("button[data-action]");

    if (checkbox) {
      toggleSelection(checkbox.dataset.selectId ?? "", checkbox.checked);
      return;
    }

    if (!button) {
      return;
    }

    const groove = grooveById(button.dataset.id);
    if (!groove) {
      return;
    }

    if (button.dataset.action === "play") {
      void togglePlayback(groove);
    }

  });

  byId("rows").addEventListener("change", (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>("select[data-export-id]");
    if (!select) {
      return;
    }

    const groove = grooveById(select.dataset.exportId);
    const kind = select.value as AudioExportKind | "";
    select.value = "";

    if (!groove || !kind) {
      return;
    }

    void runExportAction([groove], () => runSingleGrooveExport(groove, kind), singleExportMessage(groove, kind));
  });

  byId<HTMLInputElement>("selectVisibleInput").addEventListener("change", (event) => {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    for (const groove of displayedGrooves) {
      if (checked) {
        state.selectedIds.add(groove.id);
      } else {
        state.selectedIds.delete(groove.id);
      }
    }
    renderRows();
    renderSelection();
  });

  byId("clearSelectionButton").addEventListener("click", () => {
    state.selectedIds.clear();
    renderRows();
    renderSelection();
  });

  byId("midiZipButton").addEventListener("click", () => {
    const grooves = selectedGrooves();
    void runExportAction(grooves, () => exportSelectedAudioZip(grooves, "midi", effectivePreviewTempo), "ZIP ready");
  });

  byId("mixZipButton").addEventListener("click", () => {
    const grooves = selectedGrooves();
    void runExportAction(
      grooves,
      () => exportSelectedAudioZip(grooves, "mix-wav", effectivePreviewTempo, renderProgress),
      "ZIP ready",
    );
  });

  byId("stemsZipButton").addEventListener("click", () => {
    const grooves = selectedGrooves();
    void runExportAction(
      grooves,
      () => exportSelectedAudioZip(grooves, "stems-zip", effectivePreviewTempo, renderProgress),
      "ZIP ready",
    );
  });

  byId("builderPanel").addEventListener("click", (event) => {
    handleBuilderClick(event);
  });

  byId("builderPanel").addEventListener("input", (event) => {
    handleBuilderInput(event);
  });

  byId("builderPanel").addEventListener("change", (event) => {
    handleBuilderChange(event);
  });

  byId("builderPanel").addEventListener("focusout", (event) => {
    handleBuilderFocusOut(event);
  });

  byId("builderPanel").addEventListener("keydown", (event) => {
    handleBuilderKeydown(event);
  });
}

function renderAll() {
  const pack = currentPack();
  renderPackNav();

  if (isBuilderPack()) {
    renderBuilderPage();
    return;
  }

  normalizeFilters(pack);
  filteredGrooves = getFilteredGrooves();

  byId("segmentsPanel").hidden = false;
  byId("exportStrip").hidden = false;
  byId("grooveBrowser").hidden = false;
  byId("builderPanel").hidden = true;
  const searchInput = byId<HTMLInputElement>("searchInput");
  searchInput.disabled = false;
  searchInput.placeholder = "Search grooves";
  searchInput.value = state.query;

  byId("packTitle").textContent = pack.name;
  byId("packMeta").textContent = `${pack.count} grooves`;

  renderTempoTabs(pack);
  renderCategoryTabs(pack);
  renderRows();
  renderSelection();
  syncTempoControls();
  hydrateIcons();
}

function renderPackNav() {
  byId("packNav").innerHTML = allPacks()
    .map((pack) => `
      <button class="pack-link ${pack.id === state.packId ? "active" : ""}" type="button" data-pack-id="${pack.id}">
        <span>${escapeHtml(shortPackName(pack.name))}</span>
        <small>${pack.count}</small>
      </button>
    `)
    .join("");
}

function renderBuilderPage() {
  const groove = currentBuilderGroove();
  filteredGrooves = [];
  displayedGrooves = [];

  if (!state.tempoDirty) {
    state.previewTempo = builderState.tempo;
  }

  byId("segmentsPanel").hidden = true;
  byId("exportStrip").hidden = true;
  byId("grooveBrowser").hidden = true;
  byId("builderPanel").hidden = false;

  const searchInput = byId<HTMLInputElement>("searchInput");
  searchInput.disabled = true;
  searchInput.value = "";
  searchInput.placeholder = "Part Builder";

  byId("packTitle").textContent = builderPackName;
  byId("packMeta").textContent = `${formatTempo(builderState.tempo)} BPM · ${builderState.bars} ${builderState.bars === 1 ? "bar" : "bars"} · ${groove.noteCount} hits`;
  byId("builderPanel").innerHTML = builderHtml(groove);
  syncTempoControls();
  hydrateIcons();
}

function builderHtml(groove: Groove) {
  const stepCount = builderStepCount(builderState);
  const isPlaying = isBuilderPlaying();
  const hits = compactHits(groove) || "No hits";
  const status = document.getElementById("builderStatusText")?.textContent
    ?? document.getElementById("statusText")?.textContent
    ?? "Ready";

  return `
    <div class="builder-toolbar">
      <label class="builder-field builder-title-field">
        <span>Title</span>
        <input type="text" data-builder-field="title" value="${escapeHtml(builderState.title)}" autocomplete="off" />
      </label>
      <label class="builder-field">
        <span>Tempo</span>
        <input type="text" inputmode="decimal" data-builder-field="tempo" value="${formatTempo(builderState.tempo)}" autocomplete="off" />
      </label>
      <label class="builder-field">
        <span>Bars</span>
        <select data-builder-field="bars">
          ${[1, 2, 4, 8].map((bars) => `<option value="${bars}" ${builderState.bars === bars ? "selected" : ""}>${bars}</option>`).join("")}
        </select>
      </label>
      <div class="builder-actions">
        <button class="text-button" type="button" data-builder-action="play">
          <i data-lucide="${isPlaying ? "square" : "play"}"></i>
          <span>${isPlaying ? "Stop" : "Preview"}</span>
        </button>
        <button class="text-button" type="button" data-builder-action="midi">
          <i data-lucide="archive"></i>
          <span>MIDI</span>
        </button>
        <button class="text-button" type="button" data-builder-action="mix-wav">
          <i data-lucide="archive"></i>
          <span>Mix WAV</span>
        </button>
        <button class="text-button" type="button" data-builder-action="stems-zip">
          <i data-lucide="archive"></i>
          <span>Stems ZIP</span>
        </button>
        <button class="icon-button" type="button" data-builder-action="add-lane" title="Add lane" aria-label="Add lane">
          <i data-lucide="plus"></i>
        </button>
        <button class="icon-button" type="button" data-builder-action="clear" title="Clear grid" aria-label="Clear grid">
          <i data-lucide="eraser"></i>
        </button>
      </div>
    </div>
    <div class="builder-meter">
      <strong>${escapeHtml(hits)}</strong>
      <span>${stepCount} sixteenth-note steps</span>
      <span class="builder-status" id="builderStatusText">${escapeHtml(status)}</span>
      <div class="builder-legend" aria-label="Cell velocity legend">
        <span><b class="legend-dot value-1"></b>Ghost</span>
        <span><b class="legend-dot value-2"></b>Hit</span>
        <span><b class="legend-dot value-3"></b>Accent</span>
      </div>
    </div>
    <div class="builder-grid" style="--builder-steps:${stepCount}">
      <div class="builder-grid-head">
        <span>Lane</span>
        <span>Map</span>
        <span>Velocity</span>
        <span>Accent</span>
        <span></span>
        <span>Steps</span>
      </div>
      <div class="builder-lanes">
        ${builderState.lanes.map((lane) => builderLaneHtml(lane)).join("")}
      </div>
    </div>
  `;
}

function builderLaneHtml(lane: BuilderLane) {
  const velocity = Math.round(lane.velocity * 127);
  const accentVelocity = Math.round(lane.accentVelocity * 127);

  return `
    <div class="builder-lane" data-lane-id="${escapeHtml(lane.id)}">
      <div class="builder-lane-name">
        <strong>${escapeHtml(lane.label)}</strong>
        <span>Note ${lane.note}</span>
      </div>
      <label class="builder-field inline">
        <span>Map</span>
        <select data-builder-lane-field="note" data-lane-id="${escapeHtml(lane.id)}" aria-label="Map ${escapeHtml(lane.label)}">
          ${builderNoteOptions.map((option) => `
            <option value="${option.note}" ${lane.note === option.note ? "selected" : ""}>${escapeHtml(option.label)} · ${option.note}</option>
          `).join("")}
        </select>
      </label>
      <label class="builder-range">
        <span>Vel <output id="builder-velocity-${escapeHtml(lane.id)}">${velocity}</output></span>
        <input type="range" min="1" max="127" step="1" value="${velocity}" data-builder-lane-field="velocity" data-lane-id="${escapeHtml(lane.id)}" />
      </label>
      <label class="builder-range">
        <span>Acc <output id="builder-accentVelocity-${escapeHtml(lane.id)}">${accentVelocity}</output></span>
        <input type="range" min="1" max="127" step="1" value="${accentVelocity}" data-builder-lane-field="accentVelocity" data-lane-id="${escapeHtml(lane.id)}" />
      </label>
      <button class="icon-button mini builder-delete" type="button" data-builder-action="delete-lane" data-lane-id="${escapeHtml(lane.id)}" title="Delete lane" aria-label="Delete ${escapeHtml(lane.label)} lane" ${builderState.lanes.length <= 1 ? "disabled" : ""}>
        <i data-lucide="trash-2"></i>
      </button>
      <div class="builder-steps" aria-label="${escapeHtml(lane.label)} steps">
        ${lane.cells.map((value, step) => builderCellHtml(lane, value, step)).join("")}
      </div>
    </div>
  `;
}

function builderCellHtml(lane: BuilderLane, value: BuilderCellValue, step: number) {
  const classes = [
    "builder-step",
    `value-${value}`,
    step % 16 === 0 ? "bar-start" : "",
    step % 4 === 0 ? "beat-start" : "",
  ].filter(Boolean).join(" ");
  return `
    <button class="${classes}" type="button" data-builder-cell data-lane-id="${escapeHtml(lane.id)}" data-step="${step}" aria-label="${escapeHtml(lane.label)} step ${step + 1}: ${builderCellLabel(value)}"></button>
  `;
}

function builderCellLabel(value: BuilderCellValue) {
  if (value === 1) {
    return "ghost";
  }
  if (value === 2) {
    return "hit";
  }
  if (value === 3) {
    return "accent";
  }
  return "empty";
}

function handleBuilderClick(event: Event) {
  const target = event.target as HTMLElement;
  const cell = target.closest<HTMLButtonElement>("[data-builder-cell]");

  if (cell) {
    const lane = builderLaneById(cell.dataset.laneId);
    const step = Number(cell.dataset.step);
    if (!lane || !Number.isInteger(step) || step < 0 || step >= lane.cells.length) {
      return;
    }

    lane.cells[step] = ((lane.cells[step] + 1) % 4) as BuilderCellValue;
    markBuilderChanged();
    renderBuilderPage();
    return;
  }

  const button = target.closest<HTMLButtonElement>("button[data-builder-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.builderAction;
  if (action === "play") {
    const groove = currentBuilderGroove();
    if (isBuilderPlaying()) {
      state.playingId = null;
      engine.stop();
      renderBuilderPage();
    } else {
      void startPlayback(groove);
    }
    return;
  }

  if (action === "clear") {
    for (const lane of builderState.lanes) {
      lane.cells = lane.cells.map(() => 0 as BuilderCellValue);
    }
    markBuilderChanged();
    renderBuilderPage();
    return;
  }

  if (action === "add-lane") {
    addBuilderLane();
    return;
  }

  if (action === "delete-lane") {
    deleteBuilderLane(button.dataset.laneId);
    return;
  }

  if (action === "midi" || action === "mix-wav" || action === "stems-zip") {
    const groove = currentBuilderGroove();
    const kind = action as AudioExportKind;
    void runExportAction([groove], () => runSingleGrooveExport(groove, kind), singleExportMessage(groove, kind));
  }
}

function handleBuilderInput(event: Event) {
  const target = event.target as HTMLElement;
  const input = target.closest<HTMLInputElement>("input[data-builder-field], input[data-builder-lane-field]");
  if (!input) {
    return;
  }

  const field = input.dataset.builderField;
  if (field === "title") {
    builderState.title = input.value;
    builderState.revision += 1;
    return;
  }

  if (field === "tempo") {
    const tempo = parseTempoInput(input.value);
    if (tempo === null) {
      return;
    }
    builderState.tempo = tempo;
    builderState.revision += 1;
    if (!state.tempoDirty) {
      state.previewTempo = tempo;
      syncTempoControls();
    }
    stopBuilderPlaybackIfNeeded();
    return;
  }

  const laneField = input.dataset.builderLaneField;
  if (laneField !== "velocity" && laneField !== "accentVelocity") {
    return;
  }

  const lane = builderLaneById(input.dataset.laneId);
  const value = Number(input.value);
  if (!lane || !Number.isFinite(value)) {
    return;
  }

  lane[laneField] = Math.max(1, Math.min(127, value)) / 127;
  builderState.revision += 1;
  stopBuilderPlaybackIfNeeded();
  const output = document.getElementById(`builder-${laneField}-${lane.id}`);
  if (output) {
    output.textContent = String(Math.round(lane[laneField] * 127));
  }
}

function handleBuilderChange(event: Event) {
  const target = event.target as HTMLElement;
  const control = target.closest<HTMLInputElement | HTMLSelectElement>("[data-builder-field], [data-builder-lane-field]");
  if (!control) {
    return;
  }

  const field = control.dataset.builderField;
  if (field === "tempo") {
    const tempo = parseTempoInput((control as HTMLInputElement).value);
    if (tempo === null) {
      (control as HTMLInputElement).value = formatTempo(builderState.tempo);
      setStatus("Tempo must be above 0 BPM");
      return;
    }

    builderState.tempo = tempo;
    builderState.revision += 1;
    if (!state.tempoDirty) {
      state.previewTempo = tempo;
    }
    stopBuilderPlaybackIfNeeded();
    renderBuilderPage();
    return;
  }

  if (field === "bars") {
    const bars = Number((control as HTMLSelectElement).value);
    if (![1, 2, 4, 8].includes(bars)) {
      return;
    }
    resizeBuilderCells(builderState, bars);
    stopBuilderPlaybackIfNeeded();
    renderBuilderPage();
    return;
  }

  const laneField = control.dataset.builderLaneField;
  if (laneField === "note") {
    const lane = builderLaneById(control.dataset.laneId);
    const note = Number((control as HTMLSelectElement).value);
    const option = builderNoteOptions.find((item) => item.note === note);
    if (!lane || !option) {
      return;
    }

    lane.note = option.note;
    lane.label = option.label;
    markBuilderChanged();
    renderBuilderPage();
  }
}

function handleBuilderFocusOut(event: FocusEvent) {
  const target = event.target as HTMLElement;
  const input = target.closest<HTMLInputElement>("input[data-builder-field='tempo']");
  if (!input) {
    return;
  }
  commitBuilderTempoInput(input);
}

function handleBuilderKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter") {
    return;
  }

  const target = event.target as HTMLElement;
  const input = target.closest<HTMLInputElement>("input[data-builder-field='tempo']");
  if (!input) {
    return;
  }

  event.preventDefault();
  commitBuilderTempoInput(input);
}

function commitBuilderTempoInput(input: HTMLInputElement) {
  const tempo = parseTempoInput(input.value);
  if (tempo === null) {
    input.value = formatTempo(builderState.tempo);
    setStatus("Tempo must be above 0 BPM");
    return;
  }

  builderState.tempo = tempo;
  builderState.revision += 1;
  if (!state.tempoDirty) {
    state.previewTempo = tempo;
  }
  stopBuilderPlaybackIfNeeded();
  renderBuilderPage();
}

function addBuilderLane() {
  const stepCount = builderStepCount(builderState);
  const usedNotes = new Set(builderState.lanes.map((lane) => lane.note));
  const option = builderNoteOptions.find((item) => !usedNotes.has(item.note)) ?? builderNoteOptions[0];
  const id = `lane-${Date.now().toString(36)}-${builderState.lanes.length}`;
  builderState.lanes.push({
    id,
    label: option.label,
    note: option.note,
    velocity: 0.78,
    accentVelocity: 0.94,
    cells: Array<BuilderCellValue>(stepCount).fill(0),
  });
  markBuilderChanged();
  renderBuilderPage();
}

function deleteBuilderLane(laneId: string | undefined) {
  if (!laneId || builderState.lanes.length <= 1) {
    return;
  }

  builderState.lanes = builderState.lanes.filter((lane) => lane.id !== laneId);
  markBuilderChanged();
  renderBuilderPage();
}

function builderLaneById(laneId: string | undefined) {
  if (!laneId) {
    return null;
  }
  return builderState.lanes.find((lane) => lane.id === laneId) ?? null;
}

function markBuilderChanged() {
  builderState.revision += 1;
  stopBuilderPlaybackIfNeeded();
}

function stopBuilderPlaybackIfNeeded() {
  if (!isBuilderPlaying()) {
    return;
  }

  state.playingId = null;
  engine.stop(false);
  setStatus("Ready");
  updateBuilderPreviewButton();
}

function updateBuilderPreviewButton() {
  const button = document.querySelector<HTMLButtonElement>("[data-builder-action='play']");
  if (!button) {
    return;
  }

  const isPlaying = isBuilderPlaying();
  button.innerHTML = `
    <i data-lucide="${isPlaying ? "square" : "play"}"></i>
    <span>${isPlaying ? "Stop" : "Preview"}</span>
  `;
  hydrateIcons();
}

function renderTempoTabs(pack: PackSummary) {
  const baseGrooves = groovesForPack(pack.id).filter((groove) => (
    state.categoryId === "all" || groove.categoryId === state.categoryId
  ));
  const allCount = baseGrooves.length;
  byId("tempoTabs").innerHTML = [
    segmentButton("all", "All tempos", allCount, state.tempoId, "tempo"),
    ...pack.tempos.map((tempo) => segmentButton(
      tempo.id,
      tempo.label,
      baseGrooves.filter((groove) => groove.tempoId === tempo.id).length,
      state.tempoId,
      "tempo",
    )),
  ].join("");
}

function renderCategoryTabs(pack: PackSummary) {
  const packGrooves = groovesForPack(pack.id).filter((groove) => (
    state.tempoId === "all" || groove.tempoId === state.tempoId
  ));
  byId("categoryTabs").innerHTML = [
    segmentButton("all", "All parts", packGrooves.length, state.categoryId, "category"),
    ...pack.categories.map((category) => segmentButton(
      category.id,
      category.name,
      packGrooves.filter((groove) => groove.categoryId === category.id).length,
      state.categoryId,
      "category",
    )),
  ].join("");
}

function segmentButton(id: string, label: string, count: number, activeId: string, group: "tempo" | "category") {
  const attr = group === "tempo" ? "data-tempo-id" : "data-category-id";
  return `
    <button class="segment ${id === activeId ? "active" : ""}" type="button" ${attr}="${id}">
      <span>${escapeHtml(label)}</span>
      <small>${count}</small>
    </button>
  `;
}

function renderRows() {
  const rows = byId("rows");
  displayedGrooves = filteredGrooves.slice(0, maxRenderedRows);
  const isLimited = displayedGrooves.length < filteredGrooves.length;

  rows.innerHTML = displayedGrooves.length
    ? `${displayedGrooves.map(rowHtml).join("")}${
        isLimited
          ? `<div class="limit-state">Showing ${displayedGrooves.length} of ${filteredGrooves.length}. Narrow the pack to see more.</div>`
          : ""
      }`
    : `<div class="empty-state">No grooves</div>`;

  updateSelectVisibleInput();
  hydrateIcons();
}

function rowHtml(groove: Groove) {
  const isPlaying = groove.id === state.playingId;
  const isSelected = state.selectedIds.has(groove.id);
  const hits = compactHits(groove);
  const meta = [
    groove.meter,
    groove.bpm ? `${groove.bpm} BPM` : null,
    `${formatDuration(groove.duration)}`,
  ].filter(Boolean).join(" · ");

  return `
    <article class="groove-row ${isPlaying ? "playing" : ""}">
      <label class="check-cell">
        <input type="checkbox" data-select-id="${groove.id}" ${isSelected ? "checked" : ""} />
      </label>
      <button class="icon-button play-button" type="button" data-action="play" data-id="${groove.id}" title="${isPlaying ? "Stop" : "Preview"}" aria-label="${isPlaying ? "Stop" : "Preview"} ${escapeHtml(groove.grooveName)}">
        <i data-lucide="${isPlaying ? "square" : "play"}"></i>
      </button>
      <div class="groove-title">
        <strong>${escapeHtml(groove.grooveName)}</strong>
        <span>${escapeHtml(groove.categoryName)} · ${escapeHtml(groove.tempoLabel)} · ${escapeHtml(meta)}</span>
      </div>
      ${patternHtml(groove)}
      <div class="hit-summary">${escapeHtml(hits)}</div>
      <select class="row-export-menu" data-export-id="${groove.id}" aria-label="Export ${escapeHtml(groove.grooveName)}">
        <option value="">Export</option>
        <option value="midi">MIDI</option>
        <option value="mix-wav">Mix WAV</option>
        <option value="stems-zip">Stems ZIP</option>
      </select>
    </article>
  `;
}

function patternHtml(groove: Groove) {
  return `
    <div class="pattern" aria-label="Pattern preview">
      ${drumGroups.map((group) => `
        <div class="pattern-lane ${group}">
          ${groove.pattern[group].map((value) => `<span class="${value ? "hit" : ""}" style="opacity:${value ? 0.3 + value * 0.7 : 0.18}"></span>`).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

async function togglePlayback(groove: Groove) {
  if (state.playingId === groove.id) {
    state.playingId = null;
    engine.stop();
    renderPlaybackSurface();
    return;
  }

  await startPlayback(groove);
}

async function startPlayback(groove: Groove) {
  const previewTempo = effectivePreviewTempo(groove);
  if (!state.tempoDirty) {
    state.previewTempo = previewTempo;
    syncTempoControls();
  }

  state.playingId = groove.id;
  renderPlaybackSurface();
  setStatus(`Loading ${groove.grooveName}`);

  try {
    await engine.play(groove, state.loop, previewTempo);
    if (state.playingId === groove.id) {
      setStatus(`Playing ${groove.grooveName} at ${formatTempo(previewTempo)} BPM`);
    }
  } catch (error) {
    state.playingId = null;
    renderPlaybackSurface();
    setStatus(error instanceof Error ? error.message : "Playback failed");
  }
}

function restartPlayingGroove() {
  const groove = currentPlayingGroove();
  if (!groove) {
    return;
  }

  void startPlayback(groove);
}

async function runExportAction(grooves: Groove[], action: () => Promise<void>, doneMessage: string) {
  if (!grooves.length) {
    setStatus("Nothing selected");
    return;
  }

  setExportButtons(false);
  setStatus(`${grooves.length} pending`);

  try {
    await action();
    setStatus(doneMessage);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Export failed");
  } finally {
    setExportButtons(true);
  }
}

async function runSingleGrooveExport(groove: Groove, kind: AudioExportKind) {
  if (kind === "midi") {
    await downloadGrooveMidi(groove);
    return;
  }

  const tempo = effectivePreviewTempo(groove);
  setStatus(`Rendering ${groove.grooveName}`);

  if (kind === "mix-wav") {
    await exportGrooveMixWav(groove, tempo);
  } else {
    await exportGrooveStemZip(groove, tempo);
  }
}

function singleExportMessage(groove: Groove, kind: AudioExportKind) {
  if (kind === "midi") {
    return `Downloaded ${groove.grooveName}`;
  }
  return kind === "mix-wav" ? "Mix WAV ready" : "Stems ZIP ready";
}

function renderProgress(current: number, total: number, groove: Groove) {
  setStatus(`Rendering ${current}/${total}: ${groove.grooveName}`);
}

function toggleSelection(id: string, selected: boolean) {
  if (!id) {
    return;
  }

  if (selected) {
    state.selectedIds.add(id);
  } else {
    state.selectedIds.delete(id);
  }

  renderSelection();
  updateSelectVisibleInput();
}

function renderSelection() {
  const count = state.selectedIds.size;
  byId("selectedCount").textContent = `${count} selected`;
  byId<HTMLButtonElement>("midiZipButton").disabled = count === 0;
  byId<HTMLButtonElement>("mixZipButton").disabled = count === 0;
  byId<HTMLButtonElement>("stemsZipButton").disabled = count === 0;
  byId<HTMLButtonElement>("clearSelectionButton").disabled = count === 0;
}

function setExportButtons(enabled: boolean) {
  byId<HTMLButtonElement>("midiZipButton").disabled = !enabled || state.selectedIds.size === 0;
  byId<HTMLButtonElement>("mixZipButton").disabled = !enabled || state.selectedIds.size === 0;
  byId<HTMLButtonElement>("stemsZipButton").disabled = !enabled || state.selectedIds.size === 0;
}

function updateSelectVisibleInput() {
  const input = byId<HTMLInputElement>("selectVisibleInput");
  const visibleCount = displayedGrooves.length;
  const selectedVisible = displayedGrooves.filter((groove) => state.selectedIds.has(groove.id)).length;
  input.checked = visibleCount > 0 && selectedVisible === visibleCount;
  input.indeterminate = selectedVisible > 0 && selectedVisible < visibleCount;
}

function selectedGrooves() {
  const selected = catalog.grooves.filter((groove) => state.selectedIds.has(groove.id));
  selected.sort((a, b) =>
    a.packName.localeCompare(b.packName) ||
    (b.tempoSort - a.tempoSort) ||
    a.categorySort - b.categorySort ||
    a.grooveNumber - b.grooveNumber ||
    a.grooveName.localeCompare(b.grooveName),
  );
  return selected;
}

function currentPlayingGroove() {
  if (!state.playingId) {
    return null;
  }
  return grooveById(state.playingId);
}

function grooveById(id: string | undefined) {
  if (!id) {
    return null;
  }
  if (id.startsWith(`${builderPackId}/`)) {
    return currentBuilderGroove();
  }
  return catalog.grooves.find((groove) => groove.id === id) ?? null;
}

function currentBuilderGroove() {
  return buildCustomGroove(builderState);
}

function isBuilderPack() {
  return state.packId === builderPackId;
}

function isBuilderPlaying() {
  return state.playingId?.startsWith(`${builderPackId}/`) ?? false;
}

function renderPlaybackSurface() {
  if (isBuilderPack()) {
    renderBuilderPage();
    return;
  }
  renderRows();
}

function effectivePreviewTempo(groove: Groove) {
  return state.tempoDirty ? state.previewTempo : groove.bpm ?? state.previewTempo;
}

function syncTempoControls() {
  const number = document.getElementById("tempoNumber") as HTMLInputElement | null;
  const mode = document.getElementById("tempoMode");

  if (number) {
    number.value = formatTempo(state.previewTempo);
  }
  if (mode) {
    mode.textContent = state.tempoDirty ? "Custom" : "Auto";
  }
}

function commitTempoInput() {
  const input = byId<HTMLInputElement>("tempoNumber");
  const rawValue = input.value.trim();

  if (rawValue === formatTempo(state.previewTempo)) {
    syncTempoControls();
    return;
  }

  const tempo = parseTempoInput(input.value);

  if (tempo === null) {
    input.value = formatTempo(state.previewTempo);
    setStatus("Tempo must be above 0 BPM");
    return;
  }

  state.previewTempo = tempo;
  state.tempoDirty = true;
  syncTempoControls();
  restartPlayingGroove();
}

function parseTempoInput(value: string) {
  const tempo = Number(value.trim());
  if (!Number.isFinite(tempo) || tempo <= 0) {
    return null;
  }
  return tempo;
}

function formatTempo(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function getFilteredGrooves() {
  const query = state.query.trim().toLowerCase();

  return groovesForPack(state.packId).filter((groove) => {
    if (state.tempoId !== "all" && groove.tempoId !== state.tempoId) {
      return false;
    }

    if (state.categoryId !== "all" && groove.categoryId !== state.categoryId) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      groove.grooveName,
      groove.packName,
      groove.tempoLabel,
      groove.categoryName,
      groove.sourcePath,
      groove.meter ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function groovesForPack(packId: string) {
  if (packId === builderPackId) {
    return [currentBuilderGroove()];
  }
  return catalog.grooves.filter((groove) => groove.packId === packId);
}

function currentPack() {
  if (isBuilderPack()) {
    return builderPackSummary();
  }
  const pack = catalog.packs.find((item) => item.id === state.packId);
  if (!pack) {
    return catalog.packs[0];
  }
  return pack;
}

function allPacks() {
  return [builderPackSummary(), ...catalog.packs];
}

function builderPackSummary(): PackSummary {
  const tempo = builderState.tempo;
  return {
    id: builderPackId,
    name: builderPackName,
    count: 1,
    tempos: [{
      id: `${formatTempo(tempo)}-bpm`,
      label: `${formatTempo(tempo)} BPM`,
      range: [tempo, tempo],
      bpm: tempo,
      count: 1,
    }],
    categories: [{
      id: "custom",
      name: "Custom Parts",
      sort: 1,
      count: 1,
    }],
  };
}

function normalizeFilters(pack: PackSummary) {
  if (!pack.tempos.some((tempo) => tempo.id === state.tempoId)) {
    state.tempoId = "all";
  }
  if (!pack.categories.some((category) => category.id === state.categoryId)) {
    state.categoryId = "all";
  }
}

function compactHits(groove: Groove) {
  return [
    ["K", groove.hitCounts.kick],
    ["S", groove.hitCounts.snare],
    ["H", groove.hitCounts.hat],
    ["T", groove.hitCounts.tom],
    ["R", groove.hitCounts.ride],
    ["C", groove.hitCounts.crash],
  ]
    .filter(([, count]) => Number(count) > 0)
    .map(([label, count]) => `${label}${count}`)
    .join(" ");
}

function shortPackName(name: string) {
  return name.replace(" Vol. 1", "");
}

function formatDuration(seconds: number) {
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  return `${Math.round(seconds)}s`;
}

function packFromHash(packs: PackSummary[]) {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === builderPackId) {
    return builderPackId;
  }
  return packs.some((pack) => pack.id === hash) ? hash : null;
}

function kitVolume(previewMode: State["previewMode"]) {
  if (previewMode === "synthetic") {
    return -9;
  }
  return -6;
}

function initialTempoForPack(packId: string) {
  if (packId === builderPackId) {
    return builderState.tempo;
  }
  const pack = catalog.packs.find((item) => item.id === packId);
  return pack?.tempos[0]?.bpm ?? 120;
}

function setStatus(message: string) {
  const statusText = document.getElementById("statusText");
  const builderStatusText = document.getElementById("builderStatusText");
  if (statusText) {
    statusText.textContent = message;
  }
  if (builderStatusText) {
    builderStatusText.textContent = message;
  }
}

function hydrateIcons() {
  createIcons({ icons });
}

function byId<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
