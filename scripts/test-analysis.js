const fetch = require('node-fetch'); // You might need to install this if not present, or use built-in fetch in newer Node

// Mock payload mimicking the frontend request
const propertyId = 'PROP123'; // Replace with a valid ID if you have one, or mock DB logic
const backendUrl = 'http://localhost:3000';

async function testAnalysis() {
    console.log('Testing Analysis Endpoint...');
    try {
        // Note: This test requires the server to be running and valid data in DB.
        // If we don't have valid data, this might 404, but we can check if the route is reachable.

        // We'll try to reach health first
        const health = await fetch(`${backendUrl}/health`);
        console.log('Health Check:', health.status);

        // Now try analysis (might fail if no defects, but should not 404 route)
        // We are just checking if the route is registered and controller is hit.
        const res = await fetch(`${backendUrl}/property/${propertyId}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ property_id: propertyId })
        });

        console.log('Analysis Status:', res.status);
        const text = await res.text();
        console.log('Analysis Response:', text.substring(0, 200) + '...');

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testAnalysis();
