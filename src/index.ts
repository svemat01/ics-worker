import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createSkatteverketDatesCalendar, skatteverketDatesOptionsSchema } from './skatteverket';

const app = new Hono();

app.get('/skatteverket/company.ics', zValidator('query', skatteverketDatesOptionsSchema), async (c) => {
	const options = c.req.valid('query');

	const calendar = await createSkatteverketDatesCalendar(options);

	c.header('Content-Type', 'text/calendar');
	return c.body(calendar);
});

export default app;
