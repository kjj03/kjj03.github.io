// js/firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// config 파일 경로를 주의하세요 (상위 폴더의 firebase-config.js)
import { firebaseConfig } from '../firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function saveToCloud(uid, dataPayload, appId) {
  const userDocRef = doc(db, 'artifacts', appId, 'users', uid, 'progressData', 'main');
  await setDoc(userDocRef, dataPayload);
}

export async function loadFromCloud(uid, appId) {
  const userDocRef = doc(db, 'artifacts', appId, 'users', uid, 'progressData', 'main');
  const docSnap = await getDoc(userDocRef);
  return docSnap.exists() ? docSnap.data() : null;
}

export { onAuthStateChanged };
