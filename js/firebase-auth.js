// js/firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 사용자가 지정한 정식 파이어베이스 연결 도메인 바인딩
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
  console.error("파이어베이스 연결망 초기화 대기 (로컬 오프라인 브릿지 전환)", e);
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
  try {
    const docRef = doc(db, 'artifacts', customKey, 'users', uid, 'progressData', 'main');
    await setDoc(docRef, dataPayload);
  } catch (err) {
    console.warn("오프라인 상태: 클라우드 실시간 백업을 보류하고 로컬 브라우저 디스크에 안전하게 저장합니다.");
  }
}

export async function loadFromCloud(uid, customKey) {
  if (!isFirebaseInitialized) return null;
  try {
    const docRef = doc(db, 'artifacts', customKey, 'users', uid, 'progressData', 'main');
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("네트워크 부재로 클라우드 진도를 가져오지 못했습니다. 로컬 디스크 캐시를 참조합니다.");
    return null;
  }
}

export { auth, onAuthStateChanged };
