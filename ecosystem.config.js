module.exports = {
  apps: [
    {
      name: 'messmate-server',
      script: './server/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
