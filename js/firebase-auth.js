// js/firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google Login Error:", error);
    throw error;
  }
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
  if (docSnap.exists()) return docSnap.data();
  return null;
}

export { onAuthStateChanged };
