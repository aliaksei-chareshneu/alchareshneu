"""Offline Chromium checks of the real console HTML and Google callback lifecycle.

All responses are synthetic. No Google login, CRM, bank or other network call.
"""
import os
from pathlib import Path
import unittest

from playwright.sync_api import sync_playwright


CONSOLE = Path(__file__).resolve().parents[2] / 'OperatorConsole.html'
BRIDGE = r"""
window.fixtureCalls = [];
window.fixtureTimers = [];
window.fixtureSchedules = [];
window.fixtureNow = Date.now();
Date.now = () => fixtureNow;
const nativeTimeout = window.setTimeout.bind(window);
const nativeClearTimeout = window.clearTimeout.bind(window);
window.setTimeout = (callback, delay, ...args) => {
  if (delay >= 1000 && delay <= 90000) {
    window.fixtureTimers.push(callback);
    const id = 100000 + window.fixtureTimers.length;
    fixtureSchedules.push({callback, id, at: fixtureNow + delay, canceled: false, fired: false});
    return id;
  }
  return nativeTimeout(callback, delay, ...args);
};
window.clearTimeout = id => {
  const timer = fixtureSchedules[id - 100001];
  if (timer) timer.canceled = true;
  else nativeClearTimeout(id);
};
window.fixtureTick = ms => {
  fixtureNow += ms;
  for (const timer of [...fixtureSchedules]) {
    if (!timer.canceled && !timer.fired && timer.at <= fixtureNow) {
      timer.fired = true;
      timer.callback();
    }
  }
};
const runner = (success, failure) => ({
  withSuccessHandler: callback => runner(callback, failure),
  withFailureHandler: callback => runner(success, callback),
  operatorSnapshot: () => fixtureCalls.push({method: 'snapshot', success, failure}),
  operatorAction: action => fixtureCalls.push({method: action, success, failure})
});
window.google = {script: {run: runner()}};
"""


def snapshot():
    return {
        'at': '2026-10-21T08:00:00Z',
        'capabilities': {
            'recoveryState': 'MODULE_MISSING',
            'actions': {'syncOSVC': True, 'syncDruzina': True,
                        'previewPayments': True, 'previewRecovery': False,
                        'pauseRecovery': False},
        },
        'banks': {
            'osvc': {'balance': 0, 'configured': True, 'lastSuccess': ''},
            'druzina': {'balance': None, 'configured': True, 'lastSuccess': ''},
        },
        'leads': {'count': 1, 'excludedTests': 0,
                  'queue': {'total': 1, 'overdue': 0, 'today': 0, 'upcoming': 1,
                            'noDate': 0, 'invalidDate': 0, 'shown': 1, 'limit': 40,
                            'truncated': False, 'timeZone': 'Europe/Prague'},
                  'needsAction': [
            {'id': 'TEST-ONLY', 'service': 'Fixture service',
             'stage': 'New', 'next': '2026-10-22', 'dueState': 'UPCOMING'}]},
        'social': [{'id': 'TEST-ONLY-JOB', 'channel': 'Fixture', 'event': 'TEST-ONLY',
                    'status': 'DRAFT', 'verified': False, 'state': 'DRAFT', 'reason': 'DRAFT',
                    'receipt': '', 'scheduled': '2026-10-22T08:00:00Z'}],
        'socialQueue': {'total': 1, 'attention': 0, 'pending': 0, 'draft': 1,
                        'inactive': 0, 'verified': 0, 'shown': 1, 'limit': 100, 'truncated': False},
        'events': [{'id': 'TEST-ONLY-EVENT', 'title': 'TEST-ONLY event', 'date': '2026-10-22T08:00:00Z',
                    'end': '2026-10-22T09:00:00Z', 'startAt': '2026-10-22T08:00:00.000Z',
                    'endAt': '2026-10-22T09:00:00.000Z', 'community': 'Fixture',
                    'state': 'UPCOMING', 'reason': 'RANGE_VALID'}],
        'eventQueue': {'total': 1, 'live': 0, 'today': 0, 'upcoming': 1, 'review': 0,
                       'past': 0, 'shown': 1, 'limit': 100, 'truncated': False, 'timeZone': 'Europe/Prague'},
        'missing': [], 'ingestion': 'TEST_ONLY',
        'leadUrl': '', 'socialUrl': '', 'eventUrl': '',
    }


def recovery_snapshot():
    data = snapshot()
    data['capabilities']['recoveryState'] = 'ENABLED_NOT_VERIFIED'
    data['capabilities']['actions'].update(previewRecovery=True, pauseRecovery=True)
    data['recoveryDiagnostics'] = {
        'mode': 'ENABLED_NOT_VERIFIED', 'bound': True, 'formConfigured': True,
        'since': {'state': 'RECORDED', 'at': '2026-10-01T08:00:00.000Z'},
        'lastOk': {'state': 'MISSING', 'at': None},
        'lastError': {'state': 'RECORDED', 'at': '2026-10-21T07:30:00.000Z'},
        'reason': 'ERROR_RECORDED',
    }
    return data


def recovery_report(**changes):
    return {**dict(mode='READ_ONLY', responseCount=60, missingLeads=55, batchLimit=50,
                   exactFormTriggers=3, recovered=0, cashVerified=False, publicPostsSent=0,
                   checkedAt='2026-10-21T08:01:00.000Z'), **changes}


def payment_report():
    return {
        'mode': 'READ_ONLY', 'entity': 'DRUZINA', 'settled': 0,
        'rows': [{'transaction': '7001', 'payment': 'TEST-ONLY-PAYMENT',
                  'amount': 120, 'status': 'CANDIDATE_ONLY'}],
        'total': 1, 'truncated': False, 'checkedAt': '2026-10-22T08:01:00.000Z',
        'bank': {'fresh': True, 'lastSuccess': '2026-10-22T10:00:00+02:00'},
        'queue': {'total': 1, 'candidates': 1, 'review': 0, 'unmatched': 0,
                  'excluded': 0, 'shown': 1, 'limit': 100, 'truncated': False},
    }


class ConsoleBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch()
        except Exception:
            cls.playwright.stop()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={'width': 1100, 'height': 850}, offline=True)
        self.addCleanup(self.context.close)
        self.context.add_init_script(script=BRIDGE)
        self.page = self.context.new_page()
        self.errors, self.remote_requests = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.remote_requests.append(request.url)
                     if request.url.startswith(('http://', 'https://')) else None)
        self.page.goto(CONSOLE.as_uri())
        self.respond(0, snapshot())

    def tearDown(self):
        artifacts = os.environ.get('CONSOLE_BROWSER_ARTIFACTS')
        if artifacts:
            directory = Path(artifacts)
            directory.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=str(directory / (self._testMethodName + '.png')),
                                 full_page=True)
        self.assertEqual(self.errors, [])
        self.assertEqual(self.remote_requests, [])

    def respond(self, index, data):
        self.page.evaluate('([index, data]) => fixtureCalls[index].success(data)',
                           [index, data])

    def expire(self):
        self.page.evaluate('fixtureTimers[fixtureTimers.length - 1]()')

    def calls(self):
        return self.page.evaluate('fixtureCalls.map(call => call.method)')

    def bank_button(self, action='syncOSVC'):
        return self.page.locator('button[data-action="' + action + '"]')

    def test_recovery_report_fits_mobile_and_automatic_reads_do_not_rerun_it(self):
        self.page.set_viewport_size({'width': 375, 'height': 812})
        self.page.locator('#refresh').click()
        self.respond(1, recovery_snapshot())
        self.page.locator('[data-tab="system"]').click()
        self.assertFalse(self.page.locator('#recoveryPreview').is_visible())
        self.bank_button('previewRecovery').click()
        self.respond(2, recovery_report())
        self.assertEqual(self.page.locator('#recoveryResponses').inner_text(), '60')
        self.assertEqual(self.page.locator('#recoveryMissing').inner_text(), '55')
        self.assertEqual(self.page.locator('#recoveryTriggers').inner_text(), '3')
        self.assertIn('несколько обработчиков', self.page.locator('#recoveryFindings').inner_text())
        self.assertIn('21.10.2026, 10:01', self.page.locator('#recoveryCheckedAt').inner_text())
        self.assertIn('50', self.page.locator('#recoveryBatch').inner_text())
        previous = self.page.locator('#recoveryPreview').inner_text()
        self.page.evaluate('fixtureTick(60000)')
        self.respond(3, recovery_snapshot())
        self.assertEqual(self.calls(), ['snapshot', 'snapshot', 'previewRecovery', 'snapshot'])
        self.assertEqual(self.page.locator('#recoveryPreview').inner_text(), previous)
        self.bank_button('previewRecovery').click()
        self.respond(4, recovery_report(responseCount=0, missingLeads=0, exactFormTriggers=0))
        self.assertIn('не найдено', self.page.locator('#recoveryFindings').inner_text())
        self.assertIn('Обработчик этой формы не найден', self.page.locator('#recoveryFindings').inner_text())
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))

    def test_malformed_failed_and_late_recovery_reports_keep_the_last_complete_report(self):
        self.page.locator('#refresh').click()
        self.respond(1, recovery_snapshot())
        self.page.locator('[data-tab="system"]').click()
        self.bank_button('previewRecovery').click()
        self.respond(2, recovery_report(exactFormTriggers=1))
        previous = self.page.locator('#recoveryPreview').inner_text()
        self.assertIn('приём новых заявок этим не подтверждён', previous)
        self.bank_button('previewRecovery').click()
        self.respond(3, recovery_report(missingLeads=61, error='<img onerror="window.injected=true">'))
        self.assertEqual(self.page.locator('#recoveryPreview').inner_text(), previous)
        self.assertIn('не удалось отобразить', self.page.locator('#message').inner_text())
        self.page.locator('#refresh').click()
        self.respond(4, recovery_snapshot())
        self.bank_button('previewRecovery').click()
        self.expire()
        self.assertIn('Отчёт не получен за 90 секунд', self.page.locator('#message').inner_text())
        self.page.locator('#refresh').click()
        self.respond(6, recovery_snapshot())
        self.respond(5, recovery_report(missingLeads=0))
        self.assertEqual(self.page.locator('#recoveryPreview').inner_text(), previous)
        self.bank_button('previewRecovery').click()
        self.page.evaluate('fixtureCalls[7].failure({message: "PRIVATE-FIXTURE"})')
        self.assertEqual(self.page.locator('#recoveryPreview').inner_text(), previous)
        self.assertIn('Не удалось получить отчёт', self.page.locator('#message').inner_text())
        self.assertNotIn('PRIVATE-FIXTURE', self.page.locator('body').inner_text())
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual(self.calls().count('previewRecovery'), 4)

    def test_recovery_markers_update_without_form_queries_and_invalid_metadata_keeps_prior_data(self):
        self.page.locator('#refresh').click()
        data = recovery_snapshot()
        self.respond(1, data)
        self.page.locator('[data-tab="system"]').click()
        self.assertIn('отметка ошибки', self.page.locator('#recoveryDiagnostics').inner_text())
        self.assertIn('21.10.2026, 09:30', self.page.locator('#recoveryMarkers').inner_text())
        self.assertIn('НЕ ПРОВЕРЕНО', self.page.locator('#recovery').inner_text())
        data['recoveryDiagnostics']['lastOk'] = {'state': 'RECORDED', 'at': '2026-10-21T07:45:00.000Z'}
        data['recoveryDiagnostics']['reason'] = 'RECORDS_PRESENT'
        self.page.evaluate('fixtureTick(60000)')
        self.respond(2, data)
        previous = self.page.locator('#recoveryMarkers').inner_text()
        self.assertIn('текущая работа не проверена', self.page.locator('#recoveryDiagnostics').inner_text())
        data['recoveryDiagnostics']['lastOk']['at'] = '2026-10-22T07:45:00.000Z'
        data['banks']['osvc']['balance'] = 999
        self.page.locator('#refresh').click()
        self.respond(3, data)
        self.assertEqual(self.page.locator('#recoveryMarkers').inner_text(), previous)
        self.assertNotIn('999', self.page.locator('#osvcBalance').inner_text())
        self.page.locator('#refresh').click()
        self.respond(4, snapshot())
        self.assertIn('недоступна в этой версии', self.page.locator('#recoveryDiagnostics').inner_text())
        self.assertEqual(self.page.locator('#recoveryMarkers').inner_text(), '')
        self.assertNotIn('previewRecovery', self.calls())

    def test_pause_receipt_survives_snapshot_refresh_and_rejects_incomplete_confirmation(self):
        self.page.locator('#refresh').click()
        self.respond(1, recovery_snapshot())
        self.page.locator('[data-tab="system"]').click()
        self.bank_button('pauseRecovery').click()
        self.respond(2, {'status': 'UNKNOWN'})
        self.assertEqual(self.page.locator('#recoveryActionState').inner_text(), '')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot', 'pauseRecovery'])
        self.page.locator('#refresh').click()
        self.respond(3, recovery_snapshot())
        self.bank_button('pauseRecovery').click()
        self.respond(4, {'status': 'PAUSED'})
        self.assertEqual(self.calls(), ['snapshot', 'snapshot', 'pauseRecovery', 'snapshot', 'pauseRecovery', 'snapshot'])
        paused = recovery_snapshot()
        paused['capabilities']['recoveryState'] = 'PAUSED'
        paused['capabilities']['actions']['pauseRecovery'] = False
        paused['recoveryDiagnostics']['mode'] = 'PAUSED'
        self.respond(5, paused)
        self.assertIn('приостановлено', self.page.locator('#recovery').inner_text())
        self.assertIn('Подтверждение паузы получено', self.page.locator('#recoveryActionState').inner_text())
        self.assertIn('может продолжить выполнение', self.page.locator('#recoveryActionState').inner_text())
        self.assertTrue(self.bank_button('pauseRecovery').is_disabled())
        self.assertNotIn('{"status"', self.page.locator('body').inner_text())

    def test_timeout_refresh_and_late_receipt_never_repeat_bank_request(self):
        self.bank_button().evaluate('(button) => {button.click(); button.click()}')
        self.assertEqual(self.calls(), ['snapshot', 'syncOSVC'])
        self.expire()
        self.assertTrue(self.page.locator('#refresh').is_enabled())
        self.assertIn('НЕ ПРОВЕРЕН', self.page.locator('#message').inner_text())
        self.page.locator('#refresh').click()
        updated = snapshot()
        updated['banks']['osvc']['balance'] = 150
        self.respond(2, updated)
        self.assertTrue(self.bank_button().is_disabled())
        self.assertTrue(self.bank_button('syncDruzina').is_disabled())
        self.assertTrue(self.page.locator('#bankPending').is_visible())
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual(self.calls(), ['snapshot', 'syncOSVC', 'snapshot'])
        self.respond(1, {'imported': 0})
        self.assertTrue(self.bank_button().is_enabled())
        self.assertFalse(self.page.locator('#bankPending').is_visible())
        self.assertIn('150', self.page.locator('#osvcBalance').inner_text())
        self.assertEqual(self.calls(), ['snapshot', 'syncOSVC', 'snapshot'])

    def test_incomplete_snapshot_preserves_visible_records_and_recovers(self):
        self.page.locator('[data-tab="leads"]').click()
        previous = self.page.locator('#leadTable').inner_text()
        self.page.locator('#refresh').click()
        invalid = snapshot()
        del invalid['leads']
        invalid['banks']['osvc']['balance'] = 999
        self.respond(1, invalid)
        self.assertEqual(self.page.locator('#leadTable').inner_text(), previous)
        self.assertNotIn('999', self.page.locator('#osvcBalance').inner_text())
        self.assertIn('не удалось отобразить', self.page.locator('#message').inner_text())
        self.assertTrue(self.page.locator('#refresh').is_enabled())
        self.page.locator('#refresh').click()
        self.respond(2, snapshot())
        self.assertTrue(self.bank_button().is_enabled())

    def test_incomplete_reconciliation_does_not_replace_previous_preview(self):
        preview = {'mode': 'READ_ONLY', 'entity': 'DRUZINA', 'settled': 0,
                   'rows': [{'transaction': '7001', 'payment': '',
                             'amount': 120, 'status': 'UNMATCHED'}],
                   'total': 1, 'truncated': False, 'bank': {'fresh': False}}
        self.page.locator('[data-action="previewPayments"]').click()
        self.respond(1, preview)
        previous = self.page.locator('#paymentTable').inner_text()
        self.assertIn('7001', previous)
        self.page.locator('[data-action="previewPayments"]').click()
        del preview['bank']
        self.respond(2, preview)
        self.assertEqual(self.page.locator('#paymentTable').inner_text(), previous)
        self.assertIn('не удалось отобразить', self.page.locator('#message').inner_text())

    def test_payment_queue_shows_full_counts_russian_explanations_and_safe_mobile_table(self):
        self.page.set_viewport_size({'width': 375, 'height': 812})
        report = payment_report()
        report['rows'][0]['payment'] = '<img src=x onerror="window.injected=true">'
        report['rows'].append({'transaction': '7002', 'payment': '', 'amount': None,
                               'status': 'INVALID_AMOUNT'})
        report['rows'].extend({'transaction': str(7100+i), 'payment': '', 'amount': -10,
                               'status': 'DEBIT_OR_ZERO'} for i in range(98))
        report.update(total=112, truncated=True)
        report['queue'].update(total=112, review=1, excluded=110, shown=100, truncated=True)
        self.bank_button('previewPayments').click()
        self.respond(1, report)
        self.assertIn('Показано 100 из 112', self.page.locator('#paymentState').inner_text())
        self.assertIn('расходы или ноль: 110', self.page.locator('#paymentQueue').inner_text())
        self.assertIn('Совпадение для проверки', self.page.locator('#paymentTable tr').nth(1).inner_text())
        self.assertIn('Не определена', self.page.locator('#paymentTable tr').nth(2).inner_text())
        self.assertIn('22.10.2026, 10:01', self.page.locator('#paymentCheckedAt').inner_text())
        self.assertIn('менее двух часов', self.page.locator('#paymentBankState').inner_text())
        self.assertEqual(self.page.locator('#paymentTable img').count(), 0)
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertTrue(self.page.locator('#paymentTable').evaluate('e => e.scrollWidth > e.clientWidth'))
        self.page.locator('#paymentTable').evaluate('e => e.scrollLeft = e.scrollWidth')
        self.assertGreater(self.page.locator('#paymentTable').evaluate('e => e.scrollLeft'), 0)
        self.page.locator('#paymentTable').evaluate('e => e.scrollLeft = 0')
        if os.environ.get('CONSOLE_BROWSER_ARTIFACTS'):
            self.page.locator('#paymentState').scroll_into_view_if_needed()
            self.page.screenshot(path=str(Path(os.environ['CONSOLE_BROWSER_ARTIFACTS']) / 'payment-mobile-viewport.png'))

    def test_automatic_snapshots_keep_payment_report_time_and_bank_evidence_unchanged(self):
        self.bank_button('previewPayments').click()
        self.respond(1, payment_report())
        selectors = ['#paymentState', '#paymentCheckedAt', '#paymentQueue', '#paymentBankState', '#paymentTable']
        previous = [self.page.locator(selector).inner_text() for selector in selectors]
        self.page.evaluate('fixtureTick(60000)')
        data = snapshot()
        data['at'] = '2026-10-22T09:01:00Z'
        data['banks']['druzina']['lastSuccess'] = '2026-10-22T11:00:00+02:00'
        self.respond(2, data)
        self.assertEqual([self.page.locator(selector).inner_text() for selector in selectors], previous)
        self.assertEqual(self.calls(), ['snapshot', 'previewPayments', 'snapshot'])

    def test_invalid_failed_and_late_payment_reports_keep_previous_report_without_retries(self):
        self.bank_button('previewPayments').click()
        self.respond(1, payment_report())
        selectors = ['#paymentState', '#paymentCheckedAt', '#paymentQueue', '#paymentBankState', '#paymentTable']
        previous = [self.page.locator(selector).inner_text() for selector in selectors]
        self.bank_button('previewPayments').click()
        invalid = payment_report()
        invalid.update(entity='OSVC', settled=1)
        self.respond(2, invalid)
        self.assertIn('не удалось отобразить', self.page.locator('#message').inner_text())
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual(len(self.calls()), 3)
        self.page.locator('#refresh').click()
        self.respond(3, snapshot())
        self.bank_button('previewPayments').click()
        self.expire()
        self.assertIn('90 секунд', self.page.locator('#message').inner_text())
        self.page.locator('#refresh').click()
        self.respond(5, snapshot())
        late = payment_report()
        late['rows'][0]['payment'] = 'TEST-ONLY-LATE'
        self.respond(4, late)
        self.bank_button('previewPayments').click()
        self.page.evaluate('fixtureCalls[6].failure({message: "PRIVATE-FIXTURE"})')
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual([self.page.locator(selector).inner_text() for selector in selectors], previous)
        self.assertEqual(self.calls().count('previewPayments'), 4)
        self.assertNotIn('PRIVATE-FIXTURE', self.page.locator('body').inner_text())

    def test_payment_report_handles_bank_age_boundary_and_legacy_metadata(self):
        report = payment_report()
        report['checkedAt'] = '2026-10-22T10:00:00.000Z'
        self.bank_button('previewPayments').click()
        self.respond(1, report)
        self.assertIn('не подтверждена', self.page.locator('#paymentBankState').inner_text())
        self.assertIn('7001', self.page.locator('#paymentTable').inner_text())
        report.pop('queue')
        report.pop('checkedAt')
        report['bank'] = {'fresh': False, 'lastSuccess': 'PRIVATE-FIXTURE'}
        self.bank_button('previewPayments').click()
        self.respond(2, report)
        self.assertIn('недоступно', self.page.locator('#paymentCheckedAt').inner_text())
        self.assertIn('недоступны', self.page.locator('#paymentQueue').inner_text())
        self.assertIn('нет корректной отметки', self.page.locator('#paymentBankState').inner_text())
        self.assertNotIn('PRIVATE-FIXTURE', self.page.locator('body').inner_text())

    def test_mobile_tabs_fit_and_external_values_remain_text(self):
        self.page.set_viewport_size({'width': 375, 'height': 812})
        self.assertIn('0', self.page.locator('#osvcBalance').inner_text())
        self.assertEqual(self.page.locator('#ngoBalance').inner_text(), 'НЕ ПРОВЕРЕНО')
        self.page.locator('#refresh').click()
        data = snapshot()
        data['leads']['needsAction'][0]['service'] = '<img src="https://example.org/x" onerror="window.injected=true">'
        self.respond(1, data)
        for section in ('leads', 'content', 'community', 'system', 'money'):
            self.page.locator('[data-tab="' + section + '"]').click()
            self.assertTrue(self.page.locator('#' + section).is_visible())
            self.assertTrue(self.page.evaluate(
                'document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertEqual(self.page.locator('#leadTable img').count(), 0)
        self.assertIsNone(self.page.evaluate('window.injected'))

    def test_google_bridge_failure_leaves_refresh_available(self):
        self.page.evaluate('() => {google.script.run.withSuccessHandler = () => {throw Error("fixture bridge error")}}')
        self.page.locator('#refresh').click()
        self.assertTrue(self.page.locator('#refresh').is_enabled())
        self.assertIn('Не удалось отправить', self.page.locator('#message').inner_text())
        self.assertTrue(self.bank_button().is_disabled())

    def test_automatic_refresh_only_reads_snapshots(self):
        self.page.evaluate('fixtureTick(60000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])
        self.respond(1, snapshot())
        self.page.evaluate('fixtureTick(60000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot', 'snapshot'])
        self.respond(2, snapshot())
        self.assertIn('Раз в минуту', self.page.locator('#autoRefreshStatus').inner_text())

    def test_automatic_refresh_toggle_and_visibility_pause(self):
        self.page.locator('#autoRefresh').uncheck()
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual(self.calls(), ['snapshot'])
        self.page.locator('#refresh').click()
        self.respond(1, snapshot())
        self.page.evaluate('fixtureTick(60000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])
        self.page.locator('#autoRefresh').check()
        self.page.evaluate('''() => {
          Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'});
          document.dispatchEvent(new Event('visibilitychange'));
          fixtureTick(120000);
        }''')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])
        self.assertIn('неактивна', self.page.locator('#autoRefreshStatus').inner_text())
        self.page.evaluate('''() => {
          Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'});
          document.dispatchEvent(new Event('visibilitychange'));
          fixtureTick(1000);
        }''')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot', 'snapshot'])
        self.respond(2, snapshot())

    def test_automatic_refresh_stops_on_error_and_manual_refresh_recovers(self):
        self.page.evaluate('fixtureTick(60000);fixtureCalls[1].failure()')
        self.page.evaluate('fixtureTick(300000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])
        self.assertIn('после ошибки', self.page.locator('#autoRefreshStatus').inner_text())
        self.page.locator('#refresh').click()
        self.respond(2, snapshot())
        self.page.evaluate('fixtureTick(60000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot', 'snapshot', 'snapshot'])
        self.respond(3, snapshot())

    def test_lead_queue_shows_priority_totals_truncation_and_untrusted_dates(self):
        data = snapshot()
        rows = [
            {'id': 'OVERDUE-FIRST', 'next': '2026-10-20T08:00:00Z', 'dueState': 'OVERDUE'},
            {'id': 'TODAY', 'next': '2026-10-21', 'dueState': 'TODAY'},
            {'id': 'REVIEW-DATE', 'next': '<img src="https://example.org/x" onerror="window.injected=true">', 'dueState': 'INVALID_DATE'},
            {'id': 'NO-DATE', 'next': '', 'dueState': 'NO_DATE'},
        ] + [{'id': 'FUTURE-' + str(i), 'next': '2026-10-22', 'dueState': 'UPCOMING'} for i in range(36)]
        data['leads'] = {'count': 45, 'excludedTests': 0, 'needsAction': rows,
                         'queue': {'total': 45, 'overdue': 1, 'today': 1, 'upcoming': 41,
                                   'noDate': 1, 'invalidDate': 1, 'shown': 40, 'limit': 40,
                                   'truncated': True, 'timeZone': 'Europe/Prague'}}
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.page.set_viewport_size({'width': 375, 'height': 812})
        self.page.locator('[data-tab="leads"]').click()
        self.assertIn('Показано 40 из 45 — полный список в CRM', self.page.locator('#leadQueue').inner_text())
        self.assertIn('просрочено: 1', self.page.locator('#leadQueue').inner_text())
        cells = self.page.locator('#leadTable tr').nth(1).locator('td').all_text_contents()
        self.assertEqual(cells[1], 'OVERDUE-FIRST')
        self.assertIn('10:00:00', cells[4])
        self.assertEqual(cells[0], 'Просрочено')
        self.assertIn('21.10.2026 · весь день', self.page.locator('#leadTable').inner_text())
        self.assertIn('Проверьте дату', self.page.locator('#leadTable').inner_text())
        self.assertEqual(self.page.locator('#leadTable img').count(), 0)
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.assertTrue(self.page.locator('#leadTable').evaluate('(table) => table.scrollWidth > table.clientWidth'))
        self.page.locator('#leadTable').focus()
        self.page.locator('#leadTable').evaluate('(table) => {table.scrollLeft = table.scrollWidth}')
        self.assertGreater(self.page.locator('#leadTable').evaluate('(table) => table.scrollLeft'), 0)

    def test_automatic_snapshot_updates_lead_priority_without_actions(self):
        data = snapshot()
        data['at'] = '2026-10-22T08:00:00Z'
        data['leads']['queue'].update(upcoming=0, today=1)
        data['leads']['needsAction'][0]['dueState'] = 'TODAY'
        data['events'][0]['state'] = 'LIVE'
        data['eventQueue'].update(upcoming=0, live=1)
        self.page.evaluate('fixtureTick(60000)')
        self.respond(1, data)
        self.page.locator('[data-tab="leads"]').click()
        self.assertIn('сегодня: 1', self.page.locator('#leadQueue').inner_text())
        self.assertEqual(self.page.locator('#leadTable tr').nth(1).locator('td').first.inner_text(), 'Сегодня')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])

    def test_missing_leads_or_older_module_never_shows_zero_as_a_verified_queue(self):
        data = snapshot()
        del data['leads']['queue']
        del data['leads']['needsAction'][0]['dueState']
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.page.locator('[data-tab="leads"]').click()
        self.assertIn('недоступен в этой версии', self.page.locator('#leadQueue').inner_text())
        data['missing'] = ['Leads']
        self.page.locator('#refresh').click()
        self.respond(2, data)
        self.assertIn('Данные заявок недоступны', self.page.locator('#leadCount').inner_text())
        self.assertIn('Очередь недоступна', self.page.locator('#leadQueue').inner_text())
        self.assertNotIn('Открытых задач: 0', self.page.locator('#leadQueue').inner_text())
        self.assertEqual(self.page.locator('#leadTable td').count(), 0)

    def test_broken_lead_queue_keeps_prior_data_until_manual_recovery(self):
        self.page.locator('[data-tab="leads"]').click()
        previous = self.page.locator('#leadQueue').inner_text()
        data = snapshot()
        data['leads']['queue']['total'] = 999
        data['banks']['osvc']['balance'] = 999
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.assertEqual(self.page.locator('#leadQueue').inner_text(), previous)
        self.assertNotIn('999', self.page.locator('#osvcBalance').inner_text())
        self.assertIn('не удалось отобразить', self.page.locator('#message').inner_text())
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])
        self.page.locator('#refresh').click()
        self.respond(2, snapshot())
        self.assertEqual(self.page.locator('#leadQueue').inner_text(), previous)

    def test_publication_monitor_shows_problems_totals_and_safe_receipt_links_on_mobile(self):
        data = snapshot()
        template = data['social'][0]
        data['social'] = [dict(template, id='LIMIT-FIRST', status='ERROR_LIMIT', state='ATTENTION', reason='PROVIDER_LIMIT',
                               error='Bearer RAW_FIXTURE_SECRET'),
                          dict(template, id='WAITING', status='SCHEDULED_PENDING', state='PENDING', reason='WAITING')]
        data['social'] += [dict(template, id='DRAFT-' + str(i)) for i in range(97)]
        data['social'].append(dict(template, id='CONFIRMED', status='PUBLISHED_VERIFIED', state='VERIFIED', reason='VERIFIED',
                                   verified=True, receipt='https://example.org/posts/fixture-42'))
        data['socialQueue'] = {'total': 130, 'attention': 1, 'pending': 1, 'draft': 97,
                               'inactive': 0, 'verified': 31, 'shown': 100, 'limit': 100, 'truncated': True}
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.page.locator('[data-tab="content"]').click()
        self.page.set_viewport_size({'width': 375, 'height': 812})
        summary = self.page.locator('#socialQueue').inner_text()
        self.assertIn('требуют внимания: 1', summary)
        self.assertIn('подтверждено в Hub: 31', summary)
        self.assertIn('Показано 100 из 130 — полная очередь в Hub', summary)
        first = self.page.locator('#socialTable tr').nth(1).inner_text()
        self.assertIn('Требует внимания', first)
        self.assertIn('LIMIT-FIRST', first)
        self.assertIn('Ограничение сервиса', first)
        self.assertIn('10:00:00 · Прага', first)
        self.assertNotIn('RAW_FIXTURE_SECRET', self.page.locator('#socialTable').inner_text())
        anchor = self.page.locator('#socialTable a')
        self.assertEqual(anchor.count(), 1)
        self.assertEqual(anchor.get_attribute('href'), 'https://example.org/posts/fixture-42')
        self.assertEqual(anchor.get_attribute('target'), '_blank')
        self.assertEqual(set(anchor.get_attribute('rel').split()), {'noopener', 'noreferrer'})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.page.locator('#socialTable').focus()
        self.page.locator('#socialTable').evaluate('(table) => {table.scrollLeft = table.scrollWidth}')
        self.assertGreater(self.page.locator('#socialTable').evaluate('(table) => table.scrollLeft'), 0)
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])

    def test_automatic_snapshot_updates_publication_confirmation_without_publishing(self):
        data = snapshot()
        data['social'][0].update(status='PUBLISHED_VERIFIED', state='VERIFIED', reason='VERIFIED', verified=True,
                                  receipt='https://example.org/posts/fixture-42')
        data['socialQueue'].update(draft=0, verified=1)
        self.page.evaluate('fixtureTick(60000)')
        self.respond(1, data)
        self.page.locator('[data-tab="content"]').click()
        self.assertIn('подтверждено в Hub: 1', self.page.locator('#socialQueue').inner_text())
        self.assertEqual(self.page.locator('#socialTable a').count(), 1)
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])

    def test_legacy_publication_data_and_missing_sheet_do_not_invent_confirmations(self):
        data = snapshot()
        del data['socialQueue']
        template = {'id': 'LEGACY', 'channel': '<img src="https://example.org/x" onerror="window.injected=true">',
                    'event': 'TEST-ONLY', 'status': 'PUBLISHED_VERIFIED', 'verified': True, 'scheduled': ''}
        data['social'] = [dict(template, receipt='javascript:alert(1)', error='RAW_FIXTURE_SECRET'),
                          dict(template, receipt='https://example.org/posts/conflict', error='RAW_FIXTURE_SECRET'),
                          dict(template, receipt='https://example.org/posts/confirmed', error='')]
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.page.locator('[data-tab="content"]').click()
        self.assertIn('недоступна в этой версии', self.page.locator('#socialQueue').inner_text())
        self.assertTrue(self.page.locator('#socialTable tr').nth(1).inner_text().startswith('Не подтверждено'))
        self.assertTrue(self.page.locator('#socialTable tr').nth(2).inner_text().startswith('Не подтверждено'))
        self.assertEqual(self.page.locator('#socialTable a').count(), 1)
        self.assertNotIn('RAW_FIXTURE_SECRET', self.page.locator('#socialTable').inner_text())
        self.assertEqual(self.page.locator('#socialTable img').count(), 0)
        self.assertIsNone(self.page.evaluate('window.injected'))
        data['missing'] = ['SocialPublishing']
        self.page.locator('#refresh').click()
        self.respond(2, data)
        self.assertIn('Очередь недоступна', self.page.locator('#socialQueue').inner_text())
        self.assertNotIn('Всего: 0', self.page.locator('#socialQueue').inner_text())
        self.assertEqual(self.page.locator('#socialTable td').count(), 0)

    def test_broken_publication_queue_preserves_previous_data_and_pauses_automatic_reads(self):
        self.page.locator('[data-tab="content"]').click()
        previous = self.page.locator('#socialTable').inner_text()
        summary = self.page.locator('#socialQueue').inner_text()
        data = snapshot()
        data['socialQueue']['verified'] = 999
        data['banks']['osvc']['balance'] = 999
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.assertEqual(self.page.locator('#socialTable').inner_text(), previous)
        self.assertEqual(self.page.locator('#socialQueue').inner_text(), summary)
        self.assertNotIn('999', self.page.locator('#osvcBalance').inner_text())
        self.assertIn('не удалось отобразить', self.page.locator('#message').inner_text())
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])
        self.page.locator('#refresh').click()
        self.respond(2, snapshot())
        self.assertEqual(self.page.locator('#socialTable').inner_text(), previous)

    def test_event_agenda_shows_phases_totals_and_raw_invalid_dates_safely_on_mobile(self):
        data = snapshot()
        template = data['events'][0]
        data['events'] = [dict(template, id='LIVE-FIRST', title='Fixture live', date='2026-10-21T07:00:00Z',
                               end='2026-10-21T09:00:00Z', startAt='2026-10-21T07:00:00.000Z',
                               endAt='2026-10-21T09:00:00.000Z', state='LIVE'),
                          dict(template, id='TODAY', title='Fixture today', date='2026-10-21T09:00:00Z',
                               end='2026-10-21T10:00:00Z', startAt='2026-10-21T09:00:00.000Z',
                               endAt='2026-10-21T10:00:00.000Z', state='TODAY')]
        data['events'] += [dict(template, id='FUTURE-' + str(i)) for i in range(97)]
        data['events'].append(dict(template, id='REVIEW', date='<img src="https://example.org/x" onerror="window.injected=true">',
                                   end='', startAt=None, endAt=None, state='REVIEW', reason='START_INVALID'))
        data['eventQueue'] = {'total': 130, 'live': 1, 'today': 1, 'upcoming': 97, 'review': 1,
                              'past': 30, 'shown': 100, 'limit': 100, 'truncated': True, 'timeZone': 'Europe/Prague'}
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.page.locator('[data-tab="community"]').click()
        self.page.set_viewport_size({'width': 375, 'height': 812})
        summary = self.page.locator('#eventQueue').inner_text()
        self.assertIn('сейчас по расписанию: 1', summary)
        self.assertIn('интервал прошёл: 30', summary)
        self.assertIn('Показано 100 из 130 — полный список в Hub', summary)
        first = self.page.locator('#eventTable tr').nth(1).inner_text()
        self.assertIn('Идёт по расписанию', first)
        self.assertIn('LIVE-FIRST', first)
        self.assertIn('09:00:00 · Прага', first)
        self.assertIn('Проверьте дату и время начала', self.page.locator('#eventTable').inner_text())
        self.assertEqual(self.page.locator('#eventTable img').count(), 0)
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.page.locator('#eventTable').focus()
        self.page.locator('#eventTable').evaluate('(table) => {table.scrollLeft = table.scrollWidth}')
        self.assertGreater(self.page.locator('#eventTable').evaluate('(table) => table.scrollLeft'), 0)
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])

    def test_automatic_snapshots_move_events_from_future_to_live_and_past_without_actions(self):
        data = snapshot()
        data['at'] = '2026-10-22T08:30:00Z'
        data['events'][0]['state'] = 'LIVE'
        data['eventQueue'].update(upcoming=0, live=1)
        data['leads']['queue'].update(upcoming=0, today=1)
        data['leads']['needsAction'][0]['dueState'] = 'TODAY'
        self.page.evaluate('fixtureTick(60000)')
        self.respond(1, data)
        self.page.locator('[data-tab="community"]').click()
        self.assertEqual(self.page.locator('#eventTable tr').nth(1).locator('td').first.inner_text(), 'Идёт по расписанию')
        data['at'] = '2026-10-22T09:00:00Z'
        data['events'][0]['state'] = 'PAST'
        data['eventQueue'].update(live=0, past=1)
        self.page.evaluate('fixtureTick(60000)')
        self.respond(2, data)
        self.assertEqual(self.page.locator('#eventTable tr').nth(1).locator('td').first.inner_text(), 'Интервал прошёл')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot', 'snapshot'])

    def test_missing_events_or_legacy_module_never_invents_a_verified_empty_agenda(self):
        data = snapshot()
        del data['eventQueue']
        data['events'] = [{'title': 'Legacy fixture', 'date': '2026-10-22 10:00', 'community': 'Fixture'}]
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.page.locator('[data-tab="community"]').click()
        self.assertIn('недоступна в этой версии', self.page.locator('#eventQueue').inner_text())
        self.assertEqual(self.page.locator('#eventTable tr').nth(1).locator('td').first.inner_text(), 'Не определено')
        data['events'] *= 105
        self.page.locator('#refresh').click()
        self.respond(2, data)
        self.assertIn('Показаны первые 100 записей', self.page.locator('#eventQueue').inner_text())
        self.assertEqual(self.page.locator('#eventTable tr').count(), 101)
        data['missing'] = ['Events']
        self.page.locator('#refresh').click()
        self.respond(3, data)
        self.assertIn('Повестка недоступна', self.page.locator('#eventQueue').inner_text())
        self.assertNotIn('Активных записей: 0', self.page.locator('#eventQueue').inner_text())
        self.assertEqual(self.page.locator('#eventTable td').count(), 0)

    def test_broken_event_interval_preserves_previous_data_and_pauses_automatic_reads(self):
        self.page.locator('[data-tab="community"]').click()
        previous = self.page.locator('#eventTable').inner_text()
        summary = self.page.locator('#eventQueue').inner_text()
        data = snapshot()
        data['events'][0]['endAt'] = '2026-10-22T07:00:00.000Z'
        data['banks']['osvc']['balance'] = 999
        self.page.locator('#refresh').click()
        self.respond(1, data)
        self.assertEqual(self.page.locator('#eventTable').inner_text(), previous)
        self.assertEqual(self.page.locator('#eventQueue').inner_text(), summary)
        self.assertNotIn('999', self.page.locator('#osvcBalance').inner_text())
        self.assertIn('не удалось отобразить', self.page.locator('#message').inner_text())
        self.page.evaluate('fixtureTick(120000)')
        self.assertEqual(self.calls(), ['snapshot', 'snapshot'])
        self.page.locator('#refresh').click()
        self.respond(2, snapshot())
        self.assertEqual(self.page.locator('#eventTable').inner_text(), previous)


if __name__ == '__main__':
    unittest.main()
