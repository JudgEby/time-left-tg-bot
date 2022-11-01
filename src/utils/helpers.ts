import {EvensType, EventType, ThrowErrorType} from '../types';
import {getTime, isAfter, isBefore, isPast, parse, isToday, isTomorrow} from 'date-fns';
import emoji from 'node-emoji'
import Constants from './constants';

const ThrowError = (message?: string): ThrowErrorType => {
	const defaultMessage = 'Что-то пошло не так\\. Попробуйте ещё раз'
	throw {message: message || defaultMessage}
}

const createGroupId = (chatId: number): string => {
	return `group__${chatId}`
}

const getChatIdFromGroupId = (groupId: string): number => {
	return Number(groupId.replace('group__', ''))
}

const getSmiles = (emojiName: string ,number: number = 1) => {
	return Array(number).fill(emoji.get(emojiName)).join('')
}

const getMarkdownMessage = (message: string) : string => {
	let escapedMessage = message;
	Constants.forbiddenCharactersForMD.forEach((char)=>{
		escapedMessage = escapedMessage.replace(new RegExp(`\\${char}`, 'g'), '\\'+ char)
	})

	return escapedMessage
}


const separateTodayEvents = ( events: EvensType): {today: EvensType, after: EvensType} => {
	return events.reduce((accum: {today: EvensType, after: EvensType}, event) => {
		const dateArr = event.date.split('.')
		const fullDate = dateArr.length === 3 ? event.date : event.date + '.' + new Date().getFullYear()
		const dateMask = 'dd.MM.yyyy'
		const parseDate = parse(fullDate, dateMask, new Date())
		const isEventToday = isToday(parseDate)

		if (isEventToday) {
			const accumToday = accum?.today || [];
			return {...accum, today: [event, ...accumToday]}
		}
		return {...accum, after: [...accum.after, event]}
	}, { today: [], after: []})
}

const separateNearestEvents = ( events: EvensType): {today: EvensType, tomorrow: EvensType} => {
	return events.reduce((accum: {today: EvensType, tomorrow: EvensType}, event) => {
		const dateArr = event.date.split('.')
		const fullDate = dateArr.length === 3 ? event.date : event.date + '.' + new Date().getFullYear()
		const dateMask = 'dd.MM.yyyy'
		const parseDate = parse(fullDate, dateMask, new Date())
		const isEventToday = isToday(parseDate)

		if (isEventToday) {
			const accumToday = accum?.today || [];
			return {...accum, today: [event, ...accumToday]}
		}

		const isEventTomorrow = isTomorrow(parseDate)

		if (isEventTomorrow) {
			const accumTomorrow = accum?.tomorrow || [];
			return {...accum, tomorrow: [event, ...accumTomorrow]}
		}


		return accum;
	}, { today: [], tomorrow: []})
}

const createNearestMessage = (events: EvensType): string => {

	const separatedEvents = separateNearestEvents(events)

	const getLines = (events: EvensType, isToday: boolean) : string => {
		return events.map(event => {
			const dateArr = event.date.split('.')
			const message =  `${isToday ? '*' : ''}${dateArr.join('.')} ${event.text}${isToday ? '*' : ''}` + '\n'

			return getMarkdownMessage(message)
		}).join('')

	}

	const smiles = getSmiles('sparkler', 3)

	const todayLine = separatedEvents.today.length ?
		`${smiles}\n\n${getLines(separatedEvents.today, true)}\n${smiles}\n`
		: ''

	const afterLine = getLines(separatedEvents.tomorrow, false)

	if (!todayLine && !afterLine) {
		return ''
	}

	return `${todayLine ? todayLine : ''}${afterLine ? `\nЗавтра:\n${afterLine}` : ''}`
}

const createMessage = (events: EvensType) : string => {
	const separatedEvents = separateTodayEvents(events);

	const getLines = (events: EvensType, isToday: boolean) : string => {
		return events.map(event => {
			const dateArr = event.date.split('.')
			const message =  `${isToday ? '*' : ''}${dateArr.join('.')} ${event.text}${isToday ? '*' : ''}` + '\n'

			return getMarkdownMessage(message)
		}).join('')

	}

	const smiles = getSmiles('sparkler', 3)

	const todayLine = separatedEvents.today.length ?
		`${smiles}\n\n${getLines(separatedEvents.today, true)}\n${smiles}\n`
		: ''

	const afterLine = getLines(separatedEvents.after, false)

	return `${todayLine}${afterLine}`
}

const sortEventsByDates = (events: EvensType): EvensType => {
	const deletedPastEvents = events.filter((event) => {
		if (!event.date || !event.text) {
			return false
		}

		const dateSeparatedArr = event.date.split('.')
		if (dateSeparatedArr.length === 3) {
			return !isBefore(new Date().getTime(), parse(event.date, 'dd.MM.yyyy', new Date()).getTime())
		}
		return true
	})

	const sortedByDates = deletedPastEvents.sort((eventA, eventB) => {
		const dateASeparatedArr = eventA.date.split('.')
		const dateBSeparatedArr = eventB.date.split('.')

		const getTimestamp = (event: EventType, dateSeparatedArr: string[]) => {
			if (dateSeparatedArr.length === 3) {
				return getTime(parse(event.date, 'dd.MM.yyyy', new Date()))
			} else {
				const year = isAfter(new Date(), parse(event.date, 'dd.MM', new Date()))
					? new Date().getFullYear() + 1
					: new Date().getFullYear()
				return getTime(parse(event.date, 'dd.MM', new Date(year, 0, 1)))
			}
		}

		const timestampA = getTime(new Date()) - getTimestamp(eventA, dateASeparatedArr)
		const timestampB = getTime(new Date()) - getTimestamp(eventB, dateBSeparatedArr)

		return timestampB - timestampA
	})

	const sortTodaysEvents = separateTodayEvents(sortedByDates)

	return [...sortTodaysEvents.today, ...sortTodaysEvents.after]
}

const deletePastEvents = (events: EvensType): EvensType => {
	return events.filter((event)=>{
		const [ , , year] = event.date
		if (year && Number(year)) {
			const date = parse(event.date, 'dd.MM.yyyy', new Date())

			return isToday(date) || !isPast(date)
		}
		return true
	})
}

const sortAndDeleteEvents = (events: EvensType): EvensType=>{
	const sortedEvents = sortEventsByDates(events)
	return deletePastEvents(sortedEvents)
}

const createEventFromUserMessage = async (message: string): Promise<EventType | undefined> => {
	try {
		if (message) {
			// @ts-ignore
			const fullMessage = message.trim().slice(5)
			const IndexDateDivider = fullMessage.indexOf(' ')
			if (IndexDateDivider === -1) {
				ThrowError('Не правильный формат сообщения\. Пример `/add 12\.04\.2018 Мой День Рождения`')
			}

			const date = fullMessage.slice(0, IndexDateDivider + 1).trim().split('.')

			const normalizeDate = date.map((numberString: string, index) => {
				if (index <= 1 && numberString.length === 1) {
					return '0' + numberString
				}

				return numberString
			}).join('.')

			const text = fullMessage.slice(IndexDateDivider + 1).trim()

			return {date: normalizeDate, text}
		}
		ThrowError()
	} catch (e: any) {
		ThrowError(e.message)
	}
}

const isUpdateNeeded = ( nextUpdateUTC: number | undefined) : boolean => {
	if (!nextUpdateUTC) {
		return true
	}

	const nowTimestamp = new Date().getTime()
	return nextUpdateUTC < nowTimestamp
}

const getNextUpdateTS = async (updateHour: string = Constants.defaultUpdateHour, gmtOffset: string = Constants.defaultGMTOffset): Promise<number | undefined> => {
	try {
		const nowUTCDate = new Date().getUTCDate()
		const newNextDate = new Date()
		newNextDate.setUTCDate(nowUTCDate + 1)
		newNextDate.setUTCHours(Number(updateHour) - Number(gmtOffset), 0,0)

		const tomorrowUTCTS = newNextDate.getTime()

		const today = new Date()
		today.setUTCDate(nowUTCDate)
		today.setUTCHours(Number(updateHour) - Number(gmtOffset), 0,0)

		if (today.getTime() > new Date().getTime()) {
			return today.getTime()
		}

		return tomorrowUTCTS
	} catch (e) {
		ThrowError('Не верный формат часа обновления или часового пояса')
	}
}

export default {
	createGroupId,
	createEventFromUserMessage,
	createMessage,
	deletePastEvents,
	getChatIdFromGroupId,
	sortEventsByDates,
	sortAndDeleteEvents,
	ThrowError,
	isUpdateNeeded,
	getNextUpdateTS,
	createNearestMessage,
	getMarkdownMessage,
}
