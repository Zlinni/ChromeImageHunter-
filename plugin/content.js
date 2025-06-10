const TARGET_ORIGIN = Config.TARGET_ORIGIN;

// 将url转换为base64
async function urlToBase64(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  // 将 blob 转换为 base64 并返回
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    try {
      reader.onerror = () => {
        reject(new Error("文件读取失败"));
      };

      reader.onabort = () => {
        reject(new Error("文件读取被中断"));
      };

      reader.onloadend = function () {
        if (reader.error) {
          reject(reader.error);
        } else {
          const base64data = reader.result;
          resolve(base64data);
        }
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      reject(new Error("转换base64失败: " + error.message));
    }
  });
}

function loadImageWithCORS(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// 将url转为Uint8Array
// async function urlToUint8Array(url) {
//   const response = await fetch(url);
//   const arrayBuffer = await response.arrayBuffer();
//   const typedArray = new Uint8Array(arrayBuffer);
//   return Array.from(typedArray);
// }

// 发送连接请求
function sendConnectRequest() {
  // 发送连接请求给当前页面
  window.postMessage(
    {
      type: "FROM_EXTENSION",
      action: "connect",
      timestamp: Date.now(),
    },
    TARGET_ORIGIN
  );

  // 同时通知background script建立连接
  chrome.runtime.sendMessage({
    action: "forwardToTarget",
    data: {
      type: "FROM_EXTENSION",
      action: "connect",
      timestamp: Date.now(),
      sourceUrl: window.location.href,
      targetOrigin: TARGET_ORIGIN,
    },
  });
}

// 发送base64数据到目标页面
async function sendBase64ToPage(base64, taskType) {
  chrome.runtime.sendMessage({
    action: "forwardToTarget",
    data: {
      type: "FROM_EXTENSION",
      action: "[background]:task-callback",
      base64: base64,
      taskType,
      timestamp: Date.now(),
      sourceUrl: window.location.href,
      targetOrigin: TARGET_ORIGIN,
    },
  });
}

// 发送url数据到background后下载并转发到目标页面
async function sendUrlToPage(url, taskType) {
  chrome.runtime.sendMessage({
    action: "forwardURLToTarget",
    data: {
      type: "FROM_EXTENSION",
      action: "[background]:task-callback",
      url,
      taskType,
      timestamp: Date.now(),
      sourceUrl: window.location.href,
      targetOrigin: TARGET_ORIGIN,
    },
  });
}

// 发送typedArray数据到目标页面
async function sendTypedArrayToPage(typedArray, taskType) {
  chrome.runtime.sendMessage({
    action: "forwardToTarget",
    data: {
      type: "FROM_EXTENSION",
      action: "[background]:task-callback",
      typedArray,
      taskType,
      timestamp: Date.now(),
      sourceUrl: window.location.href,
      targetOrigin: TARGET_ORIGIN,
    },
  });
}

// 初始化连接
function initializeConnection() {
  // 发送连接请求
  sendConnectRequest();
  // 每30秒重新发送一次连接请求（保持连接）
  setInterval(sendConnectRequest, 30000);
}

// 页面加载完成后初始化连接
if (document.readyState === "complete") {
  initializeConnection();
} else {
  window.addEventListener("load", initializeConnection);
}

// 初始化时检查拖放模式状态
chrome.storage.local.get("dragModeActive", function (data) {
  if (data.dragModeActive) {
    toggleDragMode(true);
  }
});

// 将页面内容转换为canvas并导出base64
async function captureVisibleToBase64() {
  const canvas = await html2canvas(document.documentElement, {
    width: window.innerWidth,
    height: window.innerHeight,
    useCORS: true,
    allowTaint: true,
    scale: window.devicePixelRatio,
    logging: false,
  });

  // 转换为base64
  return canvas.toDataURL("image/png");
}

async function captureFullPageToBase64() {
  const canvas = await html2canvas(document.documentElement, {
    useCORS: true,
    allowTaint: true,
    scrollY: 0,
    scrollX: 0,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
    scale: window.devicePixelRatio,
    logging: false,
  });

  return canvas.toDataURL("image/png");
}

// 监听来自popup background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content Script收到消息:", request);
  switch (request.action) {
    case "toggleDragMode":
      console.log("换拖放模式:", request.enabled);
      toggleDragMode(request.enabled);
      break;
    case "captureVisible":
      console.log("开始截取可视区域");
      captureVisibleToBase64().then((base64) => {
        sendBase64ToPage(base64, "可视区域截图");
      });
      break;
    case "captureFullPage":
      console.log("开始整页截图");
      captureFullPageToBase64().then((base64) => {
        sendBase64ToPage(base64, "整页截图");
      });
      break;
    case "captureSelect":
      console.log("开始框选截图");
      initSelectCapture();
      break;
    case "batchCapture":
      console.log("开始批量采集图片");
      batchCaptureImages();
      break;
    case "[background]:captureImage":
      console.log("开始右键采集");
      // urlToUint8Array(request.data.imageUrl).then((typedArray) => {
      // sendTypedArrayToPage(typedArray, "右键采集");
      // });
      sendTypedArrayToPage(request.data.typedArray, "右键采集");
      break;
    case "[background]:task-callback":
      console.log("开始执行任务");
      // 转发给B网站页面
      window.postMessage(
        {
          type: "FROM_EXTENSION",
          ...request,
        },
        TARGET_ORIGIN
      );
    case "toggleHoverButtons":
      console.log("切换图片悬停按钮:", request.enabled);
      if (request.enabled) {
        initImageHoverButtons();
      } else {
        // 移除所有采集按钮
        removeHoverButtons();
      }
      break;
  }
});

// 拖放模式
function toggleDragMode(enabled) {
  if (enabled) {
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("dragend", handleDragEnd);
    document.body.style.cursor = "grab";
    // 添加提示层
    if (!document.getElementById("dragModeOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "dragModeOverlay";
      overlay.textContent = "拖放模式已开启：可直接拖动图片进行保存";
      document.body.appendChild(overlay);
    }
  } else {
    document.removeEventListener("dragstart", handleDragStart);
    document.removeEventListener("dragend", handleDragEnd);
    document.body.style.cursor = "";
    const overlay = document.getElementById("dragModeOverlay");
    if (overlay) {
      overlay.remove();
    }
  }
}

// 处理拖动开始
function handleDragStart(e) {
  if (e.target.tagName === "IMG") {
    e.target.classList.add("image-collector-dragging");
    e.dataTransfer.setData("text/plain", e.target.src);
    console.log("开始拖动图片:", e.target.src);
  }
}

// 处理拖动结束
function handleDragEnd(e) {
  if (e.target.tagName === "IMG") {
    e.target.classList.remove("image-collector-dragging");
    console.log("准备保存图片:", e.target.src);
    sendUrlToPage(e.target.src, "拖放采集");
    // urlToUint8Array(e.target.src).then((typedArray) => {
    //   sendTypedArrayToPage(typedArray, "拖放采集");
    // });
  }
}

// 框选截图
function initSelectCapture() {
  let selectBox = document.createElement("div");
  selectBox.style.position = "fixed";
  selectBox.style.border = "2px solid rgba(33, 150, 243, 0.8)";
  selectBox.style.boxSizing = "border-box";
  selectBox.style.display = "none";
  selectBox.style.zIndex = "999999";
  document.body.appendChild(selectBox);

  let startX, startY;
  let isSelecting = false;

  document.addEventListener("mousedown", startSelection);
  document.addEventListener("mousemove", updateSelection);
  document.addEventListener("mouseup", endSelection);

  function startSelection(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectBox.style.display = "block";
  }

  function updateSelection(e) {
    if (!isSelecting) return;

    let currentX = e.clientX;
    let currentY = e.clientY;

    let left = Math.min(startX, currentX);
    let top = Math.min(startY, currentY);
    let width = Math.abs(currentX - startX);
    let height = Math.abs(currentY - startY);

    selectBox.style.left = left + "px";
    selectBox.style.top = top + "px";
    selectBox.style.width = width + "px";
    selectBox.style.height = height + "px";
  }

  async function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;

    const dimensions = {
      left: parseInt(selectBox.style.left),
      top: parseInt(selectBox.style.top),
      width: parseInt(selectBox.style.width),
      height: parseInt(selectBox.style.height),
    };

    // 临时移除边框
    const originalBorder = selectBox.style.border;
    selectBox.style.border = "none";

    // 使用html2canvas截取选中区域
    const canvas = await html2canvas(document.body, {
      x: dimensions.left + window.scrollX,
      y: dimensions.top + window.scrollY,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    // 恢复边框
    selectBox.style.border = originalBorder;

    const base64 = canvas.toDataURL("image/png");
    sendBase64ToPage(base64, "区域截图");

    selectBox.style.display = "none";
    document.removeEventListener("mousedown", startSelection);
    document.removeEventListener("mousemove", updateSelection);
    document.removeEventListener("mouseup", endSelection);
    selectBox.remove();
  }
}
// 批量采集图片功能改造
function batchCaptureImages() {
  // 获取所有图片
  const images = document.getElementsByTagName("img");
  console.log("找到图片数量:", images.length);

  // 过滤掉不符合条件的图片（没有src或非http开头的）
  const validImages = Array.from(images).filter(
    (img) => img.src && img.src.startsWith("http")
  );

  // 图片信息数组
  const imageInfos = validImages.map((img) => ({
    src: img.src,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    format: getImageFormat(img.src),
    selected: true, // 默认选中
  }));

  // 从URL获取图片格式
  function getImageFormat(url) {
    const extension = url.split(".").pop().split("?")[0].toLowerCase();
    const formats = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];

    if (formats.includes(extension)) {
      return extension.toUpperCase();
    }

    // 如果URL没有明确的扩展名，尝试从内容类型推断
    return "Unknown";
  }

  // 获取页面中所有不同的图片格式
  const uniqueFormats = [...new Set(imageInfos.map((img) => img.format))];
  console.log("检测到的图片格式:", uniqueFormats);

  // 创建弹窗
  const dialog = createBatchCaptureDialog();
  // 创建弹窗时使用动态格式
  function createBatchCaptureDialog() {
    // 创建弹窗容器
    const dialog = document.createElement("div");
    dialog.id = "image-collector-dialog";
    dialog.className = "image-collector-dialog";

    // 格式选择下拉框HTML
    let formatOptionsHtml = '<option value="all">所有格式</option>';
    uniqueFormats.forEach((format) => {
      formatOptionsHtml += `<option value="${format.toLowerCase()}">${format}</option>`;
    });

    // 设置弹窗HTML结构
    dialog.innerHTML = `
      <div class="image-collector-dialog-content">
        <!-- 上部分功能区 -->
        <div class="image-collector-dialog-header">
          <div class="image-collector-dialog-title">
            <h2>批量图片采集</h2>
          </div>
          <div class="image-collector-dialog-controls">
            <!-- 格式选择（下拉框）-->
            <div class="image-collector-control-group">
              <label>图片格式：</label>
              <select id="image-format-selector" class="image-collector-select">
                ${formatOptionsHtml}
              </select>
            </div>
            
            <!-- 尺寸筛选 -->
            <div class="image-collector-control-group">
              <label>最小宽度：<span id="min-width-value">0</span>px</label>
              <input type="range" id="min-width-slider" min="0" max="1000" step="10" value="0">
            </div>
            <div class="image-collector-control-group">
              <label>最小高度：<span id="min-height-value">0</span>px</label>
              <input type="range" id="min-height-slider" min="0" max="1000" step="10" value="0">
            </div>
            
            <!-- 操作按钮 -->
            <div class="image-collector-control-group">
              <button id="select-all-images" class="image-collector-button">全选</button>
              <button id="capture-selected-images" class="image-collector-button primary">采集选中图片</button>
            </div>
          </div>
          <div class="image-collector-dialog-close">
            <button id="close-image-dialog" class="image-collector-close-button">&times;</button>
          </div>
        </div>
        
        <!-- 下部分展示区 -->
        <div class="image-collector-dialog-body">
          <div class="image-collector-images-container" id="image-collector-images">
            <!-- 图片将动态添加到这里 -->
            <div class="image-collector-loading">正在加载图片...</div>
          </div>
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement("style");
    style.id = "image-collector-dialog-styles";
    style.textContent = `
      .image-collector-dialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 9999999;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease;
      }
      
      .image-collector-dialog-content {
        width: 90%;
        height: 90%;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .image-collector-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        background-color: #f8f9fa;
      }
      
      .image-collector-dialog-title {
        flex: 0 0 200px;
      }
      
      .image-collector-dialog-title h2 {
        margin: 0;
        font-size: 18px;
        color: #333;
      }
      
      .image-collector-dialog-controls {
        flex: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        justify-content: center;
      }
      
      .image-collector-control-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .image-collector-select {
        padding: 6px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        min-width: 120px;
      }
      
      .image-collector-dialog-close {
        flex: 0 0 50px;
        text-align: right;
      }
      
      .image-collector-close-button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
      }
      
      .image-collector-close-button:hover {
        color: #ff4d4f;
      }
      
      .image-collector-dialog-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background-color: #f0f2f5;
      }
      
      .image-collector-images-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 15px;
      }
      
      .image-collector-image-item {
        position: relative;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 5px;
        background-color: white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        transition: transform 0.2s ease;
      }
      
      .image-collector-image-item:hover {
        transform: translateY(-3px);
        box-shadow: 0 5px 10px rgba(0,0,0,0.1);
      }
      
      .image-collector-image-checkbox {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        cursor: pointer;
        z-index: 1;
      }
      
      .image-collector-image-preview {
        width: 100%;
        height: 150px;
        object-fit: contain;
        display: block;
        margin-bottom: 5px;
      }
      
      .image-collector-image-info {
        font-size: 12px;
        color: #666;
        text-align: center;
      }
      
      .image-collector-button {
        padding: 6px 12px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        background-color: white;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .image-collector-button:hover {
        border-color: #1890ff;
        color: #1890ff;
      }
      
      .image-collector-button.primary {
        background-color: #1890ff;
        border-color: #1890ff;
        color: white;
      }
      
      .image-collector-button.primary:hover {
        background-color: #40a9ff;
        border-color: #40a9ff;
        color: white;
      }
      
      .image-collector-loading {
        grid-column: 1 / -1;
        text-align: center;
        padding: 50px;
        color: #666;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;

    // 添加到页面
    document.head.appendChild(style);
    document.body.appendChild(dialog);

    // 返回dialog元素供后续使用
    return dialog;
  }

  // 获取DOM元素引用
  const imagesContainer = document.getElementById("image-collector-images");
  const minWidthSlider = document.getElementById("min-width-slider");
  const minHeightSlider = document.getElementById("min-height-slider");
  const minWidthValue = document.getElementById("min-width-value");
  const minHeightValue = document.getElementById("min-height-value");
  const formatSelector = document.getElementById("image-format-selector");
  const selectAllBtn = document.getElementById("select-all-images");
  const captureBtn = document.getElementById("capture-selected-images");
  const closeBtn = document.getElementById("close-image-dialog");

  // 渲染图片列表
  function renderImages(filteredImages) {
    // 清空容器
    imagesContainer.innerHTML = "";

    if (filteredImages.length === 0) {
      imagesContainer.innerHTML =
        '<div class="image-collector-loading">没有符合条件的图片</div>';
      return;
    }

    // 添加图片到容器
    filteredImages.forEach((imgInfo, index) => {
      const imgItem = document.createElement("div");
      imgItem.className = "image-collector-image-item";
      imgItem.dataset.index = index;

      // 图片内容
      imgItem.innerHTML = `
        <input type="checkbox" class="image-collector-image-checkbox" ${
          imgInfo.selected ? "checked" : ""
        } data-index="${index}">
        <img src="${
          imgInfo.src
        }" class="image-collector-image-preview" alt="图片预览">
        <div class="image-collector-image-info">${imgInfo.width} x ${
        imgInfo.height
      } ${imgInfo.format}</div>
      `;

      imagesContainer.appendChild(imgItem);
    });

    // 绑定选择框事件
    const checkboxes = document.querySelectorAll(
      ".image-collector-image-checkbox"
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const index = parseInt(e.target.dataset.index);
        imageInfos[index].selected = e.target.checked;
      });
    });
  }

  // 应用筛选条件
  function applyFilters() {
    const minWidth = parseInt(minWidthSlider.value);
    const minHeight = parseInt(minHeightSlider.value);
    const selectedFormat = formatSelector.value;

    // 筛选图片
    const filteredImages = imageInfos.filter((img) => {
      // 格式筛选
      const formatMatch =
        selectedFormat === "all" ||
        img.format.toLowerCase() === selectedFormat.toLowerCase();

      // 尺寸筛选
      const sizeMatch = img.width >= minWidth && img.height >= minHeight;

      return formatMatch && sizeMatch;
    });

    renderImages(filteredImages);
  }

  // 初始化滑块事件
  minWidthSlider.addEventListener("input", () => {
    minWidthValue.textContent = minWidthSlider.value;
    applyFilters();
  });

  minHeightSlider.addEventListener("input", () => {
    minHeightValue.textContent = minHeightSlider.value;
    applyFilters();
  });

  // 格式选择事件
  formatSelector.addEventListener("change", applyFilters);

  // 全选按钮事件
  selectAllBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(
      ".image-collector-image-checkbox"
    );
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

    checkboxes.forEach((cb, i) => {
      cb.checked = !allChecked;
      const index = parseInt(cb.dataset.index);
      imageInfos[index].selected = !allChecked;
    });

    selectAllBtn.textContent = allChecked ? "全选" : "取消全选";
  });

  // 采集按钮事件
  captureBtn.addEventListener("click", () => {
    const selectedImages = imageInfos.filter((img) => img.selected);

    if (selectedImages.length === 0) {
      alert("请至少选择一张图片");
      return;
    }

    console.log(`开始采集${selectedImages.length}张图片`);

    Promise.all(
      selectedImages.map(async (imgInfo) => {
        console.log("下载图片:", imgInfo.src);
        sendUrlToPage(imgInfo.src, "批量采集");
      })
    )
      .then(() => {
        alert(`成功采集${selectedImages.length}张图片`);
        // 关闭弹窗
        closeDialog();
      })
      .catch((error) => {
        console.error("批量下载图片失败:", error);
        alert("部分图片采集失败，请查看控制台");
      });
  });

  // 关闭按钮事件
  closeBtn.addEventListener("click", closeDialog);

  // 关闭弹窗函数
  function closeDialog() {
    dialog.remove();
    document.getElementById("image-collector-dialog-styles").remove();
  }

  // 初始渲染
  applyFilters();
}

// 初始化图片采集按钮功能
function initImageHoverButtons() {
  // 创建样式
  const style = document.createElement("style");
  style.id = "image-collector-hover-styles";
  style.textContent = `
    .image-collector-button-container {
      position: absolute;
      top: 5px;
      left: 5px;
      display: none;
      z-index: 999999;
    }
    
    .image-collector-button {
      background-color: rgba(33, 150, 243, 0.9);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .image-collector-button:hover {
      background-color: rgba(33, 150, 243, 1);
      transform: scale(1.05);
    }
    
    /* 移除了图标的CSS */
    
    img:hover .image-collector-button-container {
      display: block;
    }
  `;
  document.head.appendChild(style);
  // 监听页面上的图片
  function processImages() {
    const images = document.getElementsByTagName("img");

    Array.from(images).forEach((img) => {
      // 检查图片是否已有采集按钮
      if (img.dataset.collectorProcessed) return;

      // 标记已处理
      img.dataset.collectorProcessed = "true";

      // 获取图片父元素，并确保它有相对定位
      const parent = img.parentElement;

      // 忽略太小的图片
      if (img.width < 50 || img.height < 50) return;

      // 设置父元素为相对定位
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }

      // 创建按钮容器
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "image-collector-button-container";

      // 创建采集按钮
      const collectButton = document.createElement("button");
      collectButton.className = "image-collector-button";
      collectButton.textContent = "采集";
      collectButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("开始采集图片:", img.src);
        // 调用现有的发送图像功能
        sendUrlToPage(img.src, "按钮采集");
      });

      // 将按钮添加到容器
      buttonContainer.appendChild(collectButton);

      // 监听鼠标进入图片
      img.addEventListener("mouseenter", () => {
        buttonContainer.style.display = "block";
      });

      // 监听鼠标离开图片
      img.addEventListener("mouseleave", (e) => {
        // 检查鼠标是否进入了按钮容器
        const rect = buttonContainer.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return; // 如果鼠标在按钮容器内，不隐藏
        }
        buttonContainer.style.display = "none";
      });

      // 监听按钮容器的鼠标离开
      buttonContainer.addEventListener("mouseleave", () => {
        buttonContainer.style.display = "none";
      });

      // 将按钮添加到图片旁边
      parent.appendChild(buttonContainer);

      // 调整按钮位置
      buttonContainer.style.position = "absolute";
      buttonContainer.style.top = img.offsetTop + 10 + "px";
      buttonContainer.style.left = img.offsetLeft + 10 + "px"; // 改为左侧
    });
  }
  // 初始处理
  processImages();
  // 保存observer到window对象以便后续移除
  window.imageCollectorObserver = new MutationObserver((mutations) => {
    processImages();
  });

  window.imageCollectorObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function removeHoverButtons() {
  // 1. 移除所有采集按钮容器
  const buttons = document.querySelectorAll(
    ".image-collector-button-container"
  );
  buttons.forEach((button) => button.remove());

  // 2. 移除之前添加的样式表
  const styleElement = document.getElementById("image-collector-hover-styles");
  if (styleElement) {
    styleElement.remove();
  }

  // 3. 移除图片标记
  const images = document.getElementsByTagName("img");
  Array.from(images).forEach((img) => {
    delete img.dataset.collectorProcessed;
  });

  // 4. 移除已注册的MutationObserver
  if (window.imageCollectorObserver) {
    window.imageCollectorObserver.disconnect();
    window.imageCollectorObserver = null;
  }

  console.log("已移除所有图片采集按钮");
}

// 在页面加载完成后检查是否启用图片采集按钮功能
function initOnPageLoad() {
  // 检查存储中是否启用了hover按钮
  chrome.storage.local.get("hoverButtonsActive", function (data) {
    if (data.hoverButtonsActive) {
      // 只有在设置为启用时才初始化hover按钮
      initImageHoverButtons();
    }
  });
}

// 页面加载完成后初始化
if (document.readyState === "complete") {
  initOnPageLoad();
} else {
  window.addEventListener("load", initOnPageLoad);
}
