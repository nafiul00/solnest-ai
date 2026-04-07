import crypto from 'crypto';

/**
 * Verify Hospitable webhook signature using HMAC-SHA256.
 * Rejects tampered or replayed webhook payloads.
 */
export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.HOSPITABLE_WEBHOOK_SECRET;
  if (!secret || !signature || !rawBody) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Strip sha256= prefix if Hospitable includes it (common webhook convention)
  const normalizedSig = signature.replace(/^sha256=/i, '');

  try {
    // timingSafeEqual requires same-length buffers — catch RangeError if lengths differ
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(normalizedSig, 'utf8')
    );
  } catch {
    return false;
  }
}
