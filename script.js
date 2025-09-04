const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("patternCanvas");
const ctx = canvas.getContext("2d");
const ruler = document.getElementById("ruler");
const highlight = document.getElementById("highlight");
const stepInput = document.getElementById("stepInput");
const rowInfo = document.getElementById("rowInfo");

let img = new Image();
let imgWidth = 0, imgHeight = 0;
let currentRow = 1;
let step = parseInt(stepInput.value);
let imgOffsetX = 0, imgOffsetY = 0;
let currentProjectIndex = null;

// Калібровка
let calibrationStart = null;
let isCalibrating = false;

// забороняємо подвійний клік
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

// забороняємо жести масштабування
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

// забороняємо wheel zoom з Ctrl/Cmd
document.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
  }
}, { passive: false });

document.getElementById("startCalibration").onclick = () => {
  calibrationStart = parseInt(ruler.style.left) || 0;
  isCalibrating = true;
  document.getElementById("startCalibration").style.display = "none";
  document.getElementById("endCalibration").style.display = "inline-block";
  alert("Калібровка розпочата. Перемістіть лінійку в кінцеву позицію і натисніть 'Кінець калібровки'");
};

document.getElementById("endCalibration").onclick = () => {
  if (!isCalibrating || calibrationStart === null) return;

  const calibrationEnd = parseInt(ruler.style.left) || 0;
  const pixelDistance = Math.abs(calibrationEnd - calibrationStart);

  const columns = prompt("Скільки стовпчиків між початковою і кінцевою позицією?");
  if (!columns || isNaN(columns) || parseInt(columns) <= 0) {
    alert("Введіть коректну кількість стовпчиків");
    return;
  }

  const newStep = pixelDistance / parseInt(columns);
  step = newStep;
  stepInput.value = newStep.toFixed(1);

  // перерахуємо поточний рядок з новим кроком
  const currentLeft = parseInt(ruler.style.left) || imgOffsetX;
  currentRow = Math.floor((currentLeft - imgOffsetX) / step) + 1;

  // Скидання калібровки
  isCalibrating = false;
  calibrationStart = null;
  document.getElementById("startCalibration").style.display = "inline-block";
  document.getElementById("endCalibration").style.display = "none";

    updateRuler();
  alert(`Калібровка завершена! Новий крок: ${newStep.toFixed(1)} px`);
};

// ========== Завантаження картинки або PDF ==========
fileInput.addEventListener("change", e => {
  currentProjectIndex = null;
  document.getElementById("updateProject").disabled = true;

  const file = e.target.files[0];
  if (!file) return;

  if (file.type === "application/pdf") {
    const reader = new FileReader();
    reader.onload = function() {
      const typedarray = new Uint8Array(this.result);
      pdfjsLib.getDocument(typedarray).promise.then(pdf => {
        pdf.getPage(1).then(page => {
          const viewport = page.getViewport({ scale: 2 });
          const pdfCanvas = document.createElement("canvas");
          const ctx2 = pdfCanvas.getContext("2d");
          pdfCanvas.width = viewport.width;
          pdfCanvas.height = viewport.height;

          page.render({ canvasContext: ctx2, viewport }).promise.then(() => {
  img.onload = () => {
    fitToScreen(img);
    drawImage();
              currentRow = 1;
    updateRuler();
  };
            img.src = pdfCanvas.toDataURL();
          });
        });
      });
};
    reader.readAsArrayBuffer(file);
    return;
  }

  // зображення
  const reader = new FileReader();
  reader.onload = ev => {
    img.onload = () => {
      fitToScreen(img);
      drawImage();
      currentRow = 1;
      updateRuler();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ========== Масштабування картинки ==========
function fitToScreen(img) {
  const container = document.getElementById("canvasContainer");
  const maxW = container.clientWidth - 40; // віднімаємо padding
  const maxH = container.clientHeight - 40;

  // дозволяємо картинці бути більшою за екран
  const scale = Math.min(maxW / img.width, maxH / img.height, 2); // максимальний початковий масштаб 2x
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  imgWidth = canvas.width;
  imgHeight = canvas.height;

  // центруємо без жорстких обмежень
  canvas.style.marginLeft = "0";
  canvas.style.marginTop = "0";

  // оновлюємо offset для позиціонування лінійки
  const containerRect = container.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  imgOffsetX = canvasRect.left - containerRect.left;
  imgOffsetY = canvasRect.top - containerRect.top;
}
function drawImage() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// ========== Лінійка ==========
function updateRuler() {
  const left = imgOffsetX + (currentRow - 1) * step;
  ruler.style.left = left + "px";
  highlight.style.left = left + "px";
  highlight.style.width = step + "px";

  rowInfo.textContent = `Рядок: ${currentRow}`;
  updateBlurMask();
}

function moveRulerTo(left) {
  const minLeft = imgOffsetX;
  const maxLeft = imgOffsetX + imgWidth;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  ruler.style.left = left + "px";
  highlight.style.left = left + "px";
  highlight.style.width = step + "px";

  // перерахуємо currentRow на основі реальної позиції
  currentRow = Math.floor((left - imgOffsetX) / step) + 1;
  rowInfo.textContent = `Рядок: ${currentRow}`;

  updateBlurMask();
}

function updateBlurMask() {
  const rulerLeft = parseInt(ruler.style.left) || 0;
  const containerRect = document.getElementById("canvasContainer").getBoundingClientRect();
  const relativeLeft = rulerLeft - containerRect.left;
  document.documentElement.style.setProperty('--ruler-left', relativeLeft + 'px');
  document.documentElement.style.setProperty('--ruler-width', step + 'px');
}

stepInput.onchange = () => {
  step = parseFloat(stepInput.value);
    updateRuler();
};

// перетягування лінійки
let dragging = false;
let freePositioning = false;

const rulerElements = [ruler, document.getElementById("rulerTouchArea")];

rulerElements.forEach(element => {
  if (!element) return;
  element.addEventListener("mousedown", e => {
  dragging = true;
  freePositioning = true;
  e.preventDefault();
});

  element.addEventListener("touchstart", e => {
    dragging = true;
    freePositioning = true;
    e.preventDefault();
});
});

document.addEventListener("mouseup", () => {
  if(dragging) {
    dragging = false;
    if (!freePositioning && !isCalibrating) {
      snapToGrid();
    }
    freePositioning = false;
  }
});

document.addEventListener("mousemove", e => { if(dragging) moveRulerTo(e.clientX); });

document.addEventListener("touchend", () => {
  if(dragging) {
    dragging = false;
    if (!freePositioning && !isCalibrating) {
      snapToGrid();
    }
    freePositioning = false;
  }
});

document.addEventListener("touchmove", e => { if(dragging) moveRulerTo(e.touches[0].clientX); });

// клік по контейнеру для позиціонування лінійки
/*
document.getElementById("canvasContainer").addEventListener("click", e => {
  if (!dragging) {
    const clickX = e.clientX;
    moveRulerTo(clickX);
  }
});
*/

// тач для мобільних
/*
document.getElementById("canvasContainer").addEventListener("touchstart", e => {
  if (e.target === e.currentTarget || e.target === canvas) {
    const touch = e.touches[0];
    moveRulerTo(touch.clientX);
    e.preventDefault();
  }
});
*/

// кнопки навігації
document.getElementById("prevRow").onclick = () => {
  if (currentRow > 1) {
    currentRow--;
    updateRuler();
  }
  };

document.getElementById("nextRow").onclick = () => {
  // розраховуємо максимальний рядок динамічно
  const currentLeft = imgOffsetX + (currentRow - 1) * step;
  const nextLeft = imgOffsetX + currentRow * step;

  // перевіряємо чи наступна позиція не виходить за межі картинки
  if (nextLeft <= imgOffsetX + imgWidth) {
    currentRow++;
    updateRuler();
  }
};

function snapToGrid() {
  const left = parseInt(ruler.style.left) || 0;
  const snappedRow = Math.round((left - imgOffsetX) / step);
  const snappedLeft = imgOffsetX + snappedRow * step;
  currentRow = Math.max(1, snappedRow + 1);
  moveRulerTo(snappedLeft);
}

// ========== Збереження/завантаження кількох проєктів ==========
function loadProjectList() {
  const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
  const select = document.getElementById("projectList");
  select.innerHTML = `<option value="">-- Обрати проєкт --</option>`;
  projects.forEach((p,i)=>{
    const opt = document.createElement("option");
    opt.value=i;
    opt.textContent=p.name||`Проєкт ${i+1}`;
    select.appendChild(opt);
  });
}

document.getElementById("saveProject").onclick = () => {
  const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
  const name = prompt("Назва проєкту", `Проєкт ${projects.length+1}`);
  if (!name) return;
  const data = { name, imgSrc: img.src, currentRow, step };
  projects.push(data);
  localStorage.setItem("beadProjects", JSON.stringify(projects));
loadProjectList();
  alert("Проєкт збережено ✅");
};

document.getElementById("loadProject").onclick = () => {
  const select = document.getElementById("projectList");
  const idx = select.value;
  if (idx==="") return alert("Оберіть проєкт для завантаження");
  const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
  const data = projects[idx];
  if (!data) return alert("Проєкт не знайдено");

  currentProjectIndex = parseInt(idx);
  document.getElementById("updateProject").disabled = false;

  img.onload = () => {
    fitToScreen(img);
    drawImage();
    step = data.step;
    stepInput.value = step;
    currentRow = data.currentRow;
    updateRuler();
  };
  img.src = data.imgSrc;
};

document.getElementById("updateProject").onclick = () => {
  if (currentProjectIndex === null) return;

  const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
  if (!projects[currentProjectIndex]) return alert("Проєкт не знайдено");

  projects[currentProjectIndex].imgSrc = img.src;
  projects[currentProjectIndex].currentRow = currentRow;
  projects[currentProjectIndex].step = step;

  localStorage.setItem("beadProjects", JSON.stringify(projects));
loadProjectList();
  alert("Проєкт оновлено ✅");
};

// старт
loadProjectList();
