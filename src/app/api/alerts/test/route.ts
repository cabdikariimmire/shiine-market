import { NextRequest, NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/resend';
import { supabase } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientEmail, recipientEmails, shopName, adminName } = body;

    let targets: string[] = [];
    if (Array.isArray(recipientEmails)) {
      targets = recipientEmails.filter((e: any) => typeof e === 'string' && e.includes('@'));
    } else if (recipientEmail && typeof recipientEmail === 'string' && recipientEmail.includes('@')) {
      targets = [recipientEmail.trim()];
    }

    if (targets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Email sax ah lama gelin (Valid recipient email is required)' },
        { status: 400 }
      );
    }

    const result = await sendTestEmail({
      recipientEmail: targets,
      shopName: shopName || 'Tukaan Shiine Supermarket',
      adminName: adminName || 'Admin',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Diritaanka email-ka wuu fashilmay' },
        { status: 500 }
      );
    }

    // Record in sent_email_alerts table (graceful catch)
    try {
      const records = targets.map((rec) => ({
        alert_type: 'test',
        recipient_email: rec.trim(),
        entity_id: 'admin_test',
        subject: `[Tijaabo] Resend Email Service — ${shopName || 'Tukaan'}`,
        status: 'sent',
        details: { adminName, messageId: result.messageId, recipients: targets },
        created_at: new Date().toISOString(),
      }));

      await supabase.from('sent_email_alerts').insert(records);
    } catch (dbErr) {
      console.warn('[DB Notice] Could not log test email to sent_email_alerts:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Email-ka tijaabada ah si guul leh ayaa loo diray!',
      messageId: result.messageId,
      recipients: result.recipients,
    });
  } catch (err: any) {
    console.error('[API /api/alerts/test error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error while sending test email' },
      { status: 500 }
    );
  }
}
