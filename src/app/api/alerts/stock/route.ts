import { NextRequest, NextResponse } from 'next/server';
import { sendLowStockAlert, sendOutOfStockAlert } from '@/lib/email/resend';
import { supabase } from '@/lib/supabase/client';

// In-memory 24-hour deduplication cache for guaranteed spam protection
const recentStockAlertsCache = new Map<string, number>();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isCachedDuplicate(variantId: string, alertType: string, recipient: string): boolean {
  const key = `${variantId}:${alertType}:${recipient.toLowerCase().trim()}`;
  const lastSent = recentStockAlertsCache.get(key);
  if (lastSent && Date.now() - lastSent < TWENTY_FOUR_HOURS_MS) {
    return true;
  }
  return false;
}

function recordInCache(variantId: string, alertType: string, recipient: string) {
  const key = `${variantId}:${alertType}:${recipient.toLowerCase().trim()}`;
  recentStockAlertsCache.set(key, Date.now());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      variantId,
      productName,
      variantName,
      currentStock,
      minimumStock,
      unit,
      sku,
      barcode,
      shopName,
      recipientEmail,
      recipientEmails,
      lowStockEnabled = true,
      outOfStockEnabled = true,
    } = body;

    // Collect and normalize recipient email list
    let targets: string[] = [];
    if (Array.isArray(recipientEmails)) {
      targets = recipientEmails.filter((e: any) => typeof e === 'string' && e.includes('@'));
    } else if (recipientEmail && typeof recipientEmail === 'string' && recipientEmail.includes('@')) {
      targets = [recipientEmail.trim()];
    }

    if (!variantId || !productName || targets.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required stock alert fields or valid recipient emails' 
      }, { status: 400 });
    }

    const numStock = Number(currentStock ?? 0);
    const numMin = Number(minimumStock ?? 0);
    const isOutOfStock = numStock <= 0;
    const isLowStock = numStock > 0 && numStock <= numMin;

    if (!isOutOfStock && !isLowStock) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Stock is above minimum threshold' });
    }

    const alertType = isOutOfStock ? 'out_of_stock' : 'low_stock';

    // Check if alert is enabled
    if (isOutOfStock && !outOfStockEnabled) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Out of stock email alerts are disabled in settings' });
    }
    if (isLowStock && !lowStockEnabled) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Low stock email alerts are disabled in settings' });
    }

    // 1. In-memory 24-hour Deduplication check
    const allCached = targets.every((t) => isCachedDuplicate(variantId, alertType, t));
    if (allCached && targets.length > 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Duplicate prevention: ${alertType} alert was already sent for this item in the last 24h.`,
      });
    }

    // 2. Database 24-hour Deduplication check (if sent_email_alerts table is present in Supabase)
    const twentyFourHoursAgo = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
    try {
      const { data: recentAlerts } = await supabase
        .from('sent_email_alerts')
        .select('id, created_at')
        .eq('entity_id', variantId)
        .eq('alert_type', alertType)
        .eq('status', 'sent')
        .gte('created_at', twentyFourHoursAgo)
        .limit(1);

      if (recentAlerts && recentAlerts.length > 0) {
        targets.forEach((t) => recordInCache(variantId, alertType, t));
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: `Duplicate prevention: ${alertType} alert was already sent for this item in the last 24h.`,
        });
      }
    } catch (checkErr) {
      // Fallback silently if table not yet migrated
    }

    // Dispatch email to all target recipients
    let result;
    if (isOutOfStock) {
      result = await sendOutOfStockAlert({
        recipientEmail: targets,
        shopName: shopName || 'Tukaan Shiine Supermarket',
        productName,
        variantName: variantName || 'Default',
        minimumStock: numMin,
        unit: unit || 'kg',
        sku,
        barcode,
      });
    } else {
      result = await sendLowStockAlert({
        recipientEmail: targets,
        shopName: shopName || 'Tukaan Shiine Supermarket',
        productName,
        variantName: variantName || 'Default',
        currentStock: numStock,
        minimumStock: numMin,
        unit: unit || 'kg',
        sku,
        barcode,
      });
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // Cache sent timestamp for all recipients
    targets.forEach((t) => recordInCache(variantId, alertType, t));

    // Record in sent_email_alerts for permanent auditing (graceful catch)
    try {
      const records = targets.map((rec) => ({
        alert_type: alertType,
        recipient_email: rec.trim(),
        entity_id: variantId,
        subject: isOutOfStock
          ? `[Alaab Dhammaatay] ${productName}`
          : `[Kayd Yar] ${productName} (${numStock} ${unit})`,
        status: 'sent',
        details: { currentStock: numStock, minimumStock: numMin, messageId: result.messageId, recipients: targets },
        created_at: new Date().toISOString(),
      }));

      await supabase.from('sent_email_alerts').insert(records);
    } catch (dbErr) {
      // Table might not exist yet before SQL migration is applied
    }

    return NextResponse.json({
      success: true,
      alertType,
      messageId: result.messageId,
      recipients: result.recipients,
    });
  } catch (err: any) {
    console.error('[API /api/alerts/stock error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error while processing stock alert' },
      { status: 500 }
    );
  }
}
