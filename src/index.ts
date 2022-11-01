import Context from 'telegraf/typings/context';
import {Telegraf} from 'telegraf';
import 'dotenv/config';
import {format} from 'date-fns';
import BotActions from './botActions'
import Helpers from './utils/helpers';
import Api from './api'
import { ChatType } from './types';
import Constants from './utils/constants';


const bot = new Telegraf(process.env.BOT_TOKEN || '');
bot.start((ctx: Context) => console.log(ctx.message));
// bot.help((ctx: Context) => console.log(ctx.message));

const checkFunc = async () => {
	const checkInterval = Number(process.env.CHECK_INTERVAL) || 10000

	try {
		setInterval( async () => {
			try {
				console.log('checkFunc')
				const collection = await Api.getCollection()

				for (const chatIdString in collection) {
					// console.log('chatIdString', chatIdString)
					const chatData = collection[chatIdString]
					const chatIdNumber = Number(chatIdString)

					const {lastBotMessId, nextUpdateUTC, updateHour, events, gmtOffset, upcomingOnly } = chatData

					const needUpdate = Helpers.isUpdateNeeded(nextUpdateUTC)

					if (events?.length && needUpdate) {

						//delete old bot message
						if (lastBotMessId) {
							await BotActions.deleteMessage(bot, chatIdNumber, lastBotMessId)
						}

						//sort and delete past events
						const sortedEvents = Helpers.sortAndDeleteEvents(events)
						//send events to chat
						const eventsMessage = upcomingOnly ? Helpers.createNearestMessage(sortedEvents) : Helpers.createMessage(sortedEvents)

						const newChatData: ChatType = {
							events: sortedEvents,
							gmtOffset: gmtOffset || Constants.defaultGMTOffset,
							updateHour: updateHour || Constants.defaultUpdateHour
						}

						if (eventsMessage) {
							const botAnswer = await BotActions.sendMarkdownMessage(bot, chatIdNumber, eventsMessage)

							if (botAnswer) {
								newChatData.lastBotMessId = botAnswer.message_id
							}
						}
						//update chat in fb
						await Api.rewriteChat(chatIdString,  newChatData, true)
					}
				}
			} catch (e) {

			}

		}, checkInterval)

	} catch (e) {
		console.log('checkFunc error')
	}
}

const sendTempMessage = async (bot: Telegraf, chatId: number, message: string, messageDurationSec: number = 10) => {
	const sentErrMessage = await bot.telegram.sendMessage(chatId, message)
	const duration = messageDurationSec * 1000
	if (sentErrMessage.message_id) {
		setTimeout(() => {
			bot.telegram.deleteMessage(chatId, sentErrMessage.message_id)
		}, duration)
	}
}

bot.help(async (ctx: Context)=>{
	try {
		// @ts-ignore
		const chatId = ctx.chat?.id

		const helpMessages = [
			`*add* - добавить событие. Для ежегодного события \`/add 31.12 Текст\`. Для единоразового \`/add 31.12.2023 Текст\``,
			`*gmt* - Установить часовой пояс \`/gmt +3\``,
			`*time* - Установить время ежедневного обновления \`/time 12\``,
			`*upcoming* - Вам будут приходить события только на сегодня и завтра, если они есть`,
			`*all* - Вам будут приходить все события ежедневно`,
		]

		const helpMessage = helpMessages.join(`\n\n`)
		const markdownMessage = Helpers.getMarkdownMessage(helpMessage)

		if (chatId) {
			await BotActions.sendMarkdownMessage( bot, ctx.chat.id, markdownMessage)
		}
	} catch (e) {

	}
})

bot.command('gmt', async (ctx: Context)=>{
	try {
		// @ts-ignore
		const chatId = ctx.chat?.id
		// @ts-ignore
		const userMessage = ctx.message?.text || ''
		const gmtOffset = userMessage.replace(/^\/gmt/, '').trim()
		const userMessageId = ctx.message?.message_id

		if (chatId && userMessage && userMessageId) {
			await BotActions.deleteMessage(bot, ctx.chat.id, ctx.message.message_id)
			await Api.updateChatField(String(chatId), {gmtOffset})
			await sendTempMessage( bot, ctx.chat.id, 'Часовой пояс успешно обновлён')
		}
	} catch (e) {

	}
})

bot.command('time', async (ctx: Context)=>{
	try {
		// @ts-ignore
		const chatId = ctx.chat?.id
		// @ts-ignore
		const userMessage = ctx.message?.text || ''
		const updateHour = userMessage.replace(/^\/time/, '').trim()
		const userMessageId = ctx.message?.message_id

		const chatFB = await Api.getChat(String(chatId))

		const nextUpdateUTC = await Helpers.getNextUpdateTS(updateHour, chatFB?.gmtOffset)

		if (chatId && userMessage && userMessageId && nextUpdateUTC) {
			await BotActions.deleteMessage(bot, ctx.chat.id, ctx.message.message_id)
			await Api.updateChatField(String(chatId), {updateHour, nextUpdateUTC})
			await sendTempMessage( bot, ctx.chat.id, 'Время ежедневного обновления изменено ' + ' ' + nextUpdateUTC)
		}
	} catch (e) {

	}
})

bot.command('add', async (ctx: Context) => {
	try {
		// @ts-ignore
		const chatId = ctx.chat?.id
		// @ts-ignore
		const userMessage = ctx.message?.text || ''
		const userMessageId = ctx.message?.message_id

		if (chatId && userMessage && userMessageId) {
			//delete user message
			await BotActions.deleteMessage(bot, ctx.chat.id, ctx.message.message_id)

			//create new event from user message
			const newEventData = await Helpers.createEventFromUserMessage(userMessage)

			//delete old events message

			const chatFromFB = await Api.getChat(String(chatId))

			let chatData: ChatType = chatFromFB || { events: [] }

			if (!chatData.events) {
				chatData.events = []
			}

			if (chatData?.lastBotMessId) {
				await BotActions.deleteMessage(bot, chatId, chatData.lastBotMessId)
			}

			//add new event to groups

			if (newEventData) {
				chatData.events.push(newEventData)
			}

			//sort events

			chatData.events = Helpers.sortAndDeleteEvents(chatData.events)


			//send events
			const eventsMessage = Helpers.createMessage(chatData.events)

			const botAnswer = await BotActions.sendMarkdownMessage(bot, chatId, eventsMessage)

			if (botAnswer) {
				if (chatFromFB) {
					await Api.rewriteChat(String(chatId),  { events: chatData.events, lastBotMessId: botAnswer.message_id})
				} else {
					// await Api.addChat(String(chatId),  chatData.events,  botAnswer.message_id)
					await Api.addChat(String(chatId),  { events: chatData.events, lastBotMessId: botAnswer.message_id}, true)
				}
			}
		}
	} catch (e: any) {
		if (ctx.chat?.id) {
			await sendTempMessage( bot, ctx.chat.id, e.message)
		}
	}
})

bot.command('upcoming', async (ctx: Context) => {
	try {
		// @ts-ignore
		const chatId = ctx.chat?.id
		// @ts-ignore
		const userMessageId = ctx.message?.message_id

		if (chatId && userMessageId) {
			await BotActions.deleteMessage(bot, ctx.chat.id, userMessageId)
			await Api.updateChatField(String(chatId), { upcomingOnly: true })
			await sendTempMessage( bot, ctx.chat.id, 'Вам будут приходить только ближайшие даты')
		}
	} catch (e: any) {
		if (ctx.chat?.id) {
			await sendTempMessage( bot, ctx.chat.id, e.message)
		}
	}
})

bot.command('all', async (ctx: Context) => {
	try {
		// @ts-ignore
		const chatId = ctx.chat?.id
		// @ts-ignore
		const userMessageId = ctx.message?.message_id

		if (chatId && userMessageId) {
			await BotActions.deleteMessage(bot, ctx.chat.id, userMessageId)
			await Api.updateChatField(String(chatId), {upcomingOnly: false})
			await sendTempMessage( bot, ctx.chat.id, 'Вам будут приходить все даты')
		}
	} catch (e: any) {
		if (ctx.chat?.id) {
			await sendTempMessage( bot, ctx.chat.id, e.message)
		}
	}
})

bot.command('t', async (ctx: Context) => {
	try {
		// @ts-ignore
		const chatId = ctx.chat?.id
		// @ts-ignore
		const userMessage = ctx.message?.text || ''

		const userMessageId = ctx.message?.message_id

		if (chatId && userMessage && userMessageId) {
			//delete user message
			await BotActions.deleteMessage(bot, ctx.chat.id, ctx.message.message_id)
			const nextUpdateUTC = new Date().setUTCMinutes(5, 0)
			//is now less next update
			const needUpdate = Helpers.isUpdateNeeded(nextUpdateUTC)
			//if needUpdate true => update events and create new nextUpdateUTC

			const updateTime = '13'
			const gmtOffset = '+3'
			const newNextUpdateUTC = await Helpers.getNextUpdateTS(updateTime, gmtOffset);

			if (newNextUpdateUTC) {
				await bot.telegram.sendMessage(userMessageId, format(newNextUpdateUTC, 'HH:mm:ss dd.MM.yyy') + ' ' + String(needUpdate))
			}

		}
	} catch (e: any) {
		if (ctx.chat?.id) {
			await sendTempMessage( bot, ctx.chat.id, e.message)
		}
	}
})


bot.command('refresh', async (ctx: Context) => {
	try {

	} catch (e: any) {
		if (ctx.chat?.id) {
			await sendTempMessage( bot, ctx.chat.id, e.message)
		}
	}
})

void bot.launch();
void checkFunc()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// console.log(isPast(parse('02.10.2023', 'dd.MM.yyyy', new Date())))
// console.log(isToday(parse('01.10.2022', 'dd.MM.yyyy', new Date())))
