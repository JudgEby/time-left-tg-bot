export interface IChats {
	[key: string]: ChatType
}

export type ChatType = {
	lastBotMessId?: number,
	events?: EvensType,
	nextUpdateUTC?: number,
	updateHour?: string,
	gmtOffset?: string,
	upcomingOnly?: boolean,
}

export type EvensType = EventType[]

export type EventType = {
	date: string,
	text: string,
}

export type ThrowErrorType = { message: string } | void
