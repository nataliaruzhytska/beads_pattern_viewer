const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("patternCanvas");
const ctx = canvas.getContext("2d");
const ruler = document.getElementById("ruler");
const highlight = document.getElementById("highlight");
const stepInput = document.getElementById("stepInput");
const rowInfo = document.getElementById("rowInfo");

let img = new Image();
let imgWidth = 0, imgHeight = 0;
let rulerPosition = 0; // позиція в пікселях замість currentRow
let step = parseInt(stepInput.value);
let imgOffsetX = 0, imgOffsetY = 0;
let currentProjectIndex = null;

// Калібровка
let calibrationStart = null;
let isCalibrating = false;

// Відстеження змін
let hasUnsavedChanges = false;
let lastSavedState = null;

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

// функція для показу повідомлень
function showToast(message, type = 'success') {
  const backgroundColor = {
    success: 'linear-gradient(to right, #00b09b, #96c93d)',
    error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
    warning: 'linear-gradient(to right, #f093fb, #f5576c)',
    info: 'linear-gradient(to right, #4facfe, #00f2fe)'
  };

  Toastify({
    text: message,
    duration: 13000,
    close: true,
    gravity: "top",
    position: "right",
    backgroundColor: backgroundColor[type],
    stopOnFocus: true
  }).showToast();
}

// функція для відстеження змін
function checkForChanges() {
  if (currentProjectIndex === null) return;

  const currentState = {
    rulerPosition: rulerPosition,
    step: step
  };

  hasUnsavedChanges = JSON.stringify(currentState) !== JSON.stringify(lastSavedState);
}

// функція з обробкою помилок для localStorage
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      showToast('Недостатньо місця для збереження. Видаліть старі проєкти.', 'error');
    } else {
      showToast('Помилка збереження: ' + error.message, 'error');
    }
    return false;
  }
}

document.getElementById("startCalibration").onclick = () => {
  calibrationStart = parseInt(ruler.style.left) || 0;
  isCalibrating = true;
  document.getElementById("startCalibration").style.display = "none";
  document.getElementById("endCalibration").style.display = "inline-block";
  showToast("Калібровка розпочата. Перемістіть лінійку в кінцеву позицію", "info");
};

document.getElementById("endCalibration").onclick = () => {
  if (!isCalibrating || calibrationStart === null) return;

  const calibrationEnd = parseInt(ruler.style.left) || 0;
  const pixelDistance = Math.abs(calibrationEnd - calibrationStart);

  const columns = prompt("Скільки стовпчиків між початковою і кінцевою позицією?");
  if (!columns || isNaN(columns) || parseInt(columns) <= 0) {
    showToast("Введіть коректну кількість стовпчиків", "error");
    return;
  }

  const newStep = pixelDistance / parseInt(columns);
  step = newStep;
  stepInput.value = newStep.toFixed(1);

  // перерахуємо поточну позицію з новим кроком
  const currentLeft = parseInt(ruler.style.left) || imgOffsetX;
  rulerPosition = currentLeft - imgOffsetX;
  // Скидання калібровки
  isCalibrating = false;
  calibrationStart = null;
  document.getElementById("startCalibration").style.display = "inline-block";
  document.getElementById("endCalibration").style.display = "none";

  updateRuler();
  checkForChanges();
  showToast(`Калібровка завершена! Новий крок: ${newStep.toFixed(1)} px`);
};

// ========== Завантаження картинки або PDF ==========
fileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  if (hasUnsavedChanges && currentProjectIndex !== null) {
    if (confirm("У поточному проєкті є несохранені зміни. Зберегти їх?")) {
      try {
      const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
      if (projects[currentProjectIndex]) {
        projects[currentProjectIndex].rulerPosition = rulerPosition;
        projects[currentProjectIndex].step = step;
          if (safeSetItem("beadProjects", JSON.stringify(projects))) {
            showToast("Зміни збережено");
      }
    }
      } catch (error) {
        showToast("Помилка збереження змін: " + error.message, "error");
  }
    }
  }

  currentProjectIndex = null;
  hasUnsavedChanges = false;
  lastSavedState = null;
  document.getElementById("updateProject").disabled = true;
  document.getElementById("deleteProject").disabled = true;
  document.getElementById("projectList").value = "";

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
              rulerPosition = 0;
              step = 20; // скидаємо крок
              stepInput.value = step;
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

  // код для зображень
  const reader = new FileReader();
  reader.onload = ev => {
    img.onload = () => {
      fitToScreen(img);
      drawImage();
      rulerPosition = 0;
      step = 20; // скидаємо крок
      stepInput.value = step;
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
  const left = imgOffsetX + rulerPosition;
  ruler.style.left = left + "px";
  highlight.style.left = left + "px";
  highlight.style.width = step + "px";

  // рахуємо рядок тільки для відображення
  const displayRow = Math.floor(rulerPosition / step) + 1;
  rowInfo.textContent = `Рядок ≈ ${displayRow} (${rulerPosition.toFixed(1)}px)`;
  updateBlurMask();
}

function moveRulerTo(left) {
  const minLeft = imgOffsetX;
  const maxLeft = imgOffsetX + imgWidth;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  // зберігаємо позицію відносно початку картинки
  rulerPosition = left - imgOffsetX;

  ruler.style.left = left + "px";
  highlight.style.left = left + "px";
  highlight.style.width = step + "px";

  const displayRow = Math.floor(rulerPosition / step) + 1;
  rowInfo.textContent = `Рядок ≈ ${displayRow} (${rulerPosition.toFixed(1)}px)`;
  updateBlurMask();

  checkForChanges(); // перевіряємо зміни
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
  checkForChanges();
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

// кнопки навігації
document.getElementById("prevRow").onclick = () => {
  rulerPosition = Math.max(0, rulerPosition - step);
  updateRuler();
  checkForChanges();
};

document.getElementById("nextRow").onclick = () => {
  rulerPosition = Math.min(imgWidth, rulerPosition + step);
  updateRuler();
  checkForChanges();
};

function snapToGrid() {
  const left = parseInt(ruler.style.left) || 0;
  const snappedPosition = Math.round((left - imgOffsetX) / step) * step;
  rulerPosition = Math.max(0, snappedPosition);
  moveRulerTo(imgOffsetX + rulerPosition);
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
  if (!img.src) {
    showToast("Спочатку завантажте картинку", "warning");
    return;
  }

  const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
  const name = prompt("Назва проєкту", `Проєкт ${projects.length+1}`);
  if (!name) return;

  const data = {
    name,
    imgSrc: img.src,
      rulerPosition: rulerPosition,
    step
    };
  projects.push(data);

  if (safeSetItem("beadProjects", JSON.stringify(projects))) {
    currentProjectIndex = projects.length - 1;
  loadProjectList();
  document.getElementById("projectList").value = currentProjectIndex;
    document.getElementById("updateProject").disabled = false;
    document.getElementById("deleteProject").disabled = false;

  lastSavedState = {
    rulerPosition: rulerPosition,
    step: step
  };
  hasUnsavedChanges = false;

    showToast("Проєкт збережено ✅");
  }
};

// автозавантаження при виборі проєкту
document.getElementById("projectList").onchange = () => {
  const select = document.getElementById("projectList");
  const idx = select.value;

  if (idx === "") {
    currentProjectIndex = null;
    document.getElementById("updateProject").disabled = true;
    document.getElementById("deleteProject").disabled = true;
    return;
  }

  try {
    const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
    const data = projects[idx];
    if (!data) {
      showToast("Проєкт не знайдено", "error");
      return;
    }

    currentProjectIndex = parseInt(idx);
    document.getElementById("updateProject").disabled = false;
    document.getElementById("deleteProject").disabled = false;

    img.onload = () => {
      fitToScreen(img);
      drawImage();
      step = data.step;
      stepInput.value = step;
      rulerPosition = data.rulerPosition || 0;
      updateRuler();

      lastSavedState = {
        rulerPosition: rulerPosition,
        step: step
      };
      hasUnsavedChanges = false;

      showToast(`Проєкт "${data.name}" завантажено`);
    };

    img.onerror = () => {
      showToast("Помилка завантаження картинки проєкту", "error");
    };

    img.src = data.imgSrc;
  } catch (error) {
    showToast("Помилка завантаження проєкту: " + error.message, "error");
  }
};

document.getElementById("updateProject").onclick = () => {
  if (currentProjectIndex === null) {
    showToast("Немає завантаженого проєкту для оновлення", "warning");
    return;
  }

  try {
    const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
    if (!projects[currentProjectIndex]) {
      showToast("Проєкт не знайдено", "error");
      return;
    }

    projects[currentProjectIndex].rulerPosition = rulerPosition;
    projects[currentProjectIndex].step = step;

    if (safeSetItem("beadProjects", JSON.stringify(projects))) {
loadProjectList();
      document.getElementById("projectList").value = currentProjectIndex;

      lastSavedState = {
        rulerPosition: rulerPosition,
        step: step
      };
      hasUnsavedChanges = false;

      showToast("Проєкт оновлено ✅");
    }
  } catch (error) {
    showToast("Помилка оновлення проєкту: " + error.message, "error");
  }
};

// функція видалення проєкту
document.getElementById("deleteProject").onclick = () => {
  if (currentProjectIndex === null) {
    showToast("Немає проєкту для видалення", "warning");
    return;
  }

  try {
    const projects = JSON.parse(localStorage.getItem("beadProjects")) || [];
    const projectName = projects[currentProjectIndex]?.name || "Проєкт";

    if (confirm(`Видалити проєкт "${projectName}"?`)) {
      projects.splice(currentProjectIndex, 1);

      if (safeSetItem("beadProjects", JSON.stringify(projects))) {
        currentProjectIndex = null;
        hasUnsavedChanges = false;
        lastSavedState = null;

        loadProjectList();
        document.getElementById("projectList").value = "";
        document.getElementById("updateProject").disabled = true;
        document.getElementById("deleteProject").disabled = true;

        showToast(`Проєкт "${projectName}" видалено`);
      }
    }
  } catch (error) {
    showToast("Помилка видалення проєкту: " + error.message, "error");
  }
};

// старт
loadProjectList();
