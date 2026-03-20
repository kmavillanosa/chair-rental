import * as nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);
  private readonly gmailUser = String(process.env.GMAIL_USER || '').trim();
  private readonly gmailAppPassword = String(process.env.GMAIL_APP_PASSWORD || '')
    .replace(/\s+/g, '')
    .trim();

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.gmailUser,
        pass: this.gmailAppPassword,
      },
    });
  }

  async verifyTransportOnStartup() {
    if (!this.gmailUser || !this.gmailAppPassword) {
      this.logger.warn(
        'Email is not fully configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.',
      );
      return;
    }

    try {
      await this.transporter.verify();
      this.logger.log('SMTP transporter verification succeeded.');
    } catch (error) {
      this.logSmtpError('SMTP transporter verification failed', error);
    }
  }

  private fromAddress() {
    const sender = this.gmailUser || 'no-reply@rentalbasic.com';
    return `"RentalBasic" <${sender}>`;
  }

  private logSmtpError(context: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : message;

    this.logger.error(context, stack);

    if (
      /Application-specific password required|InvalidSecondFactor|\b5\.7\.9\b/i.test(
        message,
      )
    ) {
      this.logger.error(
        'Gmail authentication failed (534 5.7.9). Use a Google App Password (16 chars, no spaces) from an account with 2-Step Verification enabled, then update GMAIL_APP_PASSWORD and restart the API service.',
      );
    }
  }

  private async sendMailOrThrow(mailOptions: SendMailOptions, context: string) {
    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      this.logSmtpError(context, error);
      throw error;
    }
  }

  async sendVendorOtpEmail(vendorEmail: string, otpCode: string, expiresAt: Date) {
    const expiresAtText = new Date(expiresAt).toLocaleString();

    await this.sendMailOrThrow({
      from: this.fromAddress(),
      to: vendorEmail,
      subject: 'Your RentalBasic verification code',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
            <div style="max-width: 560px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
              <h2 style="color: #2563eb; margin-top: 0;">Email OTP Verification</h2>
              <p>Use this one-time code to continue your vendor registration:</p>
              <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 18px 0; color: #111;">${otpCode}</p>
              <p>This code expires at <strong>${expiresAtText}</strong>.</p>
              <p style="font-size: 12px; color: #666; margin-top: 20px;">
                If you did not request this code, you can ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `Your RentalBasic OTP code is ${otpCode}. It expires at ${expiresAtText}.`,
    }, `Failed to send vendor OTP email to ${vendorEmail}`);

    this.logger.log(`Vendor OTP email sent to ${vendorEmail}`);
  }

  async sendVendorApprovalEmail(
    vendorEmail: string,
    vendorName: string,
    verificationBadge: string,
    vendorType: string,
    businessName: string,
  ) {
    const appUrl = process.env.VITE_CUSTOMER_APP_URL || 'https://rentalbasic.com';
    
    try {
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to: vendorEmail,
        subject: '✅ Your RentalBasic Verification is Approved!',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
                <h1 style="color: #2563eb; text-align: center;">🎉 Verification Approved!</h1>
                
                <p>Dear <strong>${vendorName}</strong>,</p>
                
                <p>Great news! Your vendor account has been verified and is now <strong>fully active</strong> on RentalBasic.</p>
                
                <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 20px 0; border-radius: 4px;">
                  <p><strong>Verification Badge:</strong></p>
                  <p style="font-size: 18px; color: #16a34a; font-weight: bold;">✓ ${verificationBadge}</p>
                  <p style="font-size: 12px; color: #666; margin: 8px 0 0 0;">
                    Business Type: <em>${vendorType.replace('_', ' ')}</em><br/>
                    Business Name: <em>${businessName}</em>
                  </p>
                </div>
                
                <h2 style="color: #1f2937; margin-top: 30px;">What's Next?</h2>
                <ul style="color: #555;">
                  <li><strong>Complete Your Shop:</strong> Upload photos and add a description</li>
                  <li><strong>Add Inventory:</strong> List your chairs, tables, and equipment</li>
                  <li><strong>Set Pricing:</strong> Configure delivery rates and terms</li>
                  <li><strong>Go Live:</strong> Start accepting bookings!</li>
                </ul>
                
                <div style="margin: 30px 0; text-align: center;">
                  <a href="${appUrl}/vendor/shop" 
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    🏪 Complete Your Shop
                  </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
                
                <p style="font-size: 12px; color: #666;">
                  If you have any questions, reply to this email or contact our support team.
                </p>
                
                <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
                  RentalBasic © 2026 | Event Rental Platform
                </p>
              </div>
            </body>
          </html>
        `,
      });

      this.logger.log(`Approval email sent to ${vendorEmail}`);
    } catch (error) {
      this.logSmtpError(`Failed to send approval email to ${vendorEmail}`, error);
      // Don't throw — fail silently so vendor isn't blocked if email fails
    }
  }

  async sendVendorRejectionEmail(
    vendorEmail: string,
    vendorName: string,
    rejectionReason: string,
    vendorType: string,
  ) {
    const appUrl = process.env.VITE_CUSTOMER_APP_URL || 'https://rentalbasic.com';
    
    try {
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to: vendorEmail,
        subject: '⚠️ Verification Update Required',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
                <h1 style="color: #dc2626; text-align: center;">⚠️ Verification Update Required</h1>
                
                <p>Dear <strong>${vendorName}</strong>,</p>
                
                <p>Your vendor verification requires additional information before we can approve your account. Please review the details below and resubmit.</p>
                
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 20px 0; border-radius: 4px;">
                  <p><strong>Reason:</strong></p>
                  <p style="font-size: 14px; color: #7f1d1d; white-space: pre-wrap;">${rejectionReason}</p>
                </div>
                
                <h2 style="color: #1f2937; margin-top: 30px;">What to do:</h2>
                <ol style="color: #555;">
                  <li>Log in to your RentalBasic account</li>
                  <li>Go to <strong>KYC Verification</strong> section</li>
                  <li>Update or resubmit the required documents</li>
                  <li>Our team will review again within 24 hours</li>
                </ol>
                
                <div style="margin: 30px 0; text-align: center;">
                  <a href="${appUrl}/vendor/kyc" 
                     style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    📝 Update KYC Info
                  </a>
                </div>
                
                <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">
                  <p style="font-size: 12px; color: #666; margin: 0;">
                    <strong>Need help?</strong> Check our <a href="${appUrl}/help/kyc" style="color: #2563eb;">KYC Requirements Guide</a> 
                    or contact support@rentalbasic.com
                  </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
                
                <p style="font-size: 12px; color: #666;">
                  This is an automated message. Please don't reply to this email.
                </p>
                
                <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
                  RentalBasic © 2026
                </p>
              </div>
            </body>
          </html>
        `,
      });

      this.logger.log(`Rejection email sent to ${vendorEmail}`);
    } catch (error) {
      this.logSmtpError(`Failed to send rejection email to ${vendorEmail}`, error);
    }
  }

  async sendVendorSuspensionEmail(
    vendorEmail: string,
    vendorName: string,
    suspensionReason: string,
    suspendedUntil?: string,
  ) {
    const appUrl = process.env.VITE_CUSTOMER_APP_URL || 'https://rentalbasic.com';
    const daysText = suspendedUntil 
      ? `until ${new Date(suspendedUntil).toLocaleDateString()}`
      : 'pending review';
    
    try {
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to: vendorEmail,
        subject: '🔒 Account Suspended',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
                <h1 style="color: #dc2626; text-align: center;">🔒 Account Suspended</h1>
                
                <p>Dear <strong>${vendorName}</strong>,</p>
                
                <p>Your RentalBasic vendor account has been temporarily suspended.</p>
                
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 20px 0; border-radius: 4px;">
                  <p><strong>Suspension Duration:</strong> ${daysText}</p>
                  <p style="margin: 12px 0 0 0;"><strong>Reason:</strong></p>
                  <p style="font-size: 14px; color: #7f1d1d; white-space: pre-wrap;">${suspensionReason}</p>
                </div>
                
                <h2 style="color: #1f2937; margin-top: 30px;">During This Time:</h2>
                <ul style="color: #555;">
                  <li>❌ You won't be able to accept new bookings</li>
                  <li>✅ Existing bookings will continue normally</li>
                  <li>✅ You can still view your dashboard</li>
                  <li>✅ You can appeal this decision</li>
                </ul>
                
                <div style="margin: 30px 0; text-align: center;">
                  <a href="${appUrl}/vendor/appeals" 
                     style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    📧 Appeal Suspension
                  </a>
                </div>
                
                <p style="color: #555; margin-top: 20px;">
                  If you believe this is a mistake or have questions, please contact our support team at 
                  <strong>support@rentalbasic.com</strong>
                </p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
                
                <p style="text-align: center; font-size: 12px; color: #999;">
                  RentalBasic © 2026
                </p>
              </div>
            </body>
          </html>
        `,
      });

      this.logger.log(`Suspension email sent to ${vendorEmail}`);
    } catch (error) {
      this.logSmtpError(`Failed to send suspension email to ${vendorEmail}`, error);
    }
  }
}
