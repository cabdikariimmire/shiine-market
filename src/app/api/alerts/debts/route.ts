import { NextRequest, NextResponse } from 'next/server';
import { sendDebtReminderAlert } from '@/lib/email/resend';
import { supabase } from '@/lib/supabase/client';

// In-memory 24-hour deduplication cache for guaranteed debt reminder protection
const recentDebtAlertsCache = new Map<string, number>();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isCachedDuplicate(debtId: string, recipient: string): boolean {
  const key = `${debtId}:debt_reminder:${recipient.toLowerCase().trim()}`;
  const lastSent = recentDebtAlertsCache.get(key);
  if (lastSent && Date.now() - lastSent < TWENTY_FOUR_HOURS_MS) {
    return true;
  }
  return false;
}

function recordInCache(debtId: string, recipient: string) {
  const key = `${debtId}:debt_reminder:${recipient.toLowerCase().trim()}`;
  recentDebtAlertsCache.set(key, Date.now());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      debtId,
      recipientEmail,
      recipientEmails,
      shopName,
      customerName,
      customerPhone,
      originalAmount,
      amountPaid,
      remainingBalance,
      dueDate,
      daysOverdue,
      currency,
      itemsSummary,
    } = body;

    let targets: string[] = [];
    if (Array.isArray(recipientEmails)) {
      targets = recipientEmails.filter((e: any) => typeof e === 'string' && e.includes('@'));
    } else if (recipientEmail && typeof recipientEmail === 'string' && recipientEmail.includes('@')) {
      targets = [recipientEmail.trim()];
    }

    if (debtId && targets.length > 0 && customerName) {
      // 1. In-memory 24-hour Deduplication check
      const allCached = targets.every((t) => isCachedDuplicate(debtId, t));
      if (allCached && targets.length > 0) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'Duplicate protection: Debt reminder already sent within the last 24h for this debt.',
        });
      }

      // 2. Database 24-hour Deduplication check
      const twentyFourHoursAgo = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
      try {
        const { data: recentAlerts } = await supabase
          .from('sent_email_alerts')
          .select('id, created_at')
          .eq('entity_id', debtId)
          .eq('alert_type', 'debt_reminder')
          .eq('status', 'sent')
          .gte('created_at', twentyFourHoursAgo)
          .limit(1);

        if (recentAlerts && recentAlerts.length > 0) {
          targets.forEach((t) => recordInCache(debtId, t));
          return NextResponse.json({
            success: true,
            skipped: true,
            reason: 'Duplicate protection: Debt reminder already sent within the last 24h for this debt.',
          });
        }
      } catch (checkErr) {
        // Fallback silently if table not yet migrated
      }

      const result = await sendDebtReminderAlert({
        recipientEmail: targets,
        shopName: shopName || 'Tukaan Shiine Supermarket',
        customerName,
        customerPhone,
        originalAmount: Number(originalAmount || 0),
        amountPaid: Number(amountPaid || 0),
        remainingBalance: Number(remainingBalance || 0),
        dueDate,
        daysOverdue: Number(daysOverdue || 0),
        currency: currency || '$',
        itemsSummary,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }

      // Cache sent timestamp for all recipients
      targets.forEach((t) => recordInCache(debtId, t));

      try {
        const records = targets.map((rec) => ({
          alert_type: 'debt_reminder',
          recipient_email: rec.trim(),
          entity_id: debtId,
          subject: `[Xasuusin Dayn] ${customerName} (${currency || '$'}${remainingBalance})`,
          status: 'sent',
          details: { debtId, remainingBalance, messageId: result.messageId, recipients: targets },
          created_at: new Date().toISOString(),
        }));

        await supabase.from('sent_email_alerts').insert(records);
      } catch (dbErr) {
        // Fallback gracefully
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        recipients: result.recipients,
      });
    }

    return NextResponse.json({ success: false, error: 'Xogta daynta ama email-ka ayaa dhiman' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/alerts/debts error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error while processing debt reminder' },
      { status: 500 }
    );
  }
}
