import nodemailer from 'nodemailer';
import { Approval } from '../models/Approval.model';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendApprovalEmail(approval: Approval) {
  const approvalUrl = `${process.env.FRONTEND_URL}/approve/${approval.token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@thamm.com',
    to: approval.customerEmail,
    subject: `PDF-Freigabe benötigt: ${approval.fileName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>PDF-Freigabe angefordert</h2>
          </div>
          <div class="content">
            <p>Guten Tag ${approval.customerName || ''},</p>

            <p>Sie haben eine neue PDF-Datei zur Freigabe erhalten:</p>

            <p><strong>Datei:</strong> ${approval.fileName}</p>
            <p><strong>Job-ID:</strong> ${approval.jobId}</p>

            <p>Bitte prüfen Sie die Datei und geben Sie diese frei oder weisen Sie sie zurück:</p>

            <a href="${approvalUrl}" class="button">PDF prüfen und freigeben</a>

            <div class="warning">
              <strong>Wichtig:</strong> Dieser Link ist ${process.env.APPROVAL_EXPIRY_DAYS || 7} Tage gültig und läuft am ${approval.expiresAt.toLocaleDateString('de-DE')} ab.
            </div>

            <p>Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border: 1px solid #ddd;">
              ${approvalUrl}
            </p>
          </div>
          <div class="footer">
            <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.</p>
            <p>Bei Fragen wenden Sie sich bitte an Ihren Ansprechpartner.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      PDF-Freigabe angefordert

      Guten Tag ${approval.customerName || ''},

      Sie haben eine neue PDF-Datei zur Freigabe erhalten:

      Datei: ${approval.fileName}
      Job-ID: ${approval.jobId}

      Bitte öffnen Sie diesen Link zur Prüfung und Freigabe:
      ${approvalUrl}

      Wichtig: Dieser Link ist ${process.env.APPROVAL_EXPIRY_DAYS || 7} Tage gültig.

      Bei Fragen wenden Sie sich bitte an Ihren Ansprechpartner.
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Approval email sent to ${approval.customerEmail} for job ${approval.jobId}`);
  } catch (error) {
    logger.error('Failed to send approval email:', error);
    throw error;
  }
}

export async function sendStatusUpdateEmail(approval: Approval) {
  const statusText = approval.status === 'approved' ? 'freigegeben' : 'zurückgewiesen';
  const statusColor = approval.status === 'approved' ? '#27ae60' : '#e74c3c';

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@thamm.com',
    to: approval.customerEmail,
    subject: `PDF ${statusText}: ${approval.fileName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>PDF ${statusText}</h2>
          </div>
          <div class="content">
            <p>Guten Tag,</p>

            <p>Die PDF-Datei wurde ${statusText}:</p>

            <p><strong>Datei:</strong> ${approval.fileName}</p>
            <p><strong>Job-ID:</strong> ${approval.jobId}</p>
            <p><strong>Status:</strong> ${statusText}</p>
            ${approval.status === 'approved' ? `<p><strong>Freigegeben von:</strong> ${approval.approvedBy}</p>` : ''}
            ${approval.status === 'rejected' ? `<p><strong>Grund der Zurückweisung:</strong> ${approval.rejectedReason}</p>` : ''}
            ${approval.comments ? `<p><strong>Kommentare:</strong> ${approval.comments}</p>` : ''}
          </div>
          <div class="footer">
            <p>Diese E-Mail wurde automatisch generiert.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Status update email sent for job ${approval.jobId}`);
  } catch (error) {
    logger.error('Failed to send status update email:', error);
  }
}