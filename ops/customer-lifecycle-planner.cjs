'use strict';
// Pure, side-effect-free planner for EXISTING canonical CRM/Event rows.
// A plan is NOT a sent message, an issued invoice, a booking, a payment, or a live integration.
const { createHash } = require('node:crypto');
const APPROVED_EVENT_STATES = new Set(['ACTIVE_CONFIRMED', 'CONFIRMED']);
const TRUSTED_PAYMENT_SOURCES = new Set(['VERIFIED_STRIPE_WEBHOOK', 'BANK_READBACK_VERIFIED']);
const SAFE_FAQ = new Set(['REGISTRATION_LINK', 'TIME', 'VENUE', 'PRICE', 'CANCELLATION_POLICY']);

function ms(value) {
  const stamp = Date.parse(value || '');
  if (!Number.isFinite(stamp)) throw new Error('INVALID_TIMESTAMP');
  return stamp;
}
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function stableId(bookingId, action, seed = '') {
  return createHash('sha256').update([bookingId, action, seed].join('|')).digest('hex').slice(0, 24);
}
function planCustomerLifecycle(input) {
  const { event = {}, booking = {}, payment = {}, attendance = {}, policy = {}, deliveryLog = [], now } = input || {};
  const blocked = [];
  const actions = [];
  const nowMs = ms(now);
  if (!nonEmpty(event.id) || !nonEmpty(booking.id) || booking.event_id !== event.id) blocked.push('CANONICAL_IDS_MISSING_OR_MISMATCHED');
  if (!APPROVED_EVENT_STATES.has(event.status)) blocked.push('EVENT_NOT_CONFIRMED');
  if (event.venue_confirmed !== true || event.organizer_confirmed !== true || event.safety_confirmed !== true) blocked.push('VENUE_OR_SAFETY_NOT_CONFIRMED');
  if (!['OSVC', 'ZS'].includes(event.payee) || booking.payee !== event.payee) blocked.push('ENTITY_MISMATCH');
  if (!['SAVED', 'PENDING_PAYMENT', 'CONFIRMED', 'ATTENDED'].includes(booking.status) || booking.canonical_readback !== true) blocked.push('BOOKING_NOT_PERSISTED');
  if (booking.rules_accepted !== true) blocked.push('RULES_NOT_ACCEPTED');
  if (event.status === 'CANCELLED' || booking.status === 'CANCELLED') blocked.push('CANCELLED');
  if (!nonEmpty(event.starts_at) || !nonEmpty(event.ends_at)) blocked.push('EVENT_TIME_MISSING');
  let start, end;
  try { start = ms(event.starts_at); end = ms(event.ends_at); if (end <= start) blocked.push('EVENT_TIME_ORDER_INVALID'); }
  catch { blocked.push('EVENT_TIME_INVALID'); }
  if (!Array.isArray(deliveryLog)) blocked.push('DELIVERY_LOG_INVALID');
  if (blocked.length) return {status: 'BLOCKED', blocked, actions: []};
  const hasChannel = booking.email_verified === true || booking.phone_verified === true;
  if (!hasChannel) return {status: 'BLOCKED', blocked: ['CONTACT_CHANNEL_NOT_VERIFIED'], actions: []};
  const sentKeys = new Set(deliveryLog.filter(x => x && (x.status === 'SENT_VERIFIED' || x.status === 'QUEUED_VERIFIED')).map(x => x.key));
  function add(type, dueAt, opts = {}) {
    const id = stableId(booking.id, type, opts.seed || event.id);
    if (sentKeys.has(id)) return;
    actions.push({idempotency_key: id, type, event_id: event.id, booking_id: booking.id,
      payee: event.payee, due_at: new Date(dueAt).toISOString(), status: 'DRY_RUN_REVIEW_REQUIRED',
      channel: booking.email_verified ? 'EMAIL' : 'SMS', ...opts});
  }
  const price = Number.isInteger(policy.price_czk) && policy.price_czk >= 0 ? policy.price_czk : null;
  const paymentNeeded = policy.requires_payment === true;
  let paid = false;
  if (paymentNeeded) {
    if (price === null || policy.price_approved !== true || policy.payee_verified !== true) {
      return {status: 'BLOCKED', blocked: ['PAYMENT_POLICY_UNVERIFIED'], actions: []};
    }
    paid = payment.verified === true && TRUSTED_PAYMENT_SOURCES.has(payment.source)
      && payment.payee === event.payee && payment.booking_id === booking.id
      && Number.isInteger(payment.cleared_czk) && payment.cleared_czk >= price
      && nonEmpty(payment.provider_receipt_id);
    if (!paid && booking.status !== 'ATTENDED') {
      if (nonEmpty(policy.approved_checkout_url) && /^https:\/\//.test(policy.approved_checkout_url)) {
        add('PAYMENT_LINK', nowMs, {requires_owner_approval: false, checkout_url: policy.approved_checkout_url});
      } else blocked.push('APPROVED_CHECKOUT_URL_MISSING');
    }
  } else paid = true;
  // A 'success' redirect, client-provided flag or submitted invoice never settles an order.
  if (paid) {
    add('BOOKING_CONFIRMATION', nowMs, {requires_owner_approval: false});
    const reminderDue = start - 24*3600*1000;
    if (nowMs >= reminderDue && nowMs < start) add('PRE_EVENT_REMINDER', nowMs, {requires_owner_approval: false});
  }
  const attended = attendance.verified_by_organizer === true && attendance.booking_id === booking.id
    && nonEmpty(attendance.check_in_at) && ms(attendance.check_in_at) <= nowMs;
  if (attended && nowMs >= end) {
    add('POST_ATTENDANCE_THANK_YOU', nowMs, {requires_owner_approval: false});
    const upgrade = policy.upgrade || {};
    const deadline = ms(attendance.check_in_at) + 48*3600*1000;
    if (booking.marketing_opt_in === true && upgrade.approved === true
      && upgrade.payee === event.payee && nonEmpty(upgrade.sku)
      && Number.isInteger(upgrade.difference_czk) && upgrade.difference_czk > 0
      && nonEmpty(upgrade.checkout_url) && /^https:\/\//.test(upgrade.checkout_url)
      && nowMs <= deadline) {
      add('OPTIONAL_UPGRADE_OFFER', nowMs, {requires_owner_approval: false,
        deadline_at: new Date(deadline).toISOString(), checkout_url: upgrade.checkout_url,
        difference_czk: upgrade.difference_czk, sku: upgrade.sku});
    }
  }
  return {status: blocked.length ? 'PARTIALLY_BLOCKED' : 'READY_FOR_AUTHORIZED_ADAPTER', blocked, actions};
}

function planInboundReply(message, publicFacts = {}) {
  const {channel, message_id, intent, event_id, human_required} = message || {};
  if (!nonEmpty(message_id) || !['EMAIL', 'SMS', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'FACEBOOK'].includes(channel))
    return {status:'ESCALATE', reason:'UNKNOWN_CHANNEL_OR_MESSAGE'};
  if (human_required === true || !SAFE_FAQ.has(intent)) return {status:'ESCALATE', reason:'UNAPPROVED_OR_SENSITIVE_INTENT'};
  const event = publicFacts[event_id];
  if (!event || !APPROVED_EVENT_STATES.has(event.status) || event.public_approved !== true)
    return {status:'ESCALATE', reason:'CURRENT_EVENT_NOT_PUBLICLY_VERIFIED'};
  const field = {
    REGISTRATION_LINK:'registration_url', TIME:'time_public', VENUE:'venue_public',
    PRICE:'price_public', CANCELLATION_POLICY:'policy_url'
  }[intent];
  if (!nonEmpty(event[field])) return {status:'ESCALATE', reason:'CURRENT_FACT_UNAVAILABLE'};
  return {status:'REPLY_DRAFT', key:stableId(message_id, intent, event_id), channel, event_id, text:event[field], sent:false};
}

function assessLateBookingSurcharge({booked_at, published_at, event_start, policy = {}}) {
  const bookingTime = ms(booked_at), publishedTime = ms(published_at), eventTime = ms(event_start);
  if (policy.approved !== true || policy.prospective_terms_approved !== true || !Number.isInteger(policy.surcharge_czk)
      || policy.surcharge_czk < 0 || bookingTime < publishedTime || bookingTime >= eventTime)
    return {status:'NO_SURCHARGE'};
  const threshold = Number(policy.hours_before_event);
  if (!Number.isFinite(threshold) || threshold < 0) return {status:'NO_SURCHARGE'};
  const late = eventTime - bookingTime < threshold*3600*1000;
  return late ? {status:'DISPLAY_BEFORE_CHECKOUT', surcharge_czk:policy.surcharge_czk} : {status:'NO_SURCHARGE'};
}
module.exports = {planCustomerLifecycle,planInboundReply,assessLateBookingSurcharge,stableId};
