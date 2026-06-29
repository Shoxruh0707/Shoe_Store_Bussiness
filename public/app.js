const state = {
  products: [],
  filteredProducts: [],
  currentImages: [],
  capturedImages: [],
  stockMatch: null,
  meta: {
    shoeTypes: ["Basanochka", "Tapochka", "Tufli", "Makasima", "Skechers", "Etik", "Krasovka", "Baletka"],
    seasons: ["Summer", "Autumn", "Winter", "Spring"],
    sizes: ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"],
    colours: [],
    materials: []
  }
};

const seasonLabels = {
  Summer: "Yoz",
  Autumn: "Kuz",
  Winter: "Qish",
  Spring: "Bahor"
};

const colourStyles = {
  beige: { background: "#f5f0df", color: "#4a3f2a", border: "#ded4b7" },
  black: { background: "#111827", color: "#ffffff", border: "#111827" },
  white: { background: "#ffffff", color: "#111827", border: "#d1d5db" },
  red: { background: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  blue: { background: "#dbeafe", color: "#1e40af", border: "#bfdbfe" },
  green: { background: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  yellow: { background: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  brown: { background: "#ead7c0", color: "#5c3b1e", border: "#d2b48c" },
  grey: { background: "#e5e7eb", color: "#374151", border: "#d1d5db" },
  gray: { background: "#e5e7eb", color: "#374151", border: "#d1d5db" },
  orange: { background: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
  pink: { background: "#fce7f3", color: "#9d174d", border: "#fbcfe8" },
  purple: { background: "#ede9fe", color: "#5b21b6", border: "#ddd6fe" },
  cream: { background: "#fff7df", color: "#5f4b1f", border: "#f4e4b5" }
};

const form = document.querySelector("#productForm");
const productIdInput = document.querySelector("#productId");
const formTitle = document.querySelector("#formTitle");
const deleteButton = document.querySelector("#deleteButton");
const resetButton = document.querySelector("#resetButton");
const addProductButton = document.querySelector("#addProductButton");
const closeFormButton = document.querySelector("#closeFormButton");
const productDrawer = document.querySelector("#productDrawer");
const statusEl = document.querySelector("#status");
const signoutButton = document.querySelector("#signoutButton");
const typeSelect = document.querySelector("#type");
const seasonButtons = document.querySelector("#seasonButtons");
const sizeGrid = document.querySelector("#sizeGrid");
const totalQuantity = document.querySelector("#totalQuantity");
const imageInput = document.querySelector("#images");
const imageList = document.querySelector("#imageList");
const openCameraButton = document.querySelector("#openCameraButton");
const cameraPanel = document.querySelector("#cameraPanel");
const cameraVideo = document.querySelector("#cameraVideo");
const cameraCanvas = document.querySelector("#cameraCanvas");
const capturePhotoButton = document.querySelector("#capturePhotoButton");
const cameraDoneButton = document.querySelector("#cameraDoneButton");
const closeCameraButton = document.querySelector("#closeCameraButton");
const cameraStrip = document.querySelector("#cameraStrip");
const artNoInput = document.querySelector("#artNo");
const nameInput = document.querySelector("#name");
const priceInput = document.querySelector("#price");
const landingPriceInput = document.querySelector("#landingPrice");
const colourInput = document.querySelector("#colour");
const materialInput = document.querySelector("#material");
const productsTable = document.querySelector("#productsTable");
const productCount = document.querySelector("#productCount");
const searchInput = document.querySelector("#search");
const colourOptions = document.querySelector("#colourOptions");
const materialOptions = document.querySelector("#materialOptions");
const emptyTemplate = document.querySelector("#emptyRowTemplate");

function setStatus(message, className = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${className}`.trim();
}

function openProductDrawer() {
  productDrawer.hidden = false;
  document.body.classList.add("drawer-open");
}

function closeProductDrawer() {
  productDrawer.hidden = true;
  document.body.classList.remove("drawer-open");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || "So'rov bajarilmadi.");
  }

  return data;
}

function renderMeta() {
  const shoeTypes = state.meta.shoeTypes.length
    ? state.meta.shoeTypes
    : ["Basanochka", "Tapochka", "Tufli", "Makasima", "Skechers", "Etik", "Krasovka", "Baletka"];
  const seasons = state.meta.seasons.length ? state.meta.seasons : ["Summer", "Autumn", "Winter", "Spring"];
  const sizes = state.meta.sizes.length
    ? state.meta.sizes
    : ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

  typeSelect.innerHTML = shoeTypes
    .map((type) => `<option value="${type}">${type}</option>`)
    .join("");

  seasonButtons.innerHTML = seasons
    .map(
      (season) =>
        `<button class="season-button" type="button" data-season="${season}" aria-pressed="false">${seasonLabels[season] || season}</button>`
    )
    .join("");

  sizeGrid.innerHTML = sizes
    .map(
      (size) => `
        <div class="size-cell" data-size="${size}" data-quantity="0">
          <span>${size}</span>
          <div class="size-stepper">
            <button class="size-minus" type="button" aria-label="${size}-razmerdan bittani ayirish">-</button>
            <strong>0</strong>
            <button class="size-plus" type="button" aria-label="${size}-razmerga bitta qo'shish">+</button>
          </div>
        </div>
      `
    )
    .join("");

  colourOptions.innerHTML = state.meta.colours.map((colour) => `<option value="${colour}"></option>`).join("");
  materialOptions.innerHTML = state.meta.materials
    .map((material) => `<option value="${material}"></option>`)
    .join("");
}

function getSelectedSeasons() {
  return [...seasonButtons.querySelectorAll(".season-button.active")].map((button) => button.dataset.season);
}

function setSelectedSeasons(seasons) {
  const selected = new Set(seasons || []);
  seasonButtons.querySelectorAll(".season-button").forEach((button) => {
    const active = selected.has(button.dataset.season);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function getInventoryRows() {
  return [...sizeGrid.querySelectorAll(".size-cell[data-size]")].map((cell) => ({
    size: cell.dataset.size,
    quantity: Number(cell.dataset.quantity || 0)
  }));
}

function setInventoryRows(rows) {
  const quantities = new Map((rows || []).map((row) => [String(row.size), Number(row.quantity || 0)]));
  sizeGrid.querySelectorAll(".size-cell[data-size]").forEach((cell) => {
    const quantity = quantities.get(cell.dataset.size) || 0;
    setSizeQuantity(cell, quantity);
  });
  updateTotalQuantity();
}

function setSizeQuantity(cell, quantity) {
  const normalized = Math.max(0, Number(quantity || 0));
  cell.dataset.quantity = String(normalized);
  cell.querySelector("strong").textContent = normalized;
  cell.classList.toggle("active", normalized > 0);
}

function updateTotalQuantity() {
  const total = getInventoryRows().reduce((sum, row) => sum + row.quantity, 0);
  totalQuantity.textContent = total;
}

function focusNextFormControl(currentControl) {
  const controls = [...form.querySelectorAll("input, select, button")]
    .filter((control) => !control.disabled && control.type !== "hidden" && control.offsetParent !== null);
  const currentIndex = controls.indexOf(currentControl);
  const nextControl = controls[currentIndex + 1];

  if (nextControl) {
    nextControl.focus();
  }
}

function setDetailsDisabled(disabled) {
  nameInput.disabled = disabled;
  typeSelect.disabled = disabled;
  priceInput.disabled = disabled;
  landingPriceInput.disabled = disabled;
  imageInput.disabled = disabled;
  openCameraButton.disabled = disabled;
  seasonButtons.querySelectorAll(".season-button").forEach((button) => {
    button.disabled = disabled;
  });
}

function clearStockMatch() {
  state.stockMatch = null;
  state.currentImages = [];
  state.capturedImages = [];
  setDetailsDisabled(false);
  renderImageList([]);
  formTitle.textContent = "Mahsulot qo'shish";
}

function resetForm() {
  form.reset();
  productIdInput.value = "";
  clearStockMatch();
  formTitle.textContent = "Mahsulot qo'shish";
  deleteButton.disabled = true;
  setSelectedSeasons([]);
  setInventoryRows([]);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatMoneyInput(value) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function moneyPayloadValue(input) {
  return digitsOnly(input.value) || "0";
}

function bindMoneyInput(input) {
  input.addEventListener("input", () => {
    input.value = formatMoneyInput(input.value);
  });
}

function formatCurrency(value) {
  return formatMoneyInput(Math.trunc(Number(value || 0)));
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 19);
}

function renderSeasonPills(seasons) {
  if (!seasons || !seasons.length) return "-";
  return `<div class="pill-list">${seasons
    .map((season) => `<span class="pill">${seasonLabels[season] || season}</span>`)
    .join("")}</div>`;
}

function colourStyleFor(value) {
  const colour = String(value || "").toLowerCase();
  const key = Object.keys(colourStyles).find((name) => colour.includes(name));
  return colourStyles[key] || { background: "#f9fafb", color: "#344054", border: "#dfe4ee" };
}

function renderColourCell(value) {
  if (!value) return "-";
  const style = colourStyleFor(value);
  return `<span class="colour-chip" style="background:${style.background};color:${style.color};border-color:${style.border}">${value}</span>`;
}

function renderImageList(existingImages = state.currentImages) {
  const selectedFiles = [...(imageInput.files || [])];
  const existingMarkup = existingImages
    .map(
      (image) => `
        <a class="image-chip" href="${image.path}" target="_blank" rel="noreferrer">
          <img src="${image.path}" alt="">
          <span>Saqlangan rasm</span>
        </a>
      `
    )
    .join("");
  const selectedMarkup = selectedFiles
    .map((file) => `<span class="image-chip selected-image">${file.name}</span>`)
    .join("");
  const capturedMarkup = state.capturedImages
    .map(
      (image, index) => `
        <span class="image-chip captured-image">
          <img src="${image.data}" alt="">
          <span>Kamera ${index + 1}</span>
        </span>
      `
    )
    .join("");

  imageList.innerHTML = existingMarkup + selectedMarkup + capturedMarkup;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`${file.name} faylini o'qib bo'lmadi.`));
    reader.readAsDataURL(file);
  });
}

async function getImageRows() {
  const files = [...(imageInput.files || [])];
  const uploadedImages = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      data: await fileToDataUrl(file)
    }))
  );
  return [...uploadedImages, ...state.capturedImages];
}

function renderCameraStrip() {
  cameraStrip.innerHTML = state.capturedImages
    .map((image) => `<img src="${image.data}" alt="">`)
    .join("");
}

function stopCamera() {
  const stream = cameraVideo.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  cameraVideo.srcObject = null;
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Brauzer kamerani qo'llab-quvvatlamaydi.", "error");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    cameraVideo.srcObject = stream;
    cameraPanel.hidden = false;
    renderCameraStrip();
  } catch (error) {
    setStatus("Kamerani ochib bo'lmadi. Ruxsatni tekshiring.", "error");
  }
}

function closeCamera() {
  stopCamera();
  cameraPanel.hidden = true;
  renderImageList();
}

function capturePhoto() {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) return;

  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  const context = cameraCanvas.getContext("2d");
  context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

  state.capturedImages.push({
    name: `camera-${Date.now()}.jpg`,
    type: "image/jpeg",
    data: cameraCanvas.toDataURL("image/jpeg", 0.88)
  });

  renderCameraStrip();
}

async function checkStockMatch() {
  if (productIdInput.value) return;

  const artNo = artNoInput.value.trim();
  const colour = colourInput.value.trim();
  const material = materialInput.value.trim();

  if (!artNo || !colour || !material) {
    if (state.stockMatch) {
      clearStockMatch();
    }
    return;
  }

  const params = new URLSearchParams({ artNo, colour, material });
  const result = await api(`/api/products/match?${params}`);
  const product = result.match;

  if (!product) {
    if (state.stockMatch) {
      clearStockMatch();
    }
    return;
  }

  state.stockMatch = product;
  nameInput.value = product.name || "";
  typeSelect.value = product.type || state.meta.shoeTypes[0] || "";
  priceInput.value = formatMoneyInput(product.price || 0);
  landingPriceInput.value = formatMoneyInput(product.landingPrice || 0);
  setSelectedSeasons(product.seasons || []);
  imageInput.value = "";
  state.capturedImages = [];
  state.currentImages = product.images || [];
  renderImageList();
  setInventoryRows([]);
  setDetailsDisabled(true);
  formTitle.textContent = `${product.artNo} uchun razmer qo'shish`;
  setStatus("Mavjud mahsulot topildi. Faqat yangi razmer sonlarini kiriting.", "ok");
}

function renderProducts() {
  const queryParts = searchInput.value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  state.filteredProducts = state.products.filter((product) => {
    const haystack = [
      product.artNo,
      product.name,
      product.type,
      product.colours,
      product.materials,
      product.availableSizes,
      product.price,
      product.landingPrice,
      product.quantity
    ]
      .join(" ")
      .toLowerCase();

    return queryParts.every((part) => haystack.includes(part));
  });

  productCount.textContent = `${state.filteredProducts.length} ta mahsulot`;

  if (!state.filteredProducts.length) {
    productsTable.innerHTML = "";
    productsTable.appendChild(emptyTemplate.content.cloneNode(true));
    return;
  }

  productsTable.innerHTML = state.filteredProducts
    .map(
      (product) => `
        <tr data-id="${product.id}">
          <td><strong>${product.artNo || "-"}</strong></td>
          <td>${renderColourCell(product.colours)}</td>
          <td>${product.materials || "-"}</td>
          <td>${product.availableSizes || "-"}</td>
          <td><strong>${product.quantity || 0}</strong></td>
          <td>${formatCurrency(product.price)}</td>
        </tr>
      `
    )
    .join("");
}

async function loadProducts() {
  state.products = await api("/api/products");
  renderProducts();
}

async function productPayload() {
  return {
    artNo: artNoInput.value,
    name: nameInput.value,
    type: typeSelect.value,
    seasons: getSelectedSeasons(),
    price: moneyPayloadValue(priceInput),
    landingPrice: moneyPayloadValue(landingPriceInput),
    colour: colourInput.value,
    material: materialInput.value,
    inventory: getInventoryRows(),
    images: await getImageRows()
  };
}

async function editProduct(id) {
  openProductDrawer();
  const product = await api(`/api/products/${id}`);
  state.stockMatch = null;
  setDetailsDisabled(false);
  imageInput.value = "";
  state.capturedImages = [];
  state.currentImages = product.images || [];
  productIdInput.value = product.id;
  artNoInput.value = product.artNo || "";
  nameInput.value = product.name || "";
  typeSelect.value = product.type || state.meta.shoeTypes[0] || "";
  priceInput.value = formatMoneyInput(product.price || 0);
  landingPriceInput.value = formatMoneyInput(product.landingPrice || 0);
  colourInput.value = product.colour || "";
  materialInput.value = product.material || "";
  setSelectedSeasons(product.seasons || []);
  setInventoryRows(product.inventory || []);
  renderImageList();
  formTitle.textContent = `${product.artNo} ni tahrirlash`;
  deleteButton.disabled = false;
}

async function init() {
  renderMeta();
  resetForm();

  try {
    const session = await api("/api/auth/me");
    if (!["store_owner", "admin"].includes(session.user.role) || !session.store) {
      window.location.replace(session.user.role === "customer" ? "/customer" : "/signup");
      return;
    }
    setStatus(`${session.store.storeName} ombori`, "ok");
  } catch (_error) {
    window.location.replace("/signin");
    return;
  }

  try {
    await api("/api/health");
  } catch (error) {
    setStatus(error.message, "error");
  }

  try {
    state.meta = {
      ...state.meta,
      ...(await api("/api/meta"))
    };
    renderMeta();
    resetForm();
  } catch (error) {
    setStatus(error.message, "error");
  }

  try {
    await loadProducts();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

seasonButtons.addEventListener("click", (event) => {
  const button = event.target.closest(".season-button");
  if (!button) return;

  const active = !button.classList.contains("active");
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
});

sizeGrid.addEventListener("click", (event) => {
  const cell = event.target.closest(".size-cell");
  if (!cell) return;

  if (event.target.closest(".size-plus")) {
    setSizeQuantity(cell, Number(cell.dataset.quantity || 0) + 1);
  }

  if (event.target.closest(".size-minus")) {
    setSizeQuantity(cell, Number(cell.dataset.quantity || 0) - 1);
  }

  updateTotalQuantity();
});
imageInput.addEventListener("change", () => renderImageList());
bindMoneyInput(priceInput);
bindMoneyInput(landingPriceInput);
openCameraButton.addEventListener("click", () => openCamera());
capturePhotoButton.addEventListener("click", capturePhoto);
cameraDoneButton.addEventListener("click", closeCamera);
closeCameraButton.addEventListener("click", closeCamera);
searchInput.addEventListener("input", renderProducts);
addProductButton.addEventListener("click", () => {
  resetForm();
  openProductDrawer();
  artNoInput.focus();
});
closeFormButton.addEventListener("click", closeProductDrawer);
productDrawer.addEventListener("click", (event) => {
  if (event.target === productDrawer) closeProductDrawer();
});
resetButton.addEventListener("click", () => {
  resetForm();
  artNoInput.focus();
});
signoutButton.addEventListener("click", async () => {
  try {
    await api("/api/auth/signout", { method: "POST" });
  } finally {
    window.location.replace("/signin");
  }
});
artNoInput.addEventListener("change", () => checkStockMatch().catch((error) => setStatus(error.message, "error")));
colourInput.addEventListener("change", () => checkStockMatch().catch((error) => setStatus(error.message, "error")));
materialInput.addEventListener("change", () => checkStockMatch().catch((error) => setStatus(error.message, "error")));

productsTable.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  editProduct(row.dataset.id).catch((error) => setStatus(error.message, "error"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !productDrawer.hidden) {
    closeProductDrawer();
  }
});

form.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;

  const control = event.target.closest("input, select, button");
  if (!control) return;

  event.preventDefault();
  focusNextFormControl(control);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const id = productIdInput.value;
    const payload = await productPayload();
    const path = id ? `/api/products/${id}` : "/api/products";
    const method = id ? "PUT" : "POST";

    await api(path, {
      method,
      body: JSON.stringify(payload)
    });

    resetForm();
    closeProductDrawer();
    await loadProducts();
    setStatus("Mahsulot saqlandi", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

deleteButton.addEventListener("click", async () => {
  const id = productIdInput.value;
  if (!id) return;

  const artNo = document.querySelector("#artNo").value || "bu mahsulot";
  if (!window.confirm(`${artNo} o'chirilsinmi?`)) return;

  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
    resetForm();
    closeProductDrawer();
    await loadProducts();
    setStatus("Mahsulot o'chirildi", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

init().catch((error) => {
  setStatus(error.message, "error");
});
