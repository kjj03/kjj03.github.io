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
  console.error("Firebase Initialization Failure:", e);
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

export { auth, db, onAuthStateChanged };
