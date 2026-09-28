const fileInput = document.querySelector('#file-input');
const folderInput = document.querySelector('#folder-input');
const folderPickButton = document.querySelector('#folder-pick-button');
const uploadPanel = document.querySelector('.upload-panel');
const previewPanel = document.querySelector('.preview-panel');
const dropZone = document.querySelector('#drop-zone');
const emptyAddButton = document.querySelector('#empty-add-button');
const uploadStatus = document.querySelector('#upload-status');
const uploadProgress = document.querySelector('#upload-progress');
const fileCount = document.querySelector('#file-count');
const clearFilesButton = document.querySelector('#clear-files');
const importErrorsElement = document.querySelector('#import-errors');
const maxSideInput = document.querySelector('#max-side');
const targetWidthInput = document.querySelector('#target-width');
const targetHeightInput = document.querySelector('#target-height');
const qualityInput = document.querySelector('#quality');
const qualityValue = document.querySelector('#quality-value');
const convertButton = document.querySelector('#convert-button');
const conversionStatus = document.querySelector('#conversion-status');
const settingsError = document.querySelector('#settings-error');
const resultSection = document.querySelector('#result-section');
const resultsList = document.querySelector('#results-list');
const downloadAllButton = document.querySelector('#download-all-button');
const batchSavings = document.querySelector('#batch-savings');
const staleWarning = document.querySelector('#stale-warning');
const zipNote = document.querySelector('#zip-note');
const previewEmpty = document.querySelector('#preview-empty');
const previewStage = document.querySelector('#preview-stage');
const activePreviewImage = document.querySelector('#active-preview-image');
const activeFileMeta = document.querySelector('#active-file-meta');
const activeFileBadge = document.querySelector('#active-file-badge');
const cropWindow = document.querySelector('#crop-window');
const cropFormatLabel = document.querySelector('#crop-format-label');
const cropKeptLabel = document.querySelector('#crop-kept-label');
const cropExcludedLabel = document.querySelector('#crop-excluded-label');
const cropDescription = document.querySelector('#crop-description');
const previewDimensions = document.querySelector('#preview-dimensions');
const fileStripWrap = document.querySelector('#file-strip-wrap');
const fileStrip = document.querySelector('#file-strip');
const stripCount = document.querySelector('#strip-count');
const stripStatus = document.querySelector('#strip-status');
const appliesCount = document.querySelector('#applies-count');

const state = {
  selectedItems: [],
  importErrors: [],
  activeItemId: null,
  nextItemId: 0,
  nextImportErrorId: 0,
  isLoading: false,
  isConverting: false,
  resizeMode: 'max-side',
  conversionCurrentIndex: 0,
  conversionTotal: 0,
};

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_DIMENSION = 20000;
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

function formatDimensions(width, height) {
  return `${width} × ${height} px`;
}

function isSupportedImage(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  return SUPPORTED_MIME_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(extension);
}

function isSystemMetadataFile(file) {
  const path = (file.webkitRelativePath || file.name).replaceAll('\\', '/');
  const normalizedPath = path.toLowerCase();
  const name = normalizedPath.split('/').pop();
  return name === '.ds_store'
    || name === 'thumbs.db'
    || name === 'desktop.ini'
    || name.startsWith('._')
    || normalizedPath.split('/').includes('__macosx');
}

function getExtension(file) {
  return (file.name.split('.').pop() || 'IMG').slice(0, 4).toUpperCase();
}

function getDisplayName(item) {
  return item.file.webkitRelativePath || item.file.name;
}

function addImportError(fileName, message) {
  state.importErrors.push({ id: state.nextImportErrorId++, fileName, message });
}

function removeImportError(id) {
  state.importErrors = state.importErrors.filter((error) => error.id !== id);
  render();
}

function markCompletedItemsStale() {
  state.selectedItems.forEach((item) => {
    if (item.status === 'complete' && item.blob) item.isStale = true;
  });
  renderResults();
}

function revokeItemUrls(item) {
  if (item.sourcePreviewUrl) URL.revokeObjectURL(item.sourcePreviewUrl);
  if (item.outputPreviewUrl) URL.revokeObjectURL(item.outputPreviewUrl);
  item.sourcePreviewUrl = null;
  item.outputPreviewUrl = null;
}

function removeImage(id) {
  if (state.isConverting || state.isLoading) return;
  const removedItem = state.selectedItems.find((item) => item.id === id);
  if (removedItem) revokeItemUrls(removedItem);
  state.selectedItems = state.selectedItems.filter((item) => item.id !== id);
  if (state.activeItemId === id) state.activeItemId = state.selectedItems[0]?.id ?? null;
  render();
}

function clearFiles() {
  if (state.isConverting || state.isLoading) return;
  state.selectedItems.forEach(revokeItemUrls);
  state.selectedItems = [];
  state.importErrors = [];
  state.activeItemId = null;
  fileInput.value = '';
  folderInput.value = '';
  render();
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
        // Use the WebKit entry or File fallback below.
      }
    }
    if (item.entry) files.push(...await filesFromEntry(item.entry));
    else if (item.file) files.push(item.file);
  }
  return files;
}

function decodeImage(file) {
  return new Promise((resolve) => {
    const sourcePreviewUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ file, image, sourcePreviewUrl });
    image.onerror = () => {
      URL.revokeObjectURL(sourcePreviewUrl);
      resolve(null);
    };
    image.src = sourcePreviewUrl;
  });
}

async function addImages(files) {
  if (state.isConverting || state.isLoading || files.length === 0) return;

  const validFiles = [];
  for (const file of files) {
    if (isSystemMetadataFile(file)) continue;
    if (!isSupportedImage(file)) {
      addImportError(file.name, 'Formato non supportato. Scegli un file JPG, PNG o WebP.');
    } else if (file.size > MAX_FILE_SIZE) {
      addImportError(file.name, 'Il file supera il limite di 30 MB e non è stato aggiunto.');
    } else {
      validFiles.push(file);
    }
  }

  if (validFiles.length === 0) {
    render();
    return;
  }

  state.isLoading = true;
  uploadStatus.textContent = `Lettura di ${validFiles.length} ${validFiles.length === 1 ? 'immagine' : 'immagini'}…`;
  render();
  uploadProgress.hidden = false;
  uploadProgress.textContent = `Lettura di ${validFiles.length} ${validFiles.length === 1 ? 'immagine' : 'immagini'}…`;

  try {
    const decodedImages = await Promise.all(validFiles.map(decodeImage));
    const newItems = [];
    decodedImages.forEach((decoded, index) => {
      if (!decoded) {
        addImportError(validFiles[index].name, 'Immagine non leggibile. Scegli un’altra versione del file.');
        return;
      }
      newItems.push({
        id: state.nextItemId++,
        file: decoded.file,
        image: decoded.image,
        sourcePreviewUrl: decoded.sourcePreviewUrl,
        outputPreviewUrl: null,
        status: 'queued',
        blob: null,
        outputName: null,
        error: null,
        width: null,
        height: null,
        mode: null,
        isStale: false,
      });
    });
    state.selectedItems.push(...newItems);
    if (state.activeItemId === null && newItems.length) state.activeItemId = newItems[0].id;
    uploadStatus.textContent = newItems.length
      ? `${newItems.length} ${newItems.length === 1 ? 'immagine aggiunta' : 'immagini aggiunte'} al lotto.`
      : 'Nessuna immagine valida è stata aggiunta.';
  } finally {
    state.isLoading = false;
    uploadProgress.hidden = true;
    render();
  }
}

function computeCenteredCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = targetWidth / scale;
  const height = targetHeight / scale;
  return {
    x: (sourceWidth - width) / 2,
    y: (sourceHeight - height) / 2,
    width,
    height,
  };
}

function getResizeOptions() {
  if (state.resizeMode === 'exact') {
    const width = Number.parseInt(targetWidthInput.value, 10);
    const height = Number.parseInt(targetHeightInput.value, 10);
    if (!Number.isInteger(width) || width < 1 || width > MAX_DIMENSION || !Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
      return { error: 'Inserisci larghezza e altezza tra 1 e 20.000 px.', target: targetWidthInput };
    }
    return { mode: 'exact', width, height };
  }

  const side = Number.parseInt(maxSideInput.value, 10);
  if (!Number.isInteger(side) || side < 1 || side > MAX_DIMENSION) {
    return { error: 'Inserisci un lato massimo tra 1 e 20.000 px.', target: maxSideInput };
  }
  return { mode: 'max-side', side };
}

function getOutputDimensions(item, resizeOptions = getResizeOptions()) {
  if (!resizeOptions || resizeOptions.error || !item?.image) return null;
  if (resizeOptions.mode === 'exact') return { width: resizeOptions.width, height: resizeOptions.height };
  const sourceWidth = item.image.naturalWidth;
  const sourceHeight = item.image.naturalHeight;
  const scale = Math.min(1, resizeOptions.side / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function convertOne(item, resizeOptions, quality) {
  return new Promise((resolve) => {
    const sourceWidth = item.image.naturalWidth;
    const sourceHeight = item.image.naturalHeight;
    const outputSize = getOutputDimensions(item, resizeOptions);
    if (!outputSize) {
      item.error = 'Dimensioni di uscita non valide.';
      resolve();
      return;
    }

    const { width, height } = outputSize;
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
      const crop = computeCenteredCrop(sourceWidth, sourceHeight, width, height);
      context.drawImage(item.image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    } else {
      context.drawImage(item.image, 0, 0, width, height);
    }

    try {
      canvas.toBlob((blob) => {
        if (!blob || blob.type !== 'image/webp') {
          item.error = 'Esportazione WebP non supportata da questo browser.';
        } else {
          if (item.outputPreviewUrl) URL.revokeObjectURL(item.outputPreviewUrl);
          item.blob = blob;
          item.outputPreviewUrl = URL.createObjectURL(blob);
          item.outputName = null;
          item.width = width;
          item.height = height;
          item.mode = resizeOptions.mode;
          item.error = null;
          item.isStale = false;
        }
        canvas.width = 0;
        canvas.height = 0;
        resolve();
      }, 'image/webp', quality);
    } catch {
      item.error = 'Il browser non è riuscito a creare il file WebP.';
      canvas.width = 0;
      canvas.height = 0;
      resolve();
    }
  });
}

function makeUniqueName(item, usedNames) {
  const baseName = item.file.name.replace(/\.[^.]+$/, '');
  const dimensions = item.mode === 'exact'
    ? `${item.width}x${item.height}px`
    : `${Math.max(item.width, item.height)}px`;
  let name = `${baseName}-${dimensions}.webp`;
  let duplicate = 2;
  while (usedNames.has(name.toLowerCase())) name = `${baseName}-${duplicate++}-${dimensions}.webp`;
  usedNames.add(name.toLowerCase());
  return name;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getActiveItem() {
  return state.selectedItems.find((item) => item.id === state.activeItemId) || null;
}

function renderImportErrors() {
  importErrorsElement.replaceChildren();
  importErrorsElement.hidden = state.importErrors.length === 0;
  state.importErrors.forEach((error) => {
    const row = document.createElement('div');
    row.className = 'import-error-row';
    const copy = document.createElement('div');
    copy.className = 'import-error-copy';
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '!';
    const message = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = error.fileName;
    message.append(name, document.createTextNode(` — ${error.message}`));
    copy.append(icon, message);
    const actions = document.createElement('div');
    actions.className = 'import-error-actions';
    const replace = document.createElement('button');
    replace.type = 'button';
    replace.textContent = 'Scegli un altro file';
    replace.addEventListener('click', () => fileInput.click());
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Ignora';
    dismiss.setAttribute('aria-label', `Ignora l’avviso per ${error.fileName}`);
    dismiss.addEventListener('click', () => removeImportError(error.id));
    actions.append(replace, dismiss);
    row.append(copy, actions);
    importErrorsElement.append(row);
  });
}

function renderStrip() {
  const items = state.selectedItems;
  fileCount.hidden = items.length === 0;
  clearFilesButton.hidden = items.length === 0;
  fileCount.textContent = `${items.length} ${items.length === 1 ? 'immagine' : 'immagini'} ${items.length === 1 ? 'aggiunta' : 'nel lotto'}`;
  appliesCount.textContent = items.length ? `Comune a ${items.length} ${items.length === 1 ? 'immagine' : 'immagini'}` : 'Comune a tutte le immagini';
  fileStripWrap.hidden = items.length === 0;
  fileStrip.replaceChildren();
  const completeCount = items.filter((item) => item.status === 'complete' && !item.isStale).length;
  const processingCount = items.filter((item) => item.status === 'processing').length;
  const queuedCount = items.filter((item) => item.status === 'queued').length;
  const errorCount = items.filter((item) => item.status === 'error').length;
  stripCount.textContent = items.length ? `· ${items.length} ${items.length === 1 ? 'immagine' : 'immagini'}` : '';
  stripStatus.textContent = items.length
    ? [completeCount ? `${completeCount} pronte` : '', processingCount ? `${processingCount} in corso` : '', queuedCount ? `${queuedCount} in coda` : '', errorCount ? `${errorCount} non riuscite` : ''].filter(Boolean).join(' · ')
    : '';

  items.forEach((item) => {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'file-chip';
    itemContainer.setAttribute('role', 'listitem');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'file-chip-button';
    button.dataset.itemId = String(item.id);
    button.setAttribute('aria-pressed', String(item.id === state.activeItemId));
    button.setAttribute('aria-label', `${getDisplayName(item)}, ${getStatusLabel(item)}. Mostra anteprima`);
    button.dataset.status = item.isStale ? 'stale' : item.status;
    const image = document.createElement('img');
    image.src = item.sourcePreviewUrl;
    image.alt = '';
    image.loading = 'lazy';
    const name = document.createElement('span');
    name.className = 'file-chip-name';
    name.textContent = item.file.name;
    const status = document.createElement('span');
    status.className = 'file-chip-status';
    status.textContent = getStatusLabel(item);
    button.append(image, name, status);
      button.addEventListener('click', () => {
      state.activeItemId = item.id;
      renderPreview();
      fileStrip.querySelectorAll('.file-chip-button').forEach((stripButton) => {
        stripButton.setAttribute('aria-pressed', String(Number(stripButton.dataset.itemId) === item.id));
      });
    });
    itemContainer.append(button);
    fileStrip.append(itemContainer);
  });
}

function getStatusLabel(item) {
  if (item.isStale) return 'Da aggiornare';
  if (item.status === 'complete') return 'WebP pronto';
  if (item.status === 'processing') return 'In conversione';
  if (item.status === 'error') return 'Non riuscita';
  return 'In coda';
}

function getActiveResizeOptions() {
  return getResizeOptions();
}

function renderPreview() {
  const item = getActiveItem();
  const resizeOptions = getActiveResizeOptions();
  previewEmpty.hidden = Boolean(item);
  previewStage.hidden = !item;
  activeFileBadge.hidden = !item;
  cropDescription.hidden = !item || (resizeOptions.mode !== 'exact' && !resizeOptions.error);
  previewDimensions.hidden = !item;

  if (!item) {
    activeFileMeta.textContent = 'Scegli un’immagine per iniziare';
    activeFileBadge.textContent = '';
    cropWindow.hidden = true;
    cropFormatLabel.hidden = true;
    cropKeptLabel.hidden = true;
    cropExcludedLabel.hidden = true;
    cropDescription.textContent = '';
    previewDimensions.textContent = '';
    return;
  }

  activePreviewImage.src = item.sourcePreviewUrl;
  activePreviewImage.alt = `Anteprima di ${getDisplayName(item)}`;
  activeFileMeta.textContent = `${formatDimensions(item.image.naturalWidth, item.image.naturalHeight)} · ${formatBytes(item.file.size)} originali`;
  activeFileBadge.textContent = getExtension(item.file);

  if (resizeOptions.error) {
    previewDimensions.textContent = 'Correggi le dimensioni per vedere l’uscita prevista.';
    cropDescription.hidden = resizeOptions.mode !== 'exact';
    cropDescription.textContent = resizeOptions.mode === 'exact'
      ? 'Inserisci larghezza e altezza tra 1 e 20.000 px.'
      : 'Inserisci un lato massimo tra 1 e 20.000 px.';
    cropWindow.hidden = true;
    cropFormatLabel.hidden = true;
    cropKeptLabel.hidden = true;
    cropExcludedLabel.hidden = true;
    return;
  }

  const outputSize = getOutputDimensions(item, resizeOptions);
  previewDimensions.textContent = `Dimensioni WebP previste · ${formatDimensions(outputSize.width, outputSize.height)}`;
  if (resizeOptions.mode !== 'exact') {
    cropWindow.hidden = true;
    cropFormatLabel.hidden = true;
    cropKeptLabel.hidden = true;
    cropExcludedLabel.hidden = true;
    cropDescription.textContent = '';
    return;
  }

  const crop = computeCenteredCrop(item.image.naturalWidth, item.image.naturalHeight, outputSize.width, outputSize.height);
  const hasCrop = crop.width < item.image.naturalWidth - 0.5 || crop.height < item.image.naturalHeight - 0.5;
  const formattedTarget = formatDimensions(outputSize.width, outputSize.height);
  cropFormatLabel.textContent = `FORMATO ${outputSize.width} × ${outputSize.height}`;
  cropWindow.hidden = !hasCrop;
  cropFormatLabel.hidden = !hasCrop;
  cropKeptLabel.hidden = !hasCrop;
  cropExcludedLabel.hidden = !hasCrop;
  const cropTitle = document.createElement('strong');
  cropTitle.textContent = 'Ritaglio centrale.';
  cropDescription.replaceChildren(
    cropTitle,
    document.createTextNode(hasCrop
      ? ' Le fasce scure saranno escluse. L’inquadratura non si può riposizionare.'
      : ' Questa immagine ha già il rapporto scelto: i bordi restano interi.'),
  );
  cropDescription.setAttribute('aria-label', hasCrop ? `Ritaglio centrale per ${formattedTarget}. Le fasce esterne vengono escluse.` : `Nessun ritaglio necessario per ${formattedTarget}.`);
  updateCropOverlay(item, crop, hasCrop);
}

function updateCropOverlay(item = getActiveItem(), crop = null, hasCrop = true) {
  if (!item || !crop || !hasCrop || previewStage.hidden) return;
  const stageRect = previewStage.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return;

  const sourceWidth = item.image.naturalWidth;
  const sourceHeight = item.image.naturalHeight;
  const scale = Math.min(stageRect.width / sourceWidth, stageRect.height / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const imageLeft = (stageRect.width - renderedWidth) / 2;
  const imageTop = (stageRect.height - renderedHeight) / 2;
  cropWindow.style.left = `${((imageLeft + crop.x * scale) / stageRect.width) * 100}%`;
  cropWindow.style.top = `${((imageTop + crop.y * scale) / stageRect.height) * 100}%`;
  cropWindow.style.width = `${(crop.width * scale / stageRect.width) * 100}%`;
  cropWindow.style.height = `${(crop.height * scale / stageRect.height) * 100}%`;
}

function renderSettings() {
  const isExact = state.resizeMode === 'exact';
  document.querySelector('#max-side-settings').hidden = isExact;
  document.querySelector('#exact-size-settings').hidden = !isExact;
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === state.resizeMode));
  });
  const selectedWidth = Number.parseInt(targetWidthInput.value, 10);
  const selectedHeight = Number.parseInt(targetHeightInput.value, 10);
  document.querySelectorAll('.preset-button').forEach((button) => {
    const selected = isExact && Number(button.dataset.width) === selectedWidth && Number(button.dataset.height) === selectedHeight;
    button.setAttribute('aria-pressed', String(selected));
  });
  qualityValue.value = `${qualityInput.value}%`;
  qualityValue.textContent = `${qualityInput.value}%`;
  const controlsDisabled = state.isConverting || state.isLoading;
  [fileInput, folderInput, folderPickButton, dropZone, emptyAddButton, maxSideInput, targetWidthInput, targetHeightInput, qualityInput, clearFilesButton].forEach((control) => {
    if (control) control.disabled = controlsDisabled;
  });
  document.querySelectorAll('.mode-button, .preset-button, .item-action').forEach((button) => {
    button.disabled = controlsDisabled;
  });
  document.querySelector('#clear-files')?.setAttribute('aria-disabled', String(controlsDisabled));
  const itemsCount = state.selectedItems.length;
  convertButton.disabled = itemsCount === 0 || state.isConverting || state.isLoading;
  convertButton.querySelector('span').textContent = state.isConverting
    ? `Conversione ${state.conversionCurrentIndex} di ${state.conversionTotal}…`
    : itemsCount
      ? `Converti ${itemsCount} ${itemsCount === 1 ? 'immagine' : 'immagini'} in WebP`
      : 'Converti in WebP';
  if (state.isConverting) conversionStatus.textContent = `Un file alla volta: ${state.conversionCurrentIndex} di ${state.conversionTotal} in conversione.`;
  else if (itemsCount === 0) conversionStatus.textContent = 'Aggiungi immagini per avviare la conversione.';
  else if (state.selectedItems.some((item) => item.isStale)) conversionStatus.textContent = 'Le impostazioni sono cambiate. Converti di nuovo per aggiornare i risultati.';
  else conversionStatus.textContent = `${itemsCount} ${itemsCount === 1 ? 'immagine pronta' : 'immagini pronte'} per la conversione.`;
}

function getSavings(originalBytes, outputBytes) {
  const delta = originalBytes - outputBytes;
  const percentage = originalBytes > 0 ? Math.round(Math.abs(delta) / originalBytes * 100) : 0;
  return { delta, percentage };
}

function renderResults() {
  const items = state.selectedItems;
  const completedItems = items.filter((item) => item.status === 'complete' && item.blob);
  const errorItems = items.filter((item) => item.status === 'error');
  const processingItems = items.filter((item) => item.status === 'processing');
  const queuedItems = items.filter((item) => item.status === 'queued');
  const hasResultState = state.isConverting || items.some((item) => item.status === 'complete' || item.status === 'error');
  resultSection.hidden = !items.length || !hasResultState;
  resultSection.setAttribute('aria-busy', String(state.isConverting));
  staleWarning.hidden = !items.some((item) => item.isStale && item.blob);
  staleWarning.textContent = staleWarning.hidden ? '' : 'Le impostazioni sono cambiate. I file WebP già pronti restano scaricabili; converti di nuovo per aggiornarli.';

  const summaryParts = [];
  if (completedItems.length) summaryParts.push(`${completedItems.length} ${completedItems.length === 1 ? 'file pronto' : 'file pronti'}`);
  if (processingItems.length) summaryParts.push(`${processingItems.length} in corso`);
  if (queuedItems.length) summaryParts.push(`${queuedItems.length} in coda`);
  if (errorItems.length) summaryParts.push(`${errorItems.length} non ${errorItems.length === 1 ? 'riuscito' : 'riusciti'}`);
  document.querySelector('#results-summary').textContent = summaryParts.join(' · ');

  const totalOriginalBytes = completedItems.reduce((sum, item) => sum + item.file.size, 0);
  const totalOutputBytes = completedItems.reduce((sum, item) => sum + item.blob.size, 0);
  batchSavings.hidden = completedItems.length === 0;
  batchSavings.replaceChildren();
  if (completedItems.length) {
    const { delta, percentage } = getSavings(totalOriginalBytes, totalOutputBytes);
    const headline = document.createElement('strong');
    headline.textContent = delta >= 0 ? `${formatBytes(delta)} risparmiati nel lotto` : `${formatBytes(Math.abs(delta))} in più nel lotto`;
    const figures = document.createElement('span');
    figures.className = 'savings-figures';
    figures.textContent = `${formatBytes(totalOriginalBytes)} originali → ${formatBytes(totalOutputBytes)} WebP`;
    const percent = document.createElement('span');
    percent.className = 'savings-percent';
    percent.textContent = delta >= 0 ? `−${percentage}% di peso` : `+${percentage}% di peso`;
    batchSavings.append(headline, figures, percent);
  }

  const successful = completedItems;
  const zipAvailable = typeof window.fflate?.zipSync === 'function';
  downloadAllButton.hidden = successful.length < 2;
  downloadAllButton.disabled = successful.length < 2 || !zipAvailable || state.isConverting;
  downloadAllButton.textContent = successful.length > 1 ? `Scarica lotto ZIP · ${successful.length} file` : '';
  zipNote.hidden = successful.length < 2 || zipAvailable;
  zipNote.textContent = zipNote.hidden ? '' : 'ZIP non disponibile in questa sessione. I download singoli restano disponibili.';

  resultsList.replaceChildren();
  const usedNames = new Set();
  items.forEach((item) => {
    if (item.status === 'complete' && item.blob) item.outputName = makeUniqueName(item, usedNames);
    const row = document.createElement('article');
    row.className = 'result-item';
    row.dataset.status = item.status;
    row.setAttribute('role', 'listitem');
    const thumb = document.createElement('div');
    thumb.className = 'result-thumb';
    if (item.outputPreviewUrl) {
      const image = document.createElement('img');
      image.src = item.outputPreviewUrl;
      image.alt = '';
      image.loading = 'lazy';
      thumb.append(image);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'result-thumb-placeholder';
      placeholder.textContent = getExtension(item.file);
      thumb.append(placeholder);
    }

    const data = document.createElement('div');
    data.className = 'result-data';
    const fileLine = document.createElement('div');
    fileLine.className = 'result-file-line';
    const name = document.createElement('strong');
    name.className = 'result-file-name';
    name.textContent = item.status === 'complete' && item.blob ? item.outputName : item.file.name;
    const status = document.createElement('span');
    status.className = 'result-state';
    status.dataset.status = item.status;
    status.textContent = item.isStale && item.blob ? 'WebP pronto · da aggiornare' : getStatusLabel(item);
    fileLine.append(name, status);
    const meta = document.createElement('p');
    meta.className = 'result-file-meta';
    meta.textContent = `${formatDimensions(item.image.naturalWidth, item.image.naturalHeight)} originali · ${formatBytes(item.file.size)}`;
    data.append(fileLine, meta);

    const compare = document.createElement('div');
    compare.className = 'result-compare';
    const isComplete = item.status === 'complete' && item.blob;
    compare.hidden = !isComplete;
    let message = null;
    if (isComplete) {
      const savings = getSavings(item.file.size, item.blob.size);
      const before = document.createElement('strong');
      before.textContent = formatBytes(item.file.size);
      const arrow = document.createTextNode(' → ');
      const after = document.createElement('strong');
      after.textContent = formatBytes(item.blob.size);
      compare.append(before, arrow, after);
      const change = document.createElement('span');
      change.className = `result-change${savings.delta < 0 ? ' is-larger' : ''}`;
      change.textContent = `${savings.delta >= 0 ? '−' : '+'}${savings.percentage}% ${savings.delta >= 0 ? 'in meno' : 'in più'}`;
      compare.append(document.createElement('br'), change, document.createTextNode(` · ${formatDimensions(item.width, item.height)}`));
    } else {
      message = document.createElement('p');
      message.className = 'result-message';
      if (item.status === 'processing') message.textContent = 'Conversione del file in corso…';
      else if (item.status === 'error') message.textContent = item.error || 'Conversione non riuscita. Puoi riprovare.';
      else message.textContent = 'In coda · sarà convertita con le stesse impostazioni.';
    }

    const actions = document.createElement('div');
    actions.className = 'result-actions';
    if (item.status === 'complete' && item.blob) {
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'item-download';
      download.textContent = `↓ Scarica ${item.file.name.replace(/\.[^.]+$/, '')}.webp`;
      download.setAttribute('aria-label', `Scarica ${item.outputName}`);
      download.addEventListener('click', () => downloadBlob(item.blob, item.outputName));
      actions.append(download);
    } else if (item.status === 'error') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'item-action';
      retry.textContent = 'Riprova';
      retry.disabled = state.isConverting || state.isLoading;
      retry.addEventListener('click', () => convertImages([item.id]));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'item-action is-danger';
      remove.textContent = 'Rimuovi';
      remove.disabled = state.isConverting || state.isLoading;
      remove.setAttribute('aria-label', `Rimuovi ${item.file.name} dal lotto`);
      remove.addEventListener('click', () => removeImage(item.id));
      actions.append(retry, remove);
    } else if (item.status === 'processing') {
      const position = document.createElement('span');
      position.className = 'result-file-meta';
      position.textContent = `${state.conversionCurrentIndex} di ${state.conversionTotal}`;
      actions.append(position);
    }

    row.append(thumb, data, compare);
    if (message) row.append(message);
    row.append(actions);
    resultsList.append(row);
  });
}

function render() {
  renderImportErrors();
  renderSettings();
  renderPreview();
  renderStrip();
  renderResults();
  if (uploadProgress) {
    uploadProgress.hidden = !state.isLoading;
    if (state.isLoading) uploadProgress.textContent = 'Lettura delle immagini selezionate…';
  }
}

function updateSettingsAfterChange() {
  if (state.isConverting) return;
  settingsError.hidden = true;
  markCompletedItemsStale();
  renderSettings();
  renderPreview();
  renderStrip();
  renderResults();
}

async function convertImages(itemIds = state.selectedItems.map((item) => item.id)) {
  if (state.isConverting || state.isLoading || !state.selectedItems.length) return;
  settingsError.hidden = true;
  const resizeOptions = getResizeOptions();
  if (resizeOptions.error) {
    settingsError.textContent = resizeOptions.error;
    settingsError.hidden = false;
    resizeOptions.target.focus();
    return;
  }

  const selectedIds = new Set(itemIds);
  const itemsToConvert = state.selectedItems.filter((item) => selectedIds.has(item.id));
  if (!itemsToConvert.length) return;

  state.isConverting = true;
  state.conversionCurrentIndex = 0;
  state.conversionTotal = itemsToConvert.length;
  itemsToConvert.forEach((item) => {
    if (item.outputPreviewUrl) URL.revokeObjectURL(item.outputPreviewUrl);
    item.outputPreviewUrl = null;
    item.blob = null;
    item.outputName = null;
    item.width = null;
    item.height = null;
    item.error = null;
    item.status = 'queued';
  });
  render();

  for (const [index, item] of itemsToConvert.entries()) {
    state.conversionCurrentIndex = index + 1;
    item.status = 'processing';
    state.activeItemId = item.id;
    render();
    try {
      await convertOne(item, resizeOptions, Number(qualityInput.value) / 100);
      item.status = item.error ? 'error' : 'complete';
    } catch {
      item.error = 'Conversione non riuscita. Riprova con un’altra versione del file.';
      item.status = 'error';
    }
    render();
  }

  state.isConverting = false;
  state.conversionCurrentIndex = 0;
  state.conversionTotal = 0;
  const readyCount = state.selectedItems.filter((item) => item.status === 'complete').length;
  const errorCount = state.selectedItems.filter((item) => item.status === 'error').length;
  conversionStatus.textContent = errorCount
    ? `${readyCount} ${readyCount === 1 ? 'file pronto' : 'file pronti'} · ${errorCount} ${errorCount === 1 ? 'conversione non riuscita' : 'conversioni non riuscite'}. Puoi riprovare o rimuovere i file con errori.`
    : `${readyCount} ${readyCount === 1 ? 'file WebP pronto' : 'file WebP pronti'} da scaricare.`;
  render();
  if (readyCount) resultSection.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

async function downloadAll() {
  const successful = state.selectedItems.filter((item) => item.status === 'complete' && item.blob);
  if (successful.length === 0) return;
  if (!window.fflate?.zipSync) {
    zipNote.hidden = false;
    zipNote.textContent = 'ZIP non disponibile in questa sessione. I download singoli restano disponibili.';
    return;
  }
  try {
    const archiveFiles = {};
    const usedNames = new Set();
    for (const item of successful) {
      const filename = item.outputName || makeUniqueName(item, usedNames);
      archiveFiles[filename] = new Uint8Array(await item.blob.arrayBuffer());
    }
    const archive = window.fflate.zipSync(archiveFiles, { level: 0 });
    downloadBlob(new Blob([archive], { type: 'application/zip' }), 'piccola-pressa-webp.zip');
  } catch {
    zipNote.hidden = false;
    zipNote.textContent = 'Non è stato possibile creare lo ZIP. I download singoli restano disponibili.';
  }
}

function handleDrop(event) {
  event.preventDefault();
  dropZone.classList.remove('is-over');
  filesFromDrop(event.dataTransfer).then((files) => addImages(files)).catch(() => {
    addImportError('Cartella', 'Non è stato possibile leggere il contenuto. Prova a selezionare di nuovo i file.');
    render();
  });
}

fileInput.addEventListener('change', (event) => {
  addImages(Array.from(event.target.files || []));
  event.target.value = '';
});
folderInput.addEventListener('change', (event) => {
  addImages(Array.from(event.target.files || []));
  event.target.value = '';
});
folderPickButton.hidden = !('webkitdirectory' in document.createElement('input'));
folderPickButton.addEventListener('click', () => folderInput.click());
dropZone.addEventListener('click', () => fileInput.click());
emptyAddButton.addEventListener('click', () => fileInput.click());
function hasDraggedFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function bindFileDropTarget(target, onDragStateChange = () => {}) {
  target.addEventListener('dragenter', (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    target.classList.add('is-over');
    onDragStateChange(true);
  });
  target.addEventListener('dragover', (event) => {
    if (hasDraggedFiles(event)) event.preventDefault();
  });
  target.addEventListener('dragleave', (event) => {
    if (!hasDraggedFiles(event)) return;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    target.classList.remove('is-over');
    onDragStateChange(false);
  });
  target.addEventListener('drop', (event) => {
    if (!hasDraggedFiles(event)) return;
    target.classList.remove('is-over');
    onDragStateChange(false);
    handleDrop(event);
  });
}

bindFileDropTarget(uploadPanel, (isOver) => dropZone.classList.toggle('is-over', isOver));
bindFileDropTarget(previewPanel);

maxSideInput.addEventListener('input', updateSettingsAfterChange);
targetWidthInput.addEventListener('input', updateSettingsAfterChange);
targetHeightInput.addEventListener('input', updateSettingsAfterChange);
qualityInput.addEventListener('input', updateSettingsAfterChange);
document.querySelectorAll('.mode-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.isConverting || state.isLoading) return;
    state.resizeMode = button.dataset.mode;
    updateSettingsAfterChange();
  });
});
document.querySelectorAll('.preset-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.isConverting || state.isLoading) return;
    targetWidthInput.value = button.dataset.width;
    targetHeightInput.value = button.dataset.height;
    state.resizeMode = 'exact';
    updateSettingsAfterChange();
  });
});
convertButton.addEventListener('click', () => convertImages());
clearFilesButton.addEventListener('click', clearFiles);
downloadAllButton.addEventListener('click', downloadAll);

const cropResizeObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(() => renderPreview())
  : null;
if (cropResizeObserver) cropResizeObserver.observe(previewStage);
window.addEventListener('resize', () => renderPreview());
window.addEventListener('beforeunload', () => state.selectedItems.forEach(revokeItemUrls));

render();
