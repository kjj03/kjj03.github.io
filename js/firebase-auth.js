// js/firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALT6mbEia6_gC49Q4A1BC7JNcq_dyuMuw",
  authDomain: "jinstudy-9a005.firebaseapp.com",
  projectId: "jinstudy-9a005",
  storageBucket: "jinstudy-9a005.firebasestorage.app",
  messagingSenderId: "728084744723",
  appId: "1:728084744723:web:efbf911b7f5302a7d14de6",
  measurementId: "G-5KYHDBML4Y"
};

let app, auth, db;
export let isFirebaseInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseInitialized = true;
} catch (e) {
  console.warn("Firebase 플레이스홀더 대기 (로컬 오프라인 브릿지 전환)", e);
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
  // 예외 처리를 붙여 클라이언트가 오프라인일 때 전체 엔진이 셧다운되지 않도록 방어
  await setDoc(docRef, dataPayload).catch(err => console.warn("클라우드 백업 보류 (로컬 보존)"));
}

export async function loadFromCloud(uid, customKey) {
  if (!isFirebaseInitialized) return null;
  const docRef = doc(db, 'artifacts', customKey, 'users', uid, 'progressData', 'main');
  try {
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch(e) {
    console.warn("원격 서버 응답 부재 -> 로컬 데이터를 참조합니다.");
    return null;
  }
}

export { auth, onAuthStateChanged };
