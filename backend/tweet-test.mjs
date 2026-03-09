import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi({
  appKey:       process.env.X_API_KEY,
  appSecret:    process.env.X_API_SECRET,
  accessToken:  process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

// Step 1: verify credentials by reading own user profile
console.log('Verificando credenciales...');
try {
  const me = await client.currentUserV2();
  console.log('✅ Autenticado como:', me.data.username, '(id:', me.data.id + ')');
} catch (e) {
  console.error('❌ Fallo al leer perfil:', e.message, JSON.stringify(e.data));
  process.exit(1);
}

// Step 2: post tweet
console.log('Publicando tweet...');
const text = `\uD83C\uDF0D LiveWar3D is now LIVE \u2014 track military aircraft, warships & conflict alerts worldwide in real time.\n\nhttps://livewar3d.com\n\n#LiveWar3D #MilitaryTracking #BreakingNews`;
try {
  const r = await client.readWrite.v2.tweet(text);
  console.log('\u2705 Tweet enviado! ID:', r.data.id);
} catch (e) {
  console.error('\u274C Error al tweetear:', e.message);
  console.error('Data:', JSON.stringify(e.data, null, 2));
}

// Retry up to 5 times with 10s delay
for (let i = 1; i <= 5; i++) {
  try {
    console.log(`Intento ${i}/5...`);
    const r = await client.readWrite.v2.tweet(text);
    console.log('✅ Tweet enviado! ID:', r.data.id);
    break;
  } catch (e) {
    console.error(`❌ Error (${e.data?.status || e.message})`);
    if (i < 5) {
      console.log('Esperando 10s...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}
