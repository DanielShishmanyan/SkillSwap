import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../firebase/firebase.config'
import type { UserProfile } from '../../types/domain'
const requireDb=()=>{if(!db)throw new Error('Firebase is not configured');return db}
export const usersService={
  async list(){const snapshot=await getDocs(collection(requireDb(),'users'));return snapshot.docs.map(item=>item.data() as UserProfile)},
  async get(id:string){const item=await getDoc(doc(requireDb(),'users',id));return item.exists()?item.data() as UserProfile:null},
  async updateOwn(id:string,update:Partial<Pick<UserProfile,'name'|'bio'|'location'|'availability'|'teaches'|'learns'|'avatar'>>){await updateDoc(doc(requireDb(),'users',id),{...update,updatedAt:serverTimestamp()})},
  async uploadAvatar(id:string,file:File){if(!storage)throw new Error('Firebase Storage is not configured');const object=ref(storage,`avatars/${id}/${crypto.randomUUID()}-${file.name}`);await uploadBytes(object,file,{contentType:file.type});return getDownloadURL(object)},
}
