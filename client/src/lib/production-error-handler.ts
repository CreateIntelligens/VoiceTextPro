/**
 * 生產環境專用錯誤處理器
 * 解決正式環境中的JSON解析和認證問題
 */

export class ProductionErrorHandler {
  /**
   * 安全的JSON解析，專為生產環境設計
   */
  static async safeParseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    
    try {
      // 檢查是否為JSON回應
      if (contentType.includes('application/json')) {
        const text = await response.text();
        return this.parseJsonSafely(text);
      }
      
      // 處理文本回應
      if (contentType.includes('text/')) {
        return await response.text();
      }
      
      // 未知內容類型的安全處理
      return await this.handleUnknownContentType(response);
      
    } catch (error) {
      throw new Error('伺服器回應格式錯誤，請重新整理頁面');
    }
  }
  
  /**
   * 安全的JSON解析
   */
  private static parseJsonSafely(text: string): any {
    const trimmedText = text.trim();
    
    // 檢查空回應
    if (!trimmedText) {
      return null;
    }
    
    // 檢查HTML錯誤頁面
    if (trimmedText.startsWith('<') || trimmedText.includes('<!DOCTYPE')) {
      throw new Error('伺服器返回HTML頁面，請檢查網路連線');
    }
    
    // 驗證JSON格式
    if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
      throw new Error('無效的資料格式');
    }
    
    try {
      return JSON.parse(trimmedText);
    } catch (parseError) {
      throw new Error('資料解析失敗，請重新整理頁面');
    }
  }
  
  /**
   * 處理未知內容類型
   */
  private static async handleUnknownContentType(response: Response): Promise<any> {
    const text = await response.text();
    const trimmedText = text.trim();
    
    // 檢查是否為HTML錯誤頁面
    if (trimmedText.includes('<html>') || trimmedText.includes('<!DOCTYPE')) {
      throw new Error('伺服器配置錯誤，請聯繫技術支援');
    }
    
    // 嘗試解析為JSON
    if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
      return this.parseJsonSafely(trimmedText);
    }
    
    return trimmedText;
  }
  
  /**
   * 處理認證錯誤
   */
  static handleAuthError(): void {
    // 清除無效的認證token
    localStorage.removeItem('auth_token');
    
    // 顯示友善的錯誤訊息
    this.showErrorMessage('登入已過期，正在重新導向到登入頁面...');
    
    // 延遲重新導向，避免阻塞當前操作
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  }
  
  /**
   * 處理網路錯誤
   */
  static handleNetworkError(error: any): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('Failed to fetch')) {
      return new Error('網路連線錯誤，請檢查網路狀態');
    }
    
    if (errorMessage.includes('Network request failed')) {
      return new Error('網路請求失敗，請重試');
    }
    
    if (errorMessage.includes('Unexpected token')) {
      return new Error('資料格式錯誤，請重新整理頁面');
    }
    
    return new Error('系統錯誤，請稍後再試');
  }
  
  /**
   * 顯示錯誤訊息
   */
  private static showErrorMessage(message: string): void {
    // 建立簡單的錯誤提示
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // 3秒後自動移除
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 3000);
  }
}