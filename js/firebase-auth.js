// js/firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// TODO: 집에 가셔서 Firebase 콘솔창에서 발급받은 실제 데이터 수치 구조로 완전히 대체하십시오.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let app, auth, db;
export let isFirebaseInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseInitialized = true;
} catch (e) {
  console.error("Firebase 초기화 대기 상태 (로컬 모드 가동)", e);
}

const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  if (!isFirebaseInitialized) return null;
  return await signInWithPopup(auth, provider);
}

export async function logoutUser() {
  if (!isFirebaseInitialized) return;
  await signOut(auth);
}

export async function saveToCloud(uid, dataPayload, customKey) {
  if (!isFirebaseInitialized) return;
  const docRef = doc(db, 'artifacts', customKey, 'users', uid, 'progressData', 'main');
  await setDoc(docRef, dataPayload);
}

export async function loadFromCloud(uid, customKey) {
  if (!isFirebaseInitialized) return null;
  const docRef = doc(db, 'artifacts', customKey, 'users', uid, 'progressData', 'main');
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

export { auth, onAuthStateChanged };
