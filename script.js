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

// ========== Завантаження картинки або PDF ==========
fileInput.addEventListener("change", e => {
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
  const maxW = container.clientWidth;
  const maxH = container.clientHeight;

  const scale = Math.min(maxW / img.width, maxH / img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  imgWidth = canvas.width;
  imgHeight = canvas.height;

  imgOffsetX = (maxW - imgWidth) / 2;
  imgOffsetY = (maxH - imgHeight) / 2;

  canvas.style.marginLeft = imgOffsetX + "px";
  canvas.style.marginTop = imgOffsetY + "px";
}

function drawImage() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// ========== Лінійка ==========
function updateRuler() {
  const left = imgOffsetX + (currentRow - 1) * step;
  moveRulerTo(left);
}

function moveRulerTo(left) {
  const minLeft = imgOffsetX;
  const maxLeft = imgOffsetX + imgWidth;
  left = Math.max(minLeft, Math.min(left, maxLeft));
  ruler.style.left = left + "px";
  highlight.style.left = left + "px";
  highlight.style.width = step + "px";
  currentRow = Math.floor((left - imgOffsetX) / step) + 1;
  rowInfo.textContent = `Рядок: ${currentRow}`;
}

// кнопки
document.getElementById("prevRow").onclick = () => { if (currentRow>1){currentRow--; updateRuler();} };
document.getElementById("nextRow").onclick = () => { currentRow++; updateRuler(); };
stepInput.onchange = () => { step = parseInt(stepInput.value); updateRuler(); };

// перетягування
let dragging = false;
ruler.addEventListener("mousedown", e => { dragging = true; e.preventDefault(); });
document.addEventListener("mouseup", () => { if(dragging){dragging=false; snapToGrid();} });
document.addEventListener("mousemove", e => { if(dragging) moveRulerTo(e.clientX); });
ruler.addEventListener("touchstart", e => { dragging=true; e.preventDefault(); });
document.addEventListener("touchend", () => { if(dragging){dragging=false;snapToGrid();} });
document.addEventListener("touchmove", e => { if(dragging) moveRulerTo(e.touches[0].clientX); });

function snapToGrid() {
  const left = ruler.offsetLeft;
  const snappedRow = Math.round((left - imgOffsetX) / step);
  const snappedLeft = imgOffsetX + snappedRow * step;
  if (snappedRow>0){ step = Math.abs((snappedLeft - imgOffsetX)/snappedRow); stepInput.value = Math.round(step); }
  currentRow = snappedRow + 1;
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

// старт
loadProjectList();
