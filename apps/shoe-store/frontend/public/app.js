const formEl = document.querySelector("#productForm");
const messageEl = document.querySelector("#message");
const dbStatusEl = document.querySelector("#dbStatus");
const submitButton = document.querySelector("#submitButton");
const refreshButton = document.querySelector("#refreshButton");
const recentListEl = document.querySelector("#recentList");
const sizeButtonsEl = document.querySelector("#sizeButtons");

const datalistMap = {
  brands: document.querySelector("#brandOptions"),
  types: document.querySelector("#typeOptions"),
  colours: document.querySelector("#colourOptions"),
  materials: document.querySelector("#materialOptions"),
};

const selectedSizes = new Set();

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(data.error || data || "Request failed");
  }
  return data;
}

function fillDatalist(list, options, labelKey = "label") {
  list.innerHTML = "";
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = String(option[labelKey]);
    list.append(item);
  });
}

function renderSizeButtons(sizes) {
  sizeButtonsEl.innerHTML = "";
  sizes.forEach((size) => {
    const value = String(Number(size.label));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "size-chip";
    button.dataset.size = value;
    button.textContent = value;
    button.addEventListener("click", () => {
      if (selectedSizes.has(value)) {
        selectedSizes.delete(value);
        button.classList.remove("selected");
      } else {
        selectedSizes.add(value);
        button.classList.add("selected");
      }
    });
    sizeButtonsEl.append(button);
  });
}

async function loadFormData() {
  const data = await api("/api/products/form-data");
  fillDatalist(datalistMap.brands, data.brands);
  fillDatalist(datalistMap.types, data.types);
  fillDatalist(datalistMap.colours, data.colours);
  fillDatalist(datalistMap.materials, data.materials);
  renderSizeButtons(data.sizes);
}

function productTitle(product) {
  return `${product.brand_name} / ${product.art_no}`;
}

function renderProducts(products) {
  recentListEl.innerHTML = "";
  if (!products.length) {
    recentListEl.textContent = "No products yet.";
    return;
  }

  products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "recent-item";

    const title = document.createElement("p");
    title.className = "recent-title";
    title.textContent = productTitle(product);
    item.append(title);

    const meta = document.createElement("div");
    meta.className = "recent-meta";
    [
      ["Type", product.type_name],
      ["Colour", product.colour_name],
      ["Material", product.material_type],
      ["Original", product.original_price],
      ["Price", product.price],
      ["Season", product.season],
      ["Sizes", product.inventory || ""],
    ].forEach(([key, value]) => {
      const keyEl = document.createElement("span");
      keyEl.textContent = key;
      const valueEl = document.createElement("span");
      valueEl.textContent = value ?? "";
      meta.append(keyEl, valueEl);
    });

    item.append(meta);
    recentListEl.append(item);
  });
}

async function loadProducts() {
  const data = await api("/api/products");
  renderProducts(data.products || []);
}

async function loadHealth() {
  try {
    const health = await api("/api/health");
    dbStatusEl.textContent = `Connected: ${health.database}`;
    dbStatusEl.className = "status ok";
  } catch (error) {
    dbStatusEl.textContent = "Database offline";
    dbStatusEl.className = "status bad";
    setMessage(error.message, "error");
  }
}

function buildFormData() {
  const data = new FormData(formEl);
  selectedSizes.forEach((size) => data.append("selected_sizes", size));
  return data;
}

function resetForm() {
  formEl.reset();
  selectedSizes.clear();
  document.querySelectorAll(".size-chip.selected").forEach((button) => {
    button.classList.remove("selected");
  });
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setMessage("Saving product...");

  try {
    await api("/api/products", {
      method: "POST",
      body: buildFormData(),
    });
    resetForm();
    await loadFormData();
    await loadProducts();
    setMessage("Product saved.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener("click", loadProducts);

async function init() {
  await loadHealth();
  await loadFormData();
  await loadProducts();
}

init().catch((error) => setMessage(error.message, "error"));
