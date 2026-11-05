function ensureSessions_() {
  // No synthetic sessions, locations, or recurring Thursday dates.
  // Owner creates explicit sessions in the existing private CRM after per-date GO.
  return 0;
}
function localDateTimeIso_(day, hhmm) {
  const parts = day.split('-').map(Number);
  const tm = hhmm.split(':').map(Number);
  const naive = new Date(Date.UTC(parts[0], parts[1]-1, parts[2], tm[0], tm[1], 0));
  const probe = new Date(Date.UTC(parts[0], parts[1]-1, parts[2], 12, 0, 0));
  const z = Utilities.formatDate(probe, APP.TIMEZONE, 'Z');
  const sign = z[0];
  const offH = Number(z.slice(1,3));
  const offM = Number(z.slice(3,5));
  const offsetMs = (offH*60 + offM) * 60000 * (sign === '+' ? 1 : -1);
  return new Date(naive.getTime() - offsetMs).toISOString();
}

function sessionById_(id) {
  return findOne_(SHEETS.SESSIONS, r => String(r.Session_ID) === String(id));
}

function bookedCount_(sessionId) {
  return findAll_(SHEETS.BOOKINGS, r => String(r.Session_ID) === String(sessionId) && ['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED'].includes(String(r.Status))).length;
}

function availableCapacity_(session,ignoreRequestId){
  if(!session) return 0;
  const safe=drusSafeCapacity_(session);
  if(!safe)return 0;
  const booked=bookedCount_(session.Session_ID);
  const held=findAll_(SHEETS.HOLDS,r=>String(r.Session_ID)===String(session.Session_ID)&&
    String(r.Status)==='ACTIVE'&&new Date(r.Expires_At)>new Date()&&
    (!ignoreRequestId||String(r.Request_ID)!==String(ignoreRequestId))).length;
  return Math.max(0,safe-booked-held);
}
function listSessionsPublic_() {
  ensureSessions_();
  const now = Date.now();
  const publicGates=drusCapacityGateMap_();
  const sessions = rows_(SHEETS.SESSIONS)
    .filter(r => String(r.Status || 'OPEN') === 'OPEN' && new Date(r.Start_DateTime).getTime() > now && drusSafeCapacity_(r,publicGates)>0)
    .sort((a,b) => new Date(a.Start_DateTime)-new Date(b.Start_DateTime))
    .slice(0, 60);

  // One snapshot per collection: never fetch Google Sheets once per session.
  // Preserve bookedCount_ and availableCapacity_ status/expiry semantics.
  const booked = {}, held = {};
  rows_(SHEETS.BOOKINGS).forEach(r => {
    if (!['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED'].includes(String(r.Status))) return;
    const key = String(r.Session_ID);
    booked[key] = (booked[key] || 0) + 1;
  });
  rows_(SHEETS.HOLDS).forEach(r => {
    if (String(r.Status) !== 'ACTIVE' || !(new Date(r.Expires_At).getTime() > now)) return;
    const key = String(r.Session_ID);
    held[key] = (held[key] || 0) + 1;
  });
  const cfg = configMap_();
  const gates=drusCapacityGateMap_();
  const novCutoff = novEffectiveDate_().getTime();
  return sessions.map(r => {
    const id = String(r.Session_ID);
    const capacity = Number(r.Capacity || APP.DEFAULT_CAPACITY);
    const policy = new Date(r.Start_DateTime).getTime() >= novCutoff
      ? String(cfg.NOV_POLICY_VERSION || 'DRU-2026-11-v1')
      : String(cfg.CURRENT_POLICY_VERSION || 'DRU-2026-10-v2');
    return {
      id, start:new Date(r.Start_DateTime).toISOString(), end:new Date(r.End_DateTime).toISOString(),
      theme:String(r.Theme||''), location:String(r.Location||APP.LOCATION), window:windowFor_(r.Start_DateTime),
      available:Math.max(0, drusSafeCapacity_(r,gates)-(booked[id]||0)-(held[id]||0)), capacity:drusSafeCapacity_(r,gates), policy
    };
  });
}

function syncSessionsToCalendar() {
  requireOwner_();
  return syncSessionsToCalendar_();
}

function syncSessionsToCalendar_() {
  return withLock_(()=>{
  const cfg=configMap_();
  if(!drusPaidRelease_().ok)return {created:0,linked:0,skipped:true,reason:'PAID_BOOKING_DISABLED'};
  if(cfg.CALENDAR_SYNC_ENABLED!==true) return {created:0,linked:0,skipped:true,reason:'CALENDAR_SYNC_ENABLED is false'};
  ensureSessions_();
  const cal = CalendarApp.getCalendarById(APP.CALENDAR_ID);
  if (!cal) throw new Error('Calendar not found');
  const portal=String(cfg.PORTAL_URL||'').trim();
  if(!portal) return {created:0,linked:0,skipped:true,reason:'PORTAL_URL is not configured'};
  let created=0, linked=0;
  const duplicateSessions=[];
  const gates=drusCapacityGateMap_();
  const linkedIds={};
  rows_(SHEETS.SESSIONS).forEach(r=>{ if(r.Calendar_Event_ID) linkedIds[String(r.Calendar_Event_ID)]=String(r.Session_ID); });
  rows_(SHEETS.SESSIONS).forEach(r => {
    if (String(r.Status||'OPEN') !== 'OPEN' || new Date(r.Start_DateTime) < new Date(Date.now()-86400000) || drusSafeCapacity_(r,gates)<=0) return;
    const linkedEvent=r.Calendar_Event_ID ? cal.getEventById(String(r.Calendar_Event_ID)) : null;
    const start = new Date(r.Start_DateTime), end = new Date(r.End_DateTime);
    const near = cal.getEvents(new Date(start.getTime()-5*60000), new Date(start.getTime()+5*60000));
    const candidates=near.filter(e=>{
      const tag=e.getTag('Druzina_Session_ID');
      return tag===String(r.Session_ID) || (!tag && /Dru[zž]ina/i.test(e.getTitle()) && e.getStartTime().getTime()===start.getTime() && (!linkedIds[e.getId()] || linkedIds[e.getId()]===String(r.Session_ID)));
    });
    if(candidates.length>1){ duplicateSessions.push(String(r.Session_ID)); return; }
    if(linkedEvent) return;
    let ev=candidates[0];
    if (!ev) {
      const title = 'Družina Moravy Training — ' + (r.Theme || 'Training');
      const desc = 'Controlled soft/LARP training. STOP and personal safety briefing required. Booking is confirmed only after bank and safety verification via: '+portal+'\nSession tariff is verified for this date; do not use old standing offers.';
      ev = cal.createEvent(title, start, end, {location:r.Location||APP.LOCATION, description:desc});
      created++;
    } else linked++;
    ev.setTag('Druzina_Session_ID',String(r.Session_ID));
    patchRow_(SHEETS.SESSIONS, r._row, {Calendar_Event_ID:ev.getId()});
    linkedIds[ev.getId()]=String(r.Session_ID);
  });
  return {created, linked, duplicateSessions};
  });
}
