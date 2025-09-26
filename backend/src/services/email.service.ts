import nodemailer from 'nodemailer';
import { Approval } from '../models/Approval.model';
import { Order } from '../models/Order.model';
import { logger } from '../utils/logger';

// Lazy initialization der SMTP-Konfiguration
let transporter: any = null;

function getTransporter() {
  // Force recreate transporter to pick up new .env values
  if (true) {  // Changed from (!transporter) to force recreation
    // Debug: Log SMTP configuration when creating transporter
    logger.info('Creating SMTP transporter with config:', {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_SECURE: process.env.SMTP_SECURE
    });

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.thamm.de',  // Fallback
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'thamm\\switch',  // Fallback
        pass: process.env.SMTP_PASS || 'switch'          // Fallback
      }
    });

    logger.info('SMTP transporter created with host:', transporter.options.host);
  }
  return transporter;
}

// NEW: Send order collection email
export async function sendOrderCollectionEmail(order: Order, approvals: Approval[]) {
  const orderToken = await order.ensureToken();
  const orderCollectionUrl = `${process.env.FRONTEND_URL}/order-collection/${orderToken}`;

  logger.info('Preparing to send order collection email:', {
    to: order.customerEmail,
    orderNumber: order.orderNumber,
    approvalCount: approvals.length,
    orderCollectionUrl
  });

  // Group approvals by material
  const approvalsByMaterial: { [material: string]: Approval[] } = {};
  approvals.forEach(approval => {
    const material = approval.material || 'Unbekanntes Material';
    if (!approvalsByMaterial[material]) {
      approvalsByMaterial[material] = [];
    }
    approvalsByMaterial[material].push(approval);
  });

  // Build material overview for email
  let materialOverview = '';
  Object.keys(approvalsByMaterial).forEach(material => {
    const materialApprovals = approvalsByMaterial[material];
    materialOverview += `
      <div style="margin: 10px 0; padding: 10px; border-left: 4px solid #3498db; background-color: #f8f9fa;">
        <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${material}</h4>
        <ul style="margin: 5px 0; padding-left: 20px;">
    `;

    materialApprovals.forEach(approval => {
      materialOverview += `
        <li style="margin: 5px 0;">
          <strong>Position ${approval.positionNumber || '?'}:</strong> ${approval.fileName}
        </li>
      `;
    });

    materialOverview += `
        </ul>
      </div>
    `;
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@thamm.com',
    to: order.customerEmail,
    subject: `Auftragsfreigabe benötigt: ${order.orderNumber} (${approvals.length} Dateien)`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 25px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 15px 30px; background: #27ae60; color: white; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; }
          .button:hover { background: #219a52; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat { text-align: center; padding: 15px; background: white; border-radius: 6px; border: 1px solid #e9ecef; }
          .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; margin: 0; }
          .stat-label { font-size: 12px; color: #6c757d; margin: 5px 0 0 0; }
          .highlight-box { background: white; padding: 20px; border-radius: 6px; border: 1px solid #e9ecef; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📋 Auftragsfreigabe</h1>
            <h2 style="margin: 10px 0 0 0; font-weight: normal;">Auftrag ${order.orderNumber}</h2>
          </div>
          <div class="content">
            <p>Guten Tag ${order.customerName || ''},</p>

            <p>Sie haben einen neuen Auftrag mit <strong>${approvals.length} PDF-Dateien</strong> zur Freigabe erhalten.</p>

            <div class="highlight-box">
              <p><strong>📋 Auftragsnummer:</strong> ${order.orderNumber}</p>
              <p><strong>📧 Kunde:</strong> ${order.customerName || order.customerEmail}</p>
              <p><strong>📅 Erstellt am:</strong> ${order.createdAt.toLocaleDateString('de-DE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>

            <div class="stats">
              <div class="stat">
                <p class="stat-number">${approvals.length}</p>
                <p class="stat-label">Dateien gesamt</p>
              </div>
              <div class="stat">
                <p class="stat-number">${Object.keys(approvalsByMaterial).length}</p>
                <p class="stat-label">Materialien</p>
              </div>
              <div class="stat">
                <p class="stat-number">${order.emailThrottleMinutes}</p>
                <p class="stat-label">Min. bis nächste E-Mail</p>
              </div>
            </div>

            <h3 style="color: #2c3e50; margin: 25px 0 15px 0;">📦 Materialübersicht:</h3>
            ${materialOverview}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${orderCollectionUrl}" class="button" target="_blank" rel="noopener noreferrer">
                🔍 Auftrag öffnen und Dateien prüfen
              </a>
            </div>

            <div class="warning">
              <strong>💡 So funktioniert's:</strong><br>
              • Klicken Sie auf den Button oben, um zur Auftragsübersicht zu gelangen<br>
              • Dort können Sie alle Dateien nach Material sortiert betrachten<br>
              • Einzelne Dateien oder ganze Gruppen freigeben/ablehnen<br>
              • Ihre Entscheidungen werden sofort verarbeitet
            </div>

            <div class="warning">
              <strong>⏰ Wichtig:</strong> Diese Links sind ${process.env.APPROVAL_EXPIRY_DAYS || 7} Tage gültig.
              Bei Fragen zu einzelnen Materialien verwenden Sie bitte die Kommentarfunktion.
            </div>

            <p>Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              ${orderCollectionUrl}
            </p>
          </div>
          <div class="footer">
            <p>Diese E-Mail wurde automatisch vom ThammApprove-System generiert.</p>
            <p>Weitere Dateien für diesen Auftrag werden <strong>nicht</strong> per E-Mail angekündigt (Throttling aktiv für ${order.emailThrottleMinutes} Minuten).</p>
            <p>Bei Fragen wenden Sie sich bitte an Ihren Ansprechpartner.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Auftragsfreigabe benötigt: ${order.orderNumber}

      Guten Tag ${order.customerName || ''},

      Sie haben einen neuen Auftrag mit ${approvals.length} PDF-Dateien zur Freigabe erhalten.

      Auftragsnummer: ${order.orderNumber}
      Kunde: ${order.customerName || order.customerEmail}
      Dateien gesamt: ${approvals.length}
      Materialien: ${Object.keys(approvalsByMaterial).length}

      Materialübersicht:
      ${Object.keys(approvalsByMaterial).map(material => {
        const materialApprovals = approvalsByMaterial[material];
        return `${material}: ${materialApprovals.length} Dateien`;
      }).join('\n      ')}

      Öffnen Sie diesen Link zur Auftragsübersicht:
      ${orderCollectionUrl}

      Wichtig: Diese Links sind ${process.env.APPROVAL_EXPIRY_DAYS || 7} Tage gültig.
      Weitere Dateien für diesen Auftrag werden nicht per E-Mail angekündigt.

      Bei Fragen wenden Sie sich bitte an Ihren Ansprechpartner.
    `
  };

  try {
    const smtpTransporter = getTransporter();
    const info = await smtpTransporter.sendMail(mailOptions);
    logger.info('Order collection email sent successfully:', {
      to: order.customerEmail,
      orderNumber: order.orderNumber,
      approvalCount: approvals.length,
      messageId: info.messageId,
      response: info.response
    });
  } catch (error) {
    logger.error('Failed to send order collection email:', {
      error: error.message,
      to: order.customerEmail,
      orderNumber: order.orderNumber,
      smtpConfig: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER
      }
    });
    throw error;
  }
}

// Legacy individual approval email (for single approvals)
export async function sendApprovalEmail(approval: Approval) {
  logger.info('sendApprovalEmail called with:', {
    id: approval.id,
    jobId: approval.jobId,
    orderNumber: approval.orderNumber,
    hasOrder: !!approval.orderNumber
  });

  // Check if this is part of an order collection
  if (approval.orderNumber) {
    logger.info('Skipping individual email for order collection approval:', {
      jobId: approval.jobId,
      orderNumber: approval.orderNumber
    });
    return; // Don't send individual emails for order collection items
  }

  const approvalUrl = `${process.env.FRONTEND_URL}/approve/${approval.token}`;

  logger.info('Preparing to send individual approval email:', {
    to: approval.customerEmail,
    approvalId: approval.id,
    token: approval.token,
    approvalUrl
  });

  if (!approval.token) {
    throw new Error('Approval token is missing - cannot generate approval URL');
  }

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

            <a href="${approvalUrl}" class="button" target="_blank" rel="noopener noreferrer">PDF prüfen und freigeben</a>

            <div class="warning">
              <strong>Wichtig:</strong> Dieser Link ist ${process.env.APPROVAL_EXPIRY_DAYS || 7} Tage gültig und läuft am ${approval.expiresAt ? approval.expiresAt.toLocaleDateString('de-DE') : 'unbekannt'} ab.
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
    const smtpTransporter = getTransporter();
    const info = await smtpTransporter.sendMail(mailOptions);
    logger.info('Individual approval email sent successfully:', {
      to: approval.customerEmail,
      jobId: approval.jobId,
      messageId: info.messageId,
      response: info.response
    });
  } catch (error) {
    logger.error('Failed to send individual approval email:', {
      error: error.message,
      to: approval.customerEmail,
      jobId: approval.jobId,
      smtpConfig: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER
      }
    });
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
            ${approval.orderNumber ? `<p><strong>Auftragsnummer:</strong> ${approval.orderNumber}</p>` : ''}
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
    const smtpTransporter = getTransporter();
    await smtpTransporter.sendMail(mailOptions);
    logger.info(`Status update email sent for job ${approval.jobId}`);
  } catch (error) {
    logger.error('Failed to send status update email:', error);
  }
}