// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Skatteverket Calendar API', () => {
	const mockSkatteverketResponse = {
		viktigaDatum: [
			{
				id: '5.test123',
				type: 'Test Type',
				category: 'Test Category',
				uri: '/test/path',
				dates: ['2024-03-15'],
				arbetsgivare: true,
			},
		],
	};

	let originalFetch: typeof fetch;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-01'));
		originalFetch = self.fetch;
	});

	it('should generate a valid ICS calendar on successful API response', async () => {
		// Mock the fetch function
		self.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockSkatteverketResponse),
		} as Response);

		const request = new IncomingRequest('http://example.com/skatteverket/company.ics');
		const ctx = createExecutionContext();

		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/calendar');

		const calendarText = await response.text();
		expect(calendarText).toContain('BEGIN:VCALENDAR');
		expect(calendarText).toContain('VERSION:2.0');
		expect(calendarText).toContain('PRODID:ics-worker/skatteverket/company');
		expect(calendarText).toContain('Test Type Test Category');
		expect(calendarText).toContain('20240315');
		expect(calendarText).toContain('https://www.skatteverket.se/test/path');
		expect(calendarText).toContain('END:VCALENDAR');
	});

	it('should handle API errors gracefully', async () => {
		// Mock a failed API response
		self.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		} as Response);

		const request = new IncomingRequest('http://example.com/skatteverket/company.ics');
		const ctx = createExecutionContext();

		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe('Failed to fetch data from Skatteverket');
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		self.fetch = originalFetch;
	});
});
