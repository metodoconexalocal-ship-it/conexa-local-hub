  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getFirestore, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  // ── Mesmo projeto Firebase do DC HUB (crm-digitalcreate) ──────────────────
  // O GMN Hub usa coleções próprias (gmn_*), sem tocar nas do CRM.
  const firebaseConfig = {
    apiKey: "AIzaSyD775h8BBglzDCSx2jkC5hKT97qJGZ-MJg",
    authDomain: "crm-digitalcreate.firebaseapp.com",
    projectId: "crm-digitalcreate",
    storageBucket: "crm-digitalcreate.firebasestorage.app",
    messagingSenderId: "633842305840",
    appId: "1:633842305840:web:400c2ae135c3edb136d6f5",
    measurementId: "G-V21DE8DZ74"
  };

  const app  = initializeApp(firebaseConfig);
  const db   = getFirestore(app);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  window._gmnDb = db;

  // ── CRUD genérico (todas as coleções gmn_*) ───────────────────────────────
  window.dbList = async (col, orderField, dir) => {
    try {
      const q = orderField
        ? query(collection(db, col), orderBy(orderField, dir || 'desc'))
        : collection(db, col);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('dbList ' + col + ':', e); return []; }
  };

  window.dbSave = async (col, data) => {
    try {
      const { id, ...rest } = data;
      if (id) {
        await updateDoc(doc(db, col, id), { ...rest, updatedAt: new Date().toISOString() });
        return id;
      }
      const ref = await addDoc(collection(db, col), { ...rest, createdAt: new Date().toISOString() });
      return ref.id;
    } catch (e) {
      console.error('dbSave ' + col + ':', e);
      alert('Erro ao salvar: ' + e.message);
      return null;
    }
  };

  window.dbDelete = async (col, id) => {
    try { await deleteDoc(doc(db, col, id)); return true; }
    catch (e) { console.error('dbDelete ' + col + ':', e); return false; }
  };

  // ── Auth ───────────────────────────────────────────────────────────────────
  window.doGoogleLogin = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e) { alert('Erro ao entrar: ' + e.message); }
  };

  window.doLogout = async () => {
    await signOut(auth);
    window.currentUser = null;
    showLoginScreen();
  };
  window.doSignOut = window.doLogout;

  // Mesma senha de equipe do DC HUB
  const SENHA_ACESSO = 'Amanda&PalomaCRM2026@';
  // E-mails que sempre têm acesso (proprietárias)
  const SUPER_ADMINS = ['digitalcreateagency@gmail.com'];

  onAuthStateChanged(auth, async (user) => {
    if (!user) { showLoginScreen(); return; }

    // Autorizado se: super admin OU já cadastrado na equipe do DC HUB
    let allowed = SUPER_ADMINS.some(e => e.toLowerCase() === user.email.toLowerCase());
    if (!allowed) {
      try {
        const snap = await getDoc(doc(db, 'crm', 'userlist'));
        const users = snap.exists() ? (snap.data().users || []) : [];
        allowed = users.some(u => (u.email || '').toLowerCase() === user.email.toLowerCase());
      } catch (e) { console.error('userlist:', e); }
    }

    if (!allowed) {
      await signOut(auth);
      showLoginScreen();
      setTimeout(() => alert('❌ Acesso negado. Seu e-mail não está autorizado.\nFale com o administrador do DC HUB.'), 100);
      return;
    }

    window._pendingUser = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('senha-screen').style.display = 'flex';
    const inp = document.getElementById('senha-input');
    inp.value = '';
    inp.focus();
  });

  window.verificarSenha = async () => {
    const val = document.getElementById('senha-input').value;
    if (val !== SENHA_ACESSO) {
      document.getElementById('senha-sub').textContent = '❌ Senha incorreta. Tente novamente.';
      document.getElementById('senha-input').value = '';
      document.getElementById('senha-input').focus();
      return;
    }

    const user = window._pendingUser;
    window.currentUser = {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photo: user.photoURL,
    };

    document.getElementById('senha-screen').style.display = 'none';
    document.getElementById('app-root').style.display = 'flex';

    const av = document.getElementById('sidebar-user-photo');
    const nm = document.getElementById('sidebar-user-name');
    if (av) { av.src = user.photoURL || ''; av.style.display = user.photoURL ? 'block' : 'none'; }
    if (nm) nm.textContent = user.displayName;

    window._firebaseReady = true;
    window.dispatchEvent(new Event('gmn-ready'));
  };

  function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('senha-screen').style.display = 'none';
    document.getElementById('app-root').style.display = 'none';
  }
