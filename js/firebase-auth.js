// js/firebase-auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ⚠️ 경로 에러를 원천 차단하기 위해 config 파일 불러오기를 없애고 여기에 직접 작성합니다.
const firebaseConfig = {
  apiKey: "AIzaSyALT6mbEia6_gC49Q4A1BC7JNcq_dyuMuw",
  authDomain: "jinstudy-9a005.firebaseapp.com",
  projectId: "jinstudy-9a005",
  storageBucket: "jinstudy-9a005.firebasestorage.app",
  messagingSenderId: "728084744723",
  appId: "1:728084744723:web:efbf911b7f5302a7d14de6",
  measurementId: "G-5KYHDBML4Y"
};

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
