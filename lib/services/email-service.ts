import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@example.com";

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
    const subject = "Welcome! 🎉";
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
      <h1>Welcome!</h1>
    </div>
    <div class="content">
      <h2>Hi ${userName}! 👋</h2>
      <p>Thank you for subscribing to the <strong>${planName}</strong> plan. We're excited to have you on board!</p>

      <div class="next-steps">
        <h3 style="margin-top: 0;">Next Steps:</h3>
        <ol>
          <li><strong>Get Started</strong> - Head to ChatGPT and start using your new features</li>
          <li><strong>Explore Tools</strong> - Try out the MCP tools available in your plan</li>
          <li><strong>Get Help</strong> - Check our documentation or reach out to support</li>
        </ol>
      </div>

      <p>When you return to your ChatGPT conversation, you'll have access to all your plan features.</p>

      <p>If you have any questions or need assistance, just reply to this email - we're here to help!</p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        The Team
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this email because you subscribed to our service.</p>
      <p>© ${new Date().getFullYear()} All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({ to: email, subject, html });
  },

  /**
   * TEMPLATE: Example method for sending account connection confirmation emails
   * Customize or remove this based on your application's needs
   */
  async sendAccountConnectionConfirmation(
    email: string,
    userName: string,
    serviceName: string,
    isFirstConnection: boolean
  ) {
    const subject = isFirstConnection
      ? "Account Connected Successfully! ✓"
      : "New Account Added! ✓";

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
      <h1>${isFirstConnection ? "You're All Set!" : "Account Added!"}</h1>
    </div>
    <div class="content">
      <h2>Hi ${userName}! 👋</h2>
      <div class="success-badge">✓ Successfully Connected</div>
      <p><strong>${serviceName}</strong> has been ${isFirstConnection ? "connected" : "added"} to your account.</p>

      ${
        isFirstConnection
          ? `
      <div class="features">
        <h3 style="margin-top: 0;">What You Can Do Now:</h3>
        <ul>
          <li><strong>Use MCP Tools</strong> - Access your features in ChatGPT</li>
          <li><strong>Explore Features</strong> - Try out the available functionality</li>
          <li><strong>Get Help</strong> - Check documentation or contact support</li>
        </ul>
      </div>
      `
          : `
      <p>You now have multiple accounts connected, giving you access to more features.</p>
      `
      }

      <p>Your data is securely encrypted and only accessible by you. We use industry-standard encryption to protect your information.</p>

      <p style="margin-top: 30px;">
        Ready to start?<br>
        Head back to ChatGPT and start using your features!
      </p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        The Team
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this email because you connected an account to our service.</p>
      <p>© ${new Date().getFullYear()} All rights reserved.</p>
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
