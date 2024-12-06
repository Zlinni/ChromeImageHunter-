interface ChromeImageHunterSDKOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onImage?: (base64: string) => void;
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
    window.addEventListener('message', this.handleMessage);
    
    // 发送连接请求
    this.sendMessage({
      type: 'TO_EXTENSION',
      action: 'connect'
    });
  }

  private handleMessage = (event: MessageEvent) => {
    const data = event.data;
    
    if (data && data.type === 'FROM_EXTENSION') {
      // 处理连接请求
      if (data.action === 'connect') {
        this.connected = true;
        this.options.onConnect?.();
        return;
      }

      // 处理图片任务
      if (data.action === '[background]:task-callback') {
        const base64 = data.base64;
        if (base64) {
          this.options.onImage?.(base64);
        }
      }
    }
  };

  private sendMessage(message: any) {
    window.postMessage(message, '*');
  }

  /**
   * 销毁实例，清理事件监听
   */
  destroy() {
    window.removeEventListener('message', this.handleMessage);
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