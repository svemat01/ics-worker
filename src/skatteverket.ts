import { generateIcsCalendar, VCalendar } from 'ts-ics';
import { z } from 'zod';

export const skatteverketDatesOptionsSchema = z.object({
	foretagsform: z.enum(['ENSKILD_NARINGSIDKARE', 'AKTIEBOLAG_FORENINGAR', 'HANDELSBOLAG_KOMMANDITBOLAG']).default('ENSKILD_NARINGSIDKARE'),
	momsredovisningsperiod: z.enum(['AR', 'KVARTAL', 'MANAD']).default('KVARTAL'),
	omsattning: z.enum(['UPP_TILL_EN_MILJON', 'MER_AN_EN_MILJON_TILL_FYRTIO_MILJONER', 'OVER_FYRTIO_MILJONER']).default('UPP_TILL_EN_MILJON'),
	rakenskapsaretsSistaManad: z.number().int().min(1).max(12).default(12),
	arbetsgivare: z.boolean().default(false),
});

export type SkatteverketDatesOptions = z.infer<typeof skatteverketDatesOptionsSchema>;

export const skatteverketDatesResponseSchema = z.object({
	viktigaDatum: z.array(
		z.object({
			id: z.string(),
			type: z.string(),
			category: z.string(),
			uri: z.string(),
			dates: z.array(z.string()),
			arbetsgivare: z.boolean(),
		})
	),
});

type SkatteverketDatesResponse = z.infer<typeof skatteverketDatesResponseSchema>;
type SkatteverketDate = SkatteverketDatesResponse['viktigaDatum'][number];

export const getSkatteverketDates = async (
	options: SkatteverketDatesOptions,
	tidigareDatum: boolean = false
): Promise<SkatteverketDatesResponse> => {
	const url = new URL('https://www.skatteverket.se/viktiga-datum-api/api/v1/viktiga-datum-foretag');

	for (const [key, value] of Object.entries(options)) {
		url.searchParams.set(key, typeof value === 'string' ? value : String(value));
	}

	if (tidigareDatum) {
		url.searchParams.set('tidigareDatum', tidigareDatum.toString());
	}

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch data from Skatteverket');
	}

	return skatteverketDatesResponseSchema.parse(await response.json());
};

export const createSkatteverketDatesCalendar = async (options: Omit<SkatteverketDatesOptions, 'tidigareDatum'>) => {
	const [dates, previousDates] = await Promise.all([getSkatteverketDates(options), getSkatteverketDates(options, true)]);

	const calendar: VCalendar = {
		version: '2.0',
		prodId: 'ics-worker/skatteverket/company',
		events: [],
		name: 'Skatteverket Viktiga Datum',
	};

	const now = new Date();

	for (const date of [...previousDates.viktigaDatum, ...dates.viktigaDatum]) {
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

	calendar.events?.sort((a, b) => a.start!.date.getTime() - b.start!.date.getTime());

	return generateIcsCalendar(calendar);
};
