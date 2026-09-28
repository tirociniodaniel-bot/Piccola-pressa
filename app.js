const fileInput = document.querySelector('#file-input');
const folderInput = document.querySelector('#folder-input');
const folderPicker = document.querySelector('#folder-picker');
const folderPickButton = document.querySelector('#folder-pick-button');
const dropZone = document.querySelector('#drop-zone');
const maxSideInput = document.querySelector('#max-side');
const qualityInput = document.querySelector('#quality');
const qualityValue = document.querySelector('#quality-value');
const convertButton = document.querySelector('#convert-button');
const errorMessage = document.querySelector('#error-message');
const fileSummary = document.querySelector('#file-summary');
const resultSection = document.querySelector('#result-section');
const targetWidthInput = document.querySelector('#target-width');
const targetHeightInput = document.querySelector('#target-height');

let selectedItems = [];
let nextItemId = 0;
let isConverting = false;
let resizeMode = 'max-side';

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
    name.textContent = item.file.webkitRelativePath || item.file.name;
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
  folderInput.disabled = isConverting;
  folderPickButton.disabled = isConverting;
  dropZone.disabled = isConverting;
  maxSideInput.disabled = isConverting;
  targetWidthInput.disabled = isConverting;
  targetHeightInput.disabled = isConverting;
  qualityInput.disabled = isConverting;
  document.querySelector('#clear-files').disabled = isConverting;
  document.querySelectorAll('.mode-button, .preset-button').forEach((button) => {
    button.disabled = isConverting;
  });
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
  folderInput.value = '';
  errorMessage.hidden = true;
  updateSelection();
}

async function filesFromHandle(handle) {
  if (handle.kind === 'file') return [await handle.getFile()];
  const files = [];
  for await (const child of handle.values()) files.push(...await filesFromHandle(child));
  return files;
}

function fileFromEntry(entry) {
  return new Promise((resolve) => entry.file(resolve, () => resolve(null)));
}

function entriesFromDirectory(entry) {
  return new Promise((resolve) => {
    const reader = entry.createReader();
    const entries = [];
    const readNextBatch = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readNextBatch();
      }, () => resolve(entries));
    };
    readNextBatch();
  });
}

async function filesFromEntry(entry) {
  try {
    if (entry.isFile) {
      const file = await fileFromEntry(entry);
      return file ? [file] : [];
    }
    if (!entry.isDirectory) return [];
    const entries = await entriesFromDirectory(entry);
    const nestedFiles = await Promise.all(entries.map(filesFromEntry));
    return nestedFiles.flat();
  } catch {
    return [];
  }
}

async function filesFromDrop(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  if (!items.length) return Array.from(dataTransfer.files || []);

  const itemData = items.map((item) => {
    let handlePromise = Promise.resolve(null);
    if (item.kind === 'file' && typeof item.getAsFileSystemHandle === 'function') {
      try {
        handlePromise = item.getAsFileSystemHandle().catch(() => null);
      } catch {
        handlePromise = Promise.resolve(null);
      }
    }
    const entry = item.kind === 'file' ? item.webkitGetAsEntry?.() : null;
    const file = item.kind === 'file' ? item.getAsFile() : null;
    return { handlePromise, entry, file };
  });
  const handles = await Promise.all(itemData.map((item) => item.handlePromise));
  const files = [];
  for (const [index, item] of itemData.entries()) {
    if (handles[index]) {
      try {
        files.push(...await filesFromHandle(handles[index]));
        continue;
      } catch {
      }
    }
    if (item.entry) files.push(...await filesFromEntry(item.entry));
    else if (item.file) files.push(item.file);
  }
  return files;
}

async function handleDrop(event) {
  const files = await filesFromDrop(event.dataTransfer);
  const images = files.filter(isSupportedImage);
  if (!images.length) {
    showError('Non ho trovato immagini JPG, PNG o WebP nella selezione o nella cartella.');
    return;
  }
  await addImages(images);
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

function convertOne(item, resizeOptions, quality) {
  return new Promise((resolve) => {
    let width;
    let height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = item.image.naturalWidth;
    let sourceHeight = item.image.naturalHeight;
    if (resizeOptions.mode === 'exact') {
      width = resizeOptions.width;
      height = resizeOptions.height;
      const scale = Math.max(width / sourceWidth, height / sourceHeight);
      sourceWidth = width / scale;
      sourceHeight = height / scale;
      sourceX = (item.image.naturalWidth - sourceWidth) / 2;
      sourceY = (item.image.naturalHeight - sourceHeight) / 2;
    } else {
      const scale = Math.min(1, resizeOptions.side / Math.max(sourceWidth, sourceHeight));
      width = Math.max(1, Math.round(sourceWidth * scale));
      height = Math.max(1, Math.round(sourceHeight * scale));
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      item.error = 'Il browser non riesce ad avviare la conversione.';
      resolve();
      return;
    }
    if (resizeOptions.mode === 'exact') {
      context.drawImage(item.image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    } else {
      context.drawImage(item.image, 0, 0, width, height);
    }
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        item.error = 'Esportazione WebP non supportata da questo browser.';
      } else {
        item.blob = blob;
        item.width = width;
        item.height = height;
        item.mode = resizeOptions.mode;
      }
      canvas.width = 0;
      canvas.height = 0;
      resolve();
    }, 'image/webp', quality);
  });
}

function makeUniqueName(item, usedNames) {
  const baseName = item.file.name.replace(/\.[^.]+$/, '');
  const dimensions = item.mode === 'exact'
    ? `${item.width}x${item.height}px`
    : `${Math.max(item.width, item.height)}px`;
  let name = `${baseName}-${dimensions}.webp`;
  let duplicate = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${baseName}-${duplicate++}-${dimensions}.webp`;
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
  if (!selectedItems.length || isConverting) return;
  let resizeOptions;
  if (resizeMode === 'exact') {
    const width = Number.parseInt(targetWidthInput.value, 10);
    const height = Number.parseInt(targetHeightInput.value, 10);
    if (!Number.isInteger(width) || width < 1 || width > 20000 || !Number.isInteger(height) || height < 1 || height > 20000) {
      showError('Inserisci larghezza e altezza tra 1 e 20.000 px.');
      targetWidthInput.focus();
      return;
    }
    resizeOptions = { mode: 'exact', width, height };
  } else {
    const side = Number.parseInt(maxSideInput.value, 10);
    if (!Number.isInteger(side) || side < 1 || side > 20000) {
      showError('Inserisci un lato massimo tra 1 e 20.000 px.');
      maxSideInput.focus();
      return;
    }
    resizeOptions = { mode: 'max-side', side };
  }
  clearResults();
  isConverting = true;
  updateSelection();
  for (const [index, item] of selectedItems.entries()) {
    convertButton.querySelector('span').textContent = `Conversione ${index + 1} di ${selectedItems.length}…`;
    item.error = null;
    await convertOne(item, resizeOptions, Number(qualityInput.value) / 100);
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
folderInput.addEventListener('change', (event) => {
  const images = [...event.target.files].filter(isSupportedImage);
  if (!images.length) showError('La cartella non contiene immagini JPG, PNG o WebP.');
  else addImages(images);
  folderInput.value = '';
});
folderPicker.hidden = !('webkitdirectory' in document.createElement('input'));
folderPickButton.addEventListener('click', () => folderInput.click());
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
dropZone.addEventListener('drop', handleDrop);
qualityInput.addEventListener('input', () => {
  qualityValue.value = `${qualityInput.value}%`;
  qualityValue.textContent = `${qualityInput.value}%`;
  clearResults();
});
maxSideInput.addEventListener('input', clearResults);
targetWidthInput.addEventListener('input', () => {
  document.querySelectorAll('.preset-button').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  clearResults();
});
targetHeightInput.addEventListener('input', () => {
  document.querySelectorAll('.preset-button').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  clearResults();
});
document.querySelectorAll('.mode-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (isConverting || resizeMode === button.dataset.mode) return;
    resizeMode = button.dataset.mode;
    document.querySelectorAll('.mode-button').forEach((modeButton) => {
      modeButton.setAttribute('aria-pressed', String(modeButton === button));
    });
    document.querySelector('#max-side-settings').hidden = resizeMode !== 'max-side';
    document.querySelector('#exact-size-settings').hidden = resizeMode !== 'exact';
    errorMessage.hidden = true;
    clearResults();
  });
});
document.querySelectorAll('.preset-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (isConverting) return;
    targetWidthInput.value = button.dataset.width;
    targetHeightInput.value = button.dataset.height;
    document.querySelectorAll('.preset-button').forEach((presetButton) => {
      presetButton.setAttribute('aria-pressed', String(presetButton === button));
    });
    errorMessage.hidden = true;
    clearResults();
  });
});
convertButton.addEventListener('click', convertImages);
document.querySelector('#clear-files').addEventListener('click', clearFiles);
document.querySelector('#download-all-button').addEventListener('click', downloadAll);
updateSelection();
