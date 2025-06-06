import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static FROM_EMAIL = 'noreply@transcription-platform.com';

  static async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      await sgMail.send({
        to: template.to,
        from: this.FROM_EMAIL,
        subject: template.subject,
        html: template.html,
        text: template.text || template.html.replace(/<[^>]*>/g, ''),
      });
      return true;
    } catch (error) {
      console.error('郵件發送失敗:', error);
      return false;
    }
  }

  static generateWelcomeEmail(email: string, name: string, temporaryPassword: string): EmailTemplate {
    return {
      to: email,
      subject: '歡迎使用智能多語言語音轉錄平台',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Microsoft JhengHei', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .password-box { background: #fff; border: 2px solid #e9ecef; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .password { font-size: 24px; font-weight: bold; color: #495057; letter-spacing: 2px; font-family: monospace; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 歡迎加入智能轉錄平台</h1>
              <p>您的帳號已成功創建</p>
            </div>
            <div class="content">
              <h2>親愛的 ${name || email}，</h2>
              <p>歡迎使用我們的智能多語言語音轉錄平台！您的帳號已成功創建，以下是您的登入資訊：</p>
              
              <div class="password-box">
                <h3>臨時登入密碼</h3>
                <div class="password">${temporaryPassword}</div>
              </div>

              <div class="warning">
                <strong>⚠️ 重要提醒：</strong>
                <ul>
                  <li>這是您的臨時密碼，首次登入後系統將要求您設定新密碼</li>
                  <li>請妥善保管此密碼，不要與他人分享</li>
                  <li>建議您在首次登入後立即更改為容易記住的密碼</li>
                </ul>
              </div>

              <h3>平台功能特色：</h3>
              <ul>
                <li>🎤 高精度多語言語音轉錄</li>
                <li>🧠 AI智能內容分析與摘要</li>
                <li>👥 智能說話者識別</li>
                <li>📊 詳細轉錄數據統計</li>
                <li>💬 24/7 AI客服支援</li>
              </ul>

              <p>如有任何問題，請隨時聯繫我們的客服團隊。</p>
              
              <p>祝您使用愉快！<br>
              智能轉錄平台團隊</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  static generatePasswordResetEmail(email: string, name: string, newPassword: string): EmailTemplate {
    return {
      to: email,
      subject: '密碼重置通知 - 智能多語言語音轉錄平台',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Microsoft JhengHei', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .password-box { background: #fff; border: 2px solid #e9ecef; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .password { font-size: 24px; font-weight: bold; color: #495057; letter-spacing: 2px; font-family: monospace; }
            .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 密碼重置通知</h1>
              <p>您的新密碼已生成</p>
            </div>
            <div class="content">
              <h2>親愛的 ${name || email}，</h2>
              <p>您已成功申請密碼重置，以下是您的新登入密碼：</p>
              
              <div class="password-box">
                <h3>新登入密碼</h3>
                <div class="password">${newPassword}</div>
              </div>

              <div class="warning">
                <strong>🛡️ 安全提醒：</strong>
                <ul>
                  <li>這是您的新臨時密碼，登入後請立即更改密碼</li>
                  <li>如果您沒有申請密碼重置，請立即聯繫客服</li>
                  <li>請不要與他人分享此密碼</li>
                  <li>建議設定包含大小寫字母、數字的強密碼</li>
                </ul>
              </div>

              <p>如有任何疑問或需要協助，請隨時聯繫我們。</p>
              
              <p>智能轉錄平台團隊<br>
              客服專線：support@transcription-platform.com</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  static generateRandomPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // 確保至少包含一個大寫字母、小寫字母、數字和符號
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // 填充剩餘長度
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // 隨機打亂密碼字符順序
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}