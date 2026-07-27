const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin');
const { getFirestore, Firestore } = require('firebase-admin/firestore');

async function main() {
  const serviceAccountPath = path.join(__dirname, '../service-account-prod.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('\x1b[31m%s\x1b[0m', 'Error: Production Service Account Key file not found!');
    console.log('\nTo run this sync script, you need to download a service account JSON from the Firebase Console:');
    console.log('1. Open your Firebase Console and select your production project.');
    console.log('2. Go to Project Settings (cog icon next to Project Overview) -> Service Accounts.');
    console.log('3. Click "Generate New Private Key" and download the JSON file.');
    console.log(`4. Save the file as 'service-account-prod.json' in: ${path.dirname(serviceAccountPath)}`);
    console.log('\nMake sure this file is kept secure. It has already been added to your .gitignore.');
    process.exit(1);
  }
  
  const serviceAccount = require(serviceAccountPath);
  
  console.log(`Initializing connection to production project: ${serviceAccount.project_id}...`);
  // Initialize production Firebase Admin app
  const prodApp = initializeApp({
    credential: cert(serviceAccount)
  }, 'production');
  const prodDb = getFirestore(prodApp);
  
  console.log('Initializing connection to local emulator (127.0.0.1:8080)...');
  // Initialize local emulator connection directly using the Firestore constructor
  const localDb = new Firestore({
    projectId: serviceAccount.project_id,
    host: '127.0.0.1',
    port: 8080,
    ssl: false,
    credentials: {
      client_email: 'local-dev@emulator.local',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3\n-----END PRIVATE KEY-----\n'
    }
  });
  
  // Test connection to local emulator
  try {
    // Attempt a write/read to check if emulator is online
    await localDb.collection('_sync_test_').doc('ping').set({ time: Date.now() });
    await localDb.collection('_sync_test_').doc('ping').delete();
  } catch (err) {
    console.error('\n\x1b[31m%s\x1b[0m', 'Error: Could not connect to the Local Firestore Emulator!');
    console.log('Please make sure your Firebase emulators are running by executing:');
    console.log('  npm run emulators');
    console.log('Leave that terminal open and run this sync script in a new terminal window.');
    process.exit(1);
  }
  
  console.log('Successfully connected to both production and local databases.');
  console.log('Starting synchronization...\n');
  
  let docCount = 0;
  
  async function syncCollection(srcColRef, destColRef, pathStr) {
    console.log(`Fetching documents from: ${pathStr}`);
    const snapshot = await srcColRef.get();
    
    if (snapshot.empty) {
      console.log(`  (empty)`);
      return;
    }
    
    console.log(`  Found ${snapshot.size} documents in ${pathStr}. Copying...`);
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const destDocRef = destColRef.doc(doc.id);
      
      // Write document to local emulator
      await destDocRef.set(data);
      docCount++;
      
      // Check for subcollections recursively
      const subcols = await doc.ref.listCollections();
      for (const subcol of subcols) {
        const subPath = `${pathStr}/${doc.id}/${subcol.id}`;
        await syncCollection(subcol, destDocRef.collection(subcol.id), subPath);
      }
    }
  }
  
  try {
    const collections = await prodDb.listCollections();
    
    if (collections.length === 0) {
      console.log('No root collections found in the production database.');
    } else {
      for (const col of collections) {
        await syncCollection(col, localDb.collection(col.id), col.id);
      }
    }
    
    console.log('\n\x1b[32m%s\x1b[0m', `Success! Synchronized ${docCount} documents into the local emulator Firestore.`);
    console.log('You can now see the data in your emulator UI (usually at http://localhost:4000).');
    
  } catch (error) {
    console.error('\n\x1b[31m%s\x1b[0m', 'An error occurred during synchronization:');
    console.error(error);
    process.exit(1);
  }
}

main();
