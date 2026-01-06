import nodemailer from 'nodemailer';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// 共用的郵件樣式
const emailStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #374151;
    background-color: #f3f4f6;
    margin: 0;
    padding: 20px;
  }
  .container {
    max-width: 480px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .header {
    background: #1f2937;
    color: #ffffff;
    padding: 32px 24px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
  .header p {
    margin: 8px 0 0 0;
    font-size: 14px;
    color: #9ca3af;
  }
  .content {
    padding: 32px 24px;
  }
  .greeting {
    font-size: 16px;
    color: #111827;
    margin-bottom: 16px;
  }
  .message {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 24px;
  }
  .button-container {
    text-align: center;
    margin: 32px 0;
  }
  .button {
    display: inline-block;
    background: #3b82f6;
    color: #ffffff !important;
    padding: 14px 32px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  .button-success {
    background: #10b981;
  }
  .button-warning {
    background: #f59e0b;
  }
  .info-box {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    padding: 16px;
    border-radius: 8px;
    margin: 24px 0;
    font-size: 13px;
  }
  .info-box ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
    color: #6b7280;
  }
  .info-box li {
    margin: 4px 0;
  }
  .link-box {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    padding: 12px;
    border-radius: 6px;
    margin-top: 16px;
    word-break: break-all;
    font-size: 12px;
    color: #3b82f6;
    font-family: monospace;
  }
  .password-box {
    background: #fef3c7;
    border: 2px solid #fbbf24;
    padding: 20px;
    margin: 24px 0;
    border-radius: 8px;
    text-align: center;
  }
  .password {
    font-size: 24px;
    font-weight: bold;
    color: #92400e;
    letter-spacing: 3px;
    font-family: monospace;
  }
  .footer {
    padding: 24px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
    font-size: 12px;
    color: #9ca3af;
  }
  .warning-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 16px;
    border-radius: 8px;
    margin: 24px 0;
  }
  .warning-box strong {
    color: #dc2626;
  }
  .success-box {
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    padding: 16px;
    border-radius: 8px;
    margin: 24px 0;
  }
  .success-box strong {
    color: #059669;
  }
`;

export class EmailService {
  private static FROM_EMAIL = process.env.GMAIL_USER || 'noreply@voicetextpro.com';
  private static FROM_NAME = 'VoiceTextPro';

  static async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
        console.error('Gmail credentials not configured');
        return false;
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD
        }
      });

      const mailOptions = {
        from: `"${this.FROM_NAME}" <${this.FROM_EMAIL}>`,
        to: template.to,
        subject: template.subject,
        text: template.text || template.html.replace(/<[^>]*>/g, ''),
        html: template.html,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${template.to}`);
      return true;
    } catch (error) {
      console.error('郵件發送失敗:', error);
      return false;
    }
  }

  /**
   * 發送 Email 驗證郵件
   */
  static async sendVerificationEmail(email: string, name: string, verificationLink: string): Promise<boolean> {
    const template: EmailTemplate = {
      to: email,
      subject: '驗證您的 Email - VoiceTextPro',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VoiceTextPro</h1>
              <p>智能語音轉錄平台</p>
            </div>
            <div class="content">
              <p class="greeting">您好 ${name || ''}，</p>
              <p class="message">感謝您註冊 VoiceTextPro！請點擊下方按鈕驗證您的 Email 地址以完成註冊。</p>

              <div class="button-container">
                <a href="${verificationLink}" class="button button-success" target="_blank" rel="noopener noreferrer">驗證 Email</a>
              </div>

              <div class="info-box">
                <strong>注意事項</strong>
                <ul>
                  <li>此連結將在 24 小時後失效</li>
                  <li>如果按鈕無法點擊，請複製下方連結到瀏覽器開啟</li>
                </ul>
                <div class="link-box">${verificationLink}</div>
              </div>

              <p class="message">如果您沒有註冊帳號，請忽略此郵件。</p>
            </div>
            <div class="footer">
              VoiceTextPro - 智能語音轉錄平台<br>
              此為系統自動發送的郵件，請勿直接回覆
            </div>
          </div>
        </body>
        </html>
      `
    };

    return this.sendEmail(template);
  }

  /**
   * 發送密碼重設連結郵件
   */
  static async sendPasswordResetLinkEmail(email: string, name: string, resetLink: string): Promise<boolean> {
    const template: EmailTemplate = {
      to: email,
      subject: '重設密碼 - VoiceTextPro',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VoiceTextPro</h1>
              <p>密碼重設請求</p>
            </div>
            <div class="content">
              <p class="greeting">您好 ${name || ''}，</p>
              <p class="message">我們收到了您的密碼重設請求。請點擊下方按鈕設定新密碼。</p>

              <div class="button-container">
                <a href="${resetLink}" class="button" target="_blank" rel="noopener noreferrer">重設密碼</a>
              </div>

              <div class="info-box">
                <strong>安全提醒</strong>
                <ul>
                  <li>此連結將在 1 小時後失效</li>
                  <li>每個連結只能使用一次</li>
                  <li>如果您沒有請求重設密碼，請忽略此郵件</li>
                </ul>
                <div class="link-box">${resetLink}</div>
              </div>
            </div>
            <div class="footer">
              VoiceTextPro - 智能語音轉錄平台<br>
              此為系統自動發送的郵件，請勿直接回覆
            </div>
          </div>
        </body>
        </html>
      `
    };

    return this.sendEmail(template);
  }

  /**
   * 發送密碼已變更通知
   */
  static async sendPasswordChangedNotification(email: string): Promise<boolean> {
    const template: EmailTemplate = {
      to: email,
      subject: '密碼已變更 - VoiceTextPro',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VoiceTextPro</h1>
              <p>安全通知</p>
            </div>
            <div class="content">
              <p class="greeting">您好，</p>
              <p class="message">您的 VoiceTextPro 帳號密碼已於 ${new Date().toLocaleString('zh-TW')} 成功變更。</p>

              <div class="success-box">
                <strong>密碼變更成功</strong>
                <p style="margin: 8px 0 0 0; color: #6b7280;">您現在可以使用新密碼登入。</p>
              </div>

              <div class="warning-box">
                <strong>如果這不是您本人的操作</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #6b7280;">
                  <li>請立即聯繫我們的客服團隊</li>
                  <li>檢查您的帳號是否有異常活動</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              VoiceTextPro - 智能語音轉錄平台<br>
              此為系統自動發送的郵件，請勿直接回覆
            </div>
          </div>
        </body>
        </html>
      `
    };

    return this.sendEmail(template);
  }

  /**
   * 歡迎郵件（管理員建立帳號時發送）
   */
  static generateWelcomeEmail(email: string, name: string, temporaryPassword: string): EmailTemplate {
    return {
      to: email,
      subject: '歡迎加入 VoiceTextPro',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VoiceTextPro</h1>
              <p>歡迎加入</p>
            </div>
            <div class="content">
              <p class="greeting">您好 ${name || ''}，</p>
              <p class="message">您的 VoiceTextPro 帳號已建立成功！以下是您的登入資訊：</p>

              <div class="password-box">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #92400e;">臨時密碼</p>
                <div class="password">${temporaryPassword}</div>
              </div>

              <div class="info-box">
                <strong>重要提醒</strong>
                <ul>
                  <li>這是臨時密碼，首次登入後請立即更改</li>
                  <li>請妥善保管，不要與他人分享</li>
                </ul>
              </div>

              <div class="button-container">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="button" target="_blank">前往登入</a>
              </div>
            </div>
            <div class="footer">
              VoiceTextPro - 智能語音轉錄平台<br>
              此為系統自動發送的郵件，請勿直接回覆
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  /**
   * 舊版密碼重設郵件（直接發送新密碼）
   * @deprecated 建議使用 sendPasswordResetLinkEmail
   */
  static generatePasswordResetEmail(email: string, name: string, newPassword: string): EmailTemplate {
    return {
      to: email,
      subject: '密碼已重設 - VoiceTextPro',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VoiceTextPro</h1>
              <p>密碼已重設</p>
            </div>
            <div class="content">
              <p class="greeting">您好 ${name || ''}，</p>
              <p class="message">您的密碼已重設成功。以下是您的新密碼：</p>

              <div class="password-box">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #92400e;">新密碼</p>
                <div class="password">${newPassword}</div>
              </div>

              <div class="warning-box">
                <strong>安全提醒</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #6b7280;">
                  <li>登入後請立即更改密碼</li>
                  <li>如果您沒有申請重設，請立即聯繫客服</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              VoiceTextPro - 智能語音轉錄平台<br>
              此為系統自動發送的郵件，請勿直接回覆
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

    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
