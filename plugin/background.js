// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log("插件已安装，创建右键菜单");
  chrome.contextMenus.create({
    id: "captureImage",
    title: "采集图片",
    contexts: ["image"],
  });
});

// 将url转为Uint8Array
async function urlToUint8Array(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);
  return Array.from(typedArray);
}

// 处理菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "captureImage":
      const typedArray = await urlToUint8Array(info.srcUrl);
      // 发送消息给 content script
      chrome.tabs.sendMessage(tab.id, {
        action: "[background]:captureImage",
        data: {
          imageUrl: info.srcUrl,
          typedArray,
        },
      });
      break;
  }
});

// 查找目标标签页并转发消息
async function forwardMessageToTarget(message) {
  try {
    const tabs = await chrome.tabs.query({});
    const targetTab = tabs.find((tab) => tab.url === message.targetOrigin);

    if (targetTab) {
      chrome.tabs.sendMessage(targetTab.id, message);
    } else {
      console.log("未找到目标页面");
    }
  } catch (error) {
    console.error("转发消息失败:", error);
  }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log("Background收到消息:", request);
  if (request.action === "forwardToTarget") {
    // 转发消息到目标页面
    forwardMessageToTarget(request.data);
    return;
  }
  if (request.action === "forwardURLToTarget") {
    const typedArray = await urlToUint8Array(request.data.url);
    forwardMessageToTarget({
      ...request.data,
      typedArray,
    });
    return;
  }
  if (request.action === "toggleHoverButtons") {
    // 转发给content script处理
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleHoverButtons",
        enabled: request.enabled,
      });
    });
  }
});
