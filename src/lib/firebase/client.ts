import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  firebaseConfig,
  getClientAuth,
  getClientFirestore,
  getFirebaseApp,
  isFirebaseConfigured,
} from "./config";

export { firebaseConfig, getClientAuth, getClientFirestore, getFirebaseApp, isFirebaseConfigured };

export function getClientStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
