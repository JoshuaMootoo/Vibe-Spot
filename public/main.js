// ===== PERSISTENCE =====
const STORAGE_KEY = "vibe-spot:pins";

function loadPins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    console.warn("Pins were corrupted. Clearing.");
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}
function savePins(pins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    return true;
  } catch (e) {
    alert("Couldn’t save (likely image too large). Try a smaller image.");
    console.error(e);
    return false;
  }
}

// ===== MAP =====
let map, markersLayer;

init();

function init() {
  console.log("[Vibe-Spot] init…");
  // Ensure the element exists
  const mapEl = document.getElementById("map");
  if (!mapEl) {
    console.error("No #map element found.");
    return;
  }

  map = L.map("map").setView([51.5074, -0.1278], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Restore pins
  const pins = loadPins();
  renderAllPins(pins);

  // Click to add
  map.on("click", (e) => {
    const marker = L.marker(e.latlng).addTo(markersLayer);
    openFormPopup(marker, {
      id: crypto.randomUUID(),
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      description: "",
      when: nowLocalDatetimeString(),
      imageDataUrl: "",
      isNew: true,
    });
  });

  console.log("[Vibe-Spot] ready.");
}

// ===== POPUP FORM =====
function openFormPopup(marker, draft) {
  const html = `
    <div class="memory-form" style="min-width:250px;max-width:280px">
      <form id="memoryForm">
        <input type="hidden" name="id" value="${draft.id}">
        <input type="hidden" name="lat" value="${draft.lat}">
        <input type="hidden" name="lng" value="${draft.lng}">

        <label style="display:block;font-size:12px;margin:6px 0 4px;color:#9aa0a6">Description</label>
        <textarea name="description" rows="3" style="width:100%;padding:8px;border-radius:8px;border:1px solid #374151;background:#111827;color:#fff"
                  placeholder="What happened here?">${escapeHtml(draft.description || "")}</textarea>

        <label style="display:block;font-size:12px;margin:6px 0 4px;color:#9aa0a6">Date & Time</label>
        <input type="datetime-local" name="when" value="${escapeHtml(draft.when || "")}"
               style="width:100%;padding:8px;border-radius:8px;border:1px solid #374151;background:#111827;color:#fff">

        <label style="display:block;font-size:12px;margin:6px 0 4px;color:#9aa0a6">Image</label>
        <input type="file" name="image" accept="image/*" style="width:100%">
        <img id="preview" alt="" style="margin-top:8px;max-width:240px;max-height:160px;border-radius:10px;display:${draft.imageDataUrl ? "block" : "none"}"
             src="${draft.imageDataUrl || ""}">

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button type="button" class="btn-cancel" style="padding:8px 12px;border-radius:10px;background:#293241;color:#fff;border:0">Cancel</button>
          <button type="submit" class="btn-save" style="padding:8px 12px;border-radius:10px;background:#22c55e;color:#04110a;border:0">${draft.isNew ? "Save" : "Update"}</button>
        </div>
      </form>
    </div>
  `;

  marker.bindPopup(html, { closeButton: true }).openPopup();

  marker.once("popupopen", () => {
    const el = marker.getPopup().getElement();
    const form = el.querySelector("#memoryForm");
    const fileInput = form.querySelector('input[name="image"]');
    const preview = el.querySelector("#preview");
    const cancelBtn = form.querySelector(".btn-cancel");

    // live preview + size reduction
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files?.[0];
      if (!f) { preview.style.display = "none"; preview.src = ""; return; }
      const dataUrl = await readAndShrinkImage(f); // smaller for localStorage
      preview.src = dataUrl;
      preview.style.display = "block";
    });

    cancelBtn.addEventListener("click", () => {
      marker.closePopup();
      if (draft.isNew) markersLayer.removeLayer(marker);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const pin = {
        id: fd.get("id").toString(),
        lat: Number(fd.get("lat")),
        lng: Number(fd.get("lng")),
        description: (fd.get("description") || "").toString().trim(),
        when: (fd.get("when") || "").toString(),
        imageDataUrl: preview.src || draft.imageDataUrl || "",
      };

      const all = loadPins();
      const i = all.findIndex(p => p.id === pin.id);
      if (i >= 0) all[i] = pin; else all.push(pin);
      if (!savePins(all)) return;

      renderPin(marker, pin);
      marker.openPopup();
    });
  });
}

// ===== RENDER =====
function renderPin(markerOrLatLng, pin) {
  let marker = markerOrLatLng;
  if (!marker.getLatLng) marker = L.marker([pin.lat, pin.lng]).addTo(markersLayer);

  const dateStr = pin.when ? new Date(pin.when).toLocaleString() : "";
  const imgHtml = pin.imageDataUrl ? `<img src="${pin.imageDataUrl}" alt="Memory"
    style="max-width:240px;max-height:160px;border-radius:10px;display:block;margin-bottom:8px">` : "";

  const viewHtml = `
    <div style="max-width:280px">
      ${imgHtml}
      <div style="font-weight:600;margin-bottom:4px">${escapeHtml(pin.description || "No description")}</div>
      <div style="font-size:12px;color:#9aa0a6">${escapeHtml(dateStr)}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button class="btn-del" style="padding:8px 12px;border-radius:10px;background:#ef4444;color:#fff;border:0" data-id="${pin.id}">Delete</button>
        <button class="btn-edit" style="padding:8px 12px;border-radius:10px;background:#334155;color:#fff;border:0" data-id="${pin.id}">Edit</button>
      </div>
    </div>
  `;

  marker.bindPopup(viewHtml);
  marker.off("popupopen");
  marker.on("popupopen", (e) => {
    const el = e.popup.getElement();
    el.querySelector(".btn-del")?.addEventListener("click", () => {
      const rest = loadPins().filter(p => p.id !== pin.id);
      savePins(rest);
      markersLayer.removeLayer(marker);
    }, { once: true });
    el.querySelector(".btn-edit")?.addEventListener("click", () => {
      openFormPopup(marker, { ...pin, isNew: false });
    }, { once: true });
  });
}

function renderAllPins(pins) {
  markersLayer.clearLayers();
  pins.forEach(p => {
    const m = L.marker([p.lat, p.lng]).addTo(markersLayer);
    renderPin(m, p);
  });
}

// ===== UTILITIES =====
function nowLocalDatetimeString() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function readAndShrinkImage(file, maxSize = 1024, quality = 0.8) {
  const dataUrl = await readFileAsDataURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  if (Math.max(img.width, img.height) <= maxSize) return dataUrl;

  const scale = maxSize / Math.max(img.width, img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
