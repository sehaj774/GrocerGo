module.exports = {
  apps: [
    {
      name: 'grocergo',
      script: 'server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable clustering
      watch: false, // Don't watch files in production
      env_production: {
        NODE_ENV: 'production',
        HTTPS_PORT: 3001 // Or your production port
      }
    }
  ]
};