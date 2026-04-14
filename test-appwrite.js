require('dotenv').config({ path: '.env.local' });
const { Client, Databases, ID } = require('node-appwrite');
const client = new Client();
client.setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

async function test() {
  try {
    const res = await databases.createDocument(
      '69dd3854002de2030bc5', // database id
      'user_stats',           // collection id
      ID.unique(),
      {
        githubHandle: 'testuser',
        statsJson: '{}',
        lastSync: Date.now()
      }
    );
    console.log("Success:", res);
  } catch(e) {
    console.error("Error creating document:");
    console.error(e.message);
  }
}
test();
