import nodemailer from 'nodemailer'

const isProduction = process.env.NODE_ENV === 'production'

// Gmail SMTP configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
  },
})

/**
 * Send a password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetUrl - Full reset URL with token
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendPasswordResetEmail(to, resetUrl) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[Email] Gmail credentials not configured — skipping email send')
    return { success: false, error: 'Email not configured' }
  }

  try {
    const info = await transporter.sendMail({
      from: `"Meridian" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Reset your Meridian password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #d4a853; margin-bottom: 16px;">Password Reset</h2>
          <p style="color: #333; line-height: 1.6;">
            You requested a password reset for your Meridian account.
          </p>
          <p style="color: #333; line-height: 1.6;">
            Click the button below to reset your password. This link expires in <strong>1 hour</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #d4a853; color: #080c14; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 13px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px;">
            Meridian — Finance Job Application Tracker
          </p>
        </div>
      `,
      text: `Reset your Meridian password\n\nClick this link to reset your password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    })

    console.log(`[Email] Password reset sent to ${to} — messageId: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Verify email transport connection
 */
export async function verifyEmailConnection() {
  try {
    await transporter.verify()
    console.log('[Email] Gmail SMTP connection verified')
    return true
  } catch (err) {
    console.warn('[Email] Gmail SMTP connection failed:', err.message)
    return false
  }
}
