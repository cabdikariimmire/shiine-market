import { Resend } from 'resend';

// Server-side only Resend client instance
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Resend] RESEND_API_KEY is not defined in environment variables.');
    return null;
  }
  return new Resend(apiKey);
}

function getFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (fromEmail && fromEmail.trim()) {
    // If formatted like "Tukaan Alerts <alerts@domain.com>", use it, otherwise format
    if (fromEmail.includes('<')) return fromEmail.trim();
    return `Tukaan System <${fromEmail.trim()}>`;
  }
  return 'Tukaan System <onboarding@resend.dev>';
}

function normalizeRecipients(recipientInput: string | string[]): string[] {
  const list = Array.isArray(recipientInput) ? recipientInput : [recipientInput];
  const valid = list
    .map(e => (typeof e === 'string' ? e.trim() : ''))
    .filter(e => e.length > 3 && e.includes('@'));
  return Array.from(new Set(valid));
}

function formatResendError(error: any): string {
  if (!error) return 'Khalad lama filaan ah ayaa ku dhacay diritaanka email-ka';
  const msg = error.message || String(error);
  if (
    error.statusCode === 403 ||
    msg.includes('verify a domain') ||
    msg.includes('testing emails to your own email address') ||
    msg.includes('validation_error')
  ) {
    return 'Resend 403: Waxaa loo baahan yahay in domain-kaaga laga xaqiijiyo Resend (resend.com/domains) si email loogu diro shaqaalaha (Seller/Reporter/Admin).';
  }
  if (error.statusCode === 401 || msg.includes('API key')) {
    return 'Resend 401: Furaha RESEND_API_KEY ma shaqeynayo ama ma saxna.';
  }
  return msg;
}

// ============================================================================
// 1. ADMIN TEST EMAIL
// ============================================================================
export interface SendTestEmailParams {
  recipientEmail: string | string[];
  shopName?: string;
  adminName?: string;
}

export async function sendTestEmail({
  recipientEmail,
  shopName = 'Tukaan Shiine Supermarket',
  adminName = 'Admin'
}: SendTestEmailParams): Promise<{ success: boolean; messageId?: string; error?: string; recipients?: string[] }> {
  try {
    const resend = getResendClient();
    if (!resend) {
      return { 
        success: false, 
        error: 'RESEND_API_KEY lama helin server-ka. Fadlan ku dar Vercel Environment Variables.' 
      };
    }

    const recipients = normalizeRecipients(recipientEmail);
    if (recipients.length === 0) {
      return { success: false, error: 'Email sax ah oo loo diro lama helin.' };
    }

    const from = getFromEmail();
    const to = recipients.length === 1 ? recipients[0] : recipients;
    const recipientsDisplay = recipients.join(', ');
    const timestamp = new Date().toLocaleString('so-SO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const html = `
<!DOCTYPE html>
<html lang="so">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tijaabada Email-ka Resend</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color:#059669;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${shopName}</h1>
              <p style="margin:6px 0 0 0;color:#d1fae5;font-size:13px;font-weight:600;">Nidaamka Maamulka Dukaanka (Tukaan System)</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;padding:4px 12px;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:9999px;color:#047857;font-size:12px;font-weight:700;margin-bottom:16px;">
                ✓ Xiriirka Resend Wuu Guuleystay
              </div>

              <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:#0f172a;">Diritaanka Email-ka Tijaabada Ah</h2>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#475569;">
                Kani waa email tijaabo ah oo xaqiijinaya in adeegga <strong>Resend Email Service</strong> uu si buuxda ugu xiran yahay nidaamka dukaankaaga <strong>${shopName}</strong>.
              </p>

              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:600;">Email-ka Loo Diray:</td>
                  <td style="padding:6px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;font-family:monospace;">${recipientsDisplay}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:600;">Diraha (Sender):</td>
                  <td style="padding:6px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;font-family:monospace;">${from}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:600;">Maamulaha Tijaabiyey:</td>
                  <td style="padding:6px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${adminName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:600;">Taariikhda & Saacadda:</td>
                  <td style="padding:6px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${timestamp}</td>
                </tr>
              </table>

              <div style="background-color:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.5;">
                  <strong>Ogeysiis:</strong> Digniinaha kaydka yar (Low Stock), kuwa alaabta dhammaatay (Out of Stock), iyo xasuusinta daymaha (Debt Reminders) waxaa si toos ah loogu soo diri doonaa cinwaannada loo asteeyey (Admin, Seller, Reporter) markii ay dhacaan.
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                Haddii aadan adigu codsan tijaabadan, fadlan iska indhatir email-kan.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;">
                © ${new Date().getFullYear()} ${shopName} — Powered by Tukaan Management System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `[Tijaabo] Resend Email Service — ${shopName}`,
      html,
    });

    if (error) {
      console.error('[Resend Error] sendTestEmail failed:', error.message);
      return { success: false, error: formatResendError(error) };
    }

    return { success: true, messageId: data?.id, recipients };
  } catch (err: any) {
    console.error('[Resend Exception] sendTestEmail error:', err?.message || err);
    return { success: false, error: formatResendError(err) };
  }
}

// ============================================================================
// 2. LOW STOCK ALERT
// ============================================================================
export interface SendLowStockAlertParams {
  recipientEmail: string | string[];
  shopName?: string;
  productName: string;
  variantName?: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  sku?: string;
  barcode?: string;
}

export async function sendLowStockAlert({
  recipientEmail,
  shopName = 'Tukaan Shiine Supermarket',
  productName,
  variantName = 'Default',
  currentStock,
  minimumStock,
  unit,
  sku,
  barcode,
}: SendLowStockAlertParams): Promise<{ success: boolean; messageId?: string; error?: string; recipients?: string[] }> {
  try {
    const resend = getResendClient();
    if (!resend) return { success: false, error: 'RESEND_API_KEY is not configured.' };

    const recipients = normalizeRecipients(recipientEmail);
    if (recipients.length === 0) {
      return { success: false, error: 'No valid recipient email address provided.' };
    }

    const from = getFromEmail();
    const to = recipients.length === 1 ? recipients[0] : recipients;
    const timestamp = new Date().toLocaleString('so-SO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const displayVariant = variantName && variantName !== 'Default' ? `(${variantName})` : '';
    const fullProductName = `${productName} ${displayVariant}`.trim();

    const html = `
<!DOCTYPE html>
<html lang="so">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digniin: Kaydka Alaabtu Wuu Yar yahay (Low Stock)</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color:#d97706;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">⚠️ DIGNIIN: KAYDKA WAA YAR YAHAY</h1>
              <p style="margin:4px 0 0 0;color:#fef3c7;font-size:13px;font-weight:600;">${shopName} — Low Stock Alert</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">
                Nidaamka dukaanka wuxuu ogaaday in alaabta hoos ku xusan ay gaadhay ama ka hooseyso heerka ugu yar ee kaydka (Minimum Stock). Fadlan qorshee dalbasho cusub si uusan iibku u hakannin.
              </p>

              <!-- Product Card -->
              <div style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:24px;">
                <h2 style="margin:0 0 12px 0;font-size:17px;font-weight:800;color:#92400e;">${fullProductName}</h2>
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#78350f;font-weight:600;">Dukaanka (Shop):</td>
                    <td style="padding:6px 0;font-size:14px;color:#78350f;font-weight:700;text-align:right;">${shopName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#78350f;font-weight:600;">Kaydka Hadda Haray:</td>
                    <td style="padding:6px 0;font-size:16px;color:#b45309;font-weight:900;text-align:right;">${currentStock} ${unit}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#78350f;font-weight:600;">Heerka Ugu Yar (Min Stock):</td>
                    <td style="padding:6px 0;font-size:14px;color:#78350f;font-weight:700;text-align:right;">${minimumStock} ${unit}</td>
                  </tr>
                  ${sku ? `
                  <tr>
                    <td style="padding:6px 0;font-size:12px;color:#92400e;">SKU:</td>
                    <td style="padding:6px 0;font-size:12px;color:#78350f;font-family:monospace;text-align:right;">${sku}</td>
                  </tr>` : ''}
                  ${barcode ? `
                  <tr>
                    <td style="padding:6px 0;font-size:12px;color:#92400e;">Barcode:</td>
                    <td style="padding:6px 0;font-size:12px;color:#78350f;font-family:monospace;text-align:right;">${barcode}</td>
                  </tr>` : ''}
                </table>
              </div>

              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;padding-top:16px;margin-bottom:16px;">
                <tr>
                  <td style="font-size:12px;color:#64748b;">Wakhtiga Digniinta:</td>
                  <td style="font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${timestamp}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;">
                © ${new Date().getFullYear()} ${shopName} — Ogeysiis toos ah
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `⚠️ [Kayd Yar / Low Stock] ${fullProductName} — ${currentStock} ${unit} Haray (${shopName})`,
      html,
    });

    if (error) {
      console.error('[Resend Error] sendLowStockAlert failed:', error.message);
      return { success: false, error: formatResendError(error) };
    }

    return { success: true, messageId: data?.id, recipients };
  } catch (err: any) {
    console.error('[Resend Exception] sendLowStockAlert error:', err?.message || err);
    return { success: false, error: formatResendError(err) };
  }
}

// ============================================================================
// 3. OUT OF STOCK ALERT
// ============================================================================
export interface SendOutOfStockAlertParams {
  recipientEmail: string | string[];
  shopName?: string;
  productName: string;
  variantName?: string;
  minimumStock: number;
  unit: string;
  sku?: string;
  barcode?: string;
}

export async function sendOutOfStockAlert({
  recipientEmail,
  shopName = 'Tukaan Shiine Supermarket',
  productName,
  variantName = 'Default',
  minimumStock,
  unit,
  sku,
  barcode,
}: SendOutOfStockAlertParams): Promise<{ success: boolean; messageId?: string; error?: string; recipients?: string[] }> {
  try {
    const resend = getResendClient();
    if (!resend) return { success: false, error: 'RESEND_API_KEY is not configured.' };

    const recipients = normalizeRecipients(recipientEmail);
    if (recipients.length === 0) {
      return { success: false, error: 'No valid recipient email address provided.' };
    }

    const from = getFromEmail();
    const to = recipients.length === 1 ? recipients[0] : recipients;
    const timestamp = new Date().toLocaleString('so-SO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const displayVariant = variantName && variantName !== 'Default' ? `(${variantName})` : '';
    const fullProductName = `${productName} ${displayVariant}`.trim();

    const html = `
<!DOCTYPE html>
<html lang="so">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Degdeg: Alaabtu Waa Dhammaatay (Out of Stock)</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color:#dc2626;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">🚨 DEGDEG: ALAABTU WAA DHAMMAATAY</h1>
              <p style="margin:4px 0 0 0;color:#fee2e2;font-size:13px;font-weight:600;">${shopName} — Out of Stock Alert (0 Stock)</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">
                Kaydka alaabta hoos ku xusan wuxuu gaadhay <strong>0 (Eber)</strong>. Iibka alaabtan hadda ma suurtagalayo ilaa laga keeno kayd cusub.
              </p>

              <!-- Product Card -->
              <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px;">
                <h2 style="margin:0 0 12px 0;font-size:17px;font-weight:800;color:#991b1b;">${fullProductName}</h2>
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#7f1d1d;font-weight:600;">Dukaanka (Shop):</td>
                    <td style="padding:6px 0;font-size:14px;color:#7f1d1d;font-weight:700;text-align:right;">${shopName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#7f1d1d;font-weight:600;">Kaydka Hadda:</td>
                    <td style="padding:6px 0;font-size:18px;color:#dc2626;font-weight:900;text-align:right;">0 ${unit} (Dhammaatay)</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#7f1d1d;font-weight:600;">Heerka Ugu Yar (Min Stock):</td>
                    <td style="padding:6px 0;font-size:14px;color:#7f1d1d;font-weight:700;text-align:right;">${minimumStock} ${unit}</td>
                  </tr>
                  ${sku ? `
                  <tr>
                    <td style="padding:6px 0;font-size:12px;color:#991b1b;">SKU:</td>
                    <td style="padding:6px 0;font-size:12px;color:#7f1d1d;font-family:monospace;text-align:right;">${sku}</td>
                  </tr>` : ''}
                  ${barcode ? `
                  <tr>
                    <td style="padding:6px 0;font-size:12px;color:#991b1b;">Barcode:</td>
                    <td style="padding:6px 0;font-size:12px;color:#7f1d1d;font-family:monospace;text-align:right;">${barcode}</td>
                  </tr>` : ''}
                </table>
              </div>

              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;padding-top:16px;margin-bottom:16px;">
                <tr>
                  <td style="font-size:12px;color:#64748b;">Wakhtiga Ogeysiiska:</td>
                  <td style="font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${timestamp}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;">
                © ${new Date().getFullYear()} ${shopName} — Ogeysiis toos ah
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `🚨 [Alaab Dhammaatay / Out of Stock] ${fullProductName} (0 ${unit}) — ${shopName}`,
      html,
    });

    if (error) {
      console.error('[Resend Error] sendOutOfStockAlert failed:', error.message);
      return { success: false, error: formatResendError(error) };
    }

    return { success: true, messageId: data?.id, recipients };
  } catch (err: any) {
    console.error('[Resend Exception] sendOutOfStockAlert error:', err?.message || err);
    return { success: false, error: formatResendError(err) };
  }
}

// ============================================================================
// 4. DEBT REMINDER ALERT
// ============================================================================
export interface SendDebtReminderAlertParams {
  recipientEmail: string | string[];
  shopName?: string;
  customerName: string;
  customerPhone?: string;
  originalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate?: string;
  daysOverdue?: number;
  currency?: string;
  itemsSummary?: string;
}

export async function sendDebtReminderAlert({
  recipientEmail,
  shopName = 'Tukaan Shiine Supermarket',
  customerName,
  customerPhone,
  originalAmount,
  amountPaid,
  remainingBalance,
  dueDate,
  daysOverdue = 0,
  currency = '$',
  itemsSummary,
}: SendDebtReminderAlertParams): Promise<{ success: boolean; messageId?: string; error?: string; recipients?: string[] }> {
  try {
    const resend = getResendClient();
    if (!resend) return { success: false, error: 'RESEND_API_KEY is not configured.' };

    const recipients = normalizeRecipients(recipientEmail);
    if (recipients.length === 0) {
      return { success: false, error: 'No valid recipient email address provided.' };
    }

    const from = getFromEmail();
    const to = recipients.length === 1 ? recipients[0] : recipients;
    const timestamp = new Date().toLocaleString('so-SO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isOverdue = daysOverdue > 0;
    const bannerColor = isOverdue ? '#dc2626' : '#2563eb';
    const bannerTitle = isOverdue ? '⚠️ XASUUSIN: DAYN XILLIGEEDII DHAAFTAY' : '📋 XASUUSIN: DAYN GARSIIYEY XILLIGII DIGNIINTA';

    const html = `
<!DOCTYPE html>
<html lang="so">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xasuusinta Daynta</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color:${bannerColor};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:800;">${bannerTitle}</h1>
              <p style="margin:4px 0 0 0;color:#e0e7ff;font-size:13px;font-weight:600;">${shopName} — Debt Reminder</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">
                Xisaabinta dukaanka waxay xasuusinaysaa daynta macmiilka hoos ku xusan oo gaadhay xilligii ballanta ama xilliga digniinta ee la qorsheeyey.
              </p>

              <!-- Debt Card -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
                <h2 style="margin:0 0 12px 0;font-size:17px;font-weight:800;color:#0f172a;">Macmiilka: ${customerName}</h2>
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600;">Dukaanka:</td>
                    <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${shopName}</td>
                  </tr>
                  ${customerPhone ? `
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600;">Taleefanka:</td>
                    <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;font-family:monospace;">${customerPhone}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600;">Wadarta Daynta Hore:</td>
                    <td style="padding:6px 0;font-size:14px;color:#475569;font-weight:700;text-align:right;font-family:monospace;">${currency}${originalAmount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600;">Lacagta La Bixiyey:</td>
                    <td style="padding:6px 0;font-size:14px;color:#059669;font-weight:700;text-align:right;font-family:monospace;">${currency}${amountPaid.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:800;">Haraaga Daynta (Balance):</td>
                    <td style="padding:6px 0;font-size:18px;color:#dc2626;font-weight:900;text-align:right;font-family:monospace;">${currency}${remainingBalance.toFixed(2)}</td>
                  </tr>
                  ${dueDate ? `
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600;">Xilligii Ballanta:</td>
                    <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${dueDate}</td>
                  </tr>` : ''}
                  ${isOverdue ? `
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#dc2626;font-weight:700;">Wakhtiga Dhaafay:</td>
                    <td style="padding:6px 0;font-size:13px;color:#dc2626;font-weight:800;text-align:right;">${daysOverdue} Maalmood</td>
                  </tr>` : ''}
                  ${itemsSummary ? `
                  <tr>
                    <td colspan="2" style="padding-top:10px;font-size:12px;color:#64748b;">
                      <strong>Alaabta:</strong> ${itemsSummary}
                    </td>
                  </tr>` : ''}
                </table>
              </div>

              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;padding-top:16px;margin-bottom:16px;">
                <tr>
                  <td style="font-size:12px;color:#64748b;">Wakhtiga Ogeysiiska:</td>
                  <td style="font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${timestamp}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;">
                © ${new Date().getFullYear()} ${shopName} — Ogeysiis toos ah
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `📋 [Xasuusin Dayn / Debt Reminder] ${customerName} — ${currency}${remainingBalance.toFixed(2)} Haray (${shopName})`,
      html,
    });

    if (error) {
      console.error('[Resend Error] sendDebtReminderAlert failed:', error.message);
      return { success: false, error: formatResendError(error) };
    }

    return { success: true, messageId: data?.id, recipients };
  } catch (err: any) {
    console.error('[Resend Exception] sendDebtReminderAlert error:', err?.message || err);
    return { success: false, error: formatResendError(err) };
  }
}
