document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup页面加载完成');
  const toggleDragModeBtn = document.getElementById('toggleDragMode');
  const captureVisibleBtn = document.getElementById('captureVisible');
  const captureFullPageBtn = document.getElementById('captureFullPage');
  const captureSelectBtn = document.getElementById('captureSelect');
  const batchCaptureBtn = document.getElementById('batchCapture');

  // 初始化时获取当前状态
  chrome.storage.local.get('dragModeActive', function(data) {
    const dragModeActive = data.dragModeActive || false;
    updateDragModeButton(dragModeActive);
  });

  // 更新按钮状态的函数
  function updateDragModeButton(active) {
    toggleDragModeBtn.textContent = active ? '关闭拖放模式' : '开启拖放模式';
    toggleDragModeBtn.classList.toggle('active', active);
  }

  // 拖放模式切换
  toggleDragModeBtn.addEventListener('click', () => {
    chrome.storage.local.get('dragModeActive', function(data) {
      const newState = !data.dragModeActive;
      chrome.storage.local.set({ dragModeActive: newState }, function() {
        updateDragModeButton(newState);
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleDragMode',
            enabled: newState
          });
        });
      });
    });
  });

  // 截图功能
  captureVisibleBtn.addEventListener('click', () => {
    console.log('点击可视区域截图按钮');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'captureVisible'});
    });
  });

  captureFullPageBtn.addEventListener('click', () => {
    console.log('点击整页截图按钮');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'captureFullPage'});
    });
  });

  captureSelectBtn.addEventListener('click', () => {
    console.log('点击框选截图按钮');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'captureSelect'});
    });
  });

  // 批量采集功能
  batchCaptureBtn.addEventListener('click', () => {
    console.log('点击批量采集按钮');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'batchCapture'});
    });
  });
}); 