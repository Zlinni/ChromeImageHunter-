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

// 批量采集图片
function batchCaptureImages() {
  const images = document.getElementsByTagName("img");
  console.log("找到图片数量:", images.length);

  const imageUrls = Array.from(images)
    .map((img) => img.src)
    .filter((url) => url && url.startsWith("http"));
  console.log("可下载的图片URL:", imageUrls);

  Promise.all(
    imageUrls.map(async (url) => {
      console.log("下载图片:", url);
      // const typedArray = await urlToUint8Array(url);
      // await sendTypedArrayToPage(typedArray, "批量采集");
      sendUrlToPage(url, "批量采集");
    })
  ).catch((error) => {
    console.error("批量下载图片失败:", error);
  });
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
