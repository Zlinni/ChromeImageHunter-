interface ChromeImageHunterSDKOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onImage?: (blob: Blob) => void;
}

export class ChromeImageHunterSDK {
  private connected: boolean = false;
  private options: ChromeImageHunterSDKOptions;

  constructor(options: ChromeImageHunterSDKOptions = {}) {
    this.options = options;
    this.init();
  }

  private init() {
    // 监听来自插件的消息
    window.addEventListener("message", this.handleMessage);

    // 发送连接请求
    this.sendMessage({
      type: "TO_EXTENSION",
      action: "connect",
    });
  }
  // 将 Array.from(typedArray) 转为arrayBuffer
  private typedArrayToBuffer(typedArrays: number[]) {
    const arrayBuffer = new ArrayBuffer(typedArrays.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    uint8Array.set(typedArrays);
    return arrayBuffer;
  }

  private handleMessage = (event: MessageEvent) => {
    const data = event.data;

    if (data && data.type === "FROM_EXTENSION") {
      // 处理连接请求
      if (data.action === "connect") {
        this.connected = true;
        this.options.onConnect?.();
        return;
      }

      // 处理图片任务
      if (data.action === "[background]:task-callback") {
        // data中可能存在base64或者typedArray，并将他们转为blob

        const arrayBuffer = data.typedArray
          ? this.typedArrayToBuffer(data.typedArray)
          : undefined;
        // 判断是base64还是arrayBuffer，并转为blob返回
        const blob = new Blob([data.base64 ?? arrayBuffer], {
          type: "image/png",
        });
        this.options.onImage?.(blob);
      }
    }
  };

  private sendMessage(message: any) {
    window.postMessage(message, "*");
  }

  /**
   * 销毁实例，清理事件监听
   */
  destroy() {
    window.removeEventListener("message", this.handleMessage);
    this.connected = false;
    this.options.onDisconnect?.();
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// 导出默认实例
export default ChromeImageHunterSDK;
