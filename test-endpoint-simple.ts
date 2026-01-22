/**
 * Test simple de endpoint
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testEndpoint() {
  const url = 'https://www.verbadocpro.eu/api/export/consolidated';

  console.log('\n🧪 Testing endpoint:', url);
  console.log('Token length:', process.env.TEST_AUTH_TOKEN?.length || 0);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth-token=${process.env.TEST_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        extractionIds: [],
        format: 'excel'
      })
    });

    console.log('\n✅ Response received!');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('\nBody (first 500 chars):', text.substring(0, 500));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEndpoint();
