const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const maxWidthInput = document.querySelector('#max-width');
const qualityInput = document.querySelector('#quality');
const qualityValue = document.querySelector('#quality-value');
const convertButton = document.querySelector('#convert-button');
const errorMessage = document.querySelector('#error-message');
const fileSummary = document.querySelector('#file-summary');
const resultSection = document.querySelector('#result-section');

let sourceFile = null;
let sourceImage = null;
let convertedBlob = null;
let previewUrl = null;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearResult() {
  resultSection.hidden = true;
  convertedBlob = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function clearFile() {
  sourceFile = null;
  sourceImage = null;
  fileInput.value = '';
  fileSummary.hidden = true;
  dropZone.hidden = false;
  convertButton.disabled = true;
  errorMessage.hidden = true;
  clearResult();
}

function loadImage(file) {
  errorMessage.hidden = true;
  clearResult();
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showError('Formato non supportato. Scegli un file JPG, PNG o WebP.');
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    showError('Il file supera il limite di 30 MB.');
    return;
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(imageUrl);
    sourceFile = file;
    sourceImage = image;
    document.querySelector('#file-name').textContent = file.name;
    document.querySelector('#file-details').textContent = `${image.naturalWidth} × ${image.naturalHeight} px · ${formatBytes(file.size)}`;
    fileSummary.hidden = false;
    dropZone.hidden = true;
    convertButton.disabled = false;
    errorMessage.hidden = true;
  };
  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    showError('Non riesco a leggere questa immagine. Prova con un altro file.');
  };
  image.src = imageUrl;
}

function convertImage() {
  errorMessage.hidden = true;
  const maxWidth = Number.parseInt(maxWidthInput.value, 10);
  if (!sourceImage || !sourceFile) return;
  if (!Number.isInteger(maxWidth) || maxWidth < 1 || maxWidth > 20000) {
    showError('Inserisci una larghezza massima tra 1 e 20.000 px.');
    maxWidthInput.focus();
    return;
  }

  const scale = Math.min(1, maxWidth / sourceImage.naturalWidth);
  const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    showError('Il browser non riesce ad avviare la conversione. Prova a ricaricare la pagina.');
    return;
  }
  context.drawImage(sourceImage, 0, 0, width, height);

  canvas.toBlob((blob) => {
    if (!blob || blob.type !== 'image/webp') {
      showError('Questo browser non supporta l’esportazione WebP. Prova con una versione aggiornata di Chrome, Firefox, Safari o Edge.');
      return;
    }
    convertedBlob = blob;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    const baseName = sourceFile.name.replace(/\.[^.]+$/, '');
    const outputName = `${baseName}-${width}px.webp`;
    document.querySelector('#preview-image').src = previewUrl;
    document.querySelector('#result-name').textContent = outputName;
    document.querySelector('#result-dimensions').textContent = `${width} × ${height} px`;
    document.querySelector('#original-size').textContent = formatBytes(sourceFile.size);
    document.querySelector('#result-size').textContent = formatBytes(blob.size);
    const saving = sourceFile.size ? Math.round((1 - blob.size / sourceFile.size) * 100) : 0;
    document.querySelector('#saving-label').textContent = saving >= 0 ? 'Riduzione peso' : 'Differenza peso';
    document.querySelector('#saving-value').textContent = saving >= 0 ? `${saving}%` : `+${Math.abs(saving)}%`;
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 'image/webp', Number(qualityInput.value) / 100);
}

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => loadImage(event.target.files[0]));
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
dropZone.addEventListener('drop', (event) => loadImage(event.dataTransfer.files[0]));
qualityInput.addEventListener('input', () => {
  qualityValue.value = `${qualityInput.value}%`;
  qualityValue.textContent = `${qualityInput.value}%`;
  clearResult();
});
maxWidthInput.addEventListener('input', clearResult);
convertButton.addEventListener('click', convertImage);
document.querySelector('#remove-file').addEventListener('click', clearFile);
document.querySelector('#download-button').addEventListener('click', () => {
  if (!convertedBlob || !sourceFile) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(convertedBlob);
  link.download = `${sourceFile.name.replace(/\.[^.]+$/, '')}-${document.querySelector('#result-dimensions').textContent.split(' ')[0]}px.webp`;
  link.click();
  URL.revokeObjectURL(link.href);
});
