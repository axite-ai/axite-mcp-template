import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@askmymoney.app";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const EmailService = {
  /**
   * Send an email using Resend
   */
  async sendEmail({ to, subject, html }: SendEmailOptions) {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured, skipping email send");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      });

      if (error) {
        console.error("Failed to send email:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error("Email service error:", error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(
    email: string,
    userName: string,
    planName: string
  ) {
    const subject = "Welcome to AskMyMoney! 🎉";
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    h1 { margin: 0; font-size: 28px; }
    h2 { color: #111827; font-size: 22px; margin-top: 0; }
    .next-steps { background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .next-steps li { margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to AskMyMoney!</h1>
    </div>
    <div class="content">
      <h2>Hi ${userName}! 👋</h2>
      <p>Thank you for subscribing to the <strong>${planName}</strong> plan. We're excited to help you take control of your finances with AI-powered insights.</p>

      <div class="next-steps">
        <h3 style="margin-top: 0;">Next Steps:</h3>
        <ol>
          <li><strong>Connect Your Bank Account</strong> - Link your financial accounts securely through Plaid to start getting insights</li>
          <li><strong>Ask Financial Questions</strong> - Use ChatGPT to ask about your balances, transactions, spending patterns, and more</li>
          <li><strong>Get Personalized Insights</strong> - Receive AI-powered recommendations to optimize your finances</li>
        </ol>
      </div>

      <p>When you return to your ChatGPT conversation, simply try using any financial tool and you'll be prompted to connect your bank account.</p>

      <p>If you have any questions or need assistance, just reply to this email - we're here to help!</p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        The AskMyMoney Team
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this email because you subscribed to AskMyMoney.</p>
      <p>© ${new Date().getFullYear()} AskMyMoney. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({ to: email, subject, html });
  },

  /**
   * Send bank connection confirmation email
   */
  async sendBankConnectionConfirmation(
    email: string,
    userName: string,
    institutionName: string,
    isFirstAccount: boolean
  ) {
    const subject = isFirstAccount
      ? "Bank Account Connected Successfully! 🏦"
      : "New Bank Account Added! 🏦";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
    .features { background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .features li { margin: 10px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    h1 { margin: 0; font-size: 28px; }
    h2 { color: #111827; font-size: 22px; margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isFirstAccount ? "You're All Set!" : "Account Added!"}</h1>
    </div>
    <div class="content">
      <h2>Hi ${userName}! 👋</h2>
      <div class="success-badge">✓ Successfully Connected</div>
      <p><strong>${institutionName}</strong> has been ${isFirstAccount ? "connected" : "added"} to your AskMyMoney account.</p>

      ${
        isFirstAccount
          ? `
      <div class="features">
        <h3 style="margin-top: 0;">What You Can Do Now:</h3>
        <ul>
          <li><strong>Check Balances</strong> - Ask ChatGPT "What are my account balances?"</li>
          <li><strong>View Transactions</strong> - Ask "Show me my recent transactions"</li>
          <li><strong>Analyze Spending</strong> - Ask "What are my spending insights?"</li>
          <li><strong>Health Check</strong> - Ask "Check my account health"</li>
          <li><strong>Get Financial Tips</strong> - Ask for personalized advice</li>
        </ul>
      </div>
      `
          : `
      <p>You now have multiple accounts connected, giving you a more complete view of your financial picture across all your institutions.</p>
      `
      }

      <p>Your financial data is securely encrypted and only accessible by you. We use bank-level security to protect your information.</p>

      <p style="margin-top: 30px;">
        Ready to start?<br>
        Head back to ChatGPT and start asking questions about your finances!
      </p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        The AskMyMoney Team
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this email because you connected a bank account to AskMyMoney.</p>
      <p>© ${new Date().getFullYear()} AskMyMoney. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({ to: email, subject, html });
  },

  /**
   * Send additional account added notification
   */
  async sendAdditionalAccountNotification(
    email: string,
    userName: string,
    institutionName: string
  ) {
    return this.sendBankConnectionConfirmation(
      email,
      userName,
      institutionName,
      false
    );
  },
};
