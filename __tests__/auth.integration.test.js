const request = require('supertest');
const { app, server } = require('../server'); // Import from our modified server.js
const mongoose = require('mongoose');

// Close the server and database connection after all tests are done
afterAll(async () => {
  await mongoose.disconnect();
  server.close();
});

describe('Authentication API', () => {
  it('should login a registered user and return a redirect with a token cookie', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'sehaj@gmail.com',
        password: '123456',
      })
      .expect(302); // Expect a redirect status code

    // Check that the 'token' cookie is set in the response headers
    const cookies = response.headers['set-cookie'];
    expect(cookies.some(cookie => cookie.startsWith('token='))).toBe(true);
  });

  it('should fail to login with incorrect credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'sehaj@gmail.com',
        password: 'password123',
      })
      .expect(400); // Expect a bad request status code
  });
});