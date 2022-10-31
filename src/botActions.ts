import {Telegraf} from 'telegraf';
import Helpers from './utils/helpers';


const deleteMessage = async (bot: Telegraf, chatId: number, messageId: number) => {
	try {
		return await bot.telegram.deleteMessage(chatId, messageId)
	} catch (e) {
		console.log('deleteMessage error')
	}
}

const sendMarkdownMessage = async (bot: Telegraf, chatId: number, message: string) => {
	try {
		return await bot.telegram.sendMessage(chatId, message, { parse_mode: "MarkdownV2" })
	} catch (e) {
		// @ts-ignore
		console.log(e)
		Helpers.ThrowError('Ошибка в sendEventsToChat')
	}
}

const BotActions = { deleteMessage, sendMarkdownMessage }
export default BotActions
