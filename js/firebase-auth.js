// js/firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// TODO: 발급 받으신 파이어베이스 수치를 이곳에 배치하십시오.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  return await signInWithPopup(auth, provider);
}
export async function logoutUser() {
  await signOut(auth);
}
export async function saveToCloud(uid, data, appId) {
  await setDoc(doc(db, 'artifacts', appId, 'users', uid, 'progressData', 'main'), data);
}
export async function loadFromCloud(uid, appId) {
  const snap = await getDoc(doc(db, 'artifacts', appId, 'users', uid, 'progressData', 'main'));
  return snap.exists() ? snap.data() : null;
}
export { onAuthStateChanged };
