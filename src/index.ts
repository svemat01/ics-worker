import { Hono } from 'hono';
import { generateIcsCalendar, VCalendar } from 'ts-ics';
const app = new Hono();

type SkatteverketDatesResponse = {
	viktigaDatum: {
		id: string;
		type: string;
		category: string;
		uri: string;
		dates: string[];
		arbetsgivare: boolean;
	}[];
};

app.get('/skatteverket/company.ics', async (c) => {
	const calendar: VCalendar = {
		version: '2.0',
		prodId: 'ics-worker/skatteverket/company',
		events: [],
	};

	const response = await fetch(
		'https://www.skatteverket.se/viktiga-datum-api/api/v1/viktiga-datum-foretag?foretagsform=ENSKILD_NARINGSIDKARE&momsredovisningsperiod=KVARTAL&omsattning=UPP_TILL_EN_MILJON&rakenskapsaretsSistaManad=12&arbetsgivare=true'
	);

	if (!response.ok) {
		return c.text('Failed to fetch data from Skatteverket', 500);
	}

	const data = (await response.json()) as SkatteverketDatesResponse;
	const now = new Date();

	for (const date of data.viktigaDatum) {
		for (const dateString of date.dates) {
			calendar.events!.push({
				uid: `${date.id}-${dateString}`,
				summary: `${date.type} ${date.category}`,
				url: date.uri.startsWith('/') ? `https://www.skatteverket.se${date.uri}` : date.uri,
				stamp: {
					date: now,
					type: 'DATE',
				},
				start: {
					date: new Date(dateString),
					type: 'DATE',
				},
				end: {
					date: new Date(dateString),
					type: 'DATE',
				},
			});
		}
	}

	c.header('Content-Type', 'text/calendar');

	return c.body(generateIcsCalendar(calendar));
});

export default app;
