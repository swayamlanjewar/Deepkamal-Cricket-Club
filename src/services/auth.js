import { auth, isConfigValid } from "../lib/firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const MOCK_AUTH_KEY = "cricket_mock_auth_user";
const authListeners = [];

// Watch local changes in mock auth state across tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === MOCK_AUTH_KEY) {
      const user = getMockUser();
      authListeners.forEach(cb => cb(user));
    }
  });
}

function getMockUser() {
  const raw = localStorage.getItem(MOCK_AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function subscribeAuthState(callback) {
  if (isConfigValid) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        // Return standard user shape
        callback({
          uid: user.uid,
          email: user.email,
          role: "scorer"
        });
      } else {
        callback(null);
      }
    });
  } else {
    authListeners.push(callback);
    callback(getMockUser());
    return () => {
      const idx = authListeners.indexOf(callback);
      if (idx !== -1) authListeners.splice(idx, 1);
    };
  }
}

export async function loginAdmin(emailOrUsername, password) {
  // Support both "admin" and "admin@cricketclub.com" for flexibility
  let email = emailOrUsername;
  if (!email.includes("@")) {
    email = `${emailOrUsername}@cricketclub.com`;
  }

  if (isConfigValid) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      role: "scorer"
    };
  } else {
    // Standard mock credentials check
    const normalizedUser = emailOrUsername.toLowerCase().trim();
    if ((normalizedUser === "admin" || normalizedUser === "admin@cricketclub.com") && password === "admin123") {
      const mockUser = {
        uid: "mock_admin_1",
        email: "admin@cricketclub.com",
        role: "scorer"
      };
      localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify(mockUser));
      authListeners.forEach(cb => cb(mockUser));
      return mockUser;
    } else {
      throw new Error("Invalid username/email or password. Please use admin / admin123.");
    }
  }
}

export async function logoutAdmin() {
  if (isConfigValid) {
    await signOut(auth);
  } else {
    localStorage.removeItem(MOCK_AUTH_KEY);
    authListeners.forEach(cb => cb(null));
  }
}

export function getCurrentUser() {
  if (isConfigValid) {
    const user = auth.currentUser;
    return user ? { uid: user.uid, email: user.email, role: "scorer" } : null;
  } else {
    return getMockUser();
  }
}
