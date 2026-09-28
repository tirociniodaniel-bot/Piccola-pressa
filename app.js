const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const maxWidthInput = document.querySelector('#max-width');
const qualityInput = document.querySelector('#quality');
const qualityValue = document.querySelector('#quality-value');
const convertButton = document.querySelector('#convert-button');
const errorMessage = document.querySelector('#error-message');
const fileSummary = document.querySelector('#file-summary');
const resultSection = document.querySelector('#result-section');

let selectedItems = [];
let nextItemId = 0;
let isConverting = false;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSupportedImage(file) {
  const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  const extension = file.name.split('.').pop().toLowerCase();
  return mimeTypes.includes(file.type) || extensions.includes(extension);
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearResults() {
  for (const item of selectedItems) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    item.previewUrl = null;
    item.blob = null;
    item.outputName = null;
  }
  document.querySelector('#results-list').replaceChildren();
  resultSection.hidden = true;
}

function updateSelection() {
  const list = document.querySelector('#selected-files');
  const summary = document.querySelector('#selection-summary');
  list.replaceChildren();
  summary.hidden = selectedItems.length === 0;
  list.hidden = selectedItems.length === 0;
  document.querySelector('#selection-count').textContent = `${selectedItems.length} ${selectedItems.length === 1 ? 'immagine selezionata' : 'immagini selezionate'}`;
  for (const item of selectedItems) {
    const row = document.createElement('li');
    row.className = 'selected-file';
    const badge = document.createElement('span');
    badge.className = 'file-icon';
    badge.textContent = item.file.name.split('.').pop().slice(0, 4).toUpperCase();
    badge.setAttribute('aria-hidden', 'true');
    const metadata = document.createElement('span');
    metadata.className = 'file-meta';
    const name = document.createElement('strong');
    name.textContent = item.file.name;
    const details = document.createElement('span');
    details.textContent = `${item.image.naturalWidth} × ${item.image.naturalHeight} px · ${formatBytes(item.file.size)}`;
    metadata.append(name, details);
    const remove = document.createElement('button');
    remove.className = 'icon-button';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = `Rimuovi ${item.file.name}`;
    remove.setAttribute('aria-label', `Rimuovi ${item.file.name}`);
    remove.disabled = isConverting;
    remove.addEventListener('click', () => removeImage(item.id));
    row.append(badge, metadata, remove);
    list.append(row);
  }
  convertButton.disabled = selectedItems.length === 0 || isConverting;
  convertButton.querySelector('span').textContent = isConverting
    ? 'Conversione in corso…'
    : `Converti ${selectedItems.length || ''} ${selectedItems.length === 1 ? 'immagine' : 'immagini'} in WebP`.replace(/\s+/g, ' ').trim();
  fileInput.disabled = isConverting;
  dropZone.disabled = isConverting;
  maxWidthInput.disabled = isConverting;
  qualityInput.disabled = isConverting;
  document.querySelector('#clear-files').disabled = isConverting;
}

function removeImage(id) {
  if (isConverting) return;
  clearResults();
  selectedItems = selectedItems.filter((item) => item.id !== id);
  errorMessage.hidden = true;
  updateSelection();
}

function clearFiles() {
  if (isConverting) return;
  clearResults();
  selectedItems = [];
  fileInput.value = '';
  errorMessage.hidden = true;
  updateSelection();
}

async function addImages(files) {
  if (isConverting || files.length === 0) return;
  clearResults();
  errorMessage.hidden = true;
  const errors = [];
  const newItems = await Promise.all(files.map((file) => new Promise((resolve) => {
    if (!isSupportedImage(file)) {
      errors.push(`${file.name}: formato non supportato.`);
      resolve(null);
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      errors.push(`${file.name}: supera il limite di 30 MB.`);
      resolve(null);
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve({ id: nextItemId++, file, image, blob: null, outputName: null, previewUrl: null, error: null });
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      errors.push(`${file.name}: immagine non leggibile.`);
      resolve(null);
    };
    image.src = imageUrl;
  })));
  selectedItems.push(...newItems.filter(Boolean));
  updateSelection();
  if (errors.length) showError(errors.join(' '));
}

function convertOne(item, maxWidth, quality) {
  return new Promise((resolve) => {
    const scale = Math.min(1, maxWidth / item.image.naturalWidth);
    const width = Math.max(1, Math.round(item.image.naturalWidth * scale));
    const height = Math.max(1, Math.round(item.image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      item.error = 'Il browser non riesce ad avviare la conversione.';
      resolve();
      return;
    }
    context.drawImage(item.image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        item.error = 'Esportazione WebP non supportata da questo browser.';
      } else {
        item.blob = blob;
        item.width = width;
        item.height = height;
      }
      canvas.width = 0;
      canvas.height = 0;
      resolve();
    }, 'image/webp', quality);
  });
}

function makeUniqueName(item, usedNames) {
  const baseName = item.file.name.replace(/\.[^.]+$/, '');
  let name = `${baseName}-${item.width}px.webp`;
  let duplicate = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${baseName}-${duplicate++}-${item.width}px.webp`;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderResults() {
  const resultsList = document.querySelector('#results-list');
  resultsList.replaceChildren();
  const successful = selectedItems.filter((item) => item.blob);
  const usedNames = new Set();
  successful.forEach((item) => {
    item.outputName = makeUniqueName(item, usedNames);
    item.previewUrl = URL.createObjectURL(item.blob);
    const row = document.createElement('article');
    row.className = 'result-item';
    const preview = document.createElement('div');
    preview.className = 'result-thumb';
    const image = document.createElement('img');
    image.src = item.previewUrl;
    image.alt = '';
    preview.append(image);
    const details = document.createElement('div');
    details.className = 'result-data';
    const file = document.createElement('div');
    file.className = 'result-file';
    const badge = document.createElement('span');
    badge.className = 'webp-badge';
    badge.textContent = 'WEBP';
    const name = document.createElement('strong');
    name.textContent = item.outputName;
    file.append(badge, name);
    const info = document.createElement('div');
    info.className = 'result-details';
    info.textContent = `${item.width} × ${item.height} px · ${formatBytes(item.blob.size)}`;
    details.append(file, info);
    const download = document.createElement('button');
    download.className = 'item-download';
    download.type = 'button';
    download.textContent = 'Scarica';
    download.addEventListener('click', () => downloadBlob(item.blob, item.outputName));
    row.append(preview, details, download);
    resultsList.append(row);
  });
  selectedItems.filter((item) => item.error).forEach((item) => {
    const error = document.createElement('p');
    error.className = 'result-error';
    error.textContent = `${item.file.name}: ${item.error}`;
    resultsList.append(error);
  });
  document.querySelector('#download-all-button').disabled = successful.length === 0;
  resultSection.hidden = successful.length === 0 && !selectedItems.some((item) => item.error);
}

async function convertImages() {
  errorMessage.hidden = true;
  const maxWidth = Number.parseInt(maxWidthInput.value, 10);
  if (!selectedItems.length || isConverting) return;
  if (!Number.isInteger(maxWidth) || maxWidth < 1 || maxWidth > 20000) {
    showError('Inserisci una larghezza massima tra 1 e 20.000 px.');
    maxWidthInput.focus();
    return;
  }
  clearResults();
  isConverting = true;
  updateSelection();
  for (const [index, item] of selectedItems.entries()) {
    convertButton.querySelector('span').textContent = `Conversione ${index + 1} di ${selectedItems.length}…`;
    item.error = null;
    await convertOne(item, maxWidth, Number(qualityInput.value) / 100);
  }
  isConverting = false;
  updateSelection();
  renderResults();
  if (selectedItems.some((item) => item.blob)) resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function downloadAll() {
  const successful = selectedItems.filter((item) => item.blob);
  if (!successful.length) return;
  if (!window.fflate?.zipSync) {
    showError('Archivio ZIP non disponibile: scarica i file singolarmente oppure ricarica la pagina con una connessione internet.');
    return;
  }
  const archiveFiles = {};
  for (const item of successful) archiveFiles[item.outputName] = new Uint8Array(await item.blob.arrayBuffer());
  const archive = window.fflate.zipSync(archiveFiles, { level: 0 });
  downloadBlob(new Blob([archive], { type: 'application/zip' }), 'piccola-pressa-webp.zip');
}

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => {
  addImages([...event.target.files]);
  fileInput.value = '';
});
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-over');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-over');
  });
}
dropZone.addEventListener('drop', (event) => addImages([...event.dataTransfer.files]));
qualityInput.addEventListener('input', () => {
  qualityValue.value = `${qualityInput.value}%`;
  qualityValue.textContent = `${qualityInput.value}%`;
  clearResults();
});
maxWidthInput.addEventListener('input', clearResults);
convertButton.addEventListener('click', convertImages);
document.querySelector('#clear-files').addEventListener('click', clearFiles);
document.querySelector('#download-all-button').addEventListener('click', downloadAll);
updateSelection();
