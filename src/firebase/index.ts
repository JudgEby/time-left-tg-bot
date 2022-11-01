import { initializeApp } from 'firebase/app'
import { getFirestore, collection } from 'firebase/firestore'

import config from './fb-config';

const collectionName = 'chats'

// init firebase
initializeApp(config)

// init services
const dataBase = getFirestore()

// collection ref
const collectionRef = collection(dataBase, collectionName)

export {dataBase, collectionRef, collectionName}
