require('dotenv').config();
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

console.log('Testing ChatGoogleGenerativeAI instantiation...');
try {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('API Key present:', !!apiKey, 'Length:', apiKey ? apiKey.length : 0);

    const model = new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: 'gemini-pro',
        temperature: 0.3,
    });
    console.log('Instantiation successful!');
} catch (error) {
    console.error('Instantiation failed:', error);
}
