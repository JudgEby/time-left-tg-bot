import {doc, getDocs, getDoc, updateDoc, setDoc} from 'firebase/firestore';
import {collectionRef, dataBase, collectionName} from '../firebase';
import {ChatType, IChats} from '../types';
import Helpers from '../utils/helpers';
import Constants from '../utils/constants';

const getCollection = async () => {
	try {
		const snapshot = await getDocs(collectionRef)
		let chats: IChats = {}
		snapshot.forEach((doc) => {
			// @ts-ignore
			chats[doc.id] = doc.data()
		})
		return chats
	} catch (e: any) {
		Helpers.ThrowError('getCollection')
	}
}

const getChat = async (chatId: string) => {
	try {
		const docRef = doc(dataBase, collectionName, chatId)

		const chat = await getDoc(docRef)
		// chat id in chat.id
		return chat.data() as ChatType
	} catch (e: any) {
		Helpers.ThrowError('getChat')
	}
}

const updateChatField = async (chatId: string, chatData: ChatType) => {
	try {
		const docRef = doc(dataBase, collectionName, chatId)
		await updateDoc(docRef, chatData)
	} catch (e: any) {

	}
}

const rewriteChat = async (chatId: string, chatData: ChatType, writeNextUpdate: boolean = false)=>{
	try {
		const {
			events = [],
			lastBotMessId,
			updateHour,
			gmtOffset,
		} = chatData;

		const docRef = doc(dataBase, collectionName, chatId)

		const newChatData: ChatType = {lastBotMessId, events}

		if (updateHour) {
			newChatData.updateHour = updateHour
		}

		if (gmtOffset) {
			newChatData.gmtOffset = gmtOffset
		}

		if (writeNextUpdate && updateHour && gmtOffset) {
			newChatData.nextUpdateUTC = await Helpers.getNextUpdateTS(updateHour, gmtOffset)
		}

		await updateDoc(docRef, newChatData)
	} catch (e: any) {
		Helpers.ThrowError('rewriteChat')
	}
}

const addChat = async (chatId: string, chatData: ChatType, writeNextUpdate: boolean = false)=>{
	try {
		const {
			events = [],
			lastBotMessId,
			updateHour = Constants.defaultUpdateHour,
			gmtOffset = Constants.defaultGMTOffset
		} = chatData;

		const docRef = doc(dataBase, collectionName, chatId)
		const newChatData: ChatType = {lastBotMessId, events, updateHour, gmtOffset}

		if (writeNextUpdate) {
			newChatData.nextUpdateUTC = await Helpers.getNextUpdateTS(updateHour, gmtOffset)
		}

		await setDoc(docRef, newChatData)
	} catch (e: any) {
		Helpers.ThrowError('addChat')
	}
}

export default {getCollection, getChat, rewriteChat, addChat, updateChatField}
