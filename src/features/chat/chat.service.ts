import { addDoc, collection, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../../firebase/firebase.config'
import type { Message } from '../../types/domain'
const requireDb=()=>{if(!db)throw new Error('Firebase is not configured');return db}
export const chatService={
  async listForUser(userId:string){const conversations=query(collection(requireDb(),'conversations'),where('participantIds','array-contains',userId));const snapshot=await getDocs(conversations);return snapshot.docs.map(item=>({id:item.id,...item.data()}))},
  async findBetween(userId:string,participantId:string){const conversations=query(collection(requireDb(),'conversations'),where('participantIds','array-contains',userId),limit(50));const snapshot=await getDocs(conversations);return snapshot.docs.find(item=>{const ids=item.data().participantIds as string[];return ids.length===2&&ids.includes(participantId)})},
  subscribe(conversationId:string,onMessages:(messages:Message[])=>void){const messages=query(collection(requireDb(),'conversations',conversationId,'messages'),orderBy('createdAt','asc'));return onSnapshot(messages,snapshot=>onMessages(snapshot.docs.map(item=>({id:item.id,...item.data()} as Message))))},
  async send(conversationId:string,senderId:string,text:string){await addDoc(collection(requireDb(),'conversations',conversationId,'messages'),{senderId,text,createdAt:serverTimestamp(),read:false})},
}
