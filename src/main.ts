import {
  Archive,
  Check,
  Download,
  FolderDown,
  Play,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Volume2,
  X,
  createIcons,
} from "lucide";
import { DrumPreviewEngine, kitOptions, type KitId } from "./drumEngine";
import {
  canSaveToDirectory,
  downloadGroove,
  exportGroovesAsZip,
  saveGroovesToDirectory,
} from "./exporter";
import "./styles.css";
import type { Catalog, DrumGroup, Groove, PackSummary } from "./types";

type State = {
  packId: string;
  tempoId: string;
  categoryId: string;
  query: string;
  selectedIds: Set<string>;
  playingId: string | null;
  loop: boolean;
  kitId: KitId;
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
const icons = { Archive, Check, Download, FolderDown, Play, RotateCcw, Search, Square, Trash2, Volume2, X };
const maxRenderedRows = 700;

let catalog: Catalog;
let state: State;
let filteredGrooves: Groove[] = [];
let displayedGrooves: Groove[] = [];

engine.onStop = () => {
  state.playingId = null;
  renderRows();
  setStatus("Ready");
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
    kitId: "studio",
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
              ${kitOptions.map((kit) => `<option value="${kit.id}">${escapeHtml(kit.name)}</option>`).join("")}
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
              <input id="volumeInput" type="range" min="-24" max="0" step="1" value="-7" />
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

        <section class="segments">
          <div class="segment-row" id="tempoTabs" aria-label="Tempo"></div>
          <div class="segment-row category" id="categoryTabs" aria-label="Category"></div>
        </section>

        <section class="export-strip">
          <div class="selection-meter">
            <strong id="selectedCount">0 selected</strong>
            <span id="statusText">Ready</span>
          </div>
          <div class="export-actions">
            <button class="text-button" id="saveFolderButton" type="button">
              <i data-lucide="folder-down"></i>
              <span>${canSaveToDirectory() ? "Save to folder" : "ZIP output"}</span>
            </button>
            <button class="text-button" id="zipButton" type="button">
              <i data-lucide="archive"></i>
              <span>ZIP</span>
            </button>
            <button class="icon-button" id="clearSelectionButton" type="button" title="Clear selection" aria-label="Clear selection">
              <i data-lucide="x"></i>
            </button>
          </div>
        </section>

        <section class="groove-browser">
          <div class="table-head">
            <label class="check-cell">
              <input id="selectVisibleInput" type="checkbox" />
            </label>
            <span></span>
            <span>Name</span>
            <span>Pattern</span>
            <span class="right">Hits</span>
            <span></span>
          </div>
          <div class="rows" id="rows"></div>
        </section>
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
    state.kitId = (event.currentTarget as HTMLSelectElement).value as KitId;
    engine.setKit(state.kitId);
    byId<HTMLInputElement>("volumeInput").value = String(kitVolume(state.kitId));
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
    renderRows();
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

    const groove = catalog.grooves.find((item) => item.id === button.dataset.id);
    if (!groove) {
      return;
    }

    if (button.dataset.action === "play") {
      void togglePlayback(groove);
    }

    if (button.dataset.action === "download") {
      void runExportAction([groove], () => downloadGroove(groove), `Downloaded ${groove.grooveName}`);
    }
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

  byId("zipButton").addEventListener("click", () => {
    void runExportAction(selectedGrooves(), () => exportGroovesAsZip(selectedGrooves()), "ZIP ready");
  });

  byId("saveFolderButton").addEventListener("click", () => {
    void runExportAction(selectedGrooves(), () => saveGroovesToDirectory(selectedGrooves()), "Saved to output");
  });
}

function renderAll() {
  const pack = currentPack();
  normalizeFilters(pack);
  filteredGrooves = getFilteredGrooves();

  byId("packTitle").textContent = pack.name;
  byId("packMeta").textContent = `${pack.count} grooves`;

  renderPackNav();
  renderTempoTabs(pack);
  renderCategoryTabs(pack);
  renderRows();
  renderSelection();
  syncTempoControls();
  hydrateIcons();
}

function renderPackNav() {
  byId("packNav").innerHTML = catalog.packs
    .map((pack) => `
      <button class="pack-link ${pack.id === state.packId ? "active" : ""}" type="button" data-pack-id="${pack.id}">
        <span>${escapeHtml(shortPackName(pack.name))}</span>
        <small>${pack.count}</small>
      </button>
    `)
    .join("");
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
      <button class="icon-button" type="button" data-action="download" data-id="${groove.id}" title="Download MIDI" aria-label="Download ${escapeHtml(groove.grooveName)}">
        <i data-lucide="download"></i>
      </button>
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
    renderRows();
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
  renderRows();
  setStatus(`Playing ${groove.grooveName} at ${formatTempo(previewTempo)} BPM`);

  try {
    await engine.play(groove, state.loop, previewTempo);
  } catch (error) {
    state.playingId = null;
    renderRows();
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
  byId<HTMLButtonElement>("zipButton").disabled = count === 0;
  byId<HTMLButtonElement>("saveFolderButton").disabled = count === 0;
  byId<HTMLButtonElement>("clearSelectionButton").disabled = count === 0;
}

function setExportButtons(enabled: boolean) {
  byId<HTMLButtonElement>("zipButton").disabled = !enabled || state.selectedIds.size === 0;
  byId<HTMLButtonElement>("saveFolderButton").disabled = !enabled || state.selectedIds.size === 0;
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
  return catalog.grooves.find((groove) => groove.id === state.playingId) ?? null;
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
      groove.meter ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function groovesForPack(packId: string) {
  return catalog.grooves.filter((groove) => groove.packId === packId);
}

function currentPack() {
  const pack = catalog.packs.find((item) => item.id === state.packId);
  if (!pack) {
    return catalog.packs[0];
  }
  return pack;
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
  return packs.some((pack) => pack.id === hash) ? hash : null;
}

function kitVolume(kitId: State["kitId"]) {
  if (kitId === "tight") {
    return -6;
  }
  if (kitId === "room") {
    return -9;
  }
  return -7;
}

function initialTempoForPack(packId: string) {
  const pack = catalog.packs.find((item) => item.id === packId);
  return pack?.tempos[0]?.bpm ?? 120;
}

function setStatus(message: string) {
  byId("statusText").textContent = message;
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
